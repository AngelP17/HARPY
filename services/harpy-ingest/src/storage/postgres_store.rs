use harpy_proto::harpy::v1::TrackDelta;
use sqlx::{postgres::PgPoolOptions, PgPool};

#[derive(Clone)]
pub struct PostgresStore {
    pub pool: PgPool,
}

impl PostgresStore {
    pub async fn new(database_url: &str) -> anyhow::Result<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .connect(database_url)
            .await?;

        Ok(Self { pool })
    }

    /// Store track deltas in time-series table
    pub async fn store_track_deltas(&self, tracks: &[TrackDelta]) -> anyhow::Result<()> {
        if tracks.is_empty() {
            return Ok(());
        }

        for track in tracks {
            let position = track
                .position
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("Track {} has no position", track.id))?;

            let meta_json = if track.meta.is_empty() {
                serde_json::Value::Null
            } else {
                serde_json::to_value(&track.meta)?
            };

            sqlx::query(
                r#"
                INSERT INTO track_deltas (track_id, lat, lon, alt, heading, speed, ts_ms, provider_id, meta)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                "#
            )
            .bind(&track.id)
            .bind(position.lat)
            .bind(position.lon)
            .bind(position.alt)
            .bind(track.heading)
            .bind(track.speed)
            .bind(track.ts_ms as i64)
            .bind(&track.provider_id)
            .bind(meta_json)
            .execute(&self.pool)
            .await?;
        }

        tracing::debug!("Stored {} track deltas in Postgres", tracks.len());
        Ok(())
    }

    /// Upsert current track state in tracks table
    pub async fn upsert_tracks(&self, tracks: &[TrackDelta]) -> anyhow::Result<()> {
        if tracks.is_empty() {
            return Ok(());
        }

        for track in tracks {
            let position = track
                .position
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("Track {} has no position", track.id))?;

            let kind = match track.kind {
                1 => "aircraft",
                2 => "satellite",
                3 => "ground",
                4 => "vessel",
                _ => "unknown",
            };

            let meta_json = if track.meta.is_empty() {
                serde_json::Value::Null
            } else {
                serde_json::to_value(&track.meta)?
            };

            // TODO: Calculate H3 index from lat/lon
            let h3_index: Option<i64> = None;

            sqlx::query(
                r#"
                INSERT INTO tracks (id, kind, lat, lon, alt, heading, speed, ts_ms, provider_id, meta, h3_index)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (id) DO UPDATE SET
                    lat = EXCLUDED.lat,
                    lon = EXCLUDED.lon,
                    alt = EXCLUDED.alt,
                    heading = EXCLUDED.heading,
                    speed = EXCLUDED.speed,
                    ts_ms = EXCLUDED.ts_ms,
                    provider_id = EXCLUDED.provider_id,
                    meta = EXCLUDED.meta,
                    updated_at = NOW()
                "#
            )
            .bind(&track.id)
            .bind(kind)
            .bind(position.lat)
            .bind(position.lon)
            .bind(position.alt)
            .bind(track.heading)
            .bind(track.speed)
            .bind(track.ts_ms as i64)
            .bind(&track.provider_id)
            .bind(meta_json)
            .bind(h3_index)
            .execute(&self.pool)
            .await?;
        }

        tracing::debug!("Upserted {} tracks in Postgres", tracks.len());
        Ok(())
    }

    /// Clean up old track deltas (older than retention period)
    pub async fn cleanup_old_deltas(&self, retention_hours: i32) -> anyhow::Result<u64> {
        let cutoff_ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_millis() as i64
            - (retention_hours as i64 * 3600 * 1000);

        let result = sqlx::query("DELETE FROM track_deltas WHERE ts_ms < $1")
            .bind(cutoff_ts)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected())
    }
}
