//! WebSocket Subscription Manager
//!
//! Manages client subscriptions, filters tracks by viewport/layers,
//! and handles fanout of messages to connected clients.

use harpy_proto::harpy::v1::{BoundingBox, Envelope, LayerType, TrackDelta, TrackDeltaBatch};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::backpressure::BackpressureChannel;

/// Unique client ID
pub type ClientId = String;

/// Client subscription state
#[derive(Debug, Clone)]
pub struct Subscription {
    /// Bounding box filter (viewport)
    pub viewport: BoundingBox,
    /// Layer types to include
    pub layers: Vec<LayerType>,
    /// Channel to send messages to this client
    pub sender: BackpressureChannel,
}

impl Subscription {
    /// Check if a track matches this subscription's filters
    pub fn matches(&self, track: &TrackDelta) -> bool {
        // Check layer type match
        let track_layer = match track.kind {
            1 => LayerType::Aircraft,  // TRACK_KIND_AIRCRAFT
            2 => LayerType::Satellite, // TRACK_KIND_SATELLITE
            3 => LayerType::Ground,    // TRACK_KIND_GROUND
            4 => LayerType::Vessel,    // TRACK_KIND_VESSEL
            _ => return false,
        };

        if !self.layers.contains(&track_layer) {
            return false;
        }

        // Check viewport bounds
        let pos = track.position.as_ref().unwrap();
        if pos.lat < self.viewport.min_lat
            || pos.lat > self.viewport.max_lat
            || pos.lon < self.viewport.min_lon
            || pos.lon > self.viewport.max_lon
        {
            return false;
        }

        true
    }
}

/// Manages all active subscriptions
#[derive(Debug, Default)]
pub struct SubscriptionManager {
    subscriptions: RwLock<HashMap<ClientId, Subscription>>,
}

impl SubscriptionManager {
    /// Create a new subscription manager
    pub fn new() -> Self {
        Self {
            subscriptions: RwLock::new(HashMap::new()),
        }
    }

    /// Create an Arc-wrapped subscription manager
    pub fn arc() -> Arc<Self> {
        Arc::new(Self::new())
    }

    /// Add or update a client subscription
    pub async fn subscribe(&self, client_id: ClientId, subscription: Subscription) {
        let mut subs = self.subscriptions.write().await;
        subs.insert(client_id, subscription);
        tracing::info!("Client subscribed, total clients: {}", subs.len());
    }

    /// Remove a client subscription
    pub async fn unsubscribe(&self, client_id: &str) {
        let mut subs = self.subscriptions.write().await;
        subs.remove(client_id);
        tracing::info!("Client unsubscribed, total clients: {}", subs.len());
    }

    /// Get count of active subscriptions
    pub async fn client_count(&self) -> usize {
        self.subscriptions.read().await.len()
    }

    /// Broadcast track batch to all matching subscriptions
    pub async fn broadcast_tracks(&self, tracks: Vec<TrackDelta>) {
        if tracks.is_empty() {
            return;
        }

        let subs = self.subscriptions.read().await;
        if subs.is_empty() {
            return;
        }

        // Group tracks by matching subscriptions
        let mut client_batches: HashMap<ClientId, Vec<TrackDelta>> = HashMap::new();

        for track in tracks {
            for (client_id, subscription) in subs.iter() {
                if subscription.matches(&track) {
                    client_batches
                        .entry(client_id.clone())
                        .or_default()
                        .push(track.clone());
                }
            }
        }

        // Send filtered batches to each client
        for (client_id, batch_tracks) in client_batches {
            if let Some(subscription) = subs.get(&client_id) {
                let batch = TrackDeltaBatch {
                    deltas: batch_tracks,
                };
                let envelope = Envelope {
                    schema_version: "1.0.0".to_string(),
                    server_ts_ms: now_ms(),
                    payload: Some(harpy_proto::harpy::v1::envelope::Payload::TrackDeltaBatch(
                        batch,
                    )),
                };

                if subscription.sender.send(envelope).is_err() {
                    tracing::debug!(
                        "Dropped TrackDeltaBatch for client {} due to backpressure/closed channel",
                        client_id
                    );
                }
            }
        }
    }

    /// Send a message to all connected clients (used for provider status, alerts)
    pub async fn broadcast_to_all(&self, envelope: Envelope) {
        let subs = self.subscriptions.read().await;

        for (client_id, subscription) in subs.iter() {
            if subscription.sender.send(envelope.clone()).is_err() {
                tracing::warn!("Failed to send to client {}, channel closed", client_id);
            }
        }
    }
}

/// Get current timestamp in milliseconds
fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;
    use harpy_proto::harpy::v1::{Position, TrackKind};

    fn create_test_subscription(viewport: BoundingBox, layers: Vec<LayerType>) -> Subscription {
        let sender = BackpressureChannel::default();
        Subscription {
            viewport,
            layers,
            sender,
        }
    }

    fn create_test_track(lat: f64, lon: f64, kind: TrackKind) -> TrackDelta {
        TrackDelta {
            id: "test-001".to_string(),
            kind: kind as i32,
            position: Some(Position {
                lat,
                lon,
                alt: 1000.0,
            }),
            heading: 90.0,
            speed: 250.0,
            ts_ms: now_ms(),
            provider_id: "test".to_string(),
            meta: Default::default(),
        }
    }

    #[test]
    fn test_viewport_filtering() {
        let viewport = BoundingBox {
            min_lat: 37.0,
            max_lat: 38.0,
            min_lon: -123.0,
            max_lon: -121.0,
        };
        let sub = create_test_subscription(viewport, vec![LayerType::Aircraft]);

        // Inside viewport
        let track_inside = create_test_track(37.5, -122.0, TrackKind::Aircraft);
        assert!(sub.matches(&track_inside));

        // Outside viewport (lat too high)
        let track_outside_lat = create_test_track(39.0, -122.0, TrackKind::Aircraft);
        assert!(!sub.matches(&track_outside_lat));

        // Outside viewport (lon too low)
        let track_outside_lon = create_test_track(37.5, -124.0, TrackKind::Aircraft);
        assert!(!sub.matches(&track_outside_lon));
    }

    #[test]
    fn test_layer_filtering() {
        let viewport = BoundingBox {
            min_lat: 37.0,
            max_lat: 38.0,
            min_lon: -123.0,
            max_lon: -121.0,
        };
        let sub = create_test_subscription(viewport, vec![LayerType::Aircraft]);

        // Aircraft should match
        let aircraft = create_test_track(37.5, -122.0, TrackKind::Aircraft);
        assert!(sub.matches(&aircraft));

        // Satellite should not match (not in layers)
        let satellite = create_test_track(37.5, -122.0, TrackKind::Satellite);
        assert!(!sub.matches(&satellite));
    }
}
