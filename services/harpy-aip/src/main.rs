use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::{get, post},
    Json, Router,
};
use harpy_core::types::HealthResponse;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::collections::HashMap;
use std::net::SocketAddr;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Clone)]
struct AppState {
    db_pool: Option<PgPool>,
    http_client: Client,
    graph_url: String,
    jwt_secret: String,
    enforce_auth: bool,
}

#[derive(Debug, Serialize)]
struct ToolInfo {
    tool: &'static str,
    description: &'static str,
    scene_altering: bool,
}

#[derive(Debug, Deserialize)]
struct AipQueryRequest {
    actor_id: String,
    tool: String,
    #[serde(default)]
    args: Value,
    #[serde(default)]
    apply: bool,
    #[serde(default)]
    confirm: bool,
}

#[derive(Debug, Serialize)]
struct AipQueryResponse {
    accepted: bool,
    tool: String,
    requires_confirmation: bool,
    executed: bool,
    structured_request: Value,
    result: Option<Value>,
    error: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
struct GraphQueryRequest {
    template: String,
    #[serde(default)]
    params: HashMap<String, String>,
    page: Option<u32>,
    page_size: Option<u32>,
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

    let graph_url =
        std::env::var("GRAPH_URL").unwrap_or_else(|_| "http://localhost:8083".to_string());
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "dev-secret-change-in-production".to_string());
    let enforce_auth = std::env::var("ENFORCE_AUTH")
        .unwrap_or_else(|_| "false".to_string())
        .eq_ignore_ascii_case("true");

    let db_pool = match std::env::var("DATABASE_URL") {
        Ok(url) => Some(
            PgPoolOptions::new()
                .max_connections(5)
                .connect(&url)
                .await?,
        ),
        Err(_) => {
            tracing::warn!("DATABASE_URL is not set; audit persistence disabled for harpy-aip");
            None
        }
    };

    let state = AppState {
        db_pool,
        http_client: Client::new(),
        graph_url,
        jwt_secret,
        enforce_auth,
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/aip/tools", get(list_tools))
        .route("/aip/query", post(handle_aip_query))
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

async fn list_tools() -> Json<Vec<ToolInfo>> {
    Json(tool_catalog())
}

async fn handle_aip_query(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<AipQueryRequest>,
) -> Result<Json<AipQueryResponse>, (StatusCode, String)> {
    validate_tool(&req.tool)?;
    validate_tool_args(&req.tool, &req.args)?;

    let scene_altering = is_scene_altering(&req.tool);
    let requires_confirmation = scene_altering && req.apply;

    if requires_confirmation && !req.confirm {
        let structured_request = json!({
            "tool": req.tool,
            "args": req.args,
            "apply": req.apply,
            "confirm": req.confirm,
            "reason": "human_confirmation_required_for_scene_altering_actions"
        });

        audit_ai_action(
            &state,
            &req.actor_id,
            "aip_tool_preview",
            &structured_request,
        )
        .await;

        return Ok(Json(AipQueryResponse {
            accepted: true,
            tool: req.tool,
            requires_confirmation: true,
            executed: false,
            structured_request,
            result: None,
            error: Some("Confirmation required before execution".to_string()),
        }));
    }

    if req.apply {
        let claims = authorize_apply(&headers, &state)?;
        ensure_has_any_role(&claims, &["operator", "ai_operator", "admin"])?;
    }

    let structured_request = json!({
        "tool": req.tool,
        "args": req.args,
        "apply": req.apply,
        "confirm": req.confirm
    });

    if !req.apply {
        audit_ai_action(
            &state,
            &req.actor_id,
            "aip_tool_preview",
            &structured_request,
        )
        .await;

        return Ok(Json(AipQueryResponse {
            accepted: true,
            tool: req.tool,
            requires_confirmation,
            executed: false,
            structured_request,
            result: None,
            error: None,
        }));
    }

    let execution_result = execute_tool(&state, &req.tool, &req.args).await;
    match execution_result {
        Ok(result) => {
            audit_ai_action(
                &state,
                &req.actor_id,
                "aip_tool_execute",
                &structured_request,
            )
            .await;

            Ok(Json(AipQueryResponse {
                accepted: true,
                tool: req.tool,
                requires_confirmation,
                executed: true,
                structured_request,
                result: Some(result),
                error: None,
            }))
        }
        Err(error) => {
            audit_ai_action(
                &state,
                &req.actor_id,
                "aip_tool_execution_failed",
                &json!({"request": structured_request, "error": error}),
            )
            .await;

            Ok(Json(AipQueryResponse {
                accepted: false,
                tool: req.tool,
                requires_confirmation,
                executed: false,
                structured_request,
                result: None,
                error: Some(error),
            }))
        }
    }
}

async fn execute_tool(state: &AppState, tool: &str, args: &Value) -> Result<Value, String> {
    match tool {
        "seek_to_time" => Ok(json!({"status": "queued", "seek": args})),
        "seek_to_bbox" => Ok(json!({"status": "queued", "seek": args})),
        "set_layers" => Ok(json!({"status": "queued", "layers": args})),
        "run_graph_query" => {
            let graph_req: GraphQueryRequest =
                serde_json::from_value(args.clone()).map_err(|error| error.to_string())?;

            let response = state
                .http_client
                .post(format!(
                    "{}/graph/query",
                    state.graph_url.trim_end_matches('/')
                ))
                .json(&graph_req)
                .send()
                .await
                .map_err(|error| format!("graph query request failed: {}", error))?;

            let status = response.status();
            let body = response
                .text()
                .await
                .map_err(|error| format!("graph query response read failed: {}", error))?;

            if !status.is_success() {
                return Err(format!("graph query failed (status {}): {}", status, body));
            }

            serde_json::from_str::<Value>(&body)
                .map_err(|error| format!("graph query returned invalid JSON: {}", error))
        }
        _ => Err("tool is not in allow-list".to_string()),
    }
}

fn validate_tool(tool: &str) -> Result<(), (StatusCode, String)> {
    if tool_catalog().iter().any(|entry| entry.tool == tool) {
        Ok(())
    } else {
        Err((
            StatusCode::BAD_REQUEST,
            format!("Tool '{}' is not allowed", tool),
        ))
    }
}

fn validate_tool_args(tool: &str, args: &Value) -> Result<(), (StatusCode, String)> {
    let error = |message: &str| (StatusCode::BAD_REQUEST, message.to_string());

    match tool {
        "seek_to_time" => {
            let has_start = args.get("start_ts_ms").is_some();
            let has_end = args.get("end_ts_ms").is_some();
            if has_start && has_end {
                Ok(())
            } else {
                Err(error("seek_to_time requires start_ts_ms and end_ts_ms"))
            }
        }
        "seek_to_bbox" => {
            let keys = ["min_lat", "min_lon", "max_lat", "max_lon"];
            if keys.iter().all(|key| args.get(key).is_some()) {
                Ok(())
            } else {
                Err(error(
                    "seek_to_bbox requires min_lat, min_lon, max_lat, and max_lon",
                ))
            }
        }
        "set_layers" => {
            if args.get("layer_mask").is_some() {
                Ok(())
            } else {
                Err(error("set_layers requires layer_mask"))
            }
        }
        "run_graph_query" => {
            let request: GraphQueryRequest =
                serde_json::from_value(args.clone()).map_err(|e| error(&e.to_string()))?;

            let allowed = [
                "related_tracks",
                "alert_evidence_chain",
                "seen_by_sensor",
                "track_timeline",
            ];

            if allowed.contains(&request.template.as_str()) {
                Ok(())
            } else {
                Err(error("run_graph_query uses a non-allow-listed template"))
            }
        }
        _ => Err(error("unknown tool")),
    }
}

fn tool_catalog() -> Vec<ToolInfo> {
    vec![
        ToolInfo {
            tool: "seek_to_time",
            description: "Seek DVR to an absolute time range",
            scene_altering: true,
        },
        ToolInfo {
            tool: "seek_to_bbox",
            description: "Seek scene viewport to a bounding box",
            scene_altering: true,
        },
        ToolInfo {
            tool: "set_layers",
            description: "Set scene layer visibility mask",
            scene_altering: true,
        },
        ToolInfo {
            tool: "run_graph_query",
            description: "Run pre-approved ontology query template",
            scene_altering: false,
        },
    ]
}

fn is_scene_altering(tool: &str) -> bool {
    tool_catalog()
        .iter()
        .find(|entry| entry.tool == tool)
        .map(|entry| entry.scene_altering)
        .unwrap_or(false)
}

fn authorize_apply(
    headers: &HeaderMap,
    state: &AppState,
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

async fn audit_ai_action(state: &AppState, actor_id: &str, action: &str, details: &Value) {
    let Some(pool) = &state.db_pool else {
        tracing::debug!(%actor_id, %action, "audit persistence disabled");
        return;
    };

    if let Err(error) = sqlx::query(
        "INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, details, ts_ms)\
         VALUES ($1, $2, $3, $4, $5, $6, $7)",
    )
    .bind("AI")
    .bind(actor_id)
    .bind(action)
    .bind("AIP")
    .bind("tool_call")
    .bind(details)
    .bind(now_ms())
    .execute(pool)
    .await
    {
        tracing::error!(error = %error, "failed to persist AI audit log");
    }
}

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("system clock drift")
        .as_millis() as i64
}
