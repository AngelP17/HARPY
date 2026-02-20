//! Snapshot Model Definitions
//!
//! Data structures for snapshot metadata and track membership.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Snapshot metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotMetadata {
    pub id: String,
    pub start_ts_ms: u64,
    pub end_ts_ms: u64,
    pub track_count: usize,
    pub compressed_size_bytes: u64,
    pub storage_path: String,
    pub storage_backend: String,
    pub viewport: Option<Viewport>,
    pub meta: HashMap<String, String>,
}

/// Geographic viewport bounds
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Viewport {
    pub min_lat: f64,
    pub min_lon: f64,
    pub max_lat: f64,
    pub max_lon: f64,
}

/// Track membership in a snapshot
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotTrack {
    pub track_id: String,
    pub track_kind: String,
    pub first_ts_ms: u64,
    pub last_ts_ms: u64,
    pub position_count: usize,
}

/// Complete snapshot with data
#[derive(Debug, Clone)]
pub struct Snapshot {
    pub metadata: SnapshotMetadata,
    pub tracks: Vec<SnapshotTrack>,
    pub data: Vec<u8>, // Compressed track data
}

/// Snapshot format version for compatibility
pub const SNAPSHOT_FORMAT_VERSION: &str = "1.0.0";

/// Default snapshot interval in seconds
pub const DEFAULT_SNAPSHOT_INTERVAL_SECS: u64 = 300; // 5 minutes

/// Compression algorithm used for snapshots
pub const SNAPSHOT_COMPRESSION: &str = "zstd";

impl SnapshotMetadata {
    /// Create new snapshot metadata
    pub fn new(
        id: String,
        start_ts_ms: u64,
        end_ts_ms: u64,
        storage_path: String,
        storage_backend: String,
    ) -> Self {
        Self {
            id,
            start_ts_ms,
            end_ts_ms,
            track_count: 0,
            compressed_size_bytes: 0,
            storage_path,
            storage_backend,
            viewport: None,
            meta: HashMap::new(),
        }
    }

    /// Set viewport bounds
    pub fn with_viewport(mut self, viewport: Viewport) -> Self {
        self.viewport = Some(viewport);
        self
    }

    /// Add metadata field
    pub fn with_meta(mut self, key: &str, value: &str) -> Self {
        self.meta.insert(key.to_string(), value.to_string());
        self
    }

    /// Set track count
    pub fn with_track_count(mut self, count: usize) -> Self {
        self.track_count = count;
        self
    }

    /// Set compressed size
    pub fn with_size_bytes(mut self, size: u64) -> Self {
        self.compressed_size_bytes = size;
        self
    }
}

impl Viewport {
    /// Create new viewport from bounds
    pub fn new(min_lat: f64, min_lon: f64, max_lat: f64, max_lon: f64) -> Self {
        Self {
            min_lat,
            min_lon,
            max_lat,
            max_lon,
        }
    }

    /// Check if a point is within the viewport
    pub fn contains(&self, lat: f64, lon: f64) -> bool {
        lat >= self.min_lat && lat <= self.max_lat && lon >= self.min_lon && lon <= self.max_lon
    }

    /// World viewport (all tracks)
    pub fn world() -> Self {
        Self {
            min_lat: -90.0,
            max_lat: 90.0,
            min_lon: -180.0,
            max_lon: 180.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_viewport_contains() {
        let viewport = Viewport::new(37.0, -123.0, 38.0, -121.0);
        assert!(viewport.contains(37.5, -122.0));
        assert!(!viewport.contains(36.0, -122.0)); // Outside lat
        assert!(!viewport.contains(37.5, -124.0)); // Outside lon
    }

    #[test]
    fn test_viewport_world() {
        let world = Viewport::world();
        assert!(world.contains(0.0, 0.0));
        assert!(world.contains(90.0, 180.0));
        assert!(world.contains(-90.0, -180.0));
    }

    #[test]
    fn test_snapshot_metadata_builder() {
        let meta = SnapshotMetadata::new(
            "snap-001".to_string(),
            1000,
            2000,
            "s3://bucket/snap-001.zst".to_string(),
            "s3".to_string(),
        )
        .with_viewport(Viewport::world())
        .with_meta("version", "1.0.0")
        .with_track_count(50)
        .with_size_bytes(1024);

        assert_eq!(meta.id, "snap-001");
        assert_eq!(meta.track_count, 50);
        assert_eq!(meta.compressed_size_bytes, 1024);
        assert!(meta.viewport.is_some());
        assert_eq!(meta.meta.get("version"), Some(&"1.0.0".to_string()));
    }
}
