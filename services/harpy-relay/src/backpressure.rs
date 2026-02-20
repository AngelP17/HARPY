//! Backpressure Semantics (B2-5)
//!
//! Implements differentiated backpressure handling:
//! - TrackDeltaBatch: Droppable under load (high throughput, loss acceptable)
//! - AlertUpsert: Never dropped (critical alerts)
//! - ProviderStatus: Never dropped (health monitoring)
//! - SnapshotMeta: Never dropped (control messages)

#![allow(dead_code)]

use harpy_proto::harpy::v1::Envelope;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::mpsc;

/// Maximum number of pending track batches per client before dropping
const MAX_PENDING_TRACK_BATCHES: usize = 10;

/// Channel type for backpressure-aware message sending
#[derive(Debug, Clone)]
pub struct BackpressureChannel {
    /// High priority channel (alerts, provider status, control messages)
    /// Uses unbounded channel - never drops
    high_priority_tx: mpsc::UnboundedSender<Envelope>,

    /// Normal priority channel (track batches)
    /// Uses bounded channel - drops under pressure
    normal_priority_tx: mpsc::Sender<Envelope>,

    /// Statistics for monitoring
    stats: Arc<BackpressureStats>,
}

/// Backpressure statistics
#[derive(Debug, Default)]
pub struct BackpressureStats {
    /// Number of track batches dropped
    pub track_batches_dropped: AtomicUsize,
    /// Number of track batches sent
    pub track_batches_sent: AtomicUsize,
    /// Number of high priority messages sent
    pub high_priority_sent: AtomicUsize,
}

impl BackpressureStats {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record_track_batch_dropped(&self) {
        self.track_batches_dropped.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_track_batch_sent(&self) {
        self.track_batches_sent.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_high_priority_sent(&self) {
        self.high_priority_sent.fetch_add(1, Ordering::Relaxed);
    }

    pub fn get_stats(&self) -> BackpressureSnapshot {
        BackpressureSnapshot {
            track_batches_dropped: self.track_batches_dropped.load(Ordering::Relaxed),
            track_batches_sent: self.track_batches_sent.load(Ordering::Relaxed),
            high_priority_sent: self.high_priority_sent.load(Ordering::Relaxed),
        }
    }
}

/// Snapshot of backpressure statistics
#[derive(Debug, Clone, Copy)]
pub struct BackpressureSnapshot {
    pub track_batches_dropped: usize,
    pub track_batches_sent: usize,
    pub high_priority_sent: usize,
}

impl BackpressureChannel {
    /// Create a new backpressure channel
    pub fn new() -> (Self, mpsc::UnboundedReceiver<Envelope>) {
        let (high_priority_tx, mut high_priority_rx) = mpsc::unbounded_channel();
        let (normal_priority_tx, mut normal_priority_rx) = mpsc::channel(MAX_PENDING_TRACK_BATCHES);

        let stats = Arc::new(BackpressureStats::new());

        // Merge the two receivers into one
        // For simplicity, we use a single unbounded receiver that gets all messages
        // The normal_priority channel is used for backpressure detection only
        let (merged_tx, merged_rx) = mpsc::unbounded_channel();

        // Forward high/normal priority messages into a single receiver.
        // If created outside a Tokio runtime (e.g. sync unit tests), skip task spawn.
        if let Ok(handle) = tokio::runtime::Handle::try_current() {
            let merged_tx_high = merged_tx.clone();
            handle.spawn(async move {
                while let Some(envelope) = high_priority_rx.recv().await {
                    if merged_tx_high.send(envelope).is_err() {
                        break;
                    }
                }
            });

            let merged_tx_normal = merged_tx.clone();
            handle.spawn(async move {
                while let Some(envelope) = normal_priority_rx.recv().await {
                    if merged_tx_normal.send(envelope).is_err() {
                        break;
                    }
                }
            });
        } else {
            tracing::debug!(
                "BackpressureChannel created outside Tokio runtime; forwarders not started"
            );
        }

        let channel = Self {
            high_priority_tx,
            normal_priority_tx,
            stats,
        };

        (channel, merged_rx)
    }

    /// Send an envelope with appropriate backpressure handling
    #[allow(clippy::result_large_err)]
    pub fn send(&self, envelope: Envelope) -> Result<(), Envelope> {
        // Determine message priority based on payload type
        let is_high_priority = self.is_high_priority(&envelope);

        if is_high_priority {
            // High priority: never drop, use unbounded channel
            match self.high_priority_tx.send(envelope) {
                Ok(_) => {
                    self.stats.record_high_priority_sent();
                    Ok(())
                }
                Err(e) => Err(e.0),
            }
        } else {
            // Normal priority: try bounded channel first
            match self.normal_priority_tx.try_send(envelope) {
                Ok(_) => {
                    self.stats.record_track_batch_sent();
                    Ok(())
                }
                Err(tokio::sync::mpsc::error::TrySendError::Full(envelope)) => {
                    // Channel full - drop the track batch
                    self.stats.record_track_batch_dropped();
                    tracing::warn!("Dropping TrackDeltaBatch due to backpressure (queue full)");
                    // Return error to indicate drop
                    Err(envelope)
                }
                Err(tokio::sync::mpsc::error::TrySendError::Closed(envelope)) => Err(envelope),
            }
        }
    }

    /// Check if an envelope is high priority (never dropped)
    fn is_high_priority(&self, envelope: &Envelope) -> bool {
        use harpy_proto::harpy::v1::envelope::Payload;

        match &envelope.payload {
            Some(Payload::TrackDeltaBatch(_)) => false, // Droppable
            Some(Payload::AlertUpsert(_)) => true,      // Never drop
            Some(Payload::ProviderStatus(_)) => true,   // Never drop
            Some(Payload::SnapshotMeta(_)) => true,     // Never drop (control)
            Some(Payload::LinkUpsert(_)) => true,       // Never drop (rare)
            Some(Payload::SubscriptionAck(_)) => true,  // Never drop (control)
            Some(Payload::SubscriptionRequest(_)) => true, // Never drop (control)
            None => false,
        }
    }

    /// Get current backpressure statistics
    pub fn stats(&self) -> BackpressureSnapshot {
        self.stats.get_stats()
    }
}

impl Default for BackpressureChannel {
    fn default() -> Self {
        let (channel, _) = Self::new();
        channel
    }
}

/// Global backpressure monitor for the relay service
pub struct BackpressureMonitor {
    total_dropped: AtomicUsize,
    total_sent: AtomicUsize,
}

impl BackpressureMonitor {
    pub fn new() -> Self {
        Self {
            total_dropped: AtomicUsize::new(0),
            total_sent: AtomicUsize::new(0),
        }
    }

    pub fn record_dropped(&self) {
        self.total_dropped.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_sent(&self) {
        self.total_sent.fetch_add(1, Ordering::Relaxed);
    }

    pub fn drop_rate(&self) -> f64 {
        let dropped = self.total_dropped.load(Ordering::Relaxed) as f64;
        let sent = self.total_sent.load(Ordering::Relaxed) as f64;
        if sent + dropped > 0.0 {
            dropped / (sent + dropped)
        } else {
            0.0
        }
    }
}

impl Default for BackpressureMonitor {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use harpy_proto::harpy::v1::{AlertUpsert, ProviderStatus, TrackDeltaBatch};

    #[test]
    fn test_is_high_priority() {
        let (channel, _rx) = BackpressureChannel::new();

        // TrackDeltaBatch is low priority (droppable)
        let track_batch = Envelope {
            schema_version: "1.0.0".to_string(),
            server_ts_ms: 0,
            payload: Some(harpy_proto::harpy::v1::envelope::Payload::TrackDeltaBatch(
                TrackDeltaBatch { deltas: vec![] },
            )),
        };
        assert!(!channel.is_high_priority(&track_batch));

        // AlertUpsert is high priority (never drop)
        let alert = Envelope {
            schema_version: "1.0.0".to_string(),
            server_ts_ms: 0,
            payload: Some(harpy_proto::harpy::v1::envelope::Payload::AlertUpsert(
                AlertUpsert {
                    id: "test".to_string(),
                    severity: 1,
                    title: "Test".to_string(),
                    description: "".to_string(),
                    ts_ms: 0,
                    evidence_link_ids: vec![],
                    status: 1,
                    meta: Default::default(),
                },
            )),
        };
        assert!(channel.is_high_priority(&alert));

        // ProviderStatus is high priority (never drop)
        let status = Envelope {
            schema_version: "1.0.0".to_string(),
            server_ts_ms: 0,
            payload: Some(harpy_proto::harpy::v1::envelope::Payload::ProviderStatus(
                ProviderStatus {
                    provider_id: "test".to_string(),
                    circuit_state: 1,
                    freshness: 1,
                    last_success_ts_ms: 0,
                    failure_count: 0,
                    error_message: None,
                    meta: Default::default(),
                },
            )),
        };
        assert!(channel.is_high_priority(&status));
    }

    #[test]
    fn test_backpressure_stats() {
        let stats = BackpressureStats::new();

        stats.record_track_batch_sent();
        stats.record_track_batch_sent();
        stats.record_track_batch_dropped();
        stats.record_high_priority_sent();

        let snapshot = stats.get_stats();
        assert_eq!(snapshot.track_batches_sent, 2);
        assert_eq!(snapshot.track_batches_dropped, 1);
        assert_eq!(snapshot.high_priority_sent, 1);
    }
}
