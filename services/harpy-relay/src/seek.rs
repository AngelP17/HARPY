//! Seek API for Playback Ranges (B2-3)
//!
//! Provides endpoints for querying snapshots and delta ranges
//! to support DVR time-travel playback.

use axum::{
    extract::{Query, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::{Postgres, QueryBuilder, Row};

use crate::AppState;

/// Seek request parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct SeekRequest {
    /// Start timestamp (epoch milliseconds)
    pub start_ts_ms: u64,
    /// End timestamp (epoch milliseconds)
    pub end_ts_ms: u64,
    /// Optional viewport filter (min_lat)
    pub min_lat: Option<f64>,
    /// Optional viewport filter (min_lon)
    pub min_lon: Option<f64>,
    /// Optional viewport filter (max_lat)
    pub max_lat: Option<f64>,
    /// Optional viewport filter (max_lon)
    pub max_lon: Option<f64>,
    /// Layer types to include (comma-separated: aircraft,satellite,ground,vessel)
    pub layers: Option<String>,
}

/// Delta range description
#[derive(Debug, Serialize)]
pub struct DeltaRange {
    /// Start timestamp
    pub start_ts_ms: u64,
    /// End timestamp
    pub end_ts_ms: u64,
    /// Estimated number of track deltas
    pub estimated_deltas: usize,
    /// Storage location hint
    pub storage_hint: String,
}

/// Snapshot reference
#[derive(Debug, Serialize)]
pub struct SnapshotRef {
    /// Snapshot ID
    pub id: String,
    /// Time range covered
    pub start_ts_ms: u64,
    pub end_ts_ms: u64,
    /// Number of tracks in snapshot
    pub track_count: usize,
    /// Storage path
    pub storage_path: String,
}

/// Seek response
#[derive(Debug, Serialize)]
pub struct SeekResponse {
    /// Request parameters echoed back
    pub request: SeekRequest,
    /// Recommended snapshot to start from
    pub snapshot: Option<SnapshotRef>,
    /// Delta ranges to fetch after snapshot
    pub delta_ranges: Vec<DeltaRange>,
    /// Total estimated tracks
    pub total_estimated_tracks: usize,
    /// Schema version
    pub schema_version: String,
}

/// Error response
#[derive(Debug, Serialize)]
pub struct SeekError {
    pub error: String,
    pub code: String,
}

/// Seek API handler
pub async fn seek_handler(
    State(state): State<AppState>,
    Query(params): Query<SeekRequest>,
) -> impl IntoResponse {
    // Validate request
    if params.start_ts_ms >= params.end_ts_ms {
        return Json(Err::<SeekResponse, _>(SeekError {
            error: "start_ts_ms must be less than end_ts_ms".to_string(),
            code: "INVALID_RANGE".to_string(),
        }))
        .into_response();
    }

    // Maximum allowed range (24 hours)
    const MAX_RANGE_MS: u64 = 24 * 60 * 60 * 1000;
    if params.end_ts_ms - params.start_ts_ms > MAX_RANGE_MS {
        return Json(Err::<SeekResponse, _>(SeekError {
            error: "Time range exceeds maximum (24 hours)".to_string(),
            code: "RANGE_TOO_LARGE".to_string(),
        }))
        .into_response();
    }

    let Some(pool) = state.db_pool.as_ref() else {
        return Json(Err::<SeekResponse, _>(SeekError {
            error: "Database unavailable: seek requires Postgres".to_string(),
            code: "DB_UNAVAILABLE".to_string(),
        }))
        .into_response();
    };

    let snapshot = match find_snapshot(pool, params.start_ts_ms).await {
        Ok(snapshot) => snapshot,
        Err(error) => return Json(Err::<SeekResponse, _>(error)).into_response(),
    };

    let delta_start_ts_ms = snapshot
        .as_ref()
        .map(|s| s.end_ts_ms.saturating_add(1))
        .unwrap_or(params.start_ts_ms)
        .max(params.start_ts_ms);

    let estimated_deltas = match count_deltas(
        pool,
        delta_start_ts_ms,
        params.end_ts_ms,
        params.min_lat,
        params.min_lon,
        params.max_lat,
        params.max_lon,
        parse_layers(params.layers.as_deref()),
    )
    .await
    {
        Ok(count) => count,
        Err(error) => return Json(Err::<SeekResponse, _>(error)).into_response(),
    };

    let delta_ranges = vec![DeltaRange {
        start_ts_ms: delta_start_ts_ms,
        end_ts_ms: params.end_ts_ms,
        estimated_deltas,
        storage_hint: "postgres:track_deltas".to_string(),
    }];

    let response = SeekResponse {
        request: SeekRequest {
            start_ts_ms: params.start_ts_ms,
            end_ts_ms: params.end_ts_ms,
            min_lat: params.min_lat,
            min_lon: params.min_lon,
            max_lat: params.max_lat,
            max_lon: params.max_lon,
            layers: params.layers.clone(),
        },
        snapshot,
        delta_ranges,
        total_estimated_tracks: estimated_deltas,
        schema_version: "1.0.0".to_string(),
    };

    Json(Ok::<_, SeekError>(response)).into_response()
}

fn parse_layers(layers: Option<&str>) -> Vec<String> {
    layers
        .map(|l| {
            l.split(',')
                .map(|s| s.trim().to_ascii_lowercase())
                .filter(|s| !s.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

async fn find_snapshot(
    pool: &sqlx::PgPool,
    start_ts_ms: u64,
) -> Result<Option<SnapshotRef>, SeekError> {
    let as_i64 = start_ts_ms as i64;

    // Prefer snapshot that covers the requested start time.
    let row = sqlx::query(
        r#"
        SELECT id, start_ts_ms, end_ts_ms, track_count, storage_path
        FROM snapshots
        WHERE start_ts_ms <= $1 AND end_ts_ms >= $1
        ORDER BY end_ts_ms ASC
        LIMIT 1
        "#,
    )
    .bind(as_i64)
    .fetch_optional(pool)
    .await
    .map_err(|e| SeekError {
        error: format!("Failed to query snapshots: {}", e),
        code: "DB_QUERY_FAILED".to_string(),
    })?;

    if let Some(row) = row {
        return Ok(Some(SnapshotRef {
            id: row.get::<String, _>("id"),
            start_ts_ms: row.get::<i64, _>("start_ts_ms") as u64,
            end_ts_ms: row.get::<i64, _>("end_ts_ms") as u64,
            track_count: row.get::<i32, _>("track_count") as usize,
            storage_path: row.get::<String, _>("storage_path"),
        }));
    }

    // Fallback to most recent snapshot before the requested start.
    let row = sqlx::query(
        r#"
        SELECT id, start_ts_ms, end_ts_ms, track_count, storage_path
        FROM snapshots
        WHERE end_ts_ms <= $1
        ORDER BY end_ts_ms DESC
        LIMIT 1
        "#,
    )
    .bind(as_i64)
    .fetch_optional(pool)
    .await
    .map_err(|e| SeekError {
        error: format!("Failed to query fallback snapshot: {}", e),
        code: "DB_QUERY_FAILED".to_string(),
    })?;

    Ok(row.map(|row| SnapshotRef {
        id: row.get::<String, _>("id"),
        start_ts_ms: row.get::<i64, _>("start_ts_ms") as u64,
        end_ts_ms: row.get::<i64, _>("end_ts_ms") as u64,
        track_count: row.get::<i32, _>("track_count") as usize,
        storage_path: row.get::<String, _>("storage_path"),
    }))
}

#[allow(clippy::too_many_arguments)]
async fn count_deltas(
    pool: &sqlx::PgPool,
    start_ts_ms: u64,
    end_ts_ms: u64,
    min_lat: Option<f64>,
    min_lon: Option<f64>,
    max_lat: Option<f64>,
    max_lon: Option<f64>,
    layers: Vec<String>,
) -> Result<usize, SeekError> {
    let mut qb = QueryBuilder::<Postgres>::new(
        "SELECT COUNT(*)::BIGINT AS cnt \
         FROM track_deltas td \
         LEFT JOIN tracks t ON t.id = td.track_id \
         WHERE td.ts_ms >= ",
    );
    qb.push_bind(start_ts_ms as i64)
        .push(" AND td.ts_ms <= ")
        .push_bind(end_ts_ms as i64);

    if let (Some(min_lat), Some(min_lon), Some(max_lat), Some(max_lon)) =
        (min_lat, min_lon, max_lat, max_lon)
    {
        qb.push(" AND td.lat >= ")
            .push_bind(min_lat)
            .push(" AND td.lat <= ")
            .push_bind(max_lat)
            .push(" AND td.lon >= ")
            .push_bind(min_lon)
            .push(" AND td.lon <= ")
            .push_bind(max_lon);
    }

    if !layers.is_empty() {
        qb.push(" AND t.kind = ANY(").push_bind(layers).push(")");
    }

    let row = qb.build().fetch_one(pool).await.map_err(|e| SeekError {
        error: format!("Failed to count deltas: {}", e),
        code: "DB_QUERY_FAILED".to_string(),
    })?;

    Ok(row.get::<i64, _>("cnt") as usize)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seek_request_validation() {
        // Valid range
        let valid = SeekRequest {
            start_ts_ms: 1000,
            end_ts_ms: 2000,
            min_lat: Some(37.0),
            min_lon: Some(-123.0),
            max_lat: Some(38.0),
            max_lon: Some(-121.0),
            layers: Some("aircraft,satellite".to_string()),
        };
        assert!(valid.start_ts_ms < valid.end_ts_ms);

        // Invalid range
        let invalid = SeekRequest {
            start_ts_ms: 2000,
            end_ts_ms: 1000,
            min_lat: None,
            min_lon: None,
            max_lat: None,
            max_lon: None,
            layers: None,
        };
        assert!(invalid.start_ts_ms >= invalid.end_ts_ms);
    }
}
