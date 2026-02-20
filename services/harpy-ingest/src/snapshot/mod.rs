//! Snapshot Storage Module
//!
//! Handles creation, storage, and retrieval of periodic track snapshots
//! for DVR time-travel playback functionality.

pub mod model;
pub mod storage;

pub use model::SnapshotMetadata;
