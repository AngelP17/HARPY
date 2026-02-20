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

#[derive(Clone)]
struct AppState {
    db_pool: Option<PgPool>,
    h3_resolution: u8,
    dedup_ttl_ms: i64,
    dedup_cache: Arc<DashMap<String, i64>>,
}

#[derive(Debug, Deserialize)]
struct FusionIngestRequest {
    tracks: Vec<TrackObservation>,
}

#[derive(Debug, Deserialize)]
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
    generated_alerts: Vec<AlertUpsertRecord>,
    generated_links: Vec<LinkUpsertRecord>,
}

#[derive(Debug, Serialize)]
struct FusionConfigResponse {
    h3_resolution: u8,
    dedup_ttl_ms: i64,
    persistence_enabled: bool,
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

    let state = AppState {
        db_pool,
        h3_resolution,
        dedup_ttl_ms,
        dedup_cache: Arc::new(DashMap::new()),
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/fusion/config", get(fusion_config))
        .route("/fusion/ingest", post(fusion_ingest))
        .with_state(state)
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!(%addr, "harpy-fusion listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
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
    })
}

async fn fusion_ingest(
    State(state): State<AppState>,
    Json(req): Json<FusionIngestRequest>,
) -> Result<Json<FusionIngestResponse>, (StatusCode, String)> {
    if req.tracks.is_empty() {
        return Ok(Json(FusionIngestResponse {
            processed_tracks: 0,
            generated_alerts: Vec::new(),
            generated_links: Vec::new(),
        }));
    }

    let now_ms = now_ms();
    gc_dedup_cache(&state, now_ms);

    let mut cell_buckets: HashMap<String, Vec<&TrackObservation>> = HashMap::new();
    for track in &req.tracks {
        match to_h3_cell(track.lat, track.lon, state.h3_resolution) {
            Ok(cell) => {
                cell_buckets.entry(cell).or_default().push(track);
            }
            Err(error) => {
                tracing::warn!(track_id = %track.id, %error, "failed to compute H3 cell");
            }
        }
    }

    let mut generated_alerts = Vec::new();
    let mut generated_links = Vec::new();

    for (cell, tracks) in cell_buckets {
        if tracks.len() < 2 {
            continue;
        }

        let provider_count = tracks
            .iter()
            .map(|track| track.provider_id.clone())
            .collect::<HashSet<_>>()
            .len();

        if provider_count < 2 {
            continue;
        }

        for i in 0..tracks.len() {
            for j in (i + 1)..tracks.len() {
                let first = tracks[i];
                let second = tracks[j];

                let dedup_key = pair_dedup_key(&cell, &first.id, &second.id);
                let should_skip = if let Some(last_seen) = state.dedup_cache.get(&dedup_key) {
                    now_ms - *last_seen < state.dedup_ttl_ms
                } else {
                    false
                };
                if should_skip {
                    continue;
                }
                state.dedup_cache.insert(dedup_key, now_ms);

                let link_association = LinkUpsertRecord {
                    id: Uuid::new_v4().to_string(),
                    from_type: "Track".to_string(),
                    from_id: first.id.clone(),
                    rel: "associated_with".to_string(),
                    to_type: "Track".to_string(),
                    to_id: second.id.clone(),
                    ts_ms: now_ms,
                    meta: json!({
                        "rule": "co_cell_convergence",
                        "cell": cell,
                        "h3_resolution": state.h3_resolution,
                        "providers": [first.provider_id.clone(), second.provider_id.clone()],
                        "track_kinds": [first.kind.clone(), second.kind.clone()],
                        "track_altitudes": [first.alt, second.alt],
                        "track_headings": [first.heading, second.heading],
                        "track_speeds": [first.speed, second.speed],
                        "track_timestamps": [first.ts_ms, second.ts_ms],
                        "track_meta": [first.meta.clone(), second.meta.clone()],
                    }),
                };

                let alert = AlertUpsertRecord {
                    id: Uuid::new_v4().to_string(),
                    severity: "MEDIUM".to_string(),
                    title: "Convergence detected".to_string(),
                    description: format!(
                        "Tracks {} and {} converged in H3 cell {}",
                        first.id, second.id, cell
                    ),
                    ts_ms: now_ms,
                    status: "ACTIVE".to_string(),
                    evidence_link_ids: vec![link_association.id.clone()],
                    meta: json!({
                        "rule": "h3_convergence_v1",
                        "cell": cell,
                        "h3_resolution": state.h3_resolution,
                        "provider_count": provider_count,
                        "dedup_ttl_ms": state.dedup_ttl_ms,
                    }),
                };

                let alert_evidence = LinkUpsertRecord {
                    id: Uuid::new_v4().to_string(),
                    from_type: "Alert".to_string(),
                    from_id: alert.id.clone(),
                    rel: "is_evidenced_by".to_string(),
                    to_type: "Track".to_string(),
                    to_id: first.id.clone(),
                    ts_ms: now_ms,
                    meta: json!({ "source_link_id": link_association.id }),
                };

                generated_links.push(link_association.clone());
                generated_links.push(alert_evidence.clone());
                generated_alerts.push(alert);
            }
        }
    }

    if !generated_alerts.is_empty() {
        if let Some(pool) = &state.db_pool {
            persist_fusion_outputs(pool, &generated_alerts, &generated_links)
                .await
                .map_err(internal_error)?;
        }
    }

    Ok(Json(FusionIngestResponse {
        processed_tracks: req.tracks.len(),
        generated_alerts,
        generated_links,
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

fn pair_dedup_key(cell: &str, first_track_id: &str, second_track_id: &str) -> String {
    if first_track_id <= second_track_id {
        format!("{}|{}|{}", cell, first_track_id, second_track_id)
    } else {
        format!("{}|{}|{}", cell, second_track_id, first_track_id)
    }
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
