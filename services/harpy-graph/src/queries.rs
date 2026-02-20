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

pub struct QueryEngine {
    templates: HashMap<String, QueryTemplate>,
}

struct QueryTemplate {
    name: String,
    description: String,
    params: Vec<ParamDef>,
    sql: String,
    count_sql: Option<String>,
}

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

        // Template: get_evidence_chain
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
                        -- Start with the alert
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
                        
                        -- Follow links to evidence
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

        // Template: get_tracks_by_sensor
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

        // Template: find_associated_tracks
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
                      AND ABS(t.ts_ms - tt.ts_ms) < 60000  -- Within 1 minute
                      AND 6371000 * acos(
                          least(1, cos(radians(tt.lat)) * cos(radians(t.lat)) *
                          cos(radians(t.lon) - radians(tt.lon)) +
                          sin(radians(tt.lat)) * sin(radians(t.lat)))
                      ) <= COALESCE($4, 10000)
                    ORDER BY distance_meters
                    LIMIT $2 OFFSET $3
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
                      ) <= COALESCE($4, 10000)
                "#
                    .to_string(),
                ),
            },
        );

        // Template: get_alerts_by_severity
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

        // Template: get_track_history
        templates.insert(
            "get_track_history".to_string(),
            QueryTemplate {
                name: "get_track_history".to_string(),
                description: "Get position history for a track".to_string(),
                params: vec![
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
                ],
                sql: r#"
                    SELECT 
                        td.id,
                        td.track_id,
                        td.lat,
                        td.lon,
                        td.alt,
                        td.ts_ms,
                        td.provider_id
                    FROM track_deltas td
                    WHERE td.track_id = $1
                      AND ($4::bigint IS NULL OR td.ts_ms >= $4)
                      AND ($5::bigint IS NULL OR td.ts_ms <= $5)
                    ORDER BY td.ts_ms DESC
                    LIMIT $2 OFFSET $3
                "#
                .to_string(),
                count_sql: Some(
                    r#"
                    SELECT COUNT(*)
                    FROM track_deltas
                    WHERE track_id = $1
                      AND ($4::bigint IS NULL OR ts_ms >= $4)
                      AND ($5::bigint IS NULL OR ts_ms <= $5)
                "#
                    .to_string(),
                ),
            },
        );

        // Template: search_tracks
        templates.insert(
            "search_tracks".to_string(),
            QueryTemplate {
                name: "search_tracks".to_string(),
                description: "Search tracks by various criteria".to_string(),
                params: vec![
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
                        t.ts_ms,
                        t.provider_id,
                        t.meta
                    FROM tracks t
                    WHERE ($1::text IS NULL OR t.kind = $1)
                      AND ($4::float8 IS NULL OR t.lat >= $4)
                      AND ($5::float8 IS NULL OR t.lat <= $5)
                      AND ($6::float8 IS NULL OR t.lon >= $6)
                      AND ($7::float8 IS NULL OR t.lon <= $7)
                    ORDER BY t.ts_ms DESC
                    LIMIT $2 OFFSET $3
                "#
                .to_string(),
                count_sql: Some(
                    r#"
                    SELECT COUNT(*)
                    FROM tracks t
                    WHERE ($1::text IS NULL OR t.kind = $1)
                      AND ($4::float8 IS NULL OR t.lat >= $4)
                      AND ($5::float8 IS NULL OR t.lat <= $5)
                      AND ($6::float8 IS NULL OR t.lon >= $6)
                      AND ($7::float8 IS NULL OR t.lon <= $7)
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
        self.templates
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
            .collect()
    }

    pub async fn execute(
        &self,
        pool: &PgPool,
        template_name: &str,
        params: &Value,
        limit: i64,
        offset: i64,
    ) -> anyhow::Result<QueryResult> {
        let template = self
            .templates
            .get(template_name)
            .ok_or_else(|| anyhow::anyhow!("Unknown template: {}", template_name))?;

        // Validate and extract parameters
        let param_values = self.extract_params(template, params)?;

        // Build query with pagination parameters
        let mut query_params: Vec<Box<dyn sqlx::Encode<'_, sqlx::Postgres> + Send + Sync>> =
            Vec::new();

        // Add template-specific params first
        for param_def in &template.params {
            if let Some(value) = param_values.get(&param_def.name) {
                query_params.push(Box::new(value.clone()));
            } else {
                // Push NULL for missing optional params
                query_params.push(Box::new(None::<String>));
            }
        }

        // Add pagination params (limit and offset are always last two)
        query_params.push(Box::new(limit));
        query_params.push(Box::new(offset));

        // Execute count query if available
        let total = if let Some(_count_sql) = &template.count_sql {
            // Simplified count - just use the number of rows returned
            // Full implementation would execute count query with proper parameter binding
            -1
        } else {
            -1 // Unknown total
        };

        // Execute main query
        let rows = sqlx::query(&template.sql)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?;

        let results: Vec<Value> = rows.into_iter().map(|row| self.row_to_json(row)).collect();

        Ok(QueryResult {
            rows: results,
            total,
        })
    }

    fn extract_params(
        &self,
        template: &QueryTemplate,
        params: &Value,
    ) -> anyhow::Result<HashMap<String, String>> {
        let mut result = HashMap::new();
        let params_obj = params
            .as_object()
            .ok_or_else(|| anyhow::anyhow!("Params must be a JSON object"))?;

        for param_def in &template.params {
            if let Some(value) = params_obj.get(&param_def.name) {
                let str_value = match &param_def.param_type {
                    ParamType::String => value.as_str().map(|s| s.to_string()),
                    ParamType::Integer => value.as_i64().map(|i| i.to_string()),
                    ParamType::Float => value.as_f64().map(|f| f.to_string()),
                };

                if let Some(v) = str_value {
                    result.insert(param_def.name.clone(), v);
                } else if param_def.required {
                    return Err(anyhow::anyhow!(
                        "Required parameter '{}' has invalid type",
                        param_def.name
                    ));
                }
            } else if param_def.required {
                return Err(anyhow::anyhow!(
                    "Missing required parameter: {}",
                    param_def.name
                ));
            }
        }

        Ok(result)
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

impl std::fmt::Debug for ParamType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParamType::String => write!(f, "string"),
            ParamType::Integer => write!(f, "integer"),
            ParamType::Float => write!(f, "float"),
        }
    }
}
