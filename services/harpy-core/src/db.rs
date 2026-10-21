//! SQLite observation store (WAL). The only persistence layer in HARPY v0.1.

use crate::model::{FetchOutcome, NormalizedRecord, Observation, ObservationType};
use anyhow::{bail, Context, Result};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::path::Path;

const MIGRATIONS: &[(&str, &str)] = &[("0001_init", include_str!("../migrations/0001_init.sql"))];

pub const SCHEMA_VERSION: &str = "1";

pub struct Store {
    conn: Connection,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum UpsertResult {
    New,
    Revised,
    Unchanged,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq)]
pub struct BatchCounts {
    pub new: u64,
    pub revised: u64,
    pub unchanged: u64,
}

/// Canonical JSON digest. serde_json's default Map is a BTreeMap, so keys serialize sorted.
pub fn digest_json(value: &Value) -> String {
    let canonical = serde_json::to_string(value).expect("Value always serializes");
    hex::encode(Sha256::digest(canonical.as_bytes()))
}

impl Store {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                std::fs::create_dir_all(parent)
                    .with_context(|| format!("creating {}", parent.display()))?;
            }
        }
        let conn = Connection::open(path).with_context(|| format!("opening {}", path.display()))?;
        Self::init(conn)
    }

    pub fn open_read_only(path: impl AsRef<Path>) -> Result<Self> {
        let conn = Connection::open_with_flags(
            path.as_ref(),
            rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY | rusqlite::OpenFlags::SQLITE_OPEN_NO_MUTEX,
        )?;
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        Ok(Self { conn })
    }

    fn init(conn: Connection) -> Result<Self> {
        conn.busy_timeout(std::time::Duration::from_secs(5))?;
        let mode: String = conn.query_row("PRAGMA journal_mode=WAL", [], |r| r.get(0))?;
        if !mode.eq_ignore_ascii_case("wal") && !mode.eq_ignore_ascii_case("memory") {
            bail!("SQLite refused WAL mode (got {mode})");
        }
        conn.execute_batch("PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;")?;
        let store = Self { conn };
        store.migrate()?;
        Ok(store)
    }

    fn migrate(&self) -> Result<()> {
        self.conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)",
        )?;
        for (name, sql) in MIGRATIONS {
            let applied: Option<String> = self
                .conn
                .query_row("SELECT name FROM _migrations WHERE name=?1", [name], |r| {
                    r.get(0)
                })
                .optional()?;
            if applied.is_none() {
                let tx = self.conn.unchecked_transaction()?;
                tx.execute_batch(sql)
                    .with_context(|| format!("migration {name}"))?;
                tx.execute(
                    "INSERT INTO _migrations (name, applied_at) VALUES (?1, ?2)",
                    params![name, crate::now_ms()],
                )?;
                tx.execute(
                    "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('schema_version', ?1)",
                    [SCHEMA_VERSION],
                )?;
                tx.commit()?;
                tracing::info!(migration = name, "applied migration");
            }
        }
        Ok(())
    }

    /// Store a batch from one fetch atomically. Unchanged records (same digest as the latest
    /// revision) are not re-written; changed ones become a new revision.
    pub fn ingest_batch(
        &mut self,
        source_id: &str,
        license_class: &str,
        records: &[NormalizedRecord],
        ingested_at: i64,
    ) -> Result<BatchCounts> {
        let tx = self.conn.transaction()?;
        let mut counts = BatchCounts::default();
        for rec in records {
            match upsert(&tx, source_id, license_class, rec, ingested_at)? {
                UpsertResult::New => counts.new += 1,
                UpsertResult::Revised => counts.revised += 1,
                UpsertResult::Unchanged => counts.unchanged += 1,
            }
        }
        tx.commit()?;
        Ok(counts)
    }

    pub fn record_fetch(&self, f: &FetchOutcome) -> Result<()> {
        self.conn.execute(
            "INSERT INTO fetch_log (source_id, endpoint, started_at, finished_at, http_status, ok,
                records_seen, records_new, records_revised, records_unchanged, records_invalid, error)
             VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)",
            params![
                f.source_id,
                f.endpoint,
                f.started_at,
                f.finished_at,
                f.http_status,
                f.ok as i64,
                f.records_seen as i64,
                f.records_new as i64,
                f.records_revised as i64,
                f.records_unchanged as i64,
                f.records_invalid as i64,
                f.error
            ],
        )?;
        Ok(())
    }

    pub fn fetch_log(&self, source_id: Option<&str>, limit: usize) -> Result<Vec<FetchOutcome>> {
        let sql =
            "SELECT source_id, endpoint, started_at, finished_at, http_status, ok, records_seen,
                    records_new, records_revised, records_unchanged, records_invalid, error
                   FROM fetch_log WHERE (?1 IS NULL OR source_id = ?1)
                   ORDER BY started_at DESC, id DESC LIMIT ?2";
        let mut stmt = self.conn.prepare(sql)?;
        let rows = stmt.query_map(params![source_id, limit as i64], |r| {
            Ok(FetchOutcome {
                source_id: r.get(0)?,
                endpoint: r.get(1)?,
                started_at: r.get(2)?,
                finished_at: r.get(3)?,
                http_status: r.get::<_, Option<i64>>(4)?.map(|v| v as u16),
                ok: r.get::<_, i64>(5)? != 0,
                records_seen: r.get::<_, i64>(6)? as u64,
                records_new: r.get::<_, i64>(7)? as u64,
                records_revised: r.get::<_, i64>(8)? as u64,
                records_unchanged: r.get::<_, i64>(9)? as u64,
                records_invalid: r.get::<_, i64>(10)? as u64,
                error: r.get(11)?,
            })
        })?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }

    /// Most recent successful fetch of a specific endpoint, for refresh throttling.
    pub fn last_success_at(&self, source_id: &str, endpoint: &str) -> Result<Option<i64>> {
        Ok(self
            .conn
            .query_row(
                "SELECT MAX(finished_at) FROM fetch_log WHERE source_id=?1 AND endpoint=?2 AND ok=1",
                params![source_id, endpoint],
                |r| r.get::<_, Option<i64>>(0),
            )
            .optional()?
            .flatten())
    }

    /// Latest revision of each observation of `kind` whose observed_at is within [from, to].
    pub fn latest_in_window(&self, kind: &str, from: i64, to: i64) -> Result<Vec<Observation>> {
        let sql = format!(
            "SELECT {COLS} FROM observations o
             JOIN (SELECT observation_id, MAX(revision) AS r FROM observations WHERE kind=?1 GROUP BY observation_id) m
               ON o.observation_id = m.observation_id AND o.revision = m.r
             WHERE o.observed_at BETWEEN ?2 AND ?3
             ORDER BY o.observed_at ASC, o.observation_id ASC"
        );
        self.query_observations(&sql, params![kind, from, to])
    }

    /// Latest revision of every observation of `kind`.
    pub fn latest_all(&self, kind: &str) -> Result<Vec<Observation>> {
        self.latest_in_window(kind, i64::MIN, i64::MAX)
    }

    /// Every revision (not only the latest) of `kind` with observed_at in [from, to].
    pub fn revisions_in_window(&self, kind: &str, from: i64, to: i64) -> Result<Vec<Observation>> {
        let sql = format!(
            "SELECT {COLS} FROM observations o WHERE kind=?1 AND observed_at BETWEEN ?2 AND ?3
             ORDER BY observed_at ASC, observation_id ASC, revision ASC"
        );
        self.query_observations(&sql, params![kind, from, to])
    }

    pub fn history(&self, observation_id: &str) -> Result<Vec<Observation>> {
        let sql = format!(
            "SELECT {COLS} FROM observations o WHERE observation_id=?1 ORDER BY revision ASC"
        );
        self.query_observations(&sql, params![observation_id])
    }

    pub fn raw_record(&self, digest: &str) -> Result<Option<Value>> {
        let body: Option<String> = self
            .conn
            .query_row(
                "SELECT body FROM raw_records WHERE digest=?1",
                [digest],
                |r| r.get(0),
            )
            .optional()?;
        Ok(match body {
            Some(b) => Some(serde_json::from_str(&b)?),
            None => None,
        })
    }

    /// (min, max) observed_at for a kind, i.e. the recorded history range.
    pub fn observed_range(&self, kind: &str) -> Result<Option<(i64, i64)>> {
        let row: (Option<i64>, Option<i64>) = self.conn.query_row(
            "SELECT MIN(observed_at), MAX(observed_at) FROM observations WHERE kind=?1",
            [kind],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        Ok(match row {
            (Some(a), Some(b)) => Some((a, b)),
            _ => None,
        })
    }

    /// (min, max) ingested_at for a kind: when HARPY itself was recording.
    pub fn ingested_range(&self, kind: &str) -> Result<Option<(i64, i64)>> {
        let row: (Option<i64>, Option<i64>) = self.conn.query_row(
            "SELECT MIN(ingested_at), MAX(ingested_at) FROM observations WHERE kind=?1",
            [kind],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        Ok(match row {
            (Some(a), Some(b)) => Some((a, b)),
            _ => None,
        })
    }

    pub fn count(&self, kind: &str) -> Result<(u64, u64)> {
        let (ids, revs): (i64, i64) = self.conn.query_row(
            "SELECT COUNT(DISTINCT observation_id), COUNT(*) FROM observations WHERE kind=?1",
            [kind],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        Ok((ids as u64, revs as u64))
    }

    /// Retention: remove observations of `kind` observed before `before`, then orphaned raw records.
    pub fn prune(&mut self, kind: &str, before: i64) -> Result<u64> {
        let tx = self.conn.transaction()?;
        let removed = tx.execute(
            "DELETE FROM observations WHERE kind=?1 AND observed_at < ?2",
            params![kind, before],
        )? as u64;
        tx.execute(
            "DELETE FROM raw_records WHERE digest NOT IN (SELECT raw_payload_digest FROM observations)",
            [],
        )?;
        tx.commit()?;
        Ok(removed)
    }

    pub fn prune_fetch_log(&self, before: i64) -> Result<u64> {
        Ok(self
            .conn
            .execute("DELETE FROM fetch_log WHERE started_at < ?1", [before])? as u64)
    }

    pub fn integrity_check(&self) -> Result<String> {
        Ok(self
            .conn
            .query_row("PRAGMA integrity_check", [], |r| r.get(0))?)
    }

    /// Fold the WAL back into the main file, e.g. before copying the database for backup.
    pub fn checkpoint(&self) -> Result<()> {
        self.conn
            .query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()))?;
        Ok(())
    }

    /// `VACUUM INTO` produces a consistent single-file copy without stopping writers.
    pub fn backup_to(&self, dest: &Path) -> Result<()> {
        if dest.exists() {
            std::fs::remove_file(dest)?;
        }
        self.conn
            .execute("VACUUM INTO ?1", [dest.to_string_lossy().as_ref()])?;
        Ok(())
    }

    fn query_observations(&self, sql: &str, p: impl rusqlite::Params) -> Result<Vec<Observation>> {
        let mut stmt = self.conn.prepare(sql)?;
        let rows = stmt.query_map(p, row_to_observation)?;
        Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
    }
}

const COLS: &str =
    "o.observation_id, o.revision, o.observation_type, o.kind, o.source_id, o.upstream_id,
    o.observed_at, o.source_updated_at, o.ingested_at, o.geometry, o.uncertainty, o.evidence_refs,
    o.model_version, o.license_class, o.source_url, o.raw_payload_digest, o.attributes";

fn parse_json_col(raw: Option<String>) -> Option<Value> {
    raw.and_then(|s| serde_json::from_str(&s).ok())
}

fn row_to_observation(r: &Row<'_>) -> rusqlite::Result<Observation> {
    let otype: String = r.get(2)?;
    let evidence: String = r.get(11)?;
    let attributes: String = r.get(16)?;
    Ok(Observation {
        observation_id: r.get(0)?,
        revision: r.get(1)?,
        observation_type: ObservationType::parse(&otype).unwrap_or(ObservationType::Measured),
        kind: r.get(3)?,
        source_id: r.get(4)?,
        upstream_id: r.get(5)?,
        observed_at: r.get(6)?,
        source_updated_at: r.get(7)?,
        ingested_at: r.get(8)?,
        geometry: parse_json_col(r.get(9)?),
        uncertainty: parse_json_col(r.get(10)?),
        evidence_refs: serde_json::from_str(&evidence).unwrap_or_default(),
        model_version: r.get(12)?,
        license_class: r.get(13)?,
        source_url: r.get(14)?,
        raw_payload_digest: r.get(15)?,
        attributes: serde_json::from_str(&attributes).unwrap_or(Value::Null),
    })
}

fn upsert(
    tx: &rusqlite::Transaction<'_>,
    source_id: &str,
    license_class: &str,
    rec: &NormalizedRecord,
    ingested_at: i64,
) -> Result<UpsertResult> {
    let digest = digest_json(&rec.raw);
    let latest: Option<(i64, String)> = tx
        .query_row(
            "SELECT revision, raw_payload_digest FROM observations WHERE observation_id=?1
             ORDER BY revision DESC LIMIT 1",
            [&rec.observation_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?;

    let (revision, result) = match latest {
        Some((_, ref d)) if *d == digest => return Ok(UpsertResult::Unchanged),
        Some((rev, _)) => (rev + 1, UpsertResult::Revised),
        None => (1, UpsertResult::New),
    };

    tx.execute(
        "INSERT OR IGNORE INTO raw_records (digest, source_id, fetched_at, body) VALUES (?1,?2,?3,?4)",
        params![digest, source_id, ingested_at, serde_json::to_string(&rec.raw)?],
    )?;

    let (lat, lon) = point_lat_lon(rec.geometry.as_ref());
    tx.execute(
        "INSERT INTO observations (observation_id, revision, observation_type, kind, source_id, upstream_id,
            observed_at, source_updated_at, ingested_at, lat, lon, geometry, uncertainty, evidence_refs,
            model_version, license_class, source_url, raw_payload_digest, attributes)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,NULL,?15,?16,?17,?18)",
        params![
            rec.observation_id,
            revision,
            rec.observation_type.as_str(),
            rec.kind,
            source_id,
            rec.upstream_id,
            rec.observed_at,
            rec.source_updated_at,
            ingested_at,
            lat,
            lon,
            rec.geometry.as_ref().map(|g| g.to_string()),
            rec.uncertainty.as_ref().map(|u| u.to_string()),
            serde_json::to_string(&rec.evidence_refs)?,
            license_class,
            rec.source_url,
            digest,
            rec.attributes.to_string(),
        ],
    )?;
    Ok(result)
}

fn point_lat_lon(geometry: Option<&Value>) -> (Option<f64>, Option<f64>) {
    let Some(g) = geometry else {
        return (None, None);
    };
    if g.get("type").and_then(Value::as_str) != Some("Point") {
        return (None, None);
    }
    let c = g.get("coordinates").and_then(Value::as_array);
    match c {
        Some(c) if c.len() >= 2 => (c[1].as_f64(), c[0].as_f64()),
        _ => (None, None),
    }
}
