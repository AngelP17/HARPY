//! harpy-relay: WebSocket Relay Service
//!
//! Handles WebSocket connections from frontend clients, manages subscriptions,
//! and fans out track updates from Redis pub/sub.

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    extract::State,
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use dashmap::DashMap;
use harpy_core::types::HealthResponse;
use harpy_proto::harpy::v1::{
    BoundingBox, Envelope, LayerType, SubscriptionMode, SubscriptionRequest,
};
use prost::Message as ProstMessage;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::task::JoinHandle;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

mod backpressure;
mod playback;
mod redis_subscriber;
mod seek;
mod subscription;

use subscription::{Subscription, SubscriptionManager};

/// Application state shared across handlers
#[derive(Clone)]
pub(crate) struct AppState {
    pub(crate) subscription_manager: Arc<SubscriptionManager>,
    pub(crate) connection_counter: Arc<AtomicU64>,
    pub(crate) db_pool: Option<PgPool>,
    pub(crate) redis_client: Option<redis::Client>,
    pub(crate) playback_tasks: Arc<DashMap<String, JoinHandle<()>>>,
}

#[derive(Debug, Serialize)]
struct DebugSnapshotResponse {
    ts_ms: u64,
    relay: RelayDebugSnapshot,
    redis: RedisDebugSnapshot,
}

#[derive(Debug, Serialize)]
struct RelayDebugSnapshot {
    connected_clients: usize,
    playback_clients: usize,
    subscriptions: Vec<subscription::SubscriptionDebugInfo>,
    subscriptions_by_layer: HashMap<String, usize>,
    backpressure_totals: BackpressureTotals,
}

#[derive(Debug, Serialize)]
struct BackpressureTotals {
    track_batches_dropped: usize,
    track_batches_sent: usize,
    high_priority_sent: usize,
}

#[derive(Debug, Serialize)]
struct RedisDebugSnapshot {
    connected: bool,
    track_cache: TrackCacheStats,
    providers: Vec<ProviderStatusDebug>,
}

#[derive(Debug, Serialize)]
struct TrackCacheStats {
    total: usize,
    by_kind: HashMap<String, usize>,
    by_provider: HashMap<String, usize>,
    last_update_ts_ms: u64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
struct ProviderStatusDebug {
    provider_id: String,
    circuit_state: String,
    freshness: String,
    last_update_ts_ms: u64,
    last_success: bool,
}

#[derive(Debug, Deserialize, Default)]
struct TrackCacheEntry {
    kind: i32,
    #[serde(default)]
    ts_ms: u64,
    #[serde(default)]
    provider_id: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "harpy_relay=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    // Get configuration from environment
    let port = std::env::var("WS_PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse::<u16>()?;
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".to_string());
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://harpy:harpy@localhost:5432/harpy".to_string());
    let redis_client = redis::Client::open(redis_url.clone()).ok();

    // Create subscription manager
    let subscription_manager = SubscriptionManager::arc();

    let db_pool = match PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
    {
        Ok(pool) => {
            tracing::info!("Connected to Postgres at {}", database_url);
            Some(pool)
        }
        Err(e) => {
            tracing::warn!(
                "Failed to connect to Postgres: {}. Seek/playback queries will be limited.",
                e
            );
            None
        }
    };

    // Create app state
    let state = AppState {
        subscription_manager: subscription_manager.clone(),
        connection_counter: Arc::new(AtomicU64::new(0)),
        db_pool,
        redis_client,
        playback_tasks: Arc::new(DashMap::new()),
    };

    // Start Redis subscriber in background
    let sub_manager_clone = subscription_manager.clone();
    tokio::spawn(async move {
        if let Err(e) = redis_subscriber::run_subscriber(redis_url, sub_manager_clone).await {
            tracing::error!("Redis subscriber error: {}", e);
        }
    });

    // Build router
    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(health_check))
        .route("/metrics", get(metrics_handler))
        .route("/seek", get(seek::seek_handler))
        .route("/api/debug/snapshot", get(debug_snapshot_handler))
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .layer(TraceLayer::new_for_http())
        .with_state(state.clone());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("harpy-relay listening on {}", addr);
    tracing::info!("WebSocket endpoint: ws://{}:{}/ws", addr.ip(), addr.port());

    // Start server
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

async fn ws_handler(State(state): State<AppState>, ws: WebSocketUpgrade) -> Response {
    let client_id = format!("client-{}", Uuid::new_v4().simple());
    let client_num = state.connection_counter.fetch_add(1, Ordering::SeqCst);

    ws.on_upgrade(move |socket| handle_socket(socket, state, client_id, client_num))
}

async fn handle_socket(mut socket: WebSocket, state: AppState, client_id: String, client_num: u64) {
    tracing::info!(
        "WebSocket connection established: {} (client #{})",
        client_id,
        client_num
    );

    // Create backpressure-aware channel for this client.
    let (tx, mut rx) = backpressure::BackpressureChannel::new();

    // Default subscription (world viewport, all layers)
    let default_viewport = BoundingBox {
        min_lat: -90.0,
        max_lat: 90.0,
        min_lon: -180.0,
        max_lon: 180.0,
    };
    let default_layers = vec![
        LayerType::Aircraft,
        LayerType::Satellite,
        LayerType::Ground,
        LayerType::Vessel,
    ];

    // Create initial subscription
    let initial_subscription = Subscription {
        viewport: default_viewport,
        layers: default_layers,
        sender: tx.clone(),
    };

    // Register subscription
    state
        .subscription_manager
        .subscribe(client_id.clone(), initial_subscription)
        .await;

    // Send subscription acknowledgment
    let ack = Envelope {
        schema_version: "1.0.0".to_string(),
        server_ts_ms: now_ms(),
        payload: Some(harpy_proto::harpy::v1::envelope::Payload::SubscriptionAck(
            harpy_proto::harpy::v1::SubscriptionAck {
                subscription_id: client_id.clone(),
                success: true,
                error: None,
            },
        )),
    };

    if let Ok(ack_bytes) = encode_envelope(&ack) {
        if socket.send(Message::Binary(ack_bytes)).await.is_err() {
            tracing::warn!("Failed to send subscription ack to {}", client_id);
        }
    }

    // Main message loop
    loop {
        tokio::select! {
            // Handle incoming WebSocket messages from client
            msg = socket.recv() => {
                match msg {
                    Some(Ok(msg)) => {
                        if let Err(should_disconnect) = handle_client_message(
                            msg,
                            &state,
                            &client_id,
                            &tx,
                        ).await {
                            if should_disconnect {
                                break;
                            }
                        }
                    }
                    Some(Err(e)) => {
                        tracing::error!("WebSocket error for {}: {}", client_id, e);
                        break;
                    }
                    None => {
                        tracing::info!("WebSocket connection closed by client: {}", client_id);
                        break;
                    }
                }
            }

            // Handle outgoing messages from subscription manager
            Some(envelope) = rx.recv() => {
                match encode_envelope(&envelope) {
                    Ok(bytes) => {
                        if socket.send(Message::Binary(bytes)).await.is_err() {
                            tracing::warn!("Failed to send message to {}, closing", client_id);
                            break;
                        }
                    }
                    Err(e) => {
                        tracing::error!("Failed to encode envelope: {}", e);
                    }
                }
            }
        }
    }

    // Clean up subscription
    state.subscription_manager.unsubscribe(&client_id).await;
    if let Some((_, handle)) = state.playback_tasks.remove(&client_id) {
        handle.abort();
    }
    tracing::info!("WebSocket connection closed: {}", client_id);
}

/// Handle a message from the client
/// Returns Ok(()) to continue, Err(true) to disconnect, Err(false) to continue despite error
async fn handle_client_message(
    msg: Message,
    state: &AppState,
    client_id: &str,
    tx: &backpressure::BackpressureChannel,
) -> Result<(), bool> {
    match msg {
        Message::Binary(data) => {
            // Decode protobuf subscription request
            match Envelope::decode(&*data) {
                Ok(envelope) => {
                    if let Some(payload) = envelope.payload {
                        match payload {
                            harpy_proto::harpy::v1::envelope::Payload::SubscriptionRequest(
                                sub_req,
                            ) => {
                                handle_subscription_update(sub_req, state, client_id, tx).await;
                            }
                            _ => {
                                tracing::debug!(
                                    "Received unexpected message type from {}",
                                    client_id
                                );
                            }
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to decode protobuf message from {}: {}",
                        client_id,
                        e
                    );
                    // Send error response
                    let error_ack = Envelope {
                        schema_version: "1.0.0".to_string(),
                        server_ts_ms: now_ms(),
                        payload: Some(harpy_proto::harpy::v1::envelope::Payload::SubscriptionAck(
                            harpy_proto::harpy::v1::SubscriptionAck {
                                subscription_id: client_id.to_string(),
                                success: false,
                                error: Some(format!("Decode error: {}", e)),
                            },
                        )),
                    };
                    let _ = tx.send(error_ack);
                }
            }
            Ok(())
        }
        Message::Text(text) => {
            tracing::debug!("Received text message from {}: {}", client_id, text);
            // Text messages not expected in protobuf protocol, but don't disconnect
            Ok(())
        }
        Message::Close(_) => {
            tracing::info!("Received close frame from {}", client_id);
            Err(true) // Signal to disconnect
        }
        Message::Ping(_data) => {
            // Axum handles pong automatically
            tracing::trace!("Received ping from {}", client_id);
            Ok(())
        }
        Message::Pong(_) => {
            tracing::trace!("Received pong from {}", client_id);
            Ok(())
        }
    }
}

/// Handle a subscription update request from a client
async fn handle_subscription_update(
    sub_req: SubscriptionRequest,
    state: &AppState,
    client_id: &str,
    tx: &backpressure::BackpressureChannel,
) {
    tracing::info!(
        "Updating subscription for {}: {:?} layers",
        client_id,
        sub_req.layers.len()
    );

    // Extract viewport and layers from request
    let viewport = sub_req.viewport.unwrap_or_else(|| BoundingBox {
        min_lat: -90.0,
        max_lat: 90.0,
        min_lon: -180.0,
        max_lon: 180.0,
    });

    let layers: Vec<LayerType> = sub_req
        .layers
        .into_iter()
        .filter_map(|l| match l {
            0 => None, // Unspecified
            1 => Some(LayerType::Aircraft),
            2 => Some(LayerType::Satellite),
            3 => Some(LayerType::Ground),
            4 => Some(LayerType::Vessel),
            5 => Some(LayerType::Camera),
            6 => Some(LayerType::Detection),
            7 => Some(LayerType::Alert),
            _ => None,
        })
        .collect();

    // Log subscription mode and handle playback
    let is_playback = match sub_req.mode {
        mode if mode == SubscriptionMode::Live as i32 => {
            tracing::info!("Client {} subscribed in LIVE mode", client_id);
            false
        }
        mode if mode == SubscriptionMode::Playback as i32 => {
            tracing::info!("Client {} subscribed in PLAYBACK mode", client_id);
            true
        }
        _ => {
            tracing::warn!("Client {} subscribed with unknown mode", client_id);
            false
        }
    };

    // Stop any existing playback task when a new subscription request arrives.
    if let Some((_, handle)) = state.playback_tasks.remove(client_id) {
        handle.abort();
    }

    // Handle playback mode
    if is_playback {
        // Remove from live fanout while playback mode is active.
        state.subscription_manager.unsubscribe(client_id).await;

        if let Some(time_range) = sub_req.time_range {
            match time_range.range {
                Some(harpy_proto::harpy::v1::time_range::Range::Playback(playback)) => {
                    let start_ts_ms = playback.start_ts_ms;
                    let end_ts_ms = playback.end_ts_ms;
                    let speed = 1.0; // Default speed

                    tracing::info!(
                        "Starting playback for {}: {} to {} at {}x speed",
                        client_id,
                        start_ts_ms,
                        end_ts_ms,
                        speed
                    );

                    // Start playback task
                    let subscription = Subscription {
                        viewport: viewport.clone(),
                        layers: layers.clone(),
                        sender: tx.clone(),
                    };
                    let client_id_clone = client_id.to_string();
                    let tx_clone = tx.clone();
                    let db_pool = state.db_pool.clone();

                    let playback_handle = tokio::spawn(async move {
                        let mut playback_rx = playback::start_playback(
                            start_ts_ms,
                            end_ts_ms,
                            speed,
                            subscription,
                            db_pool,
                        )
                        .await;

                        while let Some(envelope) = playback_rx.recv().await {
                            if let Err(unsent) = tx_clone.send(envelope) {
                                match unsent.payload {
                                    Some(
                                        harpy_proto::harpy::v1::envelope::Payload::TrackDeltaBatch(
                                            _,
                                        ),
                                    ) => {
                                        tracing::debug!(
                                            "Dropped playback TrackDeltaBatch for {} due to backpressure",
                                            client_id_clone
                                        );
                                    }
                                    _ => {
                                        tracing::debug!(
                                            "Playback client {} disconnected",
                                            client_id_clone
                                        );
                                        break;
                                    }
                                }
                            }
                        }
                    });
                    state
                        .playback_tasks
                        .insert(client_id.to_string(), playback_handle);
                }
                _ => {
                    tracing::warn!("Playback mode requested but no playback range provided");
                }
            }
        }

        // Send ack for playback mode
        let ack = Envelope {
            schema_version: "1.0.0".to_string(),
            server_ts_ms: now_ms(),
            payload: Some(harpy_proto::harpy::v1::envelope::Payload::SubscriptionAck(
                harpy_proto::harpy::v1::SubscriptionAck {
                    subscription_id: client_id.to_string(),
                    success: true,
                    error: None,
                },
            )),
        };

        if tx.send(ack).is_err() {
            tracing::warn!("Failed to send playback ack to {}", client_id);
        }

        return; // Don't register with subscription manager for playback
    }

    // Create new subscription
    let subscription = Subscription {
        viewport,
        layers,
        sender: tx.clone(),
    };

    // Update subscription
    state
        .subscription_manager
        .subscribe(client_id.to_string(), subscription)
        .await;

    // Send success acknowledgment
    let ack = Envelope {
        schema_version: "1.0.0".to_string(),
        server_ts_ms: now_ms(),
        payload: Some(harpy_proto::harpy::v1::envelope::Payload::SubscriptionAck(
            harpy_proto::harpy::v1::SubscriptionAck {
                subscription_id: client_id.to_string(),
                success: true,
                error: None,
            },
        )),
    };

    if tx.send(ack).is_err() {
        tracing::warn!("Failed to send subscription ack to {}", client_id);
    }
}

/// Encode an envelope to bytes
fn encode_envelope(envelope: &Envelope) -> anyhow::Result<Vec<u8>> {
    let mut buf = Vec::new();
    envelope.encode(&mut buf)?;
    Ok(buf)
}

/// Get current timestamp in milliseconds
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

async fn health_check() -> impl IntoResponse {
    Json(HealthResponse {
        status: "ok".to_string(),
        service: "harpy-relay".to_string(),
    })
}

async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    let client_count = state.subscription_manager.client_count().await;
    format!(
        "# HELP harpy_relay_connected_clients Number of connected WebSocket clients\n\
         # TYPE harpy_relay_connected_clients gauge\n\
         harpy_relay_connected_clients {}\n",
        client_count
    )
}

async fn debug_snapshot_handler(State(state): State<AppState>) -> impl IntoResponse {
    let subscriptions = state.subscription_manager.debug_subscriptions().await;
    let mut subscriptions_by_layer: HashMap<String, usize> = HashMap::new();
    let mut track_batches_dropped = 0usize;
    let mut track_batches_sent = 0usize;
    let mut high_priority_sent = 0usize;

    for subscription in &subscriptions {
        for layer in &subscription.layers {
            *subscriptions_by_layer.entry(layer.clone()).or_insert(0) += 1;
        }
        track_batches_dropped += subscription.backpressure.track_batches_dropped;
        track_batches_sent += subscription.backpressure.track_batches_sent;
        high_priority_sent += subscription.backpressure.high_priority_sent;
    }

    let relay = RelayDebugSnapshot {
        connected_clients: subscriptions.len(),
        playback_clients: state.playback_tasks.len(),
        subscriptions,
        subscriptions_by_layer,
        backpressure_totals: BackpressureTotals {
            track_batches_dropped,
            track_batches_sent,
            high_priority_sent,
        },
    };

    let redis = match &state.redis_client {
        Some(client) => {
            let mut conn = match client.get_async_connection().await {
                Ok(conn) => conn,
                Err(err) => {
                    tracing::debug!("debug snapshot redis connect error: {}", err);
                    return Json(DebugSnapshotResponse {
                        ts_ms: now_ms(),
                        relay,
                        redis: RedisDebugSnapshot {
                            connected: false,
                            track_cache: TrackCacheStats {
                                total: 0,
                                by_kind: HashMap::new(),
                                by_provider: HashMap::new(),
                                last_update_ts_ms: 0,
                            },
                            providers: Vec::new(),
                        },
                    });
                }
            };

            let provider_keys = redis::cmd("KEYS")
                .arg("provider:status:*")
                .query_async::<_, Vec<String>>(&mut conn)
                .await
                .unwrap_or_default();

            let mut providers = Vec::with_capacity(provider_keys.len());
            for key in provider_keys {
                if let Ok(value) = redis::cmd("GET")
                    .arg(&key)
                    .query_async::<_, String>(&mut conn)
                    .await
                {
                    if let Ok(parsed) = serde_json::from_str::<ProviderStatusDebug>(&value) {
                        providers.push(parsed);
                    }
                }
            }
            providers.sort_by(|a, b| a.provider_id.cmp(&b.provider_id));

            let track_keys = redis::cmd("KEYS")
                .arg("track:*")
                .query_async::<_, Vec<String>>(&mut conn)
                .await
                .unwrap_or_default();

            let mut by_kind: HashMap<String, usize> = HashMap::new();
            let mut by_provider: HashMap<String, usize> = HashMap::new();
            let mut last_update_ts_ms = 0u64;

            for key in &track_keys {
                if let Ok(value) = redis::cmd("GET")
                    .arg(key)
                    .query_async::<_, String>(&mut conn)
                    .await
                {
                    if let Ok(parsed) = serde_json::from_str::<TrackCacheEntry>(&value) {
                        let kind_name = match parsed.kind {
                            1 => "AIRCRAFT",
                            2 => "SATELLITE",
                            3 => "GROUND",
                            4 => "VESSEL",
                            _ => "UNSPECIFIED",
                        };
                        *by_kind.entry(kind_name.to_string()).or_insert(0) += 1;
                        if !parsed.provider_id.is_empty() {
                            *by_provider.entry(parsed.provider_id).or_insert(0) += 1;
                        }
                        if parsed.ts_ms > last_update_ts_ms {
                            last_update_ts_ms = parsed.ts_ms;
                        }
                    }
                }
            }

            RedisDebugSnapshot {
                connected: true,
                track_cache: TrackCacheStats {
                    total: track_keys.len(),
                    by_kind,
                    by_provider,
                    last_update_ts_ms,
                },
                providers,
            }
        }
        None => RedisDebugSnapshot {
            connected: false,
            track_cache: TrackCacheStats {
                total: 0,
                by_kind: HashMap::new(),
                by_provider: HashMap::new(),
                last_update_ts_ms: 0,
            },
            providers: Vec::new(),
        },
    };

    Json(DebugSnapshotResponse {
        ts_ms: now_ms(),
        relay,
        redis,
    })
}
