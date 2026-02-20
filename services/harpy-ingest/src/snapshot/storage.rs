//! Snapshot Storage Backend
//!
//! Implements storage backends for snapshots: MinIO/S3 and local filesystem.

use super::model::{Snapshot, SnapshotMetadata};
use anyhow::{Context, Result};
use async_trait::async_trait;
use chrono::Datelike;
use std::path::PathBuf;

/// Storage backend trait
#[async_trait]
pub trait SnapshotStorage: Send + Sync {
    /// Store a snapshot
    async fn store(&self, snapshot: &Snapshot) -> Result<()>;

    /// Load a snapshot by ID
    async fn load(&self, snapshot_id: &str) -> Result<Snapshot>;

    /// Delete a snapshot
    async fn delete(&self, snapshot_id: &str) -> Result<()>;

    /// Check if a snapshot exists
    async fn exists(&self, snapshot_id: &str) -> Result<bool>;

    /// List snapshots in a time range
    async fn list(&self, start_ts_ms: u64, end_ts_ms: u64) -> Result<Vec<SnapshotMetadata>>;
}

/// Storage backend type
#[derive(Debug, Clone)]
pub enum StorageBackend {
    /// MinIO/S3-compatible object storage
    S3 {
        endpoint: String,
        bucket: String,
        access_key: String,
        secret_key: String,
        region: String,
    },
    /// Local filesystem storage
    Local { base_path: PathBuf },
}

impl StorageBackend {
    /// Create S3/MinIO backend from environment
    pub fn from_env() -> Result<Self> {
        let endpoint =
            std::env::var("S3_ENDPOINT").unwrap_or_else(|_| "http://localhost:9000".to_string());
        let bucket = std::env::var("S3_BUCKET").unwrap_or_else(|_| "harpy-snapshots".to_string());
        let access_key = std::env::var("S3_ACCESS_KEY").unwrap_or_else(|_| "harpy".to_string());
        let secret_key =
            std::env::var("S3_SECRET_KEY").unwrap_or_else(|_| "harpy_minio_secret".to_string());
        let region = std::env::var("S3_REGION").unwrap_or_else(|_| "us-east-1".to_string());

        Ok(Self::S3 {
            endpoint,
            bucket,
            access_key,
            secret_key,
            region,
        })
    }

    /// Create local filesystem backend
    pub fn local(base_path: impl Into<PathBuf>) -> Self {
        Self::Local {
            base_path: base_path.into(),
        }
    }

    /// Build storage path for a snapshot
    pub fn build_path(&self, snapshot_id: &str) -> String {
        match self {
            StorageBackend::S3 { bucket, .. } => {
                format!("s3://{}/{}", bucket, snapshot_key(snapshot_id))
            }
            StorageBackend::Local { base_path } => base_path
                .join(snapshot_key(snapshot_id))
                .to_string_lossy()
                .to_string(),
        }
    }
}

/// Generate storage key for snapshot
fn snapshot_key(snapshot_id: &str) -> String {
    // Organize snapshots by date prefix for better listing performance
    // Format: 2024/02/20/snap-uuid.zst
    let now = chrono::Utc::now();
    format!(
        "{}/{:02}/{:02}/{}.zst",
        now.year(),
        now.month(),
        now.day(),
        snapshot_id
    )
}

/// Compress snapshot data using zstd
pub fn compress_data(data: &[u8]) -> Result<Vec<u8>> {
    // Use zstd compression level 3 (good balance of speed/compression)
    zstd::encode_all(data, 3).context("Failed to compress snapshot data")
}

/// Decompress snapshot data
pub fn decompress_data(data: &[u8]) -> Result<Vec<u8>> {
    zstd::decode_all(data).context("Failed to decompress snapshot data")
}

/// Serialize tracks to JSON bytes
pub fn serialize_tracks(tracks: &[super::model::SnapshotTrack]) -> Result<Vec<u8>> {
    serde_json::to_vec(tracks).context("Failed to serialize tracks")
}

/// Deserialize tracks from JSON bytes
pub fn deserialize_tracks(data: &[u8]) -> Result<Vec<super::model::SnapshotTrack>> {
    serde_json::from_slice(data).context("Failed to deserialize tracks")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_backend_local() {
        let backend = StorageBackend::local("/tmp/snapshots");
        let path = backend.build_path("snap-001");
        assert!(path.contains("snap-001.zst"));
    }

    #[test]
    fn test_storage_backend_s3() {
        let backend = StorageBackend::S3 {
            endpoint: "http://minio:9000".to_string(),
            bucket: "harpy".to_string(),
            access_key: "key".to_string(),
            secret_key: "secret".to_string(),
            region: "us-east-1".to_string(),
        };
        let path = backend.build_path("snap-001");
        assert!(path.starts_with("s3://harpy/"));
        assert!(path.contains("snap-001.zst"));
    }

    #[test]
    fn test_compress_decompress() {
        let data = b"test snapshot data for compression";
        let compressed = compress_data(data).unwrap();
        let decompressed = decompress_data(&compressed).unwrap();
        assert_eq!(data.to_vec(), decompressed);
    }
}
