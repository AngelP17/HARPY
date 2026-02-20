//! harpy-aip: AI Operator Interface Service
//!
//! Provides AI tools for scene manipulation and data exploration.
//! All actions are validated, audited, and require confirmation for scene-altering operations.

use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use harpy_core::types::HealthResponse;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::collections::HashSet;
use std::net::SocketAddr;
use std::time::{SystemTime, UNIX_EPOCH};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

mod tools;
mod validation;

use tools::{ExecutionActor, ToolCall, ToolExecutor};
use validation::{validate_tool_call, ValidationResult};

#[derive(Clone)]
struct AppState {
    db_pool: Option<PgPool>,
    tool_executor: ToolExecutor,
    allowed_tools: HashSet<String>,
}

#[derive(Debug, Deserialize)]
struct AipQueryRequest {
    /// Natural language query (for informational purposes)
    query: Option<String>,
    /// New structured tool call format
    #[serde(default)]
    tool_call: Option<ToolCall>,
    /// Legacy HUD payload support
    #[serde(default)]
    tool: Option<String>,
    #[serde(default)]
    args: Option<Value>,
    #[serde(default)]
    apply: Option<bool>,
    #[serde(default)]
    confirm: Option<bool>,
    #[serde(default)]
    actor_id: Option<String>,
    /// User confirmation token (required for scene-altering actions)
    confirmation_token: Option<String>,
    /// Request explain mode (show what would be done without executing)
    explain: Option<bool>,
}

#[derive(Debug)]
struct NormalizedAipQueryRequest {
    query: Option<String>,
    tool_call: ToolCall,
    confirmation_token: Option<String>,
    explain: bool,
    apply: bool,
    explicit_confirm: bool,
    actor_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct AipQueryResponse {
    success: bool,
    request_id: String,
    result: Option<Value>,
    explanation: Option<String>,
    requires_confirmation: bool,
    confirmation_token: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
struct ToolsListResponse {
    tools: Vec<ToolInfo>,
}

#[derive(Debug, Serialize)]
struct ToolInfo {
    name: String,
    description: String,
    parameters: Value,
    requires_confirmation: bool,
    scene_altering: bool,
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
            "VIEWER" => Self::Viewer,
            "ADMIN" => Self::Admin,
            _ => Self::Operator,
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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "harpy_aip=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let port = std::env::var("HTTP_PORT")
        .unwrap_or_else(|_| "8084".to_string())
        .parse::<u16>()?;

    let db_pool = match std::env::var("DATABASE_URL") {
        Ok(url) => Some(
            PgPoolOptions::new()
                .max_connections(5)
                .connect(&url)
                .await?,
        ),
        Err(_) => {
            tracing::warn!("DATABASE_URL not set; audit logging disabled");
            None
        }
    };

    let graph_url =
        std::env::var("GRAPH_URL").unwrap_or_else(|_| "http://harpy-graph:8083".to_string());

    let mut allowed_tools = HashSet::new();
    allowed_tools.insert("seek_to_time".to_string());
    allowed_tools.insert("seek_to_bbox".to_string());
    allowed_tools.insert("set_layers".to_string());
    allowed_tools.insert("run_graph_query".to_string());
    allowed_tools.insert("get_provider_status".to_string());
    allowed_tools.insert("get_track_info".to_string());

    let tool_executor = ToolExecutor::new(graph_url.clone());

    let state = AppState {
        db_pool,
        tool_executor,
        allowed_tools,
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/intel/news", get(intel_news))
        .route("/intel/market", get(intel_market))
        .route("/aip/tools", get(list_tools))
        .route("/aip/query", post(aip_query))
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!(%addr, "harpy-aip listening");
    tracing::info!("Graph service URL: {}", graph_url);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        service: "harpy-aip".to_string(),
    })
}

async fn list_tools() -> Json<ToolsListResponse> {
    Json(ToolsListResponse {
        tools: vec![
            ToolInfo {
                name: "seek_to_time".to_string(),
                description: "Seek to a specific time range for playback".to_string(),
                parameters: json!({
                    "start_ts_ms": { "type": "integer", "description": "Start timestamp (epoch ms)" },
                    "end_ts_ms": { "type": "integer", "description": "End timestamp (epoch ms)" }
                }),
                requires_confirmation: true,
                scene_altering: true,
            },
            ToolInfo {
                name: "seek_to_bbox".to_string(),
                description: "Pan camera to a bounding box region".to_string(),
                parameters: json!({
                    "min_lat": { "type": "number", "description": "Minimum latitude" },
                    "min_lon": { "type": "number", "description": "Minimum longitude" },
                    "max_lat": { "type": "number", "description": "Maximum latitude" },
                    "max_lon": { "type": "number", "description": "Maximum longitude" }
                }),
                requires_confirmation: true,
                scene_altering: true,
            },
            ToolInfo {
                name: "set_layers".to_string(),
                description: "Toggle layer visibility".to_string(),
                parameters: json!({
                    "layers": { "type": "array", "items": { "type": "string" }, "description": "Layer names to enable" }
                }),
                requires_confirmation: true,
                scene_altering: true,
            },
            ToolInfo {
                name: "run_graph_query".to_string(),
                description: "Execute a pre-approved graph query".to_string(),
                parameters: json!({
                    "template": { "type": "string", "description": "Query template name" },
                    "params": { "type": "object", "description": "Query parameters" }
                }),
                requires_confirmation: false,
                scene_altering: false,
            },
            ToolInfo {
                name: "get_provider_status".to_string(),
                description: "Get health status of data providers".to_string(),
                parameters: json!({}),
                requires_confirmation: false,
                scene_altering: false,
            },
            ToolInfo {
                name: "get_track_info".to_string(),
                description: "Get detailed information about a track".to_string(),
                parameters: json!({
                    "track_id": { "type": "string", "description": "Track identifier" }
                }),
                requires_confirmation: false,
                scene_altering: false,
            },
        ],
    })
}

async fn intel_news(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<ErrorResponse>)> {
    let tool_call = ToolCall {
        name: "get_news_brief".to_string(),
        params: json!({ "q": "global" }),
    };
    match state.tool_executor.execute(&tool_call, None).await {
        Ok(value) => Ok(Json(value)),
        Err(err) => Err(error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Intel news failed",
            Some(err.to_string()),
        )),
    }
}

async fn intel_market(
    State(state): State<AppState>,
) -> Result<Json<Value>, (StatusCode, Json<ErrorResponse>)> {
    let tool_call = ToolCall {
        name: "get_market_snapshot".to_string(),
        params: json!({}),
    };
    match state.tool_executor.execute(&tool_call, None).await {
        Ok(value) => Ok(Json(value)),
        Err(err) => Err(error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Intel market failed",
            Some(err.to_string()),
        )),
    }
}

async fn aip_query(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<AipQueryRequest>,
) -> Result<Json<AipQueryResponse>, (StatusCode, Json<ErrorResponse>)> {
    let request_id = format!("aip-{}", Uuid::new_v4().simple());
    let start_time = std::time::Instant::now();

    let normalized = normalize_request(req).map_err(|reason| {
        error_response(StatusCode::BAD_REQUEST, "Invalid AIP request", Some(reason))
    })?;

    let actor = parse_actor_context(&headers, normalized.actor_id.as_deref());

    if let Some(query) = normalized.query.as_deref() {
        tracing::debug!(request_id = %request_id, query = %query, actor = %actor.actor_id, "received AIP query context");
    }

    let validation = validate_tool_call(&normalized.tool_call, &state.allowed_tools);
    let scene_altering = match validation {
        ValidationResult::Invalid { reason } => {
            audit_log(
                &state,
                &actor,
                &request_id,
                "validation_failed",
                &normalized.tool_call,
                None,
                Some(&reason),
            )
            .await;

            return Err(error_response(
                StatusCode::BAD_REQUEST,
                "Validation failed",
                Some(reason),
            ));
        }
        ValidationResult::Valid { scene_altering } => scene_altering,
    };

    if let Err(reason) = authorize_actor_for_tool(&actor, &normalized.tool_call, scene_altering) {
        audit_log(
            &state,
            &actor,
            &request_id,
            "authorization_failed",
            &normalized.tool_call,
            None,
            Some(&reason),
        )
        .await;

        return Err(error_response(
            StatusCode::FORBIDDEN,
            "Access denied",
            Some(reason),
        ));
    }

    if normalized.explain || !normalized.apply {
        let explanation = generate_explanation(&normalized.tool_call);
        return Ok(Json(AipQueryResponse {
            success: true,
            request_id,
            result: None,
            explanation: Some(explanation),
            requires_confirmation: scene_altering,
            confirmation_token: None,
            error: None,
        }));
    }

    if scene_altering && normalized.confirmation_token.is_none() && !normalized.explicit_confirm {
        let token = generate_confirmation_token(&normalized.tool_call);

        audit_log(
            &state,
            &actor,
            &request_id,
            "confirmation_required",
            &normalized.tool_call,
            None,
            None,
        )
        .await;

        return Ok(Json(AipQueryResponse {
            success: false,
            request_id,
            result: None,
            explanation: Some(generate_explanation(&normalized.tool_call)),
            requires_confirmation: true,
            confirmation_token: Some(token),
            error: Some("Confirmation required for scene-altering action".to_string()),
        }));
    }

    let execution_actor = ExecutionActor {
        actor_id: actor.actor_id.clone(),
        role: actor.role.as_str().to_string(),
        scopes: actor.scopes.iter().cloned().collect(),
        attrs: actor.attrs.clone(),
    };

    match state
        .tool_executor
        .execute(&normalized.tool_call, Some(&execution_actor))
        .await
    {
        Ok(result) => {
            let execution_time_ms = start_time.elapsed().as_millis() as u64;

            audit_log(
                &state,
                &actor,
                &request_id,
                "executed",
                &normalized.tool_call,
                Some(&result),
                None,
            )
            .await;

            tracing::info!(
                request_id = %request_id,
                actor_id = %actor.actor_id,
                role = %actor.role.as_str(),
                tool = %normalized.tool_call.name,
                execution_time_ms = %execution_time_ms,
                "Tool executed successfully"
            );

            Ok(Json(AipQueryResponse {
                success: true,
                request_id,
                result: Some(result),
                explanation: None,
                requires_confirmation: false,
                confirmation_token: None,
                error: None,
            }))
        }
        Err(e) => {
            audit_log(
                &state,
                &actor,
                &request_id,
                "execution_failed",
                &normalized.tool_call,
                None,
                Some(&e.to_string()),
            )
            .await;

            Err(error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Tool execution failed",
                Some(e.to_string()),
            ))
        }
    }
}

fn normalize_request(req: AipQueryRequest) -> Result<NormalizedAipQueryRequest, String> {
    let explain = req.explain.unwrap_or(false);
    let apply = req.apply.unwrap_or(!explain);

    let mut tool_call = req.tool_call;
    if tool_call.is_none() {
        if let Some(tool) = req.tool {
            tool_call = Some(ToolCall {
                name: tool,
                params: req.args.unwrap_or_else(|| json!({})),
            });
        }
    }

    let mut tool_call = tool_call.ok_or_else(|| {
        "Missing tool call. Expected 'tool_call' or legacy 'tool' + 'args'.".to_string()
    })?;
    if tool_call.params.is_null() {
        tool_call.params = json!({});
    }

    Ok(NormalizedAipQueryRequest {
        query: req.query,
        tool_call,
        confirmation_token: req.confirmation_token,
        explain,
        apply,
        explicit_confirm: req.confirm.unwrap_or(false),
        actor_id: req.actor_id,
    })
}

fn parse_actor_context(headers: &HeaderMap, actor_id_override: Option<&str>) -> ActorContext {
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
        actor_id: actor_id_override
            .map(ToString::to_string)
            .or_else(|| header_value(headers, "x-harpy-actor-id"))
            .unwrap_or_else(|| "anonymous".to_string()),
        role,
        scopes,
        attrs,
    }
}

fn default_scopes(role: &ActorRole) -> HashSet<String> {
    let mut scopes = HashSet::new();
    scopes.insert("aip:query".to_string());
    match role {
        ActorRole::Viewer => {}
        ActorRole::Operator => {
            scopes.insert("aip:execute".to_string());
            scopes.insert("graph:query".to_string());
        }
        ActorRole::Admin => {
            scopes.insert("aip:execute".to_string());
            scopes.insert("graph:query".to_string());
            scopes.insert("graph:query:advanced".to_string());
            scopes.insert("graph:export".to_string());
        }
    }
    scopes
}

fn authorize_actor_for_tool(
    actor: &ActorContext,
    tool_call: &ToolCall,
    scene_altering: bool,
) -> Result<(), String> {
    if !has_scope(actor, "aip:query") {
        return Err("missing aip:query scope".to_string());
    }

    if scene_altering && !has_scope(actor, "aip:execute") {
        return Err("missing aip:execute scope for scene-altering tool".to_string());
    }

    if tool_call.name == "run_graph_query" && !has_scope(actor, "graph:query") {
        return Err("missing graph:query scope".to_string());
    }

    // ABAC: constrain layer writes if allow-list is defined.
    if tool_call.name == "set_layers" {
        let allowed_layers = attr_string_list(actor, "allowed_layers");
        if !allowed_layers.is_empty() {
            let requested_layers = tool_call
                .params
                .get("layers")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|item| item.as_str().map(ToString::to_string))
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();

            let unauthorized = requested_layers
                .into_iter()
                .find(|layer| !allowed_layers.contains(layer));
            if let Some(layer) = unauthorized {
                return Err(format!("layer '{}' is not allowed for actor", layer));
            }
        }
    }

    // ABAC: constrain track reads by prefix if configured.
    if tool_call.name == "get_track_info" {
        if let Some(track_id) = tool_call.params.get("track_id").and_then(|v| v.as_str()) {
            let prefixes = attr_string_list(actor, "track_id_prefixes");
            if !prefixes.is_empty() && !prefixes.iter().any(|prefix| track_id.starts_with(prefix)) {
                return Err(format!(
                    "track '{}' does not match allowed track_id_prefixes",
                    track_id
                ));
            }
        }
    }

    // ABAC: constrain graph templates if allow-list is defined.
    if tool_call.name == "run_graph_query" {
        if let Some(template) = tool_call.params.get("template").and_then(|v| v.as_str()) {
            let allowed_templates = attr_string_list(actor, "allowed_templates");
            if !allowed_templates.is_empty() && !allowed_templates.contains(&template.to_string()) {
                return Err(format!("template '{}' is not allowed for actor", template));
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

fn header_value(headers: &HeaderMap, key: &str) -> Option<String> {
    headers
        .get(key)
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
}

fn generate_explanation(tool_call: &ToolCall) -> String {
    match tool_call.name.as_str() {
        "seek_to_time" => {
            let start = tool_call
                .params
                .get("start_ts_ms")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            let end = tool_call
                .params
                .get("end_ts_ms")
                .and_then(|v| v.as_i64())
                .unwrap_or(0);
            format!(
                "Will switch to PLAYBACK mode and seek from {} to {} ({} seconds)",
                start,
                end,
                (end - start) / 1000
            )
        }
        "seek_to_bbox" => {
            let min_lat = tool_call
                .params
                .get("min_lat")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let max_lat = tool_call
                .params
                .get("max_lat")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let min_lon = tool_call
                .params
                .get("min_lon")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let max_lon = tool_call
                .params
                .get("max_lon")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            format!(
                "Will pan camera to region: lat [{:.4}, {:.4}], lon [{:.4}, {:.4}]",
                min_lat, max_lat, min_lon, max_lon
            )
        }
        "set_layers" => {
            let layers = tool_call
                .params
                .get("layers")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                })
                .unwrap_or_default();
            format!("Will enable layers: {}", layers)
        }
        "run_graph_query" => {
            let template = tool_call
                .params
                .get("template")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");
            format!("Will execute graph query template: {}", template)
        }
        _ => format!("Will execute tool: {}", tool_call.name),
    }
}

fn generate_confirmation_token(_tool_call: &ToolCall) -> String {
    format!("confirm-{}", Uuid::new_v4())
}

async fn audit_log(
    state: &AppState,
    actor: &ActorContext,
    request_id: &str,
    action: &str,
    tool_call: &ToolCall,
    result: Option<&Value>,
    error: Option<&str>,
) {
    if let Some(pool) = &state.db_pool {
        let now_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let details = json!({
            "request_id": request_id,
            "tool": tool_call.name,
            "params": tool_call.params,
            "result": result,
            "error": error,
            "role": actor.role.as_str(),
            "scopes": &actor.scopes,
            "attrs": &actor.attrs,
        });

        let _ = sqlx::query(
            "INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, details, ts_ms)\
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
        .bind("AI")
        .bind(&actor.actor_id)
        .bind(action)
        .bind("ToolCall")
        .bind(&tool_call.name)
        .bind(&details)
        .bind(now_ms)
        .execute(pool)
        .await;
    }
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
    fn test_normalize_legacy_payload() {
        let req = AipQueryRequest {
            query: Some("set aircraft".to_string()),
            tool_call: None,
            tool: Some("set_layers".to_string()),
            args: Some(json!({"layers": ["AIRCRAFT"]})),
            apply: Some(true),
            confirm: Some(true),
            actor_id: Some("hud-operator".to_string()),
            confirmation_token: None,
            explain: Some(false),
        };

        let normalized = normalize_request(req).expect("normalized request");
        assert_eq!(normalized.tool_call.name, "set_layers");
        assert!(normalized.explicit_confirm);
    }

    #[test]
    fn test_authorization_blocks_viewer_scene_change() {
        let actor = ActorContext {
            actor_id: "viewer-1".to_string(),
            role: ActorRole::Viewer,
            scopes: ["aip:query".to_string()].into_iter().collect(),
            attrs: json!({}),
        };

        let tool_call = ToolCall {
            name: "seek_to_time".to_string(),
            params: json!({"start_ts_ms": 1, "end_ts_ms": 2}),
        };

        let denied = authorize_actor_for_tool(&actor, &tool_call, true);
        assert!(denied.is_err());
    }
}
