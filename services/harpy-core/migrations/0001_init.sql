-- HARPY observation store, schema v1.
-- Append-only: a correction is a new revision row, never an UPDATE of an old one.

CREATE TABLE IF NOT EXISTS observations (
    observation_id      TEXT    NOT NULL,
    revision            INTEGER NOT NULL CHECK (revision >= 1),
    observation_type    TEXT    NOT NULL CHECK (observation_type IN ('measured','calculated','inferred','asserted')),
    kind                TEXT    NOT NULL,
    source_id           TEXT    NOT NULL,
    upstream_id         TEXT,
    observed_at         INTEGER NOT NULL,
    source_updated_at   INTEGER,
    ingested_at         INTEGER NOT NULL,
    lat                 REAL,
    lon                 REAL,
    geometry            TEXT,
    uncertainty         TEXT,
    evidence_refs       TEXT    NOT NULL DEFAULT '[]',
    model_version       TEXT,
    license_class       TEXT    NOT NULL,
    source_url          TEXT,
    raw_payload_digest  TEXT    NOT NULL,
    attributes          TEXT    NOT NULL DEFAULT '{}',
    PRIMARY KEY (observation_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_obs_kind_observed ON observations (kind, observed_at);
CREATE INDEX IF NOT EXISTS idx_obs_source_upstream ON observations (source_id, upstream_id);
CREATE INDEX IF NOT EXISTS idx_obs_ingested ON observations (ingested_at);

-- The exact upstream record each revision was built from, deduplicated by digest.
CREATE TABLE IF NOT EXISTS raw_records (
    digest      TEXT    PRIMARY KEY,
    source_id   TEXT    NOT NULL,
    fetched_at  INTEGER NOT NULL,
    body        TEXT    NOT NULL
);

-- One row per provider fetch attempt. Provider health is derived from this.
CREATE TABLE IF NOT EXISTS fetch_log (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id           TEXT    NOT NULL,
    endpoint            TEXT    NOT NULL,
    started_at          INTEGER NOT NULL,
    finished_at         INTEGER NOT NULL,
    http_status         INTEGER,
    ok                  INTEGER NOT NULL,
    records_seen        INTEGER NOT NULL DEFAULT 0,
    records_new         INTEGER NOT NULL DEFAULT 0,
    records_revised     INTEGER NOT NULL DEFAULT 0,
    records_unchanged   INTEGER NOT NULL DEFAULT 0,
    records_invalid     INTEGER NOT NULL DEFAULT 0,
    error               TEXT
);

CREATE INDEX IF NOT EXISTS idx_fetch_source_started ON fetch_log (source_id, started_at);

CREATE TABLE IF NOT EXISTS schema_meta (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
