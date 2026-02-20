//! harpy-graph: Graph Query API Service
//!
//! Provides pre-approved query templates for graph traversal and entity relationships.
//! All queries are audited for security and compliance.

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
use std::net::SocketAddr;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod queries;

use queries::{QueryEngine, QueryResult};

struct AppState {
    db_pool: PgPool,
    query_engine: QueryEngine,
}

impl Clone for AppState {
    fn clone(&self) -> Self {
        Self {
            db_pool: self.db_pool.clone(),
            query_engine: QueryEngine::new(),
        }
    }
}

#[derive(Debug, Deserialize)]
struct GraphQueryRequest {
    template: String,
    params: Value,
    page: Option<i64>,
    per_page: Option<i64>,
}

#[derive(Debug, Serialize)]
struct GraphQueryResponse {
    template: String,
    results: Vec<Value>,
    pagination: PaginationInfo,
    execution_time_ms: u64,
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

    let db_pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    tracing::info!("Connected to database");

    let query_engine = QueryEngine::new();
    let state = AppState {
        db_pool,
        query_engine,
    };

    let app = Router::new()
        .route("/health", get(health_check))
        .route("/graph/templates", get(list_templates))
        .route("/graph/query", post(graph_query))
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
    Json(req): Json<GraphQueryRequest>,
) -> Result<Json<GraphQueryResponse>, (StatusCode, Json<ErrorResponse>)> {
    let start_time = std::time::Instant::now();

    // Validate template exists
    if !state.query_engine.is_valid_template(&req.template) {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Invalid template".to_string(),
                details: Some(format!("Template '{}' not found", req.template)),
            }),
        ));
    }

    // Set pagination defaults
    let page = req.page.unwrap_or(1).max(1);
    let per_page = req.per_page.unwrap_or(50).clamp(1, 100);
    let offset = (page - 1) * per_page;

    // Execute query
    let result = state
        .query_engine
        .execute(&state.db_pool, &req.template, &req.params, per_page, offset)
        .await;

    match result {
        Ok(QueryResult { rows, total }) => {
            let execution_time_ms = start_time.elapsed().as_millis() as u64;

            // Audit log the query
            if let Err(e) = audit_log_query(
                &state.db_pool,
                &req.template,
                &req.params,
                rows.len() as i64,
            )
            .await
            {
                tracing::warn!("Failed to write audit log: {}", e);
            }

            Ok(Json(GraphQueryResponse {
                template: req.template,
                results: rows,
                pagination: PaginationInfo {
                    page,
                    per_page,
                    total,
                    has_more: (page * per_page) < total,
                },
                execution_time_ms,
            }))
        }
        Err(e) => Err((
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: "Query execution failed".to_string(),
                details: Some(e.to_string()),
            }),
        )),
    }
}

async fn audit_log_query(
    pool: &PgPool,
    template: &str,
    params: &Value,
    result_count: i64,
) -> anyhow::Result<()> {
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)?
        .as_millis() as i64;

    sqlx::query(
        "INSERT INTO audit_log (actor_type, actor_id, action, target_type, target_id, details, ts_ms)\
         VALUES ($1, $2, $3, $4, $5, $6, $7)"
    )
    .bind("USER")
    .bind("anonymous") // TODO: Get from auth context
    .bind("graph_query")
    .bind("Query")
    .bind(template)
    .bind(json!({
        "template": template,
        "params": params,
        "result_count": result_count,
    }))
    .bind(now_ms)
    .execute(pool)
    .await?;

    Ok(())
}
