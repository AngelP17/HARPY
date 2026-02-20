use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use harpy_core::types::HealthResponse;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::collections::HashMap;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
struct AppState {
    db_pool: PgPool,
    jwt_secret: String,
    enforce_auth: bool,
}

#[derive(Debug, Serialize)]
struct TemplateInfo {
    name: &'static str,
    description: &'static str,
    required_params: Vec<&'static str>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct GraphQueryRequest {
    template: String,
    #[serde(default)]
    params: HashMap<String, String>,
    page: Option<u32>,
    page_size: Option<u32>,
}

#[derive(Debug, Serialize)]
struct GraphQueryResponse {
    template: String,
    page: u32,
    page_size: u32,
    rows: Vec<Value>,
    next_page: Option<u32>,
}

#[derive(Debug, Deserialize)]
struct ExportRequest {
    query: GraphQueryRequest,
    watermark: Option<String>,
    expires_in_secs: Option<u64>,
}

#[derive(Debug, Serialize)]
struct ExportResponse {
    watermark: String,
    signed_export_jwt: String,
    row_count: usize,
    expires_in_secs: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct AccessClaims {
    sub: String,
    exp: usize,
    #[serde(default)]
    roles: Vec<String>,
    #[serde(default)]
    attrs: HashMap<String, String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SignedExportClaims {
    sub: String,
    exp: usize,
    actor: String,
    template: String,
    watermark: String,
    data: Value,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "harpy_graph=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let port = std::env::var("HTTP_PORT")
        .unwrap_or_else(|_| "8083".to_string())
        .parse::<u16>()?;

    let database_url = std::env::var("DATABASE_URL")
        .map_err(|_| anyhow::anyhow!("DATABASE_URL is required for harpy-graph"))?;

    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "dev-secret-change-in-production".to_string());
    let enforce_auth = std::env::var("ENFORCE_AUTH")
        .unwrap_or_else(|_| "false".to_string())
        .eq_ignore_ascii_case("true");

    let db_pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    let state = AppState {
        db_pool,
        jwt_secret,
        enforce_auth,
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/graph/templates", get(list_templates))
        .route("/graph/query", post(run_graph_query))
        .route("/graph/export", post(export_graph_query))
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!(%addr, "harpy-graph listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        service: "harpy-graph".to_string(),
    })
}

async fn list_templates() -> Json<Vec<TemplateInfo>> {
    Json(template_catalog())
}

async fn run_graph_query(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<GraphQueryRequest>,
) -> Result<Json<GraphQueryResponse>, (StatusCode, String)> {
    let claims = authorize_request(&headers, &state, "graph_query")?;
    ensure_has_any_role(&claims, &["analyst", "operator", "admin"])?;

    let response = execute_query_templates(&state.db_pool, &req)
        .await
        .map_err(internal_error)?;

    audit_log(
        &state.db_pool,
        "OPERATOR",
        &claims.sub,
        "graph_query",
        "GraphTemplate",
        &req.template,
        &json!({"params": req.params, "page": response.page, "page_size": response.page_size}),
    )
    .await
    .map_err(internal_error)?;

    Ok(Json(response))
}

async fn export_graph_query(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<ExportRequest>,
) -> Result<Json<ExportResponse>, (StatusCode, String)> {
    let claims = authorize_request(&headers, &state, "graph_export")?;
    ensure_has_any_role(&claims, &["exporter", "admin"])?;
    ensure_clearance(&claims, "secret")?;

    let response = execute_query_templates(&state.db_pool, &req.query)
        .await
        .map_err(internal_error)?;

    let watermark = req
        .watermark
        .unwrap_or_else(|| format!("HARPY-EXPORT:{}:{}", claims.sub, now_ms()));

    let expires_in_secs = req.expires_in_secs.unwrap_or(900).clamp(60, 86400);
    let expiration = (std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock drift")
        .as_secs()
        + expires_in_secs) as usize;

    let export_payload = json!({
        "query": {
            "template": response.template,
            "page": response.page,
            "page_size": response.page_size,
            "next_page": response.next_page,
        },
        "rows": response.rows,
    });

    let signed_claims = SignedExportClaims {
        sub: "harpy-graph-export".to_string(),
        exp: expiration,
        actor: claims.sub.clone(),
        template: req.query.template.clone(),
        watermark: watermark.clone(),
        data: export_payload,
    };

    let signed_export_jwt = encode(
        &Header::new(Algorithm::HS256),
        &signed_claims,
        &EncodingKey::from_secret(state.jwt_secret.as_bytes()),
    )
    .map_err(|error| internal_error(anyhow::anyhow!(error)))?;

    audit_log(
        &state.db_pool,
        "OPERATOR",
        &claims.sub,
        "graph_export_signed",
        "GraphTemplate",
        &req.query.template,
        &json!({"watermark": watermark, "rows": response.rows.len(), "expires_in_secs": expires_in_secs}),
    )
    .await
    .map_err(internal_error)?;

    Ok(Json(ExportResponse {
        watermark,
        signed_export_jwt,
        row_count: response.rows.len(),
        expires_in_secs,
    }))
}

async fn execute_query_templates(
    pool: &PgPool,
    req: &GraphQueryRequest,
) -> anyhow::Result<GraphQueryResponse> {
    let page = req.page.unwrap_or(1).max(1);
    let page_size = req.page_size.unwrap_or(50).clamp(1, 500);
    let offset = ((page - 1) * page_size) as i64;
    let limit = page_size as i64;

    let rows = match req.template.as_str() {
        "related_tracks" => {
            let track_id = required_param(&req.params, "track_id")?;
            fetch_json_rows(
                sqlx::query(
                    "SELECT row_to_json(t) AS row\
                     FROM (\
                         SELECT id, from_type, from_id, rel, to_type, to_id, ts_ms, meta\
                         FROM links\
                         WHERE (from_type = 'Track' AND from_id = $1)\
                            OR (to_type = 'Track' AND to_id = $1)\
                         ORDER BY ts_ms DESC\
                         LIMIT $2 OFFSET $3\
                     ) t",
                )
                .bind(track_id)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?,
            )
        }
        "alert_evidence_chain" => {
            let alert_id = required_param(&req.params, "alert_id")?;
            fetch_json_rows(
                sqlx::query(
                    "SELECT row_to_json(t) AS row\
                     FROM (\
                         SELECT l.id, l.from_type, l.from_id, l.rel, l.to_type, l.to_id, l.ts_ms, l.meta\
                         FROM alert_evidence ae\
                         JOIN links l ON l.id = ae.link_id\
                         WHERE ae.alert_id = $1\
                         ORDER BY l.ts_ms DESC\
                         LIMIT $2 OFFSET $3\
                     ) t",
                )
                .bind(alert_id)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?,
            )
        }
        "seen_by_sensor" => {
            let sensor_id = required_param(&req.params, "sensor_id")?;
            fetch_json_rows(
                sqlx::query(
                    "SELECT row_to_json(t) AS row\
                     FROM (\
                         SELECT id, from_type, from_id, rel, to_type, to_id, ts_ms, meta\
                         FROM links\
                         WHERE to_type = 'Sensor'\
                           AND to_id = $1\
                           AND rel IN ('observed_by', 'captured_by')\
                         ORDER BY ts_ms DESC\
                         LIMIT $2 OFFSET $3\
                     ) t",
                )
                .bind(sensor_id)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?,
            )
        }
        "track_timeline" => {
            let track_id = required_param(&req.params, "track_id")?;
            fetch_json_rows(
                sqlx::query(
                    "SELECT row_to_json(t) AS row\
                     FROM (\
                         SELECT track_id, lat, lon, alt, heading, speed, ts_ms, provider_id, meta\
                         FROM track_deltas\
                         WHERE track_id = $1\
                         ORDER BY ts_ms DESC\
                         LIMIT $2 OFFSET $3\
                     ) t",
                )
                .bind(track_id)
                .bind(limit)
                .bind(offset)
                .fetch_all(pool)
                .await?,
            )
        }
        unknown => {
            anyhow::bail!(
                "Template '{}' is not allowed. Use /graph/templates to list allowed templates.",
                unknown
            );
        }
    };

    let next_page = if rows.len() == page_size as usize {
        Some(page + 1)
    } else {
        None
    };

    Ok(GraphQueryResponse {
        template: req.template.clone(),
        page,
        page_size,
        rows,
        next_page,
    })
}

fn fetch_json_rows(rows: Vec<sqlx::postgres::PgRow>) -> Vec<Value> {
    rows.into_iter()
        .filter_map(|row| row.try_get::<Value, _>("row").ok())
        .collect()
}

fn required_param<'a>(params: &'a HashMap<String, String>, key: &str) -> anyhow::Result<&'a str> {
    params
        .get(key)
        .map(|value| value.as_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow::anyhow!("Missing required query param '{}'", key))
}

fn template_catalog() -> Vec<TemplateInfo> {
    vec![
        TemplateInfo {
            name: "related_tracks",
            description: "Find ontology links for a specific track",
            required_params: vec!["track_id"],
        },
        TemplateInfo {
            name: "alert_evidence_chain",
            description: "Fetch evidence links attached to an alert",
            required_params: vec!["alert_id"],
        },
        TemplateInfo {
            name: "seen_by_sensor",
            description: "Find entities observed or captured by a sensor",
            required_params: vec!["sensor_id"],
        },
        TemplateInfo {
            name: "track_timeline",
            description: "Get time-ordered track delta history",
            required_params: vec!["track_id"],
        },
    ]
}

fn authorize_request(
    headers: &HeaderMap,
    state: &AppState,
    action: &str,
) -> Result<AccessClaims, (StatusCode, String)> {
    if !state.enforce_auth {
        return Ok(AccessClaims {
            sub: "dev-operator".to_string(),
            exp: usize::MAX,
            roles: vec!["admin".to_string()],
            attrs: HashMap::new(),
        });
    }

    let claims = decode_bearer_claims(headers, &state.jwt_secret)?;
    if claims.exp
        < (std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .expect("system clock drift")
            .as_secs() as usize)
    {
        return Err((StatusCode::UNAUTHORIZED, "token expired".to_string()));
    }

    tracing::debug!(actor = %claims.sub, %action, "authorization passed");
    Ok(claims)
}

fn decode_bearer_claims(
    headers: &HeaderMap,
    secret: &str,
) -> Result<AccessClaims, (StatusCode, String)> {
    let Some(auth_header) = headers.get("authorization") else {
        return Err((
            StatusCode::UNAUTHORIZED,
            "missing authorization header".to_string(),
        ));
    };

    let auth_value = auth_header.to_str().map_err(|_| {
        (
            StatusCode::UNAUTHORIZED,
            "invalid authorization header".to_string(),
        )
    })?;

    let token = auth_value.strip_prefix("Bearer ").ok_or_else(|| {
        (
            StatusCode::UNAUTHORIZED,
            "authorization must use Bearer token".to_string(),
        )
    })?;

    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = false;

    decode::<AccessClaims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &validation,
    )
    .map(|token_data| token_data.claims)
    .map_err(|_| (StatusCode::UNAUTHORIZED, "invalid token".to_string()))
}

fn ensure_has_any_role(
    claims: &AccessClaims,
    allowed: &[&str],
) -> Result<(), (StatusCode, String)> {
    if claims
        .roles
        .iter()
        .any(|role| allowed.iter().any(|allowed_role| role == allowed_role))
    {
        Ok(())
    } else {
        Err((
            StatusCode::FORBIDDEN,
            format!("required role missing; expected one of {:?}", allowed),
        ))
    }
}

fn ensure_clearance(claims: &AccessClaims, required: &str) -> Result<(), (StatusCode, String)> {
    let current = claims
        .attrs
        .get("clearance")
        .map(String::as_str)
        .unwrap_or("none");
    if clearance_rank(current) >= clearance_rank(required) {
        Ok(())
    } else {
        Err((StatusCode::FORBIDDEN, "insufficient clearance".to_string()))
    }
}

fn clearance_rank(clearance: &str) -> u8 {
    match clearance {
        "top_secret" => 4,
        "secret" => 3,
        "confidential" => 2,
        "restricted" => 1,
        _ => 0,
    }
}

async fn audit_log(
    pool: &PgPool,
    actor_type: &str,
    actor_id: &str,
    action: &str,
    target_type: &str,
    target_id: &str,
    details: &Value,
) -> anyhow::Result<()> {
    sqlx::query(
        "INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, details, ts_ms)\
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind(actor_type)
    .bind(actor_id)
    .bind(action)
    .bind(target_type)
    .bind(target_id)
    .bind(details)
    .bind(now_ms())
    .execute(pool)
    .await?;

    Ok(())
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock drift")
        .as_millis() as i64
}

fn internal_error(error: anyhow::Error) -> (StatusCode, String) {
    tracing::error!(error = %error, "graph request failed");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        "internal server error".to_string(),
    )
}
