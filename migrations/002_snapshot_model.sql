-- HARPY Phase 2: Snapshot Model for DVR Time-Travel
-- Stores periodic snapshots of track state for efficient playback

-- Snapshots table (metadata for each snapshot)
CREATE TABLE IF NOT EXISTS snapshots (
    id VARCHAR(255) PRIMARY KEY,
    start_ts_ms BIGINT NOT NULL,
    end_ts_ms BIGINT NOT NULL,
    track_count INTEGER NOT NULL DEFAULT 0,
    compressed_size_bytes BIGINT NOT NULL DEFAULT 0,
    storage_path VARCHAR(500) NOT NULL,  -- S3/MinIO path or local filesystem path
    storage_backend VARCHAR(50) NOT NULL DEFAULT 'minio',  -- 'minio', 's3', 'local'
    viewport_min_lat DOUBLE PRECISION,
    viewport_min_lon DOUBLE PRECISION,
    viewport_max_lat DOUBLE PRECISION,
    viewport_max_lon DOUBLE PRECISION,
    meta JSONB,  -- Additional metadata (compression algo, schema version, etc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_time_range ON snapshots(start_ts_ms, end_ts_ms);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at DESC);

-- Snapshot track membership (which tracks are in each snapshot)
-- This allows partial snapshot loading for specific tracks
CREATE TABLE IF NOT EXISTS snapshot_tracks (
    snapshot_id VARCHAR(255) NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    track_id VARCHAR(255) NOT NULL,
    track_kind VARCHAR(50) NOT NULL,
    first_ts_ms BIGINT NOT NULL,  -- First observation in this snapshot
    last_ts_ms BIGINT NOT NULL,   -- Last observation in this snapshot
    position_count INTEGER NOT NULL DEFAULT 0,  -- Number of positions in snapshot
    PRIMARY KEY (snapshot_id, track_id)
);

CREATE INDEX IF NOT EXISTS idx_snapshot_tracks_track ON snapshot_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_tracks_kind ON snapshot_tracks(track_kind);

-- Playback sessions (for tracking active playback requests)
CREATE TABLE IF NOT EXISTS playback_sessions (
    id VARCHAR(255) PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL,
    start_ts_ms BIGINT NOT NULL,
    end_ts_ms BIGINT NOT NULL,
    viewport_min_lat DOUBLE PRECISION,
    viewport_min_lon DOUBLE PRECISION,
    viewport_max_lat DOUBLE PRECISION,
    viewport_max_lon DOUBLE PRECISION,
    layers JSONB,  -- Array of layer types included
    current_ts_ms BIGINT NOT NULL,  -- Current playback position
    playback_speed FLOAT DEFAULT 1.0,  -- 1x, 2x, 4x, 8x
    is_playing BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_playback_sessions_client ON playback_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_playback_sessions_time ON playback_sessions(start_ts_ms, end_ts_ms);

-- Delta index for efficient range queries during playback
-- Maps time ranges to track deltas for fast seeking
CREATE TABLE IF NOT EXISTS delta_index (
    id BIGSERIAL PRIMARY KEY,
    track_id VARCHAR(255) NOT NULL,
    start_ts_ms BIGINT NOT NULL,
    end_ts_ms BIGINT NOT NULL,
    delta_count INTEGER NOT NULL DEFAULT 0,
    storage_hint VARCHAR(500),  -- Optional: path to pre-computed delta chunk
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delta_index_track ON delta_index(track_id);
CREATE INDEX IF NOT EXISTS idx_delta_index_time ON delta_index(start_ts_ms, end_ts_ms);
CREATE INDEX IF NOT EXISTS idx_delta_index_track_time ON delta_index(track_id, start_ts_ms, end_ts_ms);

-- Update track_deltas with snapshot reference for cleanup
ALTER TABLE track_deltas ADD COLUMN IF NOT EXISTS snapshot_id VARCHAR(255) REFERENCES snapshots(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_track_deltas_snapshot ON track_deltas(snapshot_id);
