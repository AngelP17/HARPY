mod adapters;
mod snapshot;
mod storage;

use axum::{routing::get, Json, Router};
use harpy_core::types::HealthResponse;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use adapters::{
    adsb_mock::AdsbMockProvider, adsb_opensky::OpenSkyProvider, radar_nexrad::NexradRadarProvider,
    seismic_usgs::UsgsSeismicProvider, tle_celestrak::CelesTrakProvider, tle_mock::TleMockProvider,
    weather_nws::NwsWeatherProvider, Provider,
};
use snapshot::model::{SnapshotMetadata, Viewport, DEFAULT_SNAPSHOT_INTERVAL_SECS};
use storage::{PostgresStore, RedisStore};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "harpy_ingest=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    // Get port from environment or use default
    let port = std::env::var("HTTP_PORT")
        .unwrap_or_else(|_| "8081".to_string())
        .parse::<u16>()?;

    // Build router
    let app = Router::new()
        .route("/health", get(health_check))
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("harpy-ingest listening on {}", addr);

    // Initialize storage
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://harpy:harpy@localhost:5432/harpy".to_string());

    let redis_store = match RedisStore::new(&redis_url).await {
        Ok(store) => {
            tracing::info!("Connected to Redis at {}", redis_url);
            Some(store)
        }
        Err(e) => {
            tracing::warn!(
                "Failed to connect to Redis: {}. Continuing without Redis.",
                e
            );
            None
        }
    };

    let postgres_store = match PostgresStore::new(&database_url).await {
        Ok(store) => {
            tracing::info!("Connected to Postgres at {}", database_url);
            Some(store)
        }
        Err(e) => {
            tracing::warn!(
                "Failed to connect to Postgres: {}. Continuing without Postgres.",
                e
            );
            None
        }
    };

    // Start server
    let server_handle = tokio::spawn(async move {
        let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
        axum::serve(listener, app).await.unwrap();
    });

    // Start provider polling loops
    let (adsb_provider, adsb_interval_secs) = select_adsb_provider();
    let (tle_provider, tle_interval_secs) = select_tle_provider();
    let seismic_provider = select_seismic_provider();
    let weather_provider = select_weather_provider();
    let radar_provider = select_radar_provider();

    let adsb_handle = tokio::spawn(poll_provider(
        adsb_provider,
        adsb_interval_secs,
        redis_store.clone(),
        postgres_store.clone(),
    ));
    let tle_handle = tokio::spawn(poll_provider(
        tle_provider,
        tle_interval_secs,
        redis_store.clone(),
        postgres_store.clone(),
    ));
    let redis_for_seismic = redis_store.clone();
    let postgres_for_seismic = postgres_store.clone();
    let seismic_handle = tokio::spawn(async move {
        if let Some((provider, interval_secs)) = seismic_provider {
            poll_provider(
                provider,
                interval_secs,
                redis_for_seismic,
                postgres_for_seismic,
            )
            .await;
        } else {
            futures::future::pending::<()>().await;
        }
    });
    let redis_for_weather = redis_store.clone();
    let postgres_for_weather = postgres_store.clone();
    let weather_handle = tokio::spawn(async move {
        if let Some((provider, interval_secs)) = weather_provider {
            poll_provider(
                provider,
                interval_secs,
                redis_for_weather,
                postgres_for_weather,
            )
            .await;
        } else {
            futures::future::pending::<()>().await;
        }
    });
    let redis_for_radar = redis_store.clone();
    let postgres_for_radar = postgres_store.clone();
    let radar_handle = tokio::spawn(async move {
        if let Some((provider, interval_secs)) = radar_provider {
            poll_provider(provider, interval_secs, redis_for_radar, postgres_for_radar).await;
        } else {
            futures::future::pending::<()>().await;
        }
    });

    // Start periodic snapshot creation job (B2-2)
    let snapshot_handle = tokio::spawn(snapshot_creation_job(postgres_store));

    // Wait for all tasks
    tokio::select! {
        _ = server_handle => {},
        _ = adsb_handle => {},
        _ = tle_handle => {},
        _ = seismic_handle => {},
        _ = weather_handle => {},
        _ = radar_handle => {},
        _ = snapshot_handle => {},
    }

    Ok(())
}

async fn poll_provider(
    provider: Arc<dyn Provider>,
    interval_secs: u64,
    mut redis_store: Option<RedisStore>,
    postgres_store: Option<PostgresStore>,
) {
    let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));
    let mut consecutive_failures: u32 = 0;
    tracing::info!(
        "Starting provider poll loop: provider={} interval_secs={}",
        provider.provider_id(),
        interval_secs
    );

    loop {
        interval.tick().await;
        match provider.fetch().await {
            Ok(tracks) => {
                consecutive_failures = 0;
                tracing::info!(
                    "Fetched {} tracks from {}",
                    tracks.len(),
                    provider.provider_id()
                );

                // Store in Redis
                if let Some(ref mut redis) = redis_store {
                    if let Err(e) = redis.store_tracks(&tracks).await {
                        tracing::error!("Failed to store tracks in Redis: {}", e);
                    }
                    if let Err(e) = redis.publish_track_batch(&tracks).await {
                        tracing::error!("Failed to publish tracks to Redis: {}", e);
                    }
                    if let Err(e) = redis
                        .update_provider_status(
                            provider.provider_id(),
                            "CIRCUIT_STATE_CLOSED",
                            "FRESHNESS_FRESH",
                            true,
                        )
                        .await
                    {
                        tracing::error!("Failed to update provider status: {}", e);
                    }
                }

                // Store in Postgres
                if let Some(ref postgres) = postgres_store {
                    if let Err(e) = postgres.upsert_tracks(&tracks).await {
                        tracing::error!("Failed to upsert tracks in Postgres: {}", e);
                    }
                    if let Err(e) = postgres.store_track_deltas(&tracks).await {
                        tracing::error!("Failed to store track deltas in Postgres: {}", e);
                    }
                }
            }
            Err(e) => {
                consecutive_failures = consecutive_failures.saturating_add(1);
                tracing::error!("Provider error from {}: {}", provider.provider_id(), e);

                // Update provider status to indicate failure
                if let Some(ref mut redis) = redis_store {
                    let _ = redis
                        .update_provider_status(
                            provider.provider_id(),
                            "CIRCUIT_STATE_OPEN",
                            "FRESHNESS_CRITICAL",
                            false,
                        )
                        .await;
                }

                // Progressive backoff protects upstream APIs from tight retry loops.
                let backoff_secs =
                    (5_u64.saturating_mul(1_u64 << consecutive_failures.min(6))).min(1800);
                tracing::warn!(
                    "Backing off provider {} for {}s after {} consecutive failures",
                    provider.provider_id(),
                    backoff_secs,
                    consecutive_failures
                );
                tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
            }
        }
    }
}

fn select_adsb_provider() -> (Arc<dyn Provider>, u64) {
    let use_real = env_bool("ENABLE_REAL_ADSB", false);
    if use_real {
        match OpenSkyProvider::from_env() {
            Ok(provider) => {
                let mut interval = env_u64("ADSB_POLL_INTERVAL_SECS", 15);
                if provider.is_anonymous() {
                    // OpenSky anonymous mode is heavily constrained (10s buckets, daily credits).
                    // Use a conservative minimum to avoid exhausting the 400/day budget.
                    let anon_min_interval = env_u64("OPENSKY_ANON_MIN_INTERVAL_SECS", 300);
                    if interval < anon_min_interval {
                        tracing::warn!(
                            "OpenSky anonymous mode detected; raising ADSB_POLL_INTERVAL_SECS from {}s to {}s",
                            interval
                            ,
                            anon_min_interval
                        );
                        interval = anon_min_interval;
                    }
                    tracing::warn!(
                        "Using OpenSky anonymous mode (no OPENSKY_CLIENT_ID/OPENSKY_CLIENT_SECRET): \
                         current-time only, 10-second resolution, ~400 credits/day"
                    );
                } else {
                    tracing::info!("Using real ADS-B provider: OpenSky (OAuth client credentials)");
                }
                return (Arc::new(provider), interval);
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to initialize OpenSky provider: {}. Falling back to mock.",
                    e
                );
            }
        }
    }

    tracing::info!("Using mock ADS-B provider");
    (
        Arc::new(AdsbMockProvider::new()),
        env_u64("ADSB_POLL_INTERVAL_SECS", 5),
    )
}

fn select_tle_provider() -> (Arc<dyn Provider>, u64) {
    let use_real = env_bool("ENABLE_REAL_TLE", false);
    if use_real {
        match CelesTrakProvider::from_env() {
            Ok(provider) => {
                tracing::info!("Using real TLE provider: CelesTrak");
                let interval = env_u64("TLE_POLL_INTERVAL_SECS", 7200);
                return (Arc::new(provider), interval);
            }
            Err(e) => {
                tracing::warn!(
                    "Failed to initialize CelesTrak provider: {}. Falling back to mock.",
                    e
                );
            }
        }
    }

    tracing::info!("Using mock TLE provider");
    (
        Arc::new(TleMockProvider::new()),
        env_u64("TLE_POLL_INTERVAL_SECS", 60),
    )
}

fn select_seismic_provider() -> Option<(Arc<dyn Provider>, u64)> {
    if !env_bool("ENABLE_REAL_SEISMIC", false) {
        tracing::info!("USGS seismic provider disabled");
        return None;
    }

    match UsgsSeismicProvider::from_env() {
        Ok(provider) => {
            tracing::info!("Using real seismic provider: USGS earthquake API");
            Some((
                Arc::new(provider),
                env_u64("SEISMIC_POLL_INTERVAL_SECS", 300),
            ))
        }
        Err(e) => {
            tracing::warn!(
                "Failed to initialize USGS provider: {}. Disabling seismic provider.",
                e
            );
            None
        }
    }
}

fn select_weather_provider() -> Option<(Arc<dyn Provider>, u64)> {
    if !env_bool("ENABLE_REAL_WEATHER_NWS", false) {
        tracing::info!("NWS weather provider disabled");
        return None;
    }

    match NwsWeatherProvider::from_env() {
        Ok(provider) => {
            tracing::info!("Using real weather provider: NWS");
            Some((
                Arc::new(provider),
                env_u64("WEATHER_POLL_INTERVAL_SECS", 300),
            ))
        }
        Err(e) => {
            tracing::warn!(
                "Failed to initialize NWS weather provider: {}. Disabling weather provider.",
                e
            );
            None
        }
    }
}

fn select_radar_provider() -> Option<(Arc<dyn Provider>, u64)> {
    if !env_bool("ENABLE_REAL_RADAR_NEXRAD", false) {
        tracing::info!("NEXRAD radar provider disabled");
        return None;
    }

    match NexradRadarProvider::from_env() {
        Ok(provider) => {
            tracing::info!("Using real radar provider: NEXRAD Level II");
            Some((
                Arc::new(provider),
                env_u64("NEXRAD_POLL_INTERVAL_SECS", 300),
            ))
        }
        Err(e) => {
            tracing::warn!(
                "Failed to initialize NEXRAD radar provider: {}. Disabling radar provider.",
                e
            );
            None
        }
    }
}

fn env_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(default)
}

fn env_bool(name: &str, default: bool) -> bool {
    match std::env::var(name) {
        Ok(v) => matches!(
            v.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => default,
    }
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        service: "harpy-ingest".to_string(),
    })
}

/// Periodic snapshot creation job (B2-2)
async fn snapshot_creation_job(postgres_store: Option<PostgresStore>) {
    let interval_secs = std::env::var("SNAPSHOT_INTERVAL_SECS")
        .unwrap_or_else(|_| DEFAULT_SNAPSHOT_INTERVAL_SECS.to_string())
        .parse::<u64>()
        .unwrap_or(DEFAULT_SNAPSHOT_INTERVAL_SECS);

    let mut interval = tokio::time::interval(Duration::from_secs(interval_secs));

    tracing::info!(
        "Starting periodic snapshot creation job (every {} seconds)",
        interval_secs
    );

    loop {
        interval.tick().await;

        let Some(ref postgres) = postgres_store else {
            tracing::debug!("Skipping snapshot creation - no Postgres connection");
            continue;
        };

        match create_snapshot(postgres).await {
            Ok(snapshot_id) => {
                tracing::info!("Created snapshot: {}", snapshot_id);
            }
            Err(e) => {
                tracing::error!("Failed to create snapshot: {}", e);
            }
        }
    }
}

/// Create a snapshot of current track state
async fn create_snapshot(postgres: &PostgresStore) -> anyhow::Result<String> {
    use sqlx::Row;
    use uuid::Uuid;

    let snapshot_id = format!("snap-{}", Uuid::new_v4().simple());
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_millis() as u64;

    // Get snapshot window (last interval)
    let interval_ms = DEFAULT_SNAPSHOT_INTERVAL_SECS * 1000;
    let start_ts_ms = now_ms.saturating_sub(interval_ms);
    let end_ts_ms = now_ms;

    // Query current tracks from database
    let tracks = sqlx::query(
        r#"
        SELECT id, kind, lat, lon, alt, heading, speed, ts_ms, provider_id, meta
        FROM tracks
        WHERE ts_ms >= $1 AND ts_ms <= $2
        "#,
    )
    .bind(start_ts_ms as i64)
    .bind(end_ts_ms as i64)
    .fetch_all(&postgres.pool)
    .await?;

    let track_count = tracks.len();

    if track_count == 0 {
        tracing::debug!("No tracks to snapshot in time window");
        return Ok(snapshot_id);
    }

    // Create snapshot metadata
    let metadata = SnapshotMetadata::new(
        snapshot_id.clone(),
        start_ts_ms,
        end_ts_ms,
        format!("snapshots/{}", snapshot_id),
        "local".to_string(), // TODO: Use configured storage backend
    )
    .with_viewport(Viewport::world())
    .with_meta("format_version", "1.0.0")
    .with_meta("created_by", "harpy-ingest")
    .with_track_count(track_count);

    // Insert snapshot metadata into database
    sqlx::query(
        r#"
        INSERT INTO snapshots (id, start_ts_ms, end_ts_ms, track_count, compressed_size_bytes, storage_path, storage_backend, meta)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#
    )
    .bind(&metadata.id)
    .bind(metadata.start_ts_ms as i64)
    .bind(metadata.end_ts_ms as i64)
    .bind(metadata.track_count as i32)
    .bind(metadata.compressed_size_bytes as i64)
    .bind(&metadata.storage_path)
    .bind(&metadata.storage_backend)
    .bind(sqlx::types::Json(&metadata.meta))
    .execute(&postgres.pool)
    .await?;

    // Insert track membership records
    for row in tracks {
        let track_id: String = row.get("id");
        let track_kind: String = row.get("kind");
        let track_ts_ms: i64 = row.get("ts_ms");

        sqlx::query(
            r#"
            INSERT INTO snapshot_tracks (snapshot_id, track_id, track_kind, first_ts_ms, last_ts_ms, position_count)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#
        )
        .bind(&snapshot_id)
        .bind(&track_id)
        .bind(&track_kind)
        .bind(track_ts_ms)
        .bind(track_ts_ms)
        .bind(1i32)
        .execute(&postgres.pool)
        .await?;
    }

    tracing::info!(
        "Created snapshot {} with {} tracks ({} - {})",
        snapshot_id,
        track_count,
        start_ts_ms,
        end_ts_ms
    );

    Ok(snapshot_id)
}
