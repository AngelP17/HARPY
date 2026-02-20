//! harpy-graph: Graph Query API Service
//!
//! Provides pre-approved query templates for graph traversal and entity relationships.
//! All queries are audited for security and compliance.

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use harpy_core::types::HealthResponse;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::collections::HashSet;
use std::hash::{Hash, Hasher};
use std::net::SocketAddr;
use std::time::{SystemTime, UNIX_EPOCH};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod queries;

use queries::{QueryEngine, QueryResult};

#[derive(Clone)]
struct AppState {
    db_pool: PgPool,
    query_engine: QueryEngine,
    export_jwt_secret: String,
}

#[derive(Debug, Deserialize, Clone)]
struct GraphQueryRequest {
    template: String,
    #[serde(default)]
    params: Value,
    page: Option<i64>,
    per_page: Option<i64>,
    page_size: Option<i64>,
}

impl GraphQueryRequest {
    fn normalized_page(&self) -> i64 {
        self.page.unwrap_or(1).max(1)
    }

    fn normalized_per_page(&self, max_default: i64) -> i64 {
        self.per_page
            .or(self.page_size)
            .unwrap_or(max_default)
            .clamp(1, max_default)
    }
}

#[derive(Debug, Deserialize)]
struct GraphExportRequest {
    query: GraphQueryRequest,
    watermark: String,
    expires_in_secs: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct GraphExportVerifyRequest {
    token: String,
}

#[derive(Debug, Serialize)]
struct GraphQueryResponse {
    template: String,
    results: Vec<Value>,
    pagination: PaginationInfo,
    execution_time_ms: u64,
}

#[derive(Debug, Serialize)]
struct GraphExportResponse {
    signed_export_jwt: String,
    expires_at_ts_ms: i64,
    result_count: i64,
}

#[derive(Debug, Serialize)]
struct GraphExportVerifyResponse {
    valid: bool,
    claims: Option<ExportJwtClaims>,
}

#[derive(Debug, Serialize)]
struct PaginationInfo {
    page: i64,
    per_page: i64,
    total: i64,
    has_more: bool,
}

#[derive(Debug, Serialize)]
struct TemplatesResponse {
    templates: Vec<TemplateInfo>,
}

#[derive(Debug, Serialize)]
struct TemplateInfo {
    name: String,
    description: String,
    params: Vec<ParamInfo>,
}

#[derive(Debug, Serialize)]
struct ParamInfo {
    name: String,
    param_type: String,
    required: bool,
    description: String,
}

#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
    details: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ActorRole {
    Viewer,
    Operator,
    Admin,
}

impl ActorRole {
    fn from_header(value: Option<&str>) -> Self {
        match value.unwrap_or("VIEWER").to_ascii_uppercase().as_str() {
            "ADMIN" => Self::Admin,
            "OPERATOR" => Self::Operator,
            _ => Self::Viewer,
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            Self::Viewer => "VIEWER",
            Self::Operator => "OPERATOR",
            Self::Admin => "ADMIN",
        }
    }
}

#[derive(Debug, Clone)]
struct ActorContext {
    actor_id: String,
    role: ActorRole,
    scopes: HashSet<String>,
    attrs: Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct ExportJwtClaims {
    iss: String,
    sub: String,
    role: String,
    template: String,
    query_fingerprint: String,
    watermark: String,
    result_count: i64,
    iat: usize,
    nbf: usize,
    exp: usize,
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
        .unwrap_or_else(|_| "postgres://harpy:harpy@localhost:5432/harpy".to_string());

    let export_jwt_secret = std::env::var("EXPORT_JWT_SECRET")
        .unwrap_or_else(|_| "harpy-dev-export-secret-change-me".to_string());

    let db_pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    tracing::info!("Connected to database");

    let query_engine = QueryEngine::new();
    let state = AppState {
        db_pool,
        query_engine,
        export_jwt_secret,
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/graph/templates", get(list_templates))
        .route("/graph/query", post(graph_query))
        .route("/graph/export", post(graph_export))
        .route("/graph/export/verify", post(graph_export_verify))
        .with_state(state)
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

async fn list_templates(State(state): State<AppState>) -> Json<TemplatesResponse> {
    Json(TemplatesResponse {
        templates: state.query_engine.list_templates(),
    })
}

async fn graph_query(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<GraphQueryRequest>,
) -> Result<Json<GraphQueryResponse>, (StatusCode, Json<ErrorResponse>)> {
    let start_time = std::time::Instant::now();
    let actor = parse_actor_context(&headers);

    if !state.query_engine.is_valid_template(&req.template) {
        return Err(error_response(
            StatusCode::BAD_REQUEST,
            "Invalid template",
            Some(format!("Template '{}' not found", req.template)),
        ));
    }

    if let Err(reason) = authorize_graph_query(&actor, &req.template, &req.params, false) {
        return Err(error_response(
            StatusCode::FORBIDDEN,
            "Access denied",
            Some(reason),
        ));
    }

    let page = req.normalized_page();
    let per_page = req.normalized_per_page(100);
    let offset = (page - 1) * per_page;

    match state
        .query_engine
        .execute(&state.db_pool, &req.template, &req.params, per_page, offset)
        .await
    {
        Ok(QueryResult { rows, total }) => {
            let execution_time_ms = start_time.elapsed().as_millis() as u64;
            if let Err(e) = audit_log_query(
                &state.db_pool,
                &actor,
                "graph_query",
                &req.template,
                &req.params,
                rows.len() as i64,
            )
            .await
            {
                tracing::warn!("Failed to write graph query audit log: {}", e);
            }

            Ok(Json(GraphQueryResponse {
                template: req.template,
                results: rows,
                pagination: PaginationInfo {
                    page,
                    per_page,
                    total,
                    has_more: total >= 0 && (page * per_page) < total,
                },
                execution_time_ms,
            }))
        }
        Err(e) => Err(error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Query execution failed",
            Some(e.to_string()),
        )),
    }
}

async fn graph_export(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<GraphExportRequest>,
) -> Result<Json<GraphExportResponse>, (StatusCode, Json<ErrorResponse>)> {
    let actor = parse_actor_context(&headers);
    let query = req.query;

    if !state.query_engine.is_valid_template(&query.template) {
        return Err(error_response(
            StatusCode::BAD_REQUEST,
            "Invalid template",
            Some(format!("Template '{}' not found", query.template)),
        ));
    }

    if let Err(reason) = authorize_graph_query(&actor, &query.template, &query.params, true) {
        return Err(error_response(
            StatusCode::FORBIDDEN,
            "Access denied",
            Some(reason),
        ));
    }

    let page = query.normalized_page();
    let per_page = query.normalized_per_page(200);
    let offset = (page - 1) * per_page;

    let result = state
        .query_engine
        .execute(
            &state.db_pool,
            &query.template,
            &query.params,
            per_page,
            offset,
        )
        .await
        .map_err(|e| {
            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Export query execution failed",
                Some(e.to_string()),
            )
        })?;

    let now = now_secs();
    let expires_in_secs = req.expires_in_secs.unwrap_or(900).clamp(60, 3600);
    let exp = now + expires_in_secs as usize;
    let fingerprint = fingerprint_query(&query.template, &query.params, page, per_page);

    let claims = ExportJwtClaims {
        iss: "harpy-graph".to_string(),
        sub: actor.actor_id.clone(),
        role: actor.role.as_str().to_string(),
        template: query.template.clone(),
        query_fingerprint: fingerprint,
        watermark: req.watermark,
        result_count: result.rows.len() as i64,
        iat: now,
        nbf: now,
        exp,
    };

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(state.export_jwt_secret.as_bytes()),
    )
    .map_err(|e| {
        error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Export signing failed",
            Some(e.to_string()),
        )
    })?;

    if let Err(e) = audit_log_query(
        &state.db_pool,
        &actor,
        "graph_export_signed",
        &query.template,
        &query.params,
        result.rows.len() as i64,
    )
    .await
    {
        tracing::warn!("Failed to write export audit log: {}", e);
    }

    Ok(Json(GraphExportResponse {
        signed_export_jwt: token,
        expires_at_ts_ms: (exp as i64) * 1000,
        result_count: result.rows.len() as i64,
    }))
}

async fn graph_export_verify(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<GraphExportVerifyRequest>,
) -> Result<Json<GraphExportVerifyResponse>, (StatusCode, Json<ErrorResponse>)> {
    let actor = parse_actor_context(&headers);
    if !has_scope(&actor, "graph:export") {
        return Err(error_response(
            StatusCode::FORBIDDEN,
            "Access denied",
            Some("missing graph:export scope".to_string()),
        ));
    }

    let mut validation = Validation::default();
    validation.validate_exp = true;

    let decoded = decode::<ExportJwtClaims>(
        &req.token,
        &DecodingKey::from_secret(state.export_jwt_secret.as_bytes()),
        &validation,
    )
    .map_err(|e| {
        error_response(
            StatusCode::UNAUTHORIZED,
            "Invalid export token",
            Some(e.to_string()),
        )
    })?;

    Ok(Json(GraphExportVerifyResponse {
        valid: true,
        claims: Some(decoded.claims),
    }))
}

fn parse_actor_context(headers: &HeaderMap) -> ActorContext {
    let role = ActorRole::from_header(header_value(headers, "x-harpy-role").as_deref());
    let mut scopes = default_scopes(&role);

    if let Some(raw_scopes) = header_value(headers, "x-harpy-scopes") {
        for scope in raw_scopes.split(',') {
            let trimmed = scope.trim();
            if !trimmed.is_empty() {
                scopes.insert(trimmed.to_string());
            }
        }
    }

    let attrs = header_value(headers, "x-harpy-attrs")
        .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
        .filter(|value| value.is_object())
        .unwrap_or_else(|| json!({}));

    ActorContext {
        actor_id: header_value(headers, "x-harpy-actor-id")
            .unwrap_or_else(|| "anonymous".to_string()),
        role,
        scopes,
        attrs,
    }
}

fn default_scopes(role: &ActorRole) -> HashSet<String> {
    let mut scopes = HashSet::new();
    scopes.insert("graph:query".to_string());
    match role {
        ActorRole::Viewer => {}
        ActorRole::Operator => {
            scopes.insert("graph:query:advanced".to_string());
        }
        ActorRole::Admin => {
            scopes.insert("graph:query:advanced".to_string());
            scopes.insert("graph:export".to_string());
        }
    }
    scopes
}

fn authorize_graph_query(
    actor: &ActorContext,
    template: &str,
    params: &Value,
    require_export: bool,
) -> Result<(), String> {
    if !has_scope(actor, "graph:query") {
        return Err("missing graph:query scope".to_string());
    }

    if require_export && !has_scope(actor, "graph:export") {
        return Err("missing graph:export scope".to_string());
    }

    let advanced_templates = [
        "get_evidence_chain",
        "get_tracks_by_sensor",
        "find_associated_tracks",
    ];
    if advanced_templates.contains(&template)
        && actor.role == ActorRole::Viewer
        && !has_scope(actor, "graph:query:advanced")
    {
        return Err(format!(
            "template '{}' requires graph:query:advanced scope",
            template
        ));
    }

    // ABAC: constrain sensor access if actor has allow-list.
    if template == "get_tracks_by_sensor" {
        if let (Some(sensor_id), allowed) = (
            get_string_param(params, "sensor_id"),
            attr_string_list(actor, "allowed_sensor_ids"),
        ) {
            if !allowed.is_empty() && !allowed.contains(&sensor_id.to_string()) {
                return Err(format!("sensor '{}' not allowed for actor", sensor_id));
            }
        }
    }

    // ABAC: constrain track id prefix if configured for actor.
    if [
        "get_track_history",
        "track_timeline",
        "find_associated_tracks",
    ]
    .contains(&template)
    {
        if let Some(track_id) = get_string_param(params, "track_id") {
            let prefixes = attr_string_list(actor, "track_id_prefixes");
            if !prefixes.is_empty() && !prefixes.iter().any(|prefix| track_id.starts_with(prefix)) {
                return Err(format!(
                    "track '{}' does not match allowed track_id_prefixes",
                    track_id
                ));
            }
        }
    }

    // ABAC: constrain track kind if provided.
    if template == "search_tracks" {
        if let Some(kind) = get_string_param(params, "kind") {
            let allowed_kinds = attr_string_list(actor, "allowed_kinds");
            if !allowed_kinds.is_empty() && !allowed_kinds.contains(&kind.to_string()) {
                return Err(format!("kind '{}' not allowed for actor", kind));
            }
        }
    }

    Ok(())
}

fn has_scope(actor: &ActorContext, required: &str) -> bool {
    actor.role == ActorRole::Admin || actor.scopes.contains(required)
}

fn attr_string_list(actor: &ActorContext, key: &str) -> Vec<String> {
    actor
        .attrs
        .get(key)
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str().map(ToString::to_string))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn get_string_param<'a>(params: &'a Value, key: &str) -> Option<&'a str> {
    params.get(key).and_then(|value| value.as_str())
}

fn header_value(headers: &HeaderMap, key: &str) -> Option<String> {
    headers
        .get(key)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
}

fn now_secs() -> usize {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as usize
}

fn fingerprint_query(template: &str, params: &Value, page: i64, per_page: i64) -> String {
    let payload = format!(
        "{}|{}|{}|{}",
        template,
        serde_json::to_string(params).unwrap_or_default(),
        page,
        per_page
    );
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    payload.hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

async fn audit_log_query(
    pool: &PgPool,
    actor: &ActorContext,
    action: &str,
    template: &str,
    params: &Value,
    result_count: i64,
) -> anyhow::Result<()> {
    let now_ms = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis() as i64;

    sqlx::query(
        "INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, details, ts_ms)\
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind("USER")
    .bind(&actor.actor_id)
    .bind(action)
    .bind("Query")
    .bind(template)
    .bind(json!({
        "template": template,
        "params": params,
        "result_count": result_count,
        "role": actor.role.as_str(),
        "scopes": &actor.scopes,
        "attrs": &actor.attrs,
    }))
    .bind(now_ms)
    .execute(pool)
    .await?;

    Ok(())
}

fn error_response(
    status: StatusCode,
    error: &str,
    details: Option<String>,
) -> (StatusCode, Json<ErrorResponse>) {
    (
        status,
        Json(ErrorResponse {
            error: error.to_string(),
            details,
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fingerprint_stable() {
        let params = json!({"track_id": "t-1"});
        let a = fingerprint_query("track_timeline", &params, 1, 100);
        let b = fingerprint_query("track_timeline", &params, 1, 100);
        assert_eq!(a, b);
    }

    #[test]
    fn test_viewer_blocked_from_advanced_template_without_scope() {
        let actor = ActorContext {
            actor_id: "viewer-1".to_string(),
            role: ActorRole::Viewer,
            scopes: ["graph:query".to_string()].into_iter().collect(),
            attrs: json!({}),
        };

        let denied = authorize_graph_query(
            &actor,
            "get_evidence_chain",
            &json!({"alert_id": "a-1"}),
            false,
        );
        assert!(denied.is_err());
    }

    #[test]
    fn test_abac_sensor_allow_list() {
        let actor = ActorContext {
            actor_id: "op-1".to_string(),
            role: ActorRole::Operator,
            scopes: [
                "graph:query".to_string(),
                "graph:query:advanced".to_string(),
            ]
            .into_iter()
            .collect(),
            attrs: json!({"allowed_sensor_ids": ["sensor-a"]}),
        };

        let denied = authorize_graph_query(
            &actor,
            "get_tracks_by_sensor",
            &json!({"sensor_id": "sensor-b"}),
            false,
        );
        assert!(denied.is_err());
    }
}
