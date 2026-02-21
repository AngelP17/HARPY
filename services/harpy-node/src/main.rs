mod adapters;

use adapters::{
    adsb_mock::AdsbMockProvider, adsb_opensky::OpenSkyProvider, tle_celestrak::CelesTrakProvider,
    tle_mock::TleMockProvider, Provider,
};

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use dashmap::DashMap;
use futures::{SinkExt, StreamExt};
use harpy_proto::harpy::v1::{
    envelope, BoundingBox, CircuitState, Envelope, Freshness, LayerType, ProviderStatus,
    SubscriptionAck, SubscriptionRequest, TrackDelta, TrackDeltaBatch, TrackKind,
};
use metrics::{counter, gauge};
use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};
use prost::Message as ProstMessage;
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    net::SocketAddr,
    sync::Arc,
    time::Duration,
};
use tokio::sync::{broadcast, mpsc};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

#[derive(Serialize)]
struct Health {
    status: String,
    service: String,
}

#[derive(Clone)]
struct AppState {
    tx: broadcast::Sender<ServerEvent>,
    subs: Arc<DashMap<String, ClientSub>>,
    metrics: PrometheusHandle,
}

#[derive(Clone, Debug)]
enum ServerEvent {
    Tracks(Arc<Vec<TrackDelta>>),
    ProviderStatus(ProviderStatus),
}

#[derive(Clone, Debug)]
struct ClientSub {
    viewport: BoundingBox,
    layers: HashSet<i32>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "harpy_node=info,tower_http=info".into()),
        )
        .with(tracing_subscriber::fmt::layer().json())
        .init();

    let metrics = PrometheusBuilder::new().install_recorder()?;
    let port: u16 = std::env::var("NODE_PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()?;

    let (tx, _rx) = broadcast::channel::<ServerEvent>(1024);
    let state = AppState {
        tx,
        subs: Arc::new(DashMap::new()),
        metrics,
    };

    tokio::spawn(provider_loop_adsb(state.clone()));
    tokio::spawn(provider_loop_tle(state.clone()));

    let app = Router::new()
        .route("/health", get(health))
        .route("/metrics", get(metrics_handler))
        .route("/ws", get(ws_handler))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("harpy-node listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> Json<Health> {
    Json(Health {
        status: "ok".to_string(),
        service: "harpy-node".to_string(),
    })
}

async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    (
        [("content-type", "text/plain; version=0.0.4; charset=utf-8")],
        state.metrics.render(),
    )
}

async fn ws_handler(State(state): State<AppState>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let client_id = Uuid::new_v4().to_string();
    state.subs.insert(client_id.clone(), default_subscription());
    gauge!("harpy_ws_connections").increment(1.0);

    let (mut ws_tx, mut ws_rx) = socket.split();
    let mut rx = state.tx.subscribe();
    let (direct_tx, mut direct_rx) = mpsc::unbounded_channel::<Message>();
    send_subscription_ack(&direct_tx, &client_id, true, None);

    let subs = state.subs.clone();
    let writer_client_id = client_id.clone();
    let write_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                direct = direct_rx.recv() => {
                    match direct {
                        Some(msg) => {
                            if ws_tx.send(msg).await.is_err() {
                                break;
                            }
                        }
                        None => break,
                    }
                }
                received = rx.recv() => {
                    match received {
                        Ok(ServerEvent::Tracks(tracks)) => {
                            let Some(sub) = subs.get(&writer_client_id) else {
                                break;
                            };
                            let filtered = filter_tracks_for_sub(tracks.as_ref(), &sub);
                            drop(sub);

                            if filtered.is_empty() {
                                continue;
                            }

                            let filtered_count = filtered.len() as u64;
                            let envelope = Envelope {
                                schema_version: "1.0.0".to_string(),
                                server_ts_ms: now_ms(),
                                payload: Some(envelope::Payload::TrackDeltaBatch(TrackDeltaBatch {
                                    deltas: filtered,
                                })),
                            };

                            match encode_envelope(&envelope) {
                                Ok(bytes) => {
                                    counter!("harpy_tracks_sent").increment(filtered_count);
                                    if ws_tx.send(Message::Binary(bytes.into())).await.is_err() {
                                        break;
                                    }
                                }
                                Err(err) => {
                                    tracing::warn!("failed to encode track payload: {}", err);
                                }
                            }
                        }
                        Ok(ServerEvent::ProviderStatus(status)) => {
                            let envelope = Envelope {
                                schema_version: "1.0.0".to_string(),
                                server_ts_ms: now_ms(),
                                payload: Some(envelope::Payload::ProviderStatus(status)),
                            };
                            match encode_envelope(&envelope) {
                                Ok(bytes) => {
                                    counter!("harpy_provider_status_sent").increment(1);
                                    if ws_tx.send(Message::Binary(bytes.into())).await.is_err() {
                                        break;
                                    }
                                }
                                Err(err) => {
                                    tracing::warn!("failed to encode provider status payload: {}", err);
                                }
                            }
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Lagged(skipped)) => {
                            tracing::warn!("ws writer lagged by {} messages", skipped);
                        }
                        Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                    }
                }
            }
        }
    });

    while let Some(msg) = ws_rx.next().await {
        match msg {
            Ok(Message::Binary(data)) => {
                match Envelope::decode(data.as_ref()) {
                    Ok(envelope) => {
                        if let Some(envelope::Payload::SubscriptionRequest(req)) = envelope.payload {
                            apply_subscription(&state, &client_id, req).await;
                            send_subscription_ack(&direct_tx, &client_id, true, None);
                        }
                    }
                    Err(err) => {
                        send_subscription_ack(
                            &direct_tx,
                            &client_id,
                            false,
                            Some(format!("decode error: {err}")),
                        );
                    }
                }
            }
            Ok(Message::Ping(payload)) => {
                if direct_tx.send(Message::Pong(payload)).is_err() {
                    break;
                }
            }
            Ok(Message::Close(_)) => break,
            Ok(_) => {}
            Err(err) => {
                tracing::warn!("websocket error for {}: {}", client_id, err);
                break;
            }
        }
    }

    write_task.abort();
    state.subs.remove(&client_id);
    gauge!("harpy_ws_connections").decrement(1.0);
}

async fn apply_subscription(state: &AppState, client_id: &str, req: SubscriptionRequest) {
    let viewport = req.viewport.unwrap_or_else(world_bbox);
    let mut layers: HashSet<i32> = req
        .layers
        .into_iter()
        .filter(|v| *v != LayerType::Unspecified as i32)
        .collect();

    if layers.is_empty() {
        layers = default_layers();
    }

    state.subs.insert(
        client_id.to_string(),
        ClientSub {
            viewport,
            layers,
        },
    );
}

fn filter_tracks_for_sub(tracks: &[TrackDelta], sub: &ClientSub) -> Vec<TrackDelta> {
    tracks
        .iter()
        .filter(|track| track_matches_sub(track, sub))
        .cloned()
        .collect()
}

fn track_matches_sub(track: &TrackDelta, sub: &ClientSub) -> bool {
    let Some(layer) = layer_for_track(track.kind) else {
        return false;
    };
    if !sub.layers.contains(&layer) {
        return false;
    }

    let Some(position) = track.position.as_ref() else {
        return false;
    };

    if position.lat < sub.viewport.min_lat || position.lat > sub.viewport.max_lat {
        return false;
    }

    if sub.viewport.min_lon <= sub.viewport.max_lon {
        position.lon >= sub.viewport.min_lon && position.lon <= sub.viewport.max_lon
    } else {
        // Dateline-aware bounding box support.
        position.lon >= sub.viewport.min_lon || position.lon <= sub.viewport.max_lon
    }
}

fn layer_for_track(kind: i32) -> Option<i32> {
    match TrackKind::try_from(kind).unwrap_or(TrackKind::Unspecified) {
        TrackKind::Aircraft => Some(LayerType::Aircraft as i32),
        TrackKind::Satellite => Some(LayerType::Satellite as i32),
        TrackKind::Ground => Some(LayerType::Ground as i32),
        TrackKind::Vessel => Some(LayerType::Vessel as i32),
        TrackKind::Unspecified => None,
    }
}

fn default_layers() -> HashSet<i32> {
    [
        LayerType::Aircraft as i32,
        LayerType::Satellite as i32,
        LayerType::Ground as i32,
        LayerType::Vessel as i32,
    ]
    .into_iter()
    .collect()
}

fn world_bbox() -> BoundingBox {
    BoundingBox {
        min_lat: -90.0,
        min_lon: -180.0,
        max_lat: 90.0,
        max_lon: 180.0,
    }
}

fn default_subscription() -> ClientSub {
    ClientSub {
        viewport: world_bbox(),
        layers: default_layers(),
    }
}

fn send_subscription_ack(
    direct_tx: &mpsc::UnboundedSender<Message>,
    client_id: &str,
    success: bool,
    error: Option<String>,
) {
    let ack = Envelope {
        schema_version: "1.0.0".to_string(),
        server_ts_ms: now_ms(),
        payload: Some(envelope::Payload::SubscriptionAck(SubscriptionAck {
            subscription_id: client_id.to_string(),
            success,
            error,
        })),
    };

    if let Ok(bytes) = encode_envelope(&ack) {
        let _ = direct_tx.send(Message::Binary(bytes.into()));
    }
}

fn encode_envelope(envelope: &Envelope) -> anyhow::Result<Vec<u8>> {
    let mut buf = Vec::new();
    envelope.encode(&mut buf)?;
    Ok(buf)
}

async fn provider_loop_adsb(state: AppState) {
    let use_real = env_bool("ENABLE_REAL_ADSB", false);

    let provider: Arc<dyn Provider> = if use_real {
        match OpenSkyProvider::from_env() {
            Ok(p) => {
                tracing::info!("ADS-B using OpenSky provider");
                Arc::new(p)
            }
            Err(err) => {
                tracing::warn!(
                    "ADS-B OpenSky initialization failed ({}), falling back to mock",
                    err
                );
                Arc::new(AdsbMockProvider::new())
            }
        }
    } else {
        tracing::info!("ADS-B using deterministic mock provider");
        Arc::new(AdsbMockProvider::new())
    };

    let interval_secs = env_u64("ADSB_POLL_INTERVAL_SECS", 1);
    poll_provider(provider, "ADS-B", interval_secs, state).await;
}

async fn provider_loop_tle(state: AppState) {
    let use_real = env_bool("ENABLE_REAL_TLE", false);

    let provider: Arc<dyn Provider> = if use_real {
        match CelesTrakProvider::from_env() {
            Ok(p) => {
                tracing::info!("TLE using CelesTrak provider");
                Arc::new(p)
            }
            Err(err) => {
                tracing::warn!(
                    "TLE CelesTrak initialization failed ({}), falling back to mock",
                    err
                );
                Arc::new(TleMockProvider::new())
            }
        }
    } else {
        tracing::info!("TLE using deterministic mock provider");
        Arc::new(TleMockProvider::new())
    };

    let interval_secs = env_u64("TLE_POLL_INTERVAL_SECS", 1);
    poll_provider(provider, "CelesTrak", interval_secs, state).await;
}

async fn poll_provider(
    provider: Arc<dyn Provider>,
    source_label: &str,
    interval_secs: u64,
    state: AppState,
) {
    let mut interval = tokio::time::interval(Duration::from_secs(interval_secs.max(1)));
    let mut consecutive_failures: u32 = 0;
    let mut last_success_ts_ms: u64 = 0;

    loop {
        interval.tick().await;

        match provider.fetch().await {
            Ok(deltas) => {
                consecutive_failures = 0;
                last_success_ts_ms = now_ms();
                let item_count = deltas.len();

                let _ = state
                    .tx
                    .send(ServerEvent::Tracks(Arc::new(deltas)));

                let status = ProviderStatus {
                    provider_id: provider.provider_id().to_string(),
                    circuit_state: CircuitState::Closed as i32,
                    freshness: Freshness::Fresh as i32,
                    last_success_ts_ms,
                    failure_count: 0,
                    error_message: None,
                    meta: status_meta(source_label, item_count, true),
                };
                let _ = state.tx.send(ServerEvent::ProviderStatus(status));
                counter!("harpy_provider_poll_success_total").increment(1);
            }
            Err(err) => {
                consecutive_failures = consecutive_failures.saturating_add(1);
                counter!("harpy_provider_poll_error_total").increment(1);
                tracing::warn!(
                    "provider {} poll error: {}",
                    provider.provider_id(),
                    err
                );

                let age_ms = if last_success_ts_ms == 0 {
                    u64::MAX
                } else {
                    now_ms().saturating_sub(last_success_ts_ms)
                };

                let status = ProviderStatus {
                    provider_id: provider.provider_id().to_string(),
                    circuit_state: circuit_from_failures(consecutive_failures) as i32,
                    freshness: freshness_from_age_ms(age_ms) as i32,
                    last_success_ts_ms,
                    failure_count: consecutive_failures,
                    error_message: Some(err.to_string()),
                    meta: status_meta(source_label, 0, false),
                };
                let _ = state.tx.send(ServerEvent::ProviderStatus(status));
            }
        }
    }
}

fn status_meta(source_label: &str, item_count: usize, success: bool) -> HashMap<String, String> {
    let mut meta = HashMap::new();
    meta.insert("source_label".to_string(), source_label.to_string());
    meta.insert("items".to_string(), item_count.to_string());
    meta.insert(
        "status".to_string(),
        if success { "ok" } else { "error" }.to_string(),
    );
    meta
}

fn freshness_from_age_ms(age_ms: u64) -> Freshness {
    if age_ms < 10_000 {
        Freshness::Fresh
    } else if age_ms < 30_000 {
        Freshness::Aging
    } else if age_ms < 90_000 {
        Freshness::Stale
    } else {
        Freshness::Critical
    }
}

fn circuit_from_failures(failures: u32) -> CircuitState {
    if failures == 0 {
        CircuitState::Closed
    } else if failures <= 2 {
        CircuitState::HalfOpen
    } else {
        CircuitState::Open
    }
}

fn env_bool(name: &str, default: bool) -> bool {
    match std::env::var(name) {
        Ok(v) => matches!(
            v.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => default,
    }
}

fn env_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(default)
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
