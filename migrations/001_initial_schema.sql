-- HARPY Phase 0 Database Schema
-- Initial schema for tracks, alerts, links, provider_status, and audit_log

-- Tracks table (current track state)
CREATE TABLE IF NOT EXISTS tracks (
    id VARCHAR(255) PRIMARY KEY,
    kind VARCHAR(50) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    alt DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    ts_ms BIGINT NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    meta JSONB,
    h3_index BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tracks_ts_ms ON tracks(ts_ms DESC);
CREATE INDEX IF NOT EXISTS idx_tracks_provider ON tracks(provider_id);
CREATE INDEX IF NOT EXISTS idx_tracks_kind ON tracks(kind);
CREATE INDEX IF NOT EXISTS idx_tracks_h3 ON tracks(h3_index);

-- Track deltas (time-series position history)
CREATE TABLE IF NOT EXISTS track_deltas (
    id BIGSERIAL PRIMARY KEY,
    track_id VARCHAR(255) NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    alt DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    ts_ms BIGINT NOT NULL,
    provider_id VARCHAR(255) NOT NULL,
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_track_deltas_track_id ON track_deltas(track_id);
CREATE INDEX IF NOT EXISTS idx_track_deltas_ts_ms ON track_deltas(ts_ms DESC);

-- Alerts table
CREATE TABLE IF NOT EXISTS alerts (
    id VARCHAR(255) PRIMARY KEY,
    severity VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    ts_ms BIGINT NOT NULL,
    status VARCHAR(50) NOT NULL,
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_ts_ms ON alerts(ts_ms DESC);

-- Links table (ontology edges)
CREATE TABLE IF NOT EXISTS links (
    id VARCHAR(255) PRIMARY KEY,
    from_type VARCHAR(50) NOT NULL,
    from_id VARCHAR(255) NOT NULL,
    rel VARCHAR(100) NOT NULL,
    to_type VARCHAR(50) NOT NULL,
    to_id VARCHAR(255) NOT NULL,
    ts_ms BIGINT NOT NULL,
    meta JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_links_from ON links(from_type, from_id);
CREATE INDEX IF NOT EXISTS idx_links_to ON links(to_type, to_id);
CREATE INDEX IF NOT EXISTS idx_links_rel ON links(rel);

-- Alert evidence links (junction table)
CREATE TABLE IF NOT EXISTS alert_evidence (
    alert_id VARCHAR(255) NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    link_id VARCHAR(255) NOT NULL REFERENCES links(id) ON DELETE CASCADE,
    PRIMARY KEY (alert_id, link_id)
);

-- Provider status tracking
CREATE TABLE IF NOT EXISTS provider_status (
    provider_id VARCHAR(255) PRIMARY KEY,
    circuit_state VARCHAR(50) NOT NULL,
    freshness VARCHAR(50) NOT NULL,
    last_success_ts_ms BIGINT,
    failure_count INTEGER DEFAULT 0,
    error_message TEXT,
    meta JSONB,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id BIGSERIAL PRIMARY KEY,
    actor_type VARCHAR(50) NOT NULL,
    actor_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(255),
    details JSONB,
    ts_ms BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_type, actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_ts_ms ON audit_log(ts_ms DESC);

-- Insert initial provider status records
INSERT INTO provider_status (provider_id, circuit_state, freshness, failure_count)
VALUES
    ('mock-adsb', 'CIRCUIT_STATE_CLOSED', 'FRESHNESS_FRESH', 0),
    ('mock-tle', 'CIRCUIT_STATE_CLOSED', 'FRESHNESS_FRESH', 0)
ON CONFLICT (provider_id) DO NOTHING;
