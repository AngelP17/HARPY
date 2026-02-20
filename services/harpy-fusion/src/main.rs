//! harpy-fusion: Fusion Rules Engine Service
//!
//! Implements convergence detection, anomaly detection, and pattern matching rules.
//! Publishes alerts and links to Redis for relay fanout.

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use dashmap::DashMap;
use h3o::{LatLng, Resolution};
use harpy_core::types::HealthResponse;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::Arc;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

mod rules;
mod redis_publisher;
mod redis_consumer;

use rules::{RuleEngine, RuleResult};
use redis_publisher::RedisPublisher;
use redis_consumer::RedisConsumer;

#[derive(Clone)]
struct AppState {
    db_pool: Option<PgPool>,
    redis_publisher: Option<RedisPublisher>,
    rule_engine: Arc<RuleEngine>,
    h3_resolution: u8,
    dedup_ttl_ms: i64,
    dedup_cache: Arc<DashMap<String, i64>>,
}

#[derive(Debug, Deserialize)]
struct FusionIngestRequest {
    tracks: Vec<TrackObservation>,
}

#[derive(Debug, Deserialize, Clone)]
struct TrackObservation {
    id: String,
    kind: String,
    lat: f64,
    lon: f64,
    alt: f64,
    heading: Option<f64>,
    speed: Option<f64>,
    ts_ms: i64,
    provider_id: String,
    #[serde(default)]
    meta: Value,
}

#[derive(Debug, Serialize, Clone)]
struct AlertUpsertRecord {
    id: String,
    severity: String,
    title: String,
    description: String,
    ts_ms: i64,
    status: String,
    evidence_link_ids: Vec<String>,
    meta: Value,
}

#[derive(Debug, Serialize, Clone)]
struct LinkUpsertRecord {
    id: String,
    from_type: String,
    from_id: String,
    rel: String,
    to_type: String,
    to_id: String,
    ts_ms: i64,
    meta: Value,
}

#[derive(Debug, Serialize)]
struct FusionIngestResponse {
    processed_tracks: usize,
    generated_alerts: usize,
    generated_links: usize,
    rules_triggered: Vec<String>,
}

#[derive(Debug, Serialize)]
struct FusionConfigResponse {
    h3_resolution: u8,
    dedup_ttl_ms: i64,
    persistence_enabled: bool,
    redis_enabled: bool,
    rules: Vec<String>,
}

#[derive(Debug, Serialize)]
struct RulesStatusResponse {
    rules: Vec<RuleStatus>,
}

#[derive(Debug, Serialize)]
struct RuleStatus {
    name: String,
    enabled: bool,
    trigger_count: u64,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "harpy_fusion=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let port = std::env::var("HTTP_PORT")
        .unwrap_or_else(|_| "8082".to_string())
        .parse::<u16>()?;

    let h3_resolution = std::env::var("FUSION_H3_RESOLUTION")
        .unwrap_or_else(|_| "8".to_string())
        .parse::<u8>()
        .unwrap_or(8)
        .clamp(0, 15);

    let dedup_ttl_ms = std::env::var("FUSION_ALERT_DEDUP_TTL_MS")
        .unwrap_or_else(|_| "300000".to_string())
        .parse::<i64>()
        .unwrap_or(300_000)
        .max(1_000);

    // Connect to database
    let db_pool = match std::env::var("DATABASE_URL") {
        Ok(url) => Some(
            PgPoolOptions::new()
                .max_connections(10)
                .connect(&url)
                .await?,
        ),
        Err(_) => {
            tracing::warn!("DATABASE_URL is not set; persistence disabled for harpy-fusion");
            None
        }
    };

    // Connect to Redis for alert publishing
    let redis_publisher = match std::env::var("REDIS_URL") {
        Ok(url) => match RedisPublisher::new(&url).await {
            Ok(pub_) => {
                tracing::info!("Connected to Redis for alert publishing");
                Some(pub_)
            }
            Err(e) => {
                tracing::warn!("Failed to connect to Redis: {}", e);
                None
            }
        },
        Err(_) => {
            tracing::warn!("REDIS_URL is not set; alert publishing disabled");
            None
        }
    };

    // Initialize rule engine with all rules
    let rule_engine = Arc::new(RuleEngine::new(h3_resolution));

    let state = AppState {
        db_pool,
        redis_publisher,
        rule_engine: rule_engine.clone(),
        h3_resolution,
        dedup_ttl_ms,
        dedup_cache: Arc::new(DashMap::new()),
    };

    // Clone for Redis consumer before moving into router
    let consumer_state = state.clone();
    let consumer_rule_engine = rule_engine.clone();

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/fusion/config", get(fusion_config))
        .route("/fusion/rules", get(rules_status))
        .route("/fusion/ingest", post(fusion_ingest))
        .with_state(state)
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!(%addr, "harpy-fusion listening");
    tracing::info!("Rules engine initialized with H3 resolution {}", h3_resolution);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    
    // Start Redis consumer for automatic track processing
    tokio::spawn(async move {
        if let Some(redis_url) = std::env::var("REDIS_URL").ok() {
            match RedisConsumer::new(&redis_url, consumer_state, consumer_rule_engine).await {
                Ok(consumer) => {
                    if let Err(e) = consumer.run().await {
                        tracing::error!("Redis consumer error: {}", e);
                    }
                }
                Err(e) => {
                    tracing::error!("Failed to create Redis consumer: {}", e);
                }
            }
        }
    });
    
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        service: "harpy-fusion".to_string(),
    })
}

async fn fusion_config(State(state): State<AppState>) -> Json<FusionConfigResponse> {
    Json(FusionConfigResponse {
        h3_resolution: state.h3_resolution,
        dedup_ttl_ms: state.dedup_ttl_ms,
        persistence_enabled: state.db_pool.is_some(),
        redis_enabled: state.redis_publisher.is_some(),
        rules: state.rule_engine.list_rules(),
    })
}

async fn rules_status(State(state): State<AppState>) -> Json<RulesStatusResponse> {
    Json(RulesStatusResponse {
        rules: state.rule_engine.get_rule_status(),
    })
}

async fn fusion_ingest(
    State(state): State<AppState>,
    Json(req): Json<FusionIngestRequest>,
) -> Result<Json<FusionIngestResponse>, (StatusCode, String)> {
    if req.tracks.is_empty() {
        return Ok(Json(FusionIngestResponse {
            processed_tracks: 0,
            generated_alerts: 0,
            generated_links: 0,
            rules_triggered: Vec::new(),
        }));
    }

    let now_ms = now_ms();
    gc_dedup_cache(&state, now_ms);

    // Group tracks by H3 cell for spatial indexing
    let mut cell_buckets: HashMap<String, Vec<TrackObservation>> = HashMap::new();
    for track in &req.tracks {
        match to_h3_cell(track.lat, track.lon, state.h3_resolution) {
            Ok(cell) => {
                cell_buckets.entry(cell).or_default().push(track.clone());
            }
            Err(error) => {
                tracing::warn!(track_id = %track.id, %error, "failed to compute H3 cell");
            }
        }
    }

    let mut all_alerts: Vec<AlertUpsertRecord> = Vec::new();
    let mut all_links: Vec<LinkUpsertRecord> = Vec::new();
    let mut rules_triggered: HashSet<String> = HashSet::new();

    // Run all rules against the tracks
    let rule_results = state.rule_engine.evaluate(&req.tracks, &cell_buckets, now_ms).await;

    for result in rule_results {
        match result {
            RuleResult::Alert { alert, links } => {
                // Check deduplication
                let dedup_key = format!("{}:{}", alert.title, alert.description);
                let should_skip = if let Some(last_seen) = state.dedup_cache.get(&dedup_key) {
                    now_ms - *last_seen < state.dedup_ttl_ms
                } else {
                    false
                };

                if should_skip {
                    continue;
                }
                state.dedup_cache.insert(dedup_key, now_ms);

                rules_triggered.insert(alert.meta.get("rule").and_then(|v| v.as_str()).unwrap_or("unknown").to_string());

                all_alerts.push(alert);
                all_links.extend(links);
            }
            RuleResult::Link(link) => {
                all_links.push(link);
            }
        }
    }

    // Publish alerts to Redis for relay fanout
    if let Some(ref publisher) = state.redis_publisher {
        for alert in &all_alerts {
            if let Err(e) = publisher.publish_alert(alert).await {
                tracing::warn!("Failed to publish alert to Redis: {}", e);
            }
        }
        for link in &all_links {
            if let Err(e) = publisher.publish_link(link).await {
                tracing::warn!("Failed to publish link to Redis: {}", e);
            }
        }
    }

    // Persist to database
    if !all_alerts.is_empty() {
        if let Some(pool) = &state.db_pool {
            if let Err(e) = persist_fusion_outputs(pool, &all_alerts, &all_links).await {
                tracing::error!("Failed to persist fusion outputs: {}", e);
            }
        }
    }

    Ok(Json(FusionIngestResponse {
        processed_tracks: req.tracks.len(),
        generated_alerts: all_alerts.len(),
        generated_links: all_links.len(),
        rules_triggered: rules_triggered.into_iter().collect(),
    }))
}

async fn persist_fusion_outputs(
    pool: &PgPool,
    alerts: &[AlertUpsertRecord],
    links: &[LinkUpsertRecord],
) -> anyhow::Result<()> {
    let mut tx = pool.begin().await?;

    for alert in alerts {
        sqlx::query(
            "INSERT INTO alerts (id, severity, title, description, ts_ms, status, meta)\
             VALUES ($1, $2, $3, $4, $5, $6, $7)\
             ON CONFLICT (id) DO UPDATE\
             SET severity = EXCLUDED.severity,\
                 title = EXCLUDED.title,\
                 description = EXCLUDED.description,\
                 ts_ms = EXCLUDED.ts_ms,\
                 status = EXCLUDED.status,\
                 meta = EXCLUDED.meta,\
                 updated_at = NOW()",
        )
        .bind(&alert.id)
        .bind(&alert.severity)
        .bind(&alert.title)
        .bind(&alert.description)
        .bind(alert.ts_ms)
        .bind(&alert.status)
        .bind(&alert.meta)
        .execute(tx.as_mut())
        .await?;

        for evidence_link_id in &alert.evidence_link_ids {
            sqlx::query(
                "INSERT INTO alert_evidence (alert_id, link_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(&alert.id)
            .bind(evidence_link_id)
            .execute(tx.as_mut())
            .await?;
        }

        // Audit log for alert generation
        sqlx::query(
            "INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, details, ts_ms)\
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind("SYSTEM")
        .bind("harpy-fusion")
        .bind("fusion_alert_generated")
        .bind("Alert")
        .bind(&alert.id)
        .bind(&alert.meta)
        .bind(alert.ts_ms)
        .execute(tx.as_mut())
        .await?;
    }

    for link in links {
        sqlx::query(
            "INSERT INTO links (id, from_type, from_id, rel, to_type, to_id, ts_ms, meta)\
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)\
             ON CONFLICT (id) DO UPDATE\
             SET ts_ms = EXCLUDED.ts_ms,\
                 meta = EXCLUDED.meta",
        )
        .bind(&link.id)
        .bind(&link.from_type)
        .bind(&link.from_id)
        .bind(&link.rel)
        .bind(&link.to_type)
        .bind(&link.to_id)
        .bind(link.ts_ms)
        .bind(&link.meta)
        .execute(tx.as_mut())
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

fn to_h3_cell(lat: f64, lon: f64, resolution: u8) -> anyhow::Result<String> {
    let lat_lng = LatLng::new(lat, lon)?;
    let res = Resolution::try_from(resolution)?;
    Ok(lat_lng.to_cell(res).to_string())
}

fn gc_dedup_cache(state: &AppState, now_ms: i64) {
    let stale_before = now_ms - (state.dedup_ttl_ms * 2);
    state.dedup_cache.retain(|_, ts| *ts >= stale_before);
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock drift")
        .as_millis() as i64
}

fn internal_error(error: anyhow::Error) -> (StatusCode, String) {
    tracing::error!(error = %error, "fusion request failed");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal server error".to_string(),
    )
}

impl IntoResponse for FusionIngestResponse {
    fn into_response(self) -> axum::response::Response {
        Json(self).into_response()
    }
}
