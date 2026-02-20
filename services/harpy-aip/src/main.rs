//! harpy-aip: AI Operator Interface Service
//!
//! Provides AI tools for scene manipulation and data exploration.
//! All actions are validated, audited, and require confirmation for scene-altering operations.

use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use harpy_core::types::HealthResponse;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::collections::HashSet;
use std::net::SocketAddr;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

mod tools;
mod validation;

use tools::{ToolCall, ToolExecutor};
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
    /// Structured tool call
    tool_call: ToolCall,
    /// User confirmation token (required for scene-altering actions)
    confirmation_token: Option<String>,
    /// Request explain mode (show what would be done without executing)
    explain: Option<bool>,
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

    // Define allowed tools
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
        .route("/aip/tools", get(list_tools))
        .route("/aip/query", post(aip_query))
        .with_state(state)
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
                requires_confirmation: false,
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

async fn aip_query(
    State(state): State<AppState>,
    Json(req): Json<AipQueryRequest>,
) -> Result<Json<AipQueryResponse>, (StatusCode, Json<ErrorResponse>)> {
    let request_id = format!("aip-{}", Uuid::new_v4().simple());
    let start_time = std::time::Instant::now();
    if let Some(query) = req.query.as_deref() {
        tracing::debug!(request_id = %request_id, query = %query, "received AIP query context");
    }

    // Step 1: Validate tool call
    let validation = validate_tool_call(&req.tool_call, &state.allowed_tools);
    match validation {
        ValidationResult::Invalid { reason } => {
            audit_log(
                &state,
                &request_id,
                "validation_failed",
                &req.tool_call,
                None,
                Some(&reason),
            )
            .await;

            Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "Validation failed".to_string(),
                    details: Some(reason),
                }),
            ))
        }
        ValidationResult::Valid { scene_altering } => {
            // Step 2: Handle explain mode
            if req.explain == Some(true) {
                let explanation = generate_explanation(&req.tool_call);
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

            // Step 3: Check confirmation for scene-altering actions
            if scene_altering && req.confirmation_token.is_none() {
                let token = generate_confirmation_token(&req.tool_call);

                audit_log(
                    &state,
                    &request_id,
                    "confirmation_required",
                    &req.tool_call,
                    None,
                    None,
                )
                .await;

                return Ok(Json(AipQueryResponse {
                    success: false,
                    request_id,
                    result: None,
                    explanation: Some(generate_explanation(&req.tool_call)),
                    requires_confirmation: true,
                    confirmation_token: Some(token),
                    error: Some("Confirmation required for scene-altering action".to_string()),
                }));
            }

            // Step 4: Execute tool
            match state.tool_executor.execute(&req.tool_call).await {
                Ok(result) => {
                    let execution_time_ms = start_time.elapsed().as_millis() as u64;

                    audit_log(
                        &state,
                        &request_id,
                        "executed",
                        &req.tool_call,
                        Some(&result),
                        None,
                    )
                    .await;

                    tracing::info!(
                        request_id = %request_id,
                        tool = %req.tool_call.name,
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
                        &request_id,
                        "execution_failed",
                        &req.tool_call,
                        None,
                        Some(&e.to_string()),
                    )
                    .await;

                    Err((
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(ErrorResponse {
                            error: "Tool execution failed".to_string(),
                            details: Some(e.to_string()),
                        }),
                    ))
                }
            }
        }
    }
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
    // Simple token generation - in production, use cryptographic tokens with expiration
    format!("confirm-{}", Uuid::new_v4())
}

async fn audit_log(
    state: &AppState,
    request_id: &str,
    action: &str,
    tool_call: &ToolCall,
    result: Option<&Value>,
    error: Option<&str>,
) {
    if let Some(pool) = &state.db_pool {
        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;

        let details = json!({
            "request_id": request_id,
            "tool": tool_call.name,
            "params": tool_call.params,
            "result": result,
            "error": error,
        });

        let _ = sqlx::query(
            "INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, details, ts_ms)\
             VALUES ($1, $2, $3, $4, $5, $6, $7)"
        )
        .bind("AI")
        .bind("harpy-aip")
        .bind(action)
        .bind("ToolCall")
        .bind(&tool_call.name)
        .bind(&details)
        .bind(now_ms)
        .execute(pool)
        .await;
    }
}
