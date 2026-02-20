//! Query Engine with Pre-approved Templates
//!
//! Provides safe, parameterized queries for common graph operations.
//! No arbitrary SQL execution allowed.

use crate::{ParamInfo, TemplateInfo};
use serde_json::{json, Value};
use sqlx::{Column, PgPool, Row, TypeInfo};
use std::collections::HashMap;

pub struct QueryResult {
    pub rows: Vec<Value>,
    pub total: i64,
}

#[derive(Clone)]
pub struct QueryEngine {
    templates: HashMap<String, QueryTemplate>,
}

#[derive(Clone)]
struct QueryTemplate {
    name: String,
    description: String,
    params: Vec<ParamDef>,
    sql: String,
    count_sql: Option<String>,
}

#[derive(Clone)]
struct ParamDef {
    name: String,
    param_type: ParamType,
    required: bool,
    description: String,
}

#[derive(Clone)]
enum ParamType {
    String,
    Integer,
    Float,
}

impl QueryEngine {
    pub fn new() -> Self {
        let mut templates = HashMap::new();

        templates.insert(
            "get_evidence_chain".to_string(),
            QueryTemplate {
                name: "get_evidence_chain".to_string(),
                description: "Get evidence chain for an alert".to_string(),
                params: vec![ParamDef {
                    name: "alert_id".to_string(),
                    param_type: ParamType::String,
                    required: true,
                    description: "Alert ID".to_string(),
                }],
                sql: r#"
                    WITH RECURSIVE evidence_chain AS (
                        SELECT
                            a.id as node_id,
                            'Alert' as node_type,
                            a.title as node_label,
                            a.severity,
                            a.ts_ms,
                            0 as depth
                        FROM alerts a
                        WHERE a.id = $1

                        UNION ALL

                        SELECT
                            l.to_id as node_id,
                            l.to_type as node_type,
                            COALESCE(t.kind, l.to_id) as node_label,
                            NULL as severity,
                            l.ts_ms,
                            ec.depth + 1
                        FROM evidence_chain ec
                        JOIN links l ON ec.node_id = l.from_id AND l.rel = 'is_evidenced_by'
                        LEFT JOIN tracks t ON l.to_id = t.id
                        WHERE ec.depth < 10
                    )
                    SELECT * FROM evidence_chain ORDER BY depth, ts_ms
                "#
                .to_string(),
                count_sql: None,
            },
        );

        templates.insert(
            "get_tracks_by_sensor".to_string(),
            QueryTemplate {
                name: "get_tracks_by_sensor".to_string(),
                description: "Find all tracks observed by a sensor".to_string(),
                params: vec![ParamDef {
                    name: "sensor_id".to_string(),
                    param_type: ParamType::String,
                    required: true,
                    description: "Sensor ID".to_string(),
                }],
                sql: r#"
                    SELECT DISTINCT
                        t.id,
                        t.kind,
                        t.lat,
                        t.lon,
                        t.alt,
                        t.ts_ms,
                        t.provider_id
                    FROM tracks t
                    JOIN links l ON t.id = l.to_id
                    WHERE l.from_type = 'Sensor'
                      AND l.from_id = $1
                      AND l.rel = 'observed_by'
                    ORDER BY t.ts_ms DESC
                    LIMIT $2 OFFSET $3
                "#
                .to_string(),
                count_sql: Some(
                    r#"
                    SELECT COUNT(DISTINCT t.id)
                    FROM tracks t
                    JOIN links l ON t.id = l.to_id
                    WHERE l.from_type = 'Sensor'
                      AND l.from_id = $1
                      AND l.rel = 'observed_by'
                "#
                    .to_string(),
                ),
            },
        );

        templates.insert(
            "find_associated_tracks".to_string(),
            QueryTemplate {
                name: "find_associated_tracks".to_string(),
                description: "Find tracks associated with a given track (within distance)"
                    .to_string(),
                params: vec![
                    ParamDef {
                        name: "track_id".to_string(),
                        param_type: ParamType::String,
                        required: true,
                        description: "Track ID to find associations for".to_string(),
                    },
                    ParamDef {
                        name: "max_distance_meters".to_string(),
                        param_type: ParamType::Float,
                        required: false,
                        description: "Maximum distance in meters (default: 10000)".to_string(),
                    },
                ],
                sql: r#"
                    WITH target_track AS (
                        SELECT lat, lon, ts_ms
                        FROM tracks
                        WHERE id = $1
                    )
                    SELECT DISTINCT
                        t.id,
                        t.kind,
                        t.lat,
                        t.lon,
                        t.alt,
                        t.ts_ms,
                        t.provider_id,
                        6371000 * acos(
                            least(1, cos(radians(tt.lat)) * cos(radians(t.lat)) *
                            cos(radians(t.lon) - radians(tt.lon)) +
                            sin(radians(tt.lat)) * sin(radians(t.lat)))
                        ) as distance_meters
                    FROM tracks t, target_track tt
                    WHERE t.id != $1
                      AND ABS(t.ts_ms - tt.ts_ms) < 60000
                      AND 6371000 * acos(
                          least(1, cos(radians(tt.lat)) * cos(radians(t.lat)) *
                          cos(radians(t.lon) - radians(tt.lon)) +
                          sin(radians(tt.lat)) * sin(radians(t.lat)))
                      ) <= COALESCE($2, 10000)
                    ORDER BY distance_meters
                    LIMIT $3 OFFSET $4
                "#
                .to_string(),
                count_sql: Some(
                    r#"
                    WITH target_track AS (
                        SELECT lat, lon, ts_ms
                        FROM tracks
                        WHERE id = $1
                    )
                    SELECT COUNT(*)
                    FROM tracks t, target_track tt
                    WHERE t.id != $1
                      AND ABS(t.ts_ms - tt.ts_ms) < 60000
                      AND 6371000 * acos(
                          least(1, cos(radians(tt.lat)) * cos(radians(t.lat)) *
                          cos(radians(t.lon) - radians(tt.lon)) +
                          sin(radians(tt.lat)) * sin(radians(t.lat)))
                      ) <= COALESCE($2, 10000)
                "#
                    .to_string(),
                ),
            },
        );

        templates.insert(
            "get_alerts_by_severity".to_string(),
            QueryTemplate {
                name: "get_alerts_by_severity".to_string(),
                description: "Get alerts filtered by severity".to_string(),
                params: vec![
                    ParamDef {
                        name: "severity".to_string(),
                        param_type: ParamType::String,
                        required: false,
                        description: "Minimum severity (INFO, WARNING, CRITICAL)".to_string(),
                    },
                    ParamDef {
                        name: "status".to_string(),
                        param_type: ParamType::String,
                        required: false,
                        description: "Alert status filter".to_string(),
                    },
                ],
                sql: r#"
                    SELECT
                        a.id,
                        a.severity,
                        a.title,
                        a.description,
                        a.ts_ms,
                        a.status,
                        a.meta
                    FROM alerts a
                    WHERE ($1::text IS NULL OR a.severity = $1)
                      AND ($2::text IS NULL OR a.status = $2)
                    ORDER BY
                        CASE a.severity
                            WHEN 'CRITICAL' THEN 1
                            WHEN 'WARNING' THEN 2
                            WHEN 'INFO' THEN 3
                            ELSE 4
                        END,
                        a.ts_ms DESC
                    LIMIT $3 OFFSET $4
                "#
                .to_string(),
                count_sql: Some(
                    r#"
                    SELECT COUNT(*)
                    FROM alerts a
                    WHERE ($1::text IS NULL OR a.severity = $1)
                      AND ($2::text IS NULL OR a.status = $2)
                "#
                    .to_string(),
                ),
            },
        );

        let track_history_sql = r#"
            SELECT
                td.id,
                td.track_id,
                td.lat,
                td.lon,
                td.alt,
                td.heading,
                td.speed,
                td.ts_ms,
                td.provider_id,
                td.meta
            FROM track_deltas td
            WHERE td.track_id = $1
              AND ($2::bigint IS NULL OR td.ts_ms >= $2)
              AND ($3::bigint IS NULL OR td.ts_ms <= $3)
            ORDER BY td.ts_ms DESC
            LIMIT $4 OFFSET $5
        "#
        .to_string();

        let track_history_count_sql = r#"
            SELECT COUNT(*)
            FROM track_deltas td
            WHERE td.track_id = $1
              AND ($2::bigint IS NULL OR td.ts_ms >= $2)
              AND ($3::bigint IS NULL OR td.ts_ms <= $3)
        "#
        .to_string();

        let track_history_params = vec![
            ParamDef {
                name: "track_id".to_string(),
                param_type: ParamType::String,
                required: true,
                description: "Track ID".to_string(),
            },
            ParamDef {
                name: "start_ts_ms".to_string(),
                param_type: ParamType::Integer,
                required: false,
                description: "Start timestamp".to_string(),
            },
            ParamDef {
                name: "end_ts_ms".to_string(),
                param_type: ParamType::Integer,
                required: false,
                description: "End timestamp".to_string(),
            },
        ];

        templates.insert(
            "get_track_history".to_string(),
            QueryTemplate {
                name: "get_track_history".to_string(),
                description: "Get position history for a track".to_string(),
                params: track_history_params.clone(),
                sql: track_history_sql.clone(),
                count_sql: Some(track_history_count_sql.clone()),
            },
        );

        templates.insert(
            "track_timeline".to_string(),
            QueryTemplate {
                name: "track_timeline".to_string(),
                description: "Alias for get_track_history used by export tooling".to_string(),
                params: track_history_params,
                sql: track_history_sql,
                count_sql: Some(track_history_count_sql),
            },
        );

        templates.insert(
            "search_tracks".to_string(),
            QueryTemplate {
                name: "search_tracks".to_string(),
                description: "Search tracks by various criteria".to_string(),
                params: vec![
                    ParamDef {
                        name: "id".to_string(),
                        param_type: ParamType::String,
                        required: false,
                        description: "Exact track ID".to_string(),
                    },
                    ParamDef {
                        name: "kind".to_string(),
                        param_type: ParamType::String,
                        required: false,
                        description: "Track kind (AIRCRAFT, SATELLITE, etc.)".to_string(),
                    },
                    ParamDef {
                        name: "min_lat".to_string(),
                        param_type: ParamType::Float,
                        required: false,
                        description: "Minimum latitude".to_string(),
                    },
                    ParamDef {
                        name: "max_lat".to_string(),
                        param_type: ParamType::Float,
                        required: false,
                        description: "Maximum latitude".to_string(),
                    },
                    ParamDef {
                        name: "min_lon".to_string(),
                        param_type: ParamType::Float,
                        required: false,
                        description: "Minimum longitude".to_string(),
                    },
                    ParamDef {
                        name: "max_lon".to_string(),
                        param_type: ParamType::Float,
                        required: false,
                        description: "Maximum longitude".to_string(),
                    },
                ],
                sql: r#"
                    SELECT
                        t.id,
                        t.kind,
                        t.lat,
                        t.lon,
                        t.alt,
                        t.heading,
                        t.speed,
                        t.ts_ms,
                        t.provider_id,
                        t.meta
                    FROM tracks t
                    WHERE ($1::text IS NULL OR t.id = $1)
                      AND ($2::text IS NULL OR t.kind = $2)
                      AND ($3::float8 IS NULL OR t.lat >= $3)
                      AND ($4::float8 IS NULL OR t.lat <= $4)
                      AND ($5::float8 IS NULL OR t.lon >= $5)
                      AND ($6::float8 IS NULL OR t.lon <= $6)
                    ORDER BY t.ts_ms DESC
                    LIMIT $7 OFFSET $8
                "#
                .to_string(),
                count_sql: Some(
                    r#"
                    SELECT COUNT(*)
                    FROM tracks t
                    WHERE ($1::text IS NULL OR t.id = $1)
                      AND ($2::text IS NULL OR t.kind = $2)
                      AND ($3::float8 IS NULL OR t.lat >= $3)
                      AND ($4::float8 IS NULL OR t.lat <= $4)
                      AND ($5::float8 IS NULL OR t.lon >= $5)
                      AND ($6::float8 IS NULL OR t.lon <= $6)
                "#
                    .to_string(),
                ),
            },
        );

        Self { templates }
    }

    pub fn is_valid_template(&self, name: &str) -> bool {
        self.templates.contains_key(name)
    }

    pub fn list_templates(&self) -> Vec<TemplateInfo> {
        let mut templates = self
            .templates
            .values()
            .map(|t| TemplateInfo {
                name: t.name.clone(),
                description: t.description.clone(),
                params: t
                    .params
                    .iter()
                    .map(|p| ParamInfo {
                        name: p.name.clone(),
                        param_type: format!("{:?}", p.param_type),
                        required: p.required,
                        description: p.description.clone(),
                    })
                    .collect(),
            })
            .collect::<Vec<_>>();

        templates.sort_by(|a, b| a.name.cmp(&b.name));
        templates
    }

    pub async fn execute(
        &self,
        pool: &PgPool,
        template_name: &str,
        params: &Value,
        limit: i64,
        offset: i64,
    ) -> anyhow::Result<QueryResult> {
        if !params.is_object() && !params.is_null() {
            return Err(anyhow::anyhow!("Params must be a JSON object"));
        }

        let template = self
            .templates
            .get(template_name)
            .ok_or_else(|| anyhow::anyhow!("Unknown template: {}", template_name))?;

        let (rows, total) = match template_name {
            "get_evidence_chain" => {
                let alert_id = required_string(params, "alert_id")?;
                let rows = sqlx::query(&template.sql)
                    .bind(&alert_id)
                    .fetch_all(pool)
                    .await?;
                let total = rows.len() as i64;
                (rows, total)
            }
            "get_tracks_by_sensor" => {
                let sensor_id = required_string(params, "sensor_id")?;
                let rows = sqlx::query(&template.sql)
                    .bind(&sensor_id)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(pool)
                    .await?;
                let total = sqlx::query_scalar::<_, i64>(
                    template
                        .count_sql
                        .as_deref()
                        .ok_or_else(|| anyhow::anyhow!("missing count_sql"))?,
                )
                .bind(&sensor_id)
                .fetch_one(pool)
                .await
                .unwrap_or(rows.len() as i64);
                (rows, total)
            }
            "find_associated_tracks" => {
                let track_id = required_string(params, "track_id")?;
                let max_distance = optional_f64(params, "max_distance_meters")?;
                let rows = sqlx::query(&template.sql)
                    .bind(&track_id)
                    .bind(max_distance)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(pool)
                    .await?;
                let total = sqlx::query_scalar::<_, i64>(
                    template
                        .count_sql
                        .as_deref()
                        .ok_or_else(|| anyhow::anyhow!("missing count_sql"))?,
                )
                .bind(&track_id)
                .bind(max_distance)
                .fetch_one(pool)
                .await
                .unwrap_or(rows.len() as i64);
                (rows, total)
            }
            "get_alerts_by_severity" => {
                let severity = optional_string(params, "severity")?;
                let status = optional_string(params, "status")?;
                let rows = sqlx::query(&template.sql)
                    .bind(severity.clone())
                    .bind(status.clone())
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(pool)
                    .await?;
                let total = sqlx::query_scalar::<_, i64>(
                    template
                        .count_sql
                        .as_deref()
                        .ok_or_else(|| anyhow::anyhow!("missing count_sql"))?,
                )
                .bind(severity)
                .bind(status)
                .fetch_one(pool)
                .await
                .unwrap_or(rows.len() as i64);
                (rows, total)
            }
            "get_track_history" | "track_timeline" => {
                let track_id = required_string(params, "track_id")?;
                let start_ts_ms = optional_i64(params, "start_ts_ms")?;
                let end_ts_ms = optional_i64(params, "end_ts_ms")?;
                let rows = sqlx::query(&template.sql)
                    .bind(&track_id)
                    .bind(start_ts_ms)
                    .bind(end_ts_ms)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(pool)
                    .await?;
                let total = sqlx::query_scalar::<_, i64>(
                    template
                        .count_sql
                        .as_deref()
                        .ok_or_else(|| anyhow::anyhow!("missing count_sql"))?,
                )
                .bind(&track_id)
                .bind(start_ts_ms)
                .bind(end_ts_ms)
                .fetch_one(pool)
                .await
                .unwrap_or(rows.len() as i64);
                (rows, total)
            }
            "search_tracks" => {
                let id = optional_string(params, "id")?;
                let kind = optional_string(params, "kind")?;
                let min_lat = optional_f64(params, "min_lat")?;
                let max_lat = optional_f64(params, "max_lat")?;
                let min_lon = optional_f64(params, "min_lon")?;
                let max_lon = optional_f64(params, "max_lon")?;

                let rows = sqlx::query(&template.sql)
                    .bind(id.clone())
                    .bind(kind.clone())
                    .bind(min_lat)
                    .bind(max_lat)
                    .bind(min_lon)
                    .bind(max_lon)
                    .bind(limit)
                    .bind(offset)
                    .fetch_all(pool)
                    .await?;

                let total = sqlx::query_scalar::<_, i64>(
                    template
                        .count_sql
                        .as_deref()
                        .ok_or_else(|| anyhow::anyhow!("missing count_sql"))?,
                )
                .bind(id)
                .bind(kind)
                .bind(min_lat)
                .bind(max_lat)
                .bind(min_lon)
                .bind(max_lon)
                .fetch_one(pool)
                .await
                .unwrap_or(rows.len() as i64);

                (rows, total)
            }
            _ => {
                return Err(anyhow::anyhow!("Unsupported template: {}", template_name));
            }
        };

        let results: Vec<Value> = rows.into_iter().map(|row| self.row_to_json(row)).collect();
        Ok(QueryResult {
            rows: results,
            total,
        })
    }

    fn row_to_json(&self, row: sqlx::postgres::PgRow) -> Value {
        let mut map = serde_json::Map::new();

        for column in row.columns() {
            let name = column.name();
            let type_name = column.type_info().name();

            let value: Value = if type_name.contains("TEXT") || type_name.contains("VARCHAR") {
                row.try_get::<Option<String>, _>(name)
                    .ok()
                    .flatten()
                    .map(|v| json!(v))
                    .unwrap_or(Value::Null)
            } else if type_name.contains("INT") {
                row.try_get::<Option<i64>, _>(name)
                    .ok()
                    .flatten()
                    .map(|v| json!(v))
                    .unwrap_or(Value::Null)
            } else if type_name.contains("FLOAT") {
                row.try_get::<Option<f64>, _>(name)
                    .ok()
                    .flatten()
                    .map(|v| json!(v))
                    .unwrap_or(Value::Null)
            } else if type_name.contains("BOOL") {
                row.try_get::<Option<bool>, _>(name)
                    .ok()
                    .flatten()
                    .map(|v| json!(v))
                    .unwrap_or(Value::Null)
            } else if type_name.contains("JSON") {
                row.try_get::<Option<Value>, _>(name)
                    .ok()
                    .flatten()
                    .unwrap_or(Value::Null)
            } else {
                row.try_get::<Option<String>, _>(name)
                    .ok()
                    .flatten()
                    .map(|v| json!(v))
                    .unwrap_or(Value::Null)
            };

            map.insert(name.to_string(), value);
        }

        Value::Object(map)
    }
}

fn required_string(params: &Value, key: &str) -> anyhow::Result<String> {
    let value = params
        .get(key)
        .ok_or_else(|| anyhow::anyhow!("Missing required parameter: {}", key))?;
    value
        .as_str()
        .map(ToString::to_string)
        .ok_or_else(|| anyhow::anyhow!("Parameter '{}' must be a string", key))
}

fn optional_string(params: &Value, key: &str) -> anyhow::Result<Option<String>> {
    match params.get(key) {
        None => Ok(None),
        Some(value) if value.is_null() => Ok(None),
        Some(value) => value
            .as_str()
            .map(|v| Some(v.to_string()))
            .ok_or_else(|| anyhow::anyhow!("Parameter '{}' must be a string", key)),
    }
}

fn optional_i64(params: &Value, key: &str) -> anyhow::Result<Option<i64>> {
    match params.get(key) {
        None => Ok(None),
        Some(value) if value.is_null() => Ok(None),
        Some(value) => value
            .as_i64()
            .map(Some)
            .ok_or_else(|| anyhow::anyhow!("Parameter '{}' must be an integer", key)),
    }
}

fn optional_f64(params: &Value, key: &str) -> anyhow::Result<Option<f64>> {
    match params.get(key) {
        None => Ok(None),
        Some(value) if value.is_null() => Ok(None),
        Some(value) => value
            .as_f64()
            .map(Some)
            .ok_or_else(|| anyhow::anyhow!("Parameter '{}' must be a float", key)),
    }
}

impl std::fmt::Debug for ParamType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParamType::String => write!(f, "string"),
            ParamType::Integer => write!(f, "integer"),
            ParamType::Float => write!(f, "float"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_optional_parsers() {
        let params = json!({
            "name": "abc",
            "count": 42,
            "distance": 12.5,
        });
        assert_eq!(required_string(&params, "name").expect("name"), "abc");
        assert_eq!(optional_i64(&params, "count").expect("count"), Some(42));
        assert_eq!(
            optional_f64(&params, "distance").expect("distance"),
            Some(12.5)
        );
        assert_eq!(optional_string(&params, "missing").expect("missing"), None);
    }

    #[test]
    fn test_templates_include_track_timeline_alias() {
        let engine = QueryEngine::new();
        assert!(engine.is_valid_template("get_track_history"));
        assert!(engine.is_valid_template("track_timeline"));
    }
}
