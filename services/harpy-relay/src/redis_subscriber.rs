//! Redis Pub/Sub Subscriber
//!
//! Subscribes to Redis channels and forwards messages to the subscription manager
//! for fanout to WebSocket clients.

use crate::subscription::SubscriptionManager;
use futures::StreamExt;
use harpy_proto::harpy::v1::{Envelope, ProviderStatus, TrackDelta};
use serde::Deserialize;
use std::sync::Arc;

/// JSON representation of TrackDelta for deserialization from Redis
#[derive(Debug, Deserialize)]
struct TrackDeltaJson {
    id: String,
    #[serde(rename = "kind")]
    kind: i32,
    position: Option<PositionJson>,
    heading: f64,
    speed: f64,
    #[serde(rename = "ts_ms")]
    ts_ms: u64,
    #[serde(rename = "provider_id")]
    provider_id: String,
    #[serde(default)]
    meta: std::collections::HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct PositionJson {
    lat: f64,
    lon: f64,
    alt: f64,
}

/// JSON representation of ProviderStatus
#[derive(Debug, Deserialize)]
struct ProviderStatusJson {
    #[serde(rename = "provider_id")]
    provider_id: String,
    #[serde(rename = "circuit_state")]
    circuit_state: String,
    freshness: String,
    #[serde(rename = "last_update_ts_ms")]
    last_update_ts_ms: u64,
    #[serde(rename = "last_success")]
    last_success: bool,
}

/// Start the Redis subscriber loop
pub async fn run_subscriber(
    redis_url: String,
    subscription_manager: Arc<SubscriptionManager>,
) -> anyhow::Result<()> {
    tracing::info!("Starting Redis subscriber on {}", redis_url);

    // Create a regular async connection for pub/sub (not ConnectionManager)
    let client = redis::Client::open(redis_url)?;

    // Clone for the provider status polling task
    let manager_for_polling = subscription_manager.clone();
    let client_for_polling = client.clone();

    // Spawn provider status polling task
    tokio::spawn(async move {
        poll_provider_status(client_for_polling, manager_for_polling).await;
    });

    // Set up pub/sub connection for tracks and alerts
    let pubsub_conn = client.get_async_connection().await?;
    let mut pubsub = pubsub_conn.into_pubsub();

    // Subscribe to channels
    pubsub.subscribe("tracks:updates").await?;
    pubsub.subscribe("alerts:updates").await?;

    tracing::info!("Subscribed to Redis channels: tracks:updates, alerts:updates");

    // Get message stream
    let mut msg_stream = pubsub.on_message();

    loop {
        match msg_stream.next().await {
            Some(msg) => {
                let channel: String = match msg.get_channel::<String>() {
                    Ok(c) => c,
                    Err(e) => {
                        tracing::warn!("Failed to get channel: {}", e);
                        continue;
                    }
                };
                let payload: String = match msg.get_payload() {
                    Ok(p) => p,
                    Err(e) => {
                        tracing::warn!("Failed to get payload: {}", e);
                        continue;
                    }
                };

                tracing::debug!("Received message on channel: {}", channel);

                match channel.as_str() {
                    "tracks:updates" => {
                        handle_track_batch(payload, &subscription_manager).await;
                    }
                    "alerts:updates" => {
                        handle_alert(payload, &subscription_manager).await;
                    }
                    _ => {
                        tracing::debug!("Unknown channel: {}", channel);
                    }
                }
            }
            None => {
                tracing::warn!("Redis pub/sub stream closed, reconnecting...");
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        }
    }
}

/// Poll provider status from Redis and broadcast to all clients
async fn poll_provider_status(
    client: redis::Client,
    subscription_manager: Arc<SubscriptionManager>,
) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(5));

    loop {
        interval.tick().await;

        // Get a new connection each time
        let mut conn = match client.get_async_connection().await {
            Ok(conn) => conn,
            Err(e) => {
                tracing::warn!("Failed to get Redis connection: {}", e);
                continue;
            }
        };

        // Fetch all provider status keys
        let pattern = "provider:status:*";

        match redis::cmd("KEYS")
            .arg(pattern)
            .query_async::<_, Vec<String>>(&mut conn)
            .await
        {
            Ok(keys) => {
                for key in keys {
                    match redis::cmd("GET")
                        .arg(&key)
                        .query_async::<_, String>(&mut conn)
                        .await
                    {
                        Ok(status_json) => {
                            match serde_json::from_str::<ProviderStatusJson>(&status_json) {
                                Ok(status) => {
                                    let provider_status = convert_to_proto_status(status);
                                    let envelope = Envelope {
                                        schema_version: "1.0.0".to_string(),
                                        server_ts_ms: now_ms(),
                                        payload: Some(
                                            harpy_proto::harpy::v1::envelope::Payload::ProviderStatus(
                                                provider_status,
                                            ),
                                        ),
                                    };
                                    subscription_manager.broadcast_to_all(envelope).await;
                                }
                                Err(e) => {
                                    tracing::debug!("Failed to parse provider status: {}", e);
                                }
                            }
                        }
                        Err(e) => {
                            tracing::debug!("Failed to get provider status for {}: {}", key, e);
                        }
                    }
                }
            }
            Err(e) => {
                tracing::debug!("Failed to fetch provider status keys: {}", e);
            }
        }
    }
}

/// Handle track batch from Redis
async fn handle_track_batch(payload: String, subscription_manager: &Arc<SubscriptionManager>) {
    // Parse the JSON array of TrackDelta
    match serde_json::from_str::<Vec<TrackDeltaJson>>(&payload) {
        Ok(tracks_json) => {
            // Convert JSON tracks to protobuf tracks
            let tracks: Vec<TrackDelta> = tracks_json
                .into_iter()
                .map(convert_to_proto_track)
                .collect();
            tracing::debug!("Forwarding {} tracks to subscription manager", tracks.len());
            subscription_manager.broadcast_tracks(tracks).await;
        }
        Err(e) => {
            tracing::warn!("Failed to parse track batch from Redis: {}", e);
        }
    }
}

/// Handle alert from Redis
async fn handle_alert(payload: String, subscription_manager: &Arc<SubscriptionManager>) {
    // Parse the alert JSON
    match serde_json::from_str::<serde_json::Value>(&payload) {
        Ok(alert_json) => {
            let alert = harpy_proto::harpy::v1::AlertUpsert {
                id: alert_json
                    .get("id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown")
                    .to_string(),
                severity: 1, // Info as default
                title: alert_json
                    .get("title")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Alert")
                    .to_string(),
                description: alert_json
                    .get("description")
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string(),
                ts_ms: alert_json
                    .get("ts_ms")
                    .and_then(|v| v.as_u64())
                    .unwrap_or_else(now_ms),
                evidence_link_ids: vec![],
                status: 1, // Active
                meta: Default::default(),
            };
            let envelope = Envelope {
                schema_version: "1.0.0".to_string(),
                server_ts_ms: now_ms(),
                payload: Some(harpy_proto::harpy::v1::envelope::Payload::AlertUpsert(
                    alert,
                )),
            };
            subscription_manager.broadcast_to_all(envelope).await;
        }
        Err(e) => {
            tracing::warn!("Failed to parse alert from Redis: {}", e);
        }
    }
}

/// Convert JSON track to protobuf TrackDelta
fn convert_to_proto_track(json: TrackDeltaJson) -> TrackDelta {
    use harpy_proto::harpy::v1::Position;

    let position = json.position.map(|p| Position {
        lat: p.lat,
        lon: p.lon,
        alt: p.alt,
    });

    TrackDelta {
        id: json.id,
        kind: json.kind,
        position,
        heading: json.heading,
        speed: json.speed,
        ts_ms: json.ts_ms,
        provider_id: json.provider_id,
        meta: json.meta,
    }
}

/// Convert JSON provider status to protobuf ProviderStatus
fn convert_to_proto_status(json: ProviderStatusJson) -> ProviderStatus {
    use harpy_proto::harpy::v1::{CircuitState, Freshness};

    let circuit_state = match json.circuit_state.as_str() {
        "CIRCUIT_STATE_CLOSED" => CircuitState::Closed,
        "CIRCUIT_STATE_OPEN" => CircuitState::Open,
        "CIRCUIT_STATE_HALF_OPEN" => CircuitState::HalfOpen,
        _ => CircuitState::Unspecified,
    };

    let freshness = match json.freshness.as_str() {
        "FRESHNESS_FRESH" => Freshness::Fresh,
        "FRESHNESS_AGING" => Freshness::Aging,
        "FRESHNESS_STALE" => Freshness::Stale,
        "FRESHNESS_CRITICAL" => Freshness::Critical,
        _ => Freshness::Unspecified,
    };

    ProviderStatus {
        provider_id: json.provider_id,
        circuit_state: circuit_state as i32,
        freshness: freshness as i32,
        last_success_ts_ms: json.last_update_ts_ms,
        failure_count: if json.last_success { 0 } else { 1 },
        error_message: None,
        meta: Default::default(),
    }
}

/// Get current timestamp in milliseconds
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}
