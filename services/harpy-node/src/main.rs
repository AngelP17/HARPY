mod adapters;

use adapters::{
    adsb_mock::AdsbMockProvider, adsb_opensky::OpenSkyProvider, tle_celestrak::CelesTrakProvider,
    tle_mock::TleMockProvider, Provider,
};

use axum::{
    extract::ws::{Message, WebSocket, WebSocketUpgrade},
    response::IntoResponse,
    routing::get,
    Json, Router,
};
use dashmap::DashMap;
use futures::{SinkExt, StreamExt};
use metrics::{counter, gauge};
use metrics_exporter_prometheus::PrometheusBuilder;
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, net::SocketAddr, sync::Arc, time::Duration};
use tokio::sync::broadcast;
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use uuid::Uuid;

use harpy_proto::harpy::v1::TrackKind;

#[derive(Serialize)]
struct Health {
    status: String,
    service: String,
}

#[derive(Clone)]
struct AppState {
    tx: broadcast::Sender<ServerEvent>,
    subs: Arc<DashMap<String, ClientSub>>,
    metrics_handle: metrics_exporter_prometheus::PrometheusHandle,
}

#[derive(Clone, Debug)]
struct ClientSub {
    #[allow(dead_code)]
    preset: String,
    layers: HashSet<String>,
    bbox: Option<Bbox>,
}

#[derive(Clone, Debug, Deserialize)]
struct Bbox {
    west: f64,
    south: f64,
    east: f64,
    north: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
enum ServerEvent {
    #[serde(rename = "tracks")]
    Tracks { tracks: Vec<UiTrack> },

    #[serde(rename = "providerStatus")]
    ProviderStatus {
        #[serde(rename = "providerStatus")]
        provider_status: Vec<UiProviderStatus>,
    },

    #[serde(rename = "pong")]
    Pong { t0: i64 },
}

#[derive(Debug, Clone, Serialize)]
struct UiTrack {
    id: String,
    kind: String,
    lat: f64,
    lon: f64,
    alt_m: f64,
    heading_deg: f64,
    speed_mps: f64,
    updated_ms: i64,
}

#[derive(Debug, Clone, Serialize)]
struct UiProviderStatus {
    provider_id: String,
    state: String,
    freshness: String,
    last_update_ms: i64,
    items: i64,
    source_label: String,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "type")]
enum ClientMsg {
    #[serde(rename = "ping")]
    Ping { t0: i64 },

    #[serde(rename = "subscribe")]
    Subscribe {
        preset: String,
        layers: Vec<String>,
        bbox: Option<Bbox>,
    },
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

    let metrics_handle = PrometheusBuilder::new()
        .install_recorder()
        .expect("failed to install Prometheus recorder");

    let (tx, _rx) = broadcast::channel::<ServerEvent>(1024);
    let state = AppState {
        tx,
        subs: Arc::new(DashMap::new()),
        metrics_handle,
    };

    tokio::spawn(provider_loop_adsb(state.clone()));
    tokio::spawn(provider_loop_tle(state.clone()));

    let app = Router::new()
        .route("/health", get(health))
        .route("/ws", get(ws_handler))
        .route("/metrics", get(metrics_handler))
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

async fn ws_handler(
    ws: WebSocketUpgrade,
    axum::extract::State(state): axum::extract::State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn metrics_handler(
    axum::extract::State(state): axum::extract::State<AppState>,
) -> impl IntoResponse {
    (
        [("content-type", "text/plain; version=0.0.4")],
        state.metrics_handle.render(),
    )
}

fn default_layers() -> HashSet<String> {
    ["AIR", "SAT", "SEISMIC", "WEATHER"]
        .into_iter()
        .map(|s| s.to_string())
        .collect()
}

fn kind_to_layer(kind: &str) -> Option<&'static str> {
    match kind {
        "AIR" => Some("AIR"),
        "SAT" => Some("SAT"),
        _ => None,
    }
}

fn in_bbox(b: &Bbox, lat: f64, lon: f64) -> bool {
    if lat < b.south || lat > b.north {
        return false;
    }
    if b.west <= b.east {
        lon >= b.west && lon <= b.east
    } else {
        lon >= b.west || lon <= b.east
    }
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let client_id = Uuid::new_v4().to_string();
    state.subs.insert(
        client_id.clone(),
        ClientSub {
            preset: "DC".to_string(),
            layers: default_layers(),
            bbox: None,
        },
    );

    gauge!("harpy_ws_connections").increment(1.0);

    let (mut sink, mut stream) = socket.split();
    let mut rx = state.tx.subscribe();

    let subs = state.subs.clone();
    let cid = client_id.clone();
    let write_task = tokio::spawn(async move {
        while let Ok(ev) = rx.recv().await {
            let sub = match subs.get(&cid) {
                Some(s) => s.clone(),
                None => break,
            };

            match ev {
                ServerEvent::Tracks { tracks } => {
                    let filtered: Vec<UiTrack> = tracks
                        .into_iter()
                        .filter(|t| {
                            let layer_ok = match kind_to_layer(&t.kind) {
                                Some(layer) => sub.layers.contains(layer),
                                None => true,
                            };
                            let bbox_ok = match &sub.bbox {
                                Some(b) => in_bbox(b, t.lat, t.lon),
                                None => true,
                            };
                            layer_ok && bbox_ok
                        })
                        .collect();

                    if filtered.is_empty() {
                        continue;
                    }

                    counter!("harpy_tracks_sent").increment(filtered.len() as u64);

                    let out = ServerEvent::Tracks { tracks: filtered };
                    let txt = match serde_json::to_string(&out) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };
                    if sink.send(Message::Text(txt.into())).await.is_err() {
                        break;
                    }
                }
                ServerEvent::ProviderStatus { provider_status } => {
                    counter!("harpy_provider_status_sent").increment(provider_status.len() as u64);

                    let txt = match serde_json::to_string(&ServerEvent::ProviderStatus {
                        provider_status,
                    }) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };
                    if sink.send(Message::Text(txt.into())).await.is_err() {
                        break;
                    }
                }
                ServerEvent::Pong { t0 } => {
                    let txt = match serde_json::to_string(&ServerEvent::Pong { t0 }) {
                        Ok(v) => v,
                        Err(_) => continue,
                    };
                    if sink.send(Message::Text(txt.into())).await.is_err() {
                        break;
                    }
                }
            }
        }
    });

    while let Some(Ok(msg)) = stream.next().await {
        match msg {
            Message::Text(t) => {
                if let Ok(cm) = serde_json::from_str::<ClientMsg>(&t) {
                    match cm {
                        ClientMsg::Ping { t0 } => {
                            let _ = state.tx.send(ServerEvent::Pong { t0 });
                        }
                        ClientMsg::Subscribe {
                            preset,
                            layers,
                            bbox,
                        } => {
                            let layer_set: HashSet<String> =
                                layers.into_iter().collect();
                            if let Some(mut sub) = state.subs.get_mut(&client_id) {
                                sub.preset = preset;
                                sub.layers = if layer_set.is_empty() {
                                    default_layers()
                                } else {
                                    layer_set
                                };
                                sub.bbox = bbox;
                            }
                        }
                    }
                }
            }
            Message::Close(_) => break,
            _ => {}
        }
    }

    write_task.abort();
    gauge!("harpy_ws_connections").decrement(1.0);
    state.subs.remove(&client_id);
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

fn map_kind(k: i32) -> &'static str {
    match TrackKind::try_from(k).unwrap_or(TrackKind::Unspecified) {
        TrackKind::Aircraft => "AIR",
        TrackKind::Satellite => "SAT",
        _ => "AIR",
    }
}

fn state_from_failures(failures: u32) -> &'static str {
    if failures == 0 {
        "OK"
    } else if failures <= 2 {
        "DEGRADED"
    } else {
        "DOWN"
    }
}

async fn provider_loop_adsb(state: AppState) {
    let use_real = env_bool("ENABLE_REAL_ADSB", false);

    let provider: Arc<dyn Provider> = if use_real {
        match OpenSkyProvider::from_env() {
            Ok(p) => {
                tracing::info!("ADS-B: OpenSky enabled");
                Arc::new(p)
            }
            Err(e) => {
                tracing::warn!("ADS-B: OpenSky init failed ({}), falling back to mock", e);
                Arc::new(AdsbMockProvider::new())
            }
        }
    } else {
        tracing::info!("ADS-B: mock enabled");
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
                tracing::info!("TLE: CelesTrak enabled");
                Arc::new(p)
            }
            Err(e) => {
                tracing::warn!("TLE: CelesTrak init failed ({}), falling back to mock", e);
                Arc::new(TleMockProvider::new())
            }
        }
    } else {
        tracing::info!("TLE: mock enabled");
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
    let mut last_success_ms: i64 = 0;

    loop {
        interval.tick().await;

        match provider.fetch().await {
            Ok(deltas) => {
                consecutive_failures = 0;
                last_success_ms = chrono::Utc::now().timestamp_millis();

                let mut tracks: Vec<UiTrack> = Vec::with_capacity(deltas.len());
                for d in deltas.iter() {
                    let pos = d.position.as_ref();
                    let (lat, lon, alt) = match pos {
                        Some(p) => (p.lat, p.lon, p.alt),
                        None => (0.0, 0.0, 0.0),
                    };
                    tracks.push(UiTrack {
                        id: d.id.clone(),
                        kind: map_kind(d.kind).to_string(),
                        lat,
                        lon,
                        alt_m: alt,
                        heading_deg: d.heading,
                        speed_mps: d.speed,
                        updated_ms: d.ts_ms as i64,
                    });
                }

                let _ = state.tx.send(ServerEvent::Tracks { tracks });

                let ps = UiProviderStatus {
                    provider_id: provider.provider_id().to_string(),
                    state: state_from_failures(consecutive_failures).to_string(),
                    freshness: "FRESH".to_string(),
                    last_update_ms: last_success_ms,
                    items: deltas.len() as i64,
                    source_label: source_label.to_string(),
                };

                let _ = state.tx.send(ServerEvent::ProviderStatus {
                    provider_status: vec![ps],
                });
            }
            Err(e) => {
                consecutive_failures = consecutive_failures.saturating_add(1);
                tracing::error!("Provider error from {}: {}", provider.provider_id(), e);

                let now = chrono::Utc::now().timestamp_millis();
                let age_ms = if last_success_ms == 0 {
                    i64::MAX
                } else {
                    now - last_success_ms
                };

                let freshness = if age_ms < 10_000 {
                    "FRESH"
                } else if age_ms < 30_000 {
                    "AGING"
                } else if age_ms < 90_000 {
                    "STALE"
                } else {
                    "CRITICAL"
                };

                let ps = UiProviderStatus {
                    provider_id: provider.provider_id().to_string(),
                    state: state_from_failures(consecutive_failures).to_string(),
                    freshness: freshness.to_string(),
                    last_update_ms: last_success_ms.max(0),
                    items: 0,
                    source_label: source_label.to_string(),
                };

                let _ = state.tx.send(ServerEvent::ProviderStatus {
                    provider_status: vec![ps],
                });
            }
        }
    }
}
