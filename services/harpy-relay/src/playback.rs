//! Playback Mode Support (B2-4)
//!
//! Handles playback subscriptions by querying historical track deltas
//! from Postgres and streaming them to clients at playback speed.

#![allow(dead_code)]

use crate::subscription::Subscription;
use harpy_proto::harpy::v1::{
    envelope::Payload, Envelope, LayerType, Position, TrackDelta, TrackDeltaBatch,
};
use sqlx::{Postgres, QueryBuilder, Row};
use std::collections::HashMap;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::time::{interval, Instant};

/// Playback state for a client
#[derive(Debug, Clone)]
pub struct PlaybackState {
    /// Current playback position (timestamp)
    pub current_ts_ms: u64,
    /// Playback speed multiplier (1x, 2x, 4x, 8x)
    pub speed: f32,
    /// Whether playback is currently active
    pub is_playing: bool,
    /// End timestamp for playback range
    pub end_ts_ms: u64,
}

impl PlaybackState {
    /// Create new playback state
    pub fn new(start_ts_ms: u64, end_ts_ms: u64, speed: f32) -> Self {
        Self {
            current_ts_ms: start_ts_ms,
            speed: speed.clamp(0.25, 8.0), // Clamp between 0.25x and 8x
            is_playing: true,
            end_ts_ms,
        }
    }

    /// Advance playback position
    pub fn advance(&mut self, real_time_ms: u64) -> bool {
        if !self.is_playing {
            return false;
        }

        let playback_delta = (real_time_ms as f32 * self.speed) as u64;
        self.current_ts_ms = self.current_ts_ms.saturating_add(playback_delta);

        // Check if we've reached the end
        if self.current_ts_ms >= self.end_ts_ms {
            self.current_ts_ms = self.end_ts_ms;
            self.is_playing = false;
            false // Playback complete
        } else {
            true // Still playing
        }
    }

    /// Pause playback
    pub fn pause(&mut self) {
        self.is_playing = false;
    }

    /// Resume playback
    pub fn resume(&mut self) {
        if self.current_ts_ms < self.end_ts_ms {
            self.is_playing = true;
        }
    }

    /// Seek to a specific position
    pub fn seek(&mut self, ts_ms: u64) {
        self.current_ts_ms = ts_ms.clamp(0, self.end_ts_ms);
        // Resume if we were at the end
        if self.is_playing || self.current_ts_ms < self.end_ts_ms {
            self.is_playing = true;
        }
    }

    /// Set playback speed
    pub fn set_speed(&mut self, speed: f32) {
        self.speed = speed.clamp(0.25, 8.0);
    }
}

/// Playback handle for a client subscription
pub struct PlaybackHandle {
    pub state: PlaybackState,
    pub subscription: Subscription,
    pub sender: mpsc::UnboundedSender<Envelope>,
}

/// Start playback streaming for a subscription
///
/// Queries historical deltas from Postgres and streams them at playback speed.
pub async fn start_playback(
    start_ts_ms: u64,
    end_ts_ms: u64,
    speed: f32,
    subscription: Subscription,
    db_pool: Option<sqlx::PgPool>,
) -> mpsc::UnboundedReceiver<Envelope> {
    let (tx, rx) = mpsc::unbounded_channel();
    let mut state = PlaybackState::new(start_ts_ms, end_ts_ms, speed);

    // Spawn playback task
    tokio::spawn(async move {
        let mut tick = interval(Duration::from_millis(100)); // 10fps
        let mut last_tick = Instant::now();

        loop {
            tick.tick().await;

            if !state.is_playing {
                continue;
            }

            let now = Instant::now();
            let elapsed_ms = now.duration_since(last_tick).as_millis() as u64;
            last_tick = now;

            // Advance playback position
            let prev_ts_ms = state.current_ts_ms;
            let still_playing = state.advance(elapsed_ms);
            let current_ts_ms = state.current_ts_ms;

            let deltas = if let Some(pool) = db_pool.as_ref() {
                match fetch_playback_deltas(pool, &subscription, prev_ts_ms, current_ts_ms).await {
                    Ok(deltas) => deltas,
                    Err(e) => {
                        tracing::error!("Playback delta query failed: {}", e);
                        Vec::new()
                    }
                }
            } else {
                tracing::debug!("Playback requested without database pool");
                Vec::new()
            };

            let batch = TrackDeltaBatch { deltas };
            let envelope = Envelope {
                schema_version: "1.0.0".to_string(),
                server_ts_ms: now_ms(),
                payload: Some(Payload::TrackDeltaBatch(batch)),
            };

            if tx.send(envelope).is_err() {
                tracing::debug!("Playback client disconnected");
                break;
            }

            if !still_playing {
                tracing::info!("Playback complete: reached end timestamp");
                // Send completion indicator
                let completion = Envelope {
                    schema_version: "1.0.0".to_string(),
                    server_ts_ms: now_ms(),
                    payload: Some(Payload::SnapshotMeta(
                        harpy_proto::harpy::v1::SnapshotMeta {
                            snapshot_id: "playback-complete".to_string(),
                            start_ts_ms,
                            end_ts_ms,
                            s3_url: "".to_string(),
                            track_count: 0,
                            compressed_size_bytes: 0,
                        },
                    )),
                };
                let _ = tx.send(completion);
                break;
            }
        }
    });

    rx
}

fn layer_kind_strings(layers: &[LayerType]) -> Vec<&'static str> {
    let mut out = Vec::with_capacity(layers.len());
    for layer in layers {
        match layer {
            LayerType::Aircraft => out.push("aircraft"),
            LayerType::Satellite => out.push("satellite"),
            LayerType::Ground => out.push("ground"),
            LayerType::Vessel => out.push("vessel"),
            _ => {}
        }
    }
    out
}

fn parse_meta(value: Option<serde_json::Value>) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let Some(serde_json::Value::Object(obj)) = value else {
        return map;
    };

    for (key, value) in obj {
        let normalized = value
            .as_str()
            .map(ToString::to_string)
            .unwrap_or_else(|| value.to_string());
        map.insert(key, normalized);
    }
    map
}

fn kind_to_proto(kind: &str) -> i32 {
    match kind {
        "aircraft" => 1,
        "satellite" => 2,
        "ground" => 3,
        "vessel" => 4,
        _ => 0,
    }
}

async fn fetch_playback_deltas(
    pool: &sqlx::PgPool,
    subscription: &Subscription,
    start_ts_ms: u64,
    end_ts_ms: u64,
) -> anyhow::Result<Vec<TrackDelta>> {
    if start_ts_ms >= end_ts_ms {
        return Ok(Vec::new());
    }

    let mut qb = QueryBuilder::<Postgres>::new(
        "SELECT td.track_id, td.lat, td.lon, td.alt, td.heading, td.speed, td.ts_ms, td.provider_id, td.meta, COALESCE(t.kind, 'unknown') AS kind \
         FROM track_deltas td \
         LEFT JOIN tracks t ON t.id = td.track_id \
         WHERE td.ts_ms > ",
    );
    qb.push_bind(start_ts_ms as i64)
        .push(" AND td.ts_ms <= ")
        .push_bind(end_ts_ms as i64)
        .push(" AND td.lat >= ")
        .push_bind(subscription.viewport.min_lat)
        .push(" AND td.lat <= ")
        .push_bind(subscription.viewport.max_lat)
        .push(" AND td.lon >= ")
        .push_bind(subscription.viewport.min_lon)
        .push(" AND td.lon <= ")
        .push_bind(subscription.viewport.max_lon);

    let layer_kinds = layer_kind_strings(&subscription.layers);
    if !layer_kinds.is_empty() {
        qb.push(" AND t.kind = ANY(")
            .push_bind(layer_kinds)
            .push(")");
    }

    qb.push(" ORDER BY td.ts_ms ASC LIMIT 5000");

    let rows = qb.build().fetch_all(pool).await?;
    let mut out = Vec::with_capacity(rows.len());

    for row in rows {
        let kind: String = row.get("kind");
        let meta: Option<serde_json::Value> = row.try_get("meta").ok();
        let delta = TrackDelta {
            id: row.get("track_id"),
            kind: kind_to_proto(&kind),
            position: Some(Position {
                lat: row.get("lat"),
                lon: row.get("lon"),
                alt: row.get("alt"),
            }),
            heading: row.get("heading"),
            speed: row.get("speed"),
            ts_ms: row.get::<i64, _>("ts_ms") as u64,
            provider_id: row.get("provider_id"),
            meta: parse_meta(meta),
        };
        out.push(delta);
    }

    Ok(out)
}

fn now_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_playback_state_advance() {
        let mut state = PlaybackState::new(1000, 5000, 2.0);

        // Advance 500ms real time at 2x = 1000ms playback time
        assert!(state.advance(500));
        assert_eq!(state.current_ts_ms, 2000);
        assert!(state.is_playing);

        // Advance to end
        assert!(!state.advance(2000)); // 4000ms at 2x = 8000ms, exceeds end
        assert_eq!(state.current_ts_ms, 5000);
        assert!(!state.is_playing);
    }

    #[test]
    fn test_playback_state_seek() {
        let mut state = PlaybackState::new(1000, 5000, 1.0);

        state.seek(3000);
        assert_eq!(state.current_ts_ms, 3000);
        assert!(state.is_playing);

        state.seek(6000); // Beyond end
        assert_eq!(state.current_ts_ms, 5000);
    }

    #[test]
    fn test_playback_speed_clamping() {
        let state = PlaybackState::new(1000, 5000, 100.0);
        assert_eq!(state.speed, 8.0); // Clamped to max

        let state = PlaybackState::new(1000, 5000, 0.1);
        assert_eq!(state.speed, 0.25); // Clamped to min
    }
}
