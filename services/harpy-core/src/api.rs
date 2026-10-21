//! Read-only HTTP API. There are no write routes: ingestion is internal, uploads don't exist in v0.1.

use crate::db::Store;
use crate::export::{self, Builder, DeploymentInfo};
use crate::providers::celestrak;
use crate::{now_ms, orbit};
use axum::extract::{Path as AxPath, Query, State};
use axum::http::{header, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use axum::{Json, Router};
use metrics_exporter_prometheus::PrometheusHandle;
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tower::ServiceBuilder;
use tower_http::compression::CompressionLayer;
use tower_http::services::ServeDir;
use tower_http::set_header::SetResponseHeaderLayer;
use tower_http::trace::TraceLayer;

#[derive(Clone)]
pub struct AppState {
    pub db_path: Arc<PathBuf>,
    pub deploy: Arc<DeploymentInfo>,
    pub metrics: Option<PrometheusHandle>,
}

pub fn router(state: AppState, web_dir: Option<PathBuf>) -> Router {
    let api = Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
        .route("/metrics", get(metrics))
        .route("/data/v1/{*path}", get(data_doc))
        .route("/api/v1/observations/{id}/history", get(history))
        .route("/api/v1/satellites/{norad}/position", get(position))
        .with_state(state);

    let mut app = api;
    if let Some(dir) = web_dir {
        app = app.fallback_service(ServeDir::new(dir).append_index_html_on_directories(true));
    }
    app.layer(
        ServiceBuilder::new()
            .layer(TraceLayer::new_for_http())
            .layer(SetResponseHeaderLayer::overriding(
                header::X_CONTENT_TYPE_OPTIONS,
                HeaderValue::from_static("nosniff"),
            ))
            .layer(SetResponseHeaderLayer::overriding(
                header::REFERRER_POLICY,
                HeaderValue::from_static("strict-origin-when-cross-origin"),
            ))
            .layer(CompressionLayer::new())
            .layer(tower::limit::ConcurrencyLimitLayer::new(256)),
    )
}

struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        tracing::error!(error = %e, "request failed");
        ApiError(StatusCode::INTERNAL_SERVER_ERROR, "internal error".into())
    }
}

async fn with_store<T: Send + 'static>(
    state: &AppState,
    f: impl FnOnce(&Store) -> anyhow::Result<T> + Send + 'static,
) -> Result<T, ApiError> {
    let path = state.db_path.clone();
    let fut = tokio::task::spawn_blocking(move || {
        let store = Store::open_read_only(path.as_path())?;
        f(&store)
    });
    match tokio::time::timeout(Duration::from_secs(10), fut).await {
        Ok(Ok(r)) => r.map_err(ApiError::from),
        Ok(Err(join)) => Err(anyhow::anyhow!("worker panicked: {join}").into()),
        Err(_) => Err(ApiError(
            StatusCode::GATEWAY_TIMEOUT,
            "query timed out".into(),
        )),
    }
}

fn json_doc(v: Value) -> Response {
    let mut r = Json(v).into_response();
    r.headers_mut()
        .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-cache"));
    r
}

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok", "service": "harpy-core", "version": env!("CARGO_PKG_VERSION") }))
}

/// Ready = database readable and integrity check passes. Provider outages do not make the
/// service unready: serving an honest "source unavailable" is correct behaviour.
async fn ready(State(state): State<AppState>) -> Result<Response, ApiError> {
    let integrity = with_store(&state, |s| s.integrity_check()).await?;
    let ok = integrity == "ok";
    let code = if ok {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };
    Ok((code, Json(json!({ "ready": ok, "integrity": integrity }))).into_response())
}

async fn metrics(State(state): State<AppState>) -> Response {
    match &state.metrics {
        Some(h) => (
            [(header::CONTENT_TYPE, "text/plain; version=0.0.4")],
            h.render(),
        )
            .into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

async fn data_doc(
    State(state): State<AppState>,
    AxPath(path): AxPath<String>,
) -> Result<Response, ApiError> {
    let deploy = state.deploy.clone();
    let path_owned = path.clone();
    let doc = with_store(&state, move |store| {
        let b = Builder {
            store,
            now: now_ms(),
            deploy: &deploy,
        };
        let p = path_owned.as_str();
        let day = |prefix: &str| -> Option<chrono::NaiveDate> {
            p.strip_prefix(prefix)
                .and_then(|r| r.strip_suffix(".json"))
                .and_then(|d| export::parse_day(d).ok())
        };
        Ok(Some(match p {
            "meta.json" => b.meta()?,
            "providers.json" => b.providers()?,
            "fetch-log.json" => b.fetch_log()?,
            "earthquakes/index.json" => b.earthquake_index()?,
            "satellites/latest.json" => b.satellites_latest()?,
            "satellites/index.json" => b.satellites_index()?,
            _ => {
                if let Some(d) = day("earthquakes/day/") {
                    b.earthquake_day(d)?
                } else if let Some(d) = day("satellites/day/") {
                    b.satellites_day(d)?
                } else {
                    return Ok(None);
                }
            }
        }))
    })
    .await?;
    match doc {
        Some(v) => Ok(json_doc(v)),
        None => Err(ApiError(
            StatusCode::NOT_FOUND,
            format!("no document {path}"),
        )),
    }
}

async fn history(
    State(state): State<AppState>,
    AxPath(id): AxPath<String>,
) -> Result<Response, ApiError> {
    if id.len() > 128 {
        return Err(ApiError(StatusCode::BAD_REQUEST, "id too long".into()));
    }
    let id2 = id.clone();
    let revisions = with_store(&state, move |s| {
        let revs = s.history(&id2)?;
        let mut out = vec![];
        for r in revs {
            let raw = s.raw_record(&r.raw_payload_digest)?;
            let mut v = serde_json::to_value(&r)?;
            v["raw_record"] = raw.unwrap_or(Value::Null);
            out.push(v);
        }
        Ok(out)
    })
    .await?;
    if revisions.is_empty() {
        return Err(ApiError(
            StatusCode::NOT_FOUND,
            format!("no observation {id}"),
        ));
    }
    Ok(json_doc(
        json!({ "observation_id": id, "revisions": revisions }),
    ))
}

#[derive(Deserialize)]
struct PositionQuery {
    t: Option<i64>,
}

/// A calculated observation: SGP4 position of `norad` at `t` from the nearest stored element set.
async fn position(
    State(state): State<AppState>,
    AxPath(norad): AxPath<u64>,
    Query(q): Query<PositionQuery>,
) -> Result<Response, ApiError> {
    let at = q.t.unwrap_or_else(now_ms);
    let id = format!("{}:{}", celestrak::SOURCE_ID, norad);
    let revisions = with_store(&state, move |s| s.history(&id)).await?;
    let max_offset = 3 * 86_400_000;
    let best = revisions
        .iter()
        .min_by_key(|r| (r.observed_at - at).abs())
        .filter(|r| (r.observed_at - at).abs() <= max_offset);
    let Some(el_obs) = best else {
        return Ok(json_doc(json!({
            "display_state": "INSUFFICIENT_EVIDENCE",
            "reason": "no stored element set within 3 days of the requested time",
            "norad_id": norad, "t": at,
        })));
    };
    let omm = el_obs.attributes.get("omm").cloned().unwrap_or(Value::Null);
    let elements: sgp4::Elements = serde_json::from_value(omm).map_err(|e| anyhow::anyhow!(e))?;
    let p = orbit::propagate(&elements, at)?;
    Ok(json_doc(json!({
        "display_state": "CALCULATED",
        "observation_type": "calculated",
        "kind": "satellite_position",
        "source_id": "harpy-sgp4",
        "observed_at": at,
        "geometry": {"type": "Point", "coordinates": [p.geodetic.lon_deg, p.geodetic.lat_deg, p.geodetic.alt_km * 1000.0]},
        "evidence_refs": [format!("{}@{}", el_obs.observation_id, el_obs.revision)],
        "attributes": {
            "element_epoch": el_obs.observed_at,
            "minutes_since_epoch": p.minutes_since_epoch,
            "speed_km_s": p.speed_km_s,
            "frame_note": "TEME rotated by IAU-82 GMST; polar motion ignored",
        },
    })))
}
