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
use harpy_proto::harpy::v1::{
    envelope::Payload, BoundingBox, CircuitState, Envelope, Freshness, LayerType, ProviderStatus,
    SubscriptionAck, SubscriptionMode, TrackDelta, TrackDeltaBatch, TrackKind,
};
use metrics_exporter_prometheus::{PrometheusBuilder, PrometheusHandle};
use prost::Message as ProstMessage;
use serde::Serialize;
use std::{
    collections::{HashMap, HashSet},
    net::SocketAddr,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc,
    },
    time::Duration,
};
use tokio::sync::broadcast;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    tx: broadcast::Sender<NodeEvent>,
    subs: Arc<DashMap<String, ClientSub>>,
    provider_snapshots: Arc<DashMap<String, ProviderSnapshot>>,
    metrics: PrometheusHandle,
    debug_counters: Arc<DebugCounters>,
}

#[derive(Clone)]
enum NodeEvent {
    TrackBatch(Arc<Vec<TrackDelta>>),
    ProviderStatus(ProviderStatus),
}

#[derive(Clone)]
struct ClientSub {
    viewport: BoundingBox,
    layers: HashSet<i32>,
    mode: i32,
}

impl Default for ClientSub {
    fn default() -> Self {
        Self {
            viewport: BoundingBox {
                min_lat: -90.0,
                min_lon: -180.0,
                max_lat: 90.0,
                max_lon: 180.0,
            },
            layers: default_layers(),
            mode: SubscriptionMode::Live as i32,
        }
    }
}

#[derive(Default)]
struct DebugCounters {
    tracks_sent: AtomicU64,
    provider_status_sent: AtomicU64,
}

#[derive(Clone, Serialize)]
struct ProviderSnapshot {
    provider_id: String,
    circuit_state: String,
    freshness: String,
    last_update_ts_ms: u64,
    last_success: bool,
}

#[derive(Serialize)]
struct DebugSnapshotResponse {
    ts_ms: u64,
    relay: RelayDebugSnapshot,
    redis: RedisDebugSnapshot,
}

#[derive(Serialize)]
struct RelayDebugSnapshot {
    connected_clients: usize,
    playback_clients: usize,
    backpressure_totals: BackpressureTotals,
}

#[derive(Serialize)]
struct BackpressureTotals {
    track_batches_dropped: usize,
    track_batches_sent: usize,
    high_priority_sent: usize,
}

#[derive(Serialize)]
struct RedisDebugSnapshot {
    connected: bool,
    providers: Vec<ProviderSnapshot>,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    service: String,
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

    let port: u16 = std::env::var("NODE_PORT")
        .unwrap_or_else(|_| "8080".to_string())
        .parse()?;
    let metrics = PrometheusBuilder::new().install_recorder()?;

    let (tx, _rx) = broadcast::channel::<NodeEvent>(2048);
    let state = AppState {
        tx,
        subs: Arc::new(DashMap::new()),
        provider_snapshots: Arc::new(DashMap::new()),
        metrics,
        debug_counters: Arc::new(DebugCounters::default()),
    };

    tokio::spawn(provider_loop_adsb(state.clone()));
    tokio::spawn(provider_loop_tle(state.clone()));

    let app = Router::new()
        .route("/health", get(health))
        .route("/metrics", get(metrics_handler))
        .route("/api/debug/snapshot", get(debug_snapshot_handler))
        .route("/ws", get(ws_handler))
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    tracing::info!("harpy-node listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        service: "harpy-node".to_string(),
    })
}

async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    (
        [("content-type", "text/plain; version=0.0.4")],
        state.metrics.render(),
    )
}

async fn debug_snapshot_handler(State(state): State<AppState>) -> impl IntoResponse {
    let mut providers: Vec<ProviderSnapshot> = state
        .provider_snapshots
        .iter()
        .map(|entry| entry.value().clone())
        .collect();
    providers.sort_by(|a, b| a.provider_id.cmp(&b.provider_id));

    Json(DebugSnapshotResponse {
        ts_ms: now_ms(),
        relay: RelayDebugSnapshot {
            connected_clients: state.subs.len(),
            playback_clients: state
                .subs
                .iter()
                .filter(|entry| entry.value().mode == SubscriptionMode::Playback as i32)
                .count(),
            backpressure_totals: BackpressureTotals {
                track_batches_dropped: 0,
                track_batches_sent: state.debug_counters.tracks_sent.load(Ordering::Relaxed)
                    as usize,
                high_priority_sent: state
                    .debug_counters
                    .provider_status_sent
                    .load(Ordering::Relaxed) as usize,
            },
        },
        redis: RedisDebugSnapshot {
            connected: false,
            providers,
        },
    })
}

async fn ws_handler(State(state): State<AppState>, ws: WebSocketUpgrade) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: AppState) {
    let client_id = format!("client-{}", Uuid::new_v4().simple());
    state.subs.insert(client_id.clone(), ClientSub::default());
    metrics::increment_gauge!("harpy_ws_connections", 1.0);

    if send_subscription_ack(&mut socket, &client_id, true, None)
        .await
        .is_err()
    {
        state.subs.remove(&client_id);
        metrics::decrement_gauge!("harpy_ws_connections", 1.0);
        return;
    }

    let mut rx = state.tx.subscribe();

    loop {
        tokio::select! {
            incoming = socket.recv() => {
                match incoming {
                    Some(Ok(Message::Binary(data))) => {
                        if let Err(error) = handle_client_binary_message(&client_id, &state, data) {
                            let _ = send_subscription_ack(&mut socket, &client_id, false, Some(error)).await;
                        } else {
                            let _ = send_subscription_ack(&mut socket, &client_id, true, None).await;
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        break;
                    }
                    Some(Ok(_)) => {
                        // No-op for text/ping/pong.
                    }
                    Some(Err(err)) => {
                        tracing::warn!("ws client {} transport error: {}", client_id, err);
                        break;
                    }
                    None => break,
                }
            }
            outbound = rx.recv() => {
                match outbound {
                    Ok(event) => {
                        let sub = state
                            .subs
                            .get(&client_id)
                            .map(|entry| entry.value().clone())
                            .unwrap_or_default();

                        if let Some((envelope, track_count, provider_status_count)) = event_to_envelope(event, &sub) {
                            match encode_envelope(&envelope) {
                                Ok(bytes) => {
                                    if socket.send(Message::Binary(bytes)).await.is_err() {
                                        break;
                                    }
                                    if track_count > 0 {
                                        metrics::counter!("harpy_tracks_sent", track_count);
                                        state
                                            .debug_counters
                                            .tracks_sent
                                            .fetch_add(track_count, Ordering::Relaxed);
                                    }
                                    if provider_status_count > 0 {
                                        metrics::counter!(
                                            "harpy_provider_status_sent",
                                            provider_status_count
                                        );
                                        state
                                            .debug_counters
                                            .provider_status_sent
                                            .fetch_add(provider_status_count, Ordering::Relaxed);
                                    }
                                }
                                Err(err) => tracing::error!("failed to encode outgoing envelope: {}", err),
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(skipped)) => {
                        tracing::warn!("client {} lagged {} broadcast messages", client_id, skipped);
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        }
    }

    state.subs.remove(&client_id);
    metrics::decrement_gauge!("harpy_ws_connections", 1.0);
}

fn handle_client_binary_message(
    client_id: &str,
    state: &AppState,
    data: Vec<u8>,
) -> Result<(), String> {
    let envelope = Envelope::decode(&*data).map_err(|err| format!("decode error: {err}"))?;
    let Some(payload) = envelope.payload else {
        return Ok(());
    };

    match payload {
        Payload::SubscriptionRequest(req) => {
            let sub = subscription_from_request(req);
            state.subs.insert(client_id.to_string(), sub);
            Ok(())
        }
        _ => Ok(()),
    }
}

fn subscription_from_request(req: harpy_proto::harpy::v1::SubscriptionRequest) -> ClientSub {
    let mut layers: HashSet<i32> = req.layers.into_iter().collect();
    if layers.is_empty() {
        layers = default_layers();
    }
    ClientSub {
        viewport: req.viewport.unwrap_or_else(default_viewport),
        layers,
        mode: req.mode,
    }
}

fn default_viewport() -> BoundingBox {
    BoundingBox {
        min_lat: -90.0,
        min_lon: -180.0,
        max_lat: 90.0,
        max_lon: 180.0,
    }
}

fn default_layers() -> HashSet<i32> {
    HashSet::from([
        LayerType::Aircraft as i32,
        LayerType::Satellite as i32,
        LayerType::Ground as i32,
        LayerType::Vessel as i32,
        LayerType::Camera as i32,
        LayerType::Detection as i32,
    ])
}

fn event_to_envelope(event: NodeEvent, sub: &ClientSub) -> Option<(Envelope, u64, u64)> {
    match event {
        NodeEvent::TrackBatch(tracks) => {
            let filtered = filter_tracks_for_sub(&tracks, sub);
            if filtered.is_empty() {
                return None;
            }
            let filtered_len = filtered.len() as u64;
            Some((
                Envelope {
                    schema_version: "1.0.0".to_string(),
                    server_ts_ms: now_ms(),
                    payload: Some(Payload::TrackDeltaBatch(TrackDeltaBatch {
                        deltas: filtered,
                    })),
                },
                filtered_len,
                0,
            ))
        }
        NodeEvent::ProviderStatus(provider_status) => Some((
            Envelope {
                schema_version: "1.0.0".to_string(),
                server_ts_ms: now_ms(),
                payload: Some(Payload::ProviderStatus(provider_status)),
            },
            0,
            1,
        )),
    }
}

fn filter_tracks_for_sub(tracks: &[TrackDelta], sub: &ClientSub) -> Vec<TrackDelta> {
    tracks
        .iter()
        .filter(|track| layer_allowed(track.kind, &sub.layers))
        .filter(|track| track_in_viewport(track, &sub.viewport))
        .cloned()
        .collect()
}

fn layer_allowed(kind: i32, layers: &HashSet<i32>) -> bool {
    match TrackKind::try_from(kind).unwrap_or(TrackKind::Unspecified) {
        TrackKind::Aircraft => layers.contains(&(LayerType::Aircraft as i32)),
        TrackKind::Satellite => layers.contains(&(LayerType::Satellite as i32)),
        TrackKind::Ground => {
            layers.contains(&(LayerType::Ground as i32))
                || layers.contains(&(LayerType::Camera as i32))
                || layers.contains(&(LayerType::Detection as i32))
        }
        TrackKind::Vessel => layers.contains(&(LayerType::Vessel as i32)),
        TrackKind::Unspecified => true,
    }
}

fn track_in_viewport(track: &TrackDelta, viewport: &BoundingBox) -> bool {
    let Some(position) = track.position.as_ref() else {
        return false;
    };

    let south = viewport.min_lat.min(viewport.max_lat);
    let north = viewport.min_lat.max(viewport.max_lat);
    if position.lat < south || position.lat > north {
        return false;
    }

    if viewport.min_lon <= viewport.max_lon {
        position.lon >= viewport.min_lon && position.lon <= viewport.max_lon
    } else {
        // Dateline-crossing bbox.
        position.lon >= viewport.min_lon || position.lon <= viewport.max_lon
    }
}

async fn send_subscription_ack(
    socket: &mut WebSocket,
    client_id: &str,
    success: bool,
    error: Option<String>,
) -> Result<(), ()> {
    let ack = Envelope {
        schema_version: "1.0.0".to_string(),
        server_ts_ms: now_ms(),
        payload: Some(Payload::SubscriptionAck(SubscriptionAck {
            subscription_id: client_id.to_string(),
            success,
            error,
        })),
    };
    let bytes = encode_envelope(&ack).map_err(|_| ())?;
    socket.send(Message::Binary(bytes)).await.map_err(|_| ())
}

fn encode_envelope(envelope: &Envelope) -> anyhow::Result<Vec<u8>> {
    let mut buf = Vec::new();
    envelope.encode(&mut buf)?;
    Ok(buf)
}

async fn provider_loop_adsb(state: AppState) {
    let use_real = env_bool("ENABLE_REAL_ADSB", false);
    let interval_secs = env_u64("ADSB_POLL_INTERVAL_SECS", 1);
    let provider: Arc<dyn Provider> = if use_real {
        match OpenSkyProvider::from_env() {
            Ok(provider) => {
                if provider.is_anonymous() {
                    tracing::warn!(
                        "ADS-B OpenSky running in anonymous mode (reduced rate limits and resolution)"
                    );
                }
                Arc::new(provider)
            }
            Err(err) => {
                tracing::warn!(
                    "ADS-B OpenSky initialization failed: {}. Falling back to deterministic mock.",
                    err
                );
                Arc::new(AdsbMockProvider::new())
            }
        }
    } else {
        Arc::new(AdsbMockProvider::new())
    };

    poll_provider(provider, "ADS-B", interval_secs, state).await;
}

async fn provider_loop_tle(state: AppState) {
    let use_real = env_bool("ENABLE_REAL_TLE", false);
    let interval_secs = env_u64("TLE_POLL_INTERVAL_SECS", 1);
    let provider: Arc<dyn Provider> = if use_real {
        match CelesTrakProvider::from_env() {
            Ok(provider) => Arc::new(provider),
            Err(err) => {
                tracing::warn!(
                    "TLE CelesTrak initialization failed: {}. Falling back to deterministic mock.",
                    err
                );
                Arc::new(TleMockProvider::new())
            }
        }
    } else {
        Arc::new(TleMockProvider::new())
    };

    poll_provider(provider, "CelesTrak", interval_secs, state).await;
}

async fn poll_provider(
    provider: Arc<dyn Provider>,
    source_label: &str,
    interval_secs: u64,
    state: AppState,
) {
    let mut interval = tokio::time::interval(Duration::from_secs(interval_secs.max(1)));
    let mut consecutive_failures = 0_u32;
    let mut last_success_ts_ms = 0_u64;

    loop {
        interval.tick().await;
        let provider_id = provider.provider_id().to_string();
        match provider.fetch().await {
            Ok(deltas) => {
                let items = deltas.len();
                consecutive_failures = 0;
                last_success_ts_ms = now_ms();

                let _ = state.tx.send(NodeEvent::TrackBatch(Arc::new(deltas)));

                let status = ProviderStatus {
                    provider_id: provider_id.clone(),
                    circuit_state: CircuitState::Closed as i32,
                    freshness: Freshness::Fresh as i32,
                    last_success_ts_ms,
                    failure_count: consecutive_failures,
                    error_message: None,
                    meta: HashMap::from([
                        ("items".to_string(), items.to_string()),
                        ("source".to_string(), source_label.to_string()),
                    ]),
                };

                update_provider_snapshot(&state, &status, true);
                let _ = state.tx.send(NodeEvent::ProviderStatus(status));
            }
            Err(err) => {
                consecutive_failures = consecutive_failures.saturating_add(1);
                let circuit_state = if consecutive_failures > 2 {
                    CircuitState::Open
                } else {
                    CircuitState::HalfOpen
                };
                let freshness = freshness_from_age(now_ms().saturating_sub(last_success_ts_ms));

                tracing::warn!(
                    "provider={} source={} fetch failed: {} (consecutive_failures={})",
                    provider_id,
                    source_label,
                    err,
                    consecutive_failures
                );

                let status = ProviderStatus {
                    provider_id: provider_id.clone(),
                    circuit_state: circuit_state as i32,
                    freshness: freshness as i32,
                    last_success_ts_ms,
                    failure_count: consecutive_failures,
                    error_message: Some(err.to_string()),
                    meta: HashMap::from([
                        ("items".to_string(), "0".to_string()),
                        ("source".to_string(), source_label.to_string()),
                    ]),
                };
                update_provider_snapshot(&state, &status, false);
                let _ = state.tx.send(NodeEvent::ProviderStatus(status));
            }
        }
    }
}

fn update_provider_snapshot(state: &AppState, status: &ProviderStatus, last_success: bool) {
    let snapshot = ProviderSnapshot {
        provider_id: status.provider_id.clone(),
        circuit_state: circuit_name(status.circuit_state).to_string(),
        freshness: freshness_name(status.freshness).to_string(),
        last_update_ts_ms: now_ms(),
        last_success,
    };
    state
        .provider_snapshots
        .insert(status.provider_id.clone(), snapshot);
}

fn freshness_from_age(age_ms: u64) -> Freshness {
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

fn circuit_name(circuit: i32) -> &'static str {
    match CircuitState::try_from(circuit).unwrap_or(CircuitState::Unspecified) {
        CircuitState::Closed => "CIRCUIT_STATE_CLOSED",
        CircuitState::Open => "CIRCUIT_STATE_OPEN",
        CircuitState::HalfOpen => "CIRCUIT_STATE_HALF_OPEN",
        CircuitState::Unspecified => "CIRCUIT_STATE_UNSPECIFIED",
    }
}

fn freshness_name(freshness: i32) -> &'static str {
    match Freshness::try_from(freshness).unwrap_or(Freshness::Unspecified) {
        Freshness::Fresh => "FRESHNESS_FRESH",
        Freshness::Aging => "FRESHNESS_AGING",
        Freshness::Stale => "FRESHNESS_STALE",
        Freshness::Critical => "FRESHNESS_CRITICAL",
        Freshness::Unspecified => "FRESHNESS_UNSPECIFIED",
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
