//! Tool Call Validation
//!
//! Validates AI tool calls for security and compliance.

use crate::tools::ToolCall;
use std::collections::HashSet;

pub enum ValidationResult {
    Valid { scene_altering: bool },
    Invalid { reason: String },
}

/// Scene-altering tools require confirmation
const SCENE_ALTERING_TOOLS: &[&str] = &["seek_to_time", "seek_to_bbox", "set_layers"];

pub fn validate_tool_call(
    tool_call: &ToolCall,
    allowed_tools: &HashSet<String>,
) -> ValidationResult {
    // Check if tool is in allow list
    if !allowed_tools.contains(&tool_call.name) {
        return ValidationResult::Invalid {
            reason: format!("Tool '{}' is not in the allowed tools list", tool_call.name),
        };
    }

    // Validate parameters based on tool type
    let param_validation = match tool_call.name.as_str() {
        "seek_to_time" => validate_seek_to_time(&tool_call.params),
        "seek_to_bbox" => validate_seek_to_bbox(&tool_call.params),
        "set_layers" => validate_set_layers(&tool_call.params),
        "run_graph_query" => validate_graph_query(&tool_call.params),
        "get_provider_status" => Ok(()),
        "get_track_info" => validate_get_track_info(&tool_call.params),
        _ => Err("Unknown tool".to_string()),
    };

    match param_validation {
        Ok(()) => {
            let scene_altering = SCENE_ALTERING_TOOLS.contains(&tool_call.name.as_str());
            ValidationResult::Valid { scene_altering }
        }
        Err(reason) => ValidationResult::Invalid { reason },
    }
}

fn validate_seek_to_time(params: &serde_json::Value) -> Result<(), String> {
    let start = params
        .get("start_ts_ms")
        .and_then(|v| v.as_i64())
        .ok_or("Missing start_ts_ms")?;

    let end = params
        .get("end_ts_ms")
        .and_then(|v| v.as_i64())
        .ok_or("Missing end_ts_ms")?;

    if start < 0 || end < 0 {
        return Err("Timestamps must be positive".to_string());
    }

    if end <= start {
        return Err("end_ts_ms must be greater than start_ts_ms".to_string());
    }

    // Limit time range to 24 hours
    if end - start > 24 * 60 * 60 * 1000 {
        return Err("Time range cannot exceed 24 hours".to_string());
    }

    Ok(())
}

fn validate_seek_to_bbox(params: &serde_json::Value) -> Result<(), String> {
    let min_lat = params
        .get("min_lat")
        .and_then(|v| v.as_f64())
        .ok_or("Missing min_lat")?;
    let max_lat = params
        .get("max_lat")
        .and_then(|v| v.as_f64())
        .ok_or("Missing max_lat")?;
    let min_lon = params
        .get("min_lon")
        .and_then(|v| v.as_f64())
        .ok_or("Missing min_lon")?;
    let max_lon = params
        .get("max_lon")
        .and_then(|v| v.as_f64())
        .ok_or("Missing max_lon")?;

    // Validate coordinate ranges
    if min_lat < -90.0 || max_lat > 90.0 {
        return Err("Latitude must be between -90 and 90".to_string());
    }

    if min_lon < -180.0 || max_lon > 180.0 {
        return Err("Longitude must be between -180 and 180".to_string());
    }

    if min_lat >= max_lat {
        return Err("min_lat must be less than max_lat".to_string());
    }

    if min_lon >= max_lon {
        return Err("min_lon must be less than max_lon".to_string());
    }

    // Limit bounding box size (roughly 1000km x 1000km)
    if (max_lat - min_lat) > 10.0 {
        return Err("Bounding box latitude range cannot exceed 10 degrees".to_string());
    }

    if (max_lon - min_lon) > 10.0 {
        return Err("Bounding box longitude range cannot exceed 10 degrees".to_string());
    }

    Ok(())
}

fn validate_set_layers(params: &serde_json::Value) -> Result<(), String> {
    let layers = params
        .get("layers")
        .and_then(|v| v.as_array())
        .ok_or("Missing layers array")?;

    if layers.is_empty() {
        return Err("At least one layer must be specified".to_string());
    }

    if layers.len() > 10 {
        return Err("Cannot specify more than 10 layers".to_string());
    }

    let valid_layers: HashSet<&str> = [
        "AIRCRAFT",
        "SATELLITE",
        "GROUND",
        "VESSEL",
        "CAMERA",
        "DETECTION",
        "ALERT",
    ]
    .iter()
    .copied()
    .collect();

    for layer in layers {
        let layer_str = layer.as_str().ok_or("Layer must be a string")?;
        if !valid_layers.contains(layer_str) {
            return Err(format!("Invalid layer: {}", layer_str));
        }
    }

    Ok(())
}

fn validate_graph_query(params: &serde_json::Value) -> Result<(), String> {
    let template = params
        .get("template")
        .and_then(|v| v.as_str())
        .ok_or("Missing template")?;

    // Whitelist of allowed query templates
    let allowed_templates: HashSet<&str> = [
        "get_evidence_chain",
        "get_tracks_by_sensor",
        "find_associated_tracks",
        "get_alerts_by_severity",
        "get_track_history",
        "search_tracks",
    ]
    .iter()
    .copied()
    .collect();

    if !allowed_templates.contains(template) {
        return Err(format!(
            "Template '{}' is not in the allowed list",
            template
        ));
    }

    Ok(())
}

fn validate_get_track_info(params: &serde_json::Value) -> Result<(), String> {
    let track_id = params
        .get("track_id")
        .and_then(|v| v.as_str())
        .ok_or("Missing track_id")?;

    if track_id.is_empty() {
        return Err("track_id cannot be empty".to_string());
    }

    if track_id.len() > 100 {
        return Err("track_id too long".to_string());
    }

    // Validate track_id format (alphanumeric, hyphens, underscores)
    if !track_id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err("track_id contains invalid characters".to_string());
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn create_allowed_tools() -> HashSet<String> {
        let mut set = HashSet::new();
        set.insert("seek_to_time".to_string());
        set.insert("seek_to_bbox".to_string());
        set.insert("set_layers".to_string());
        set.insert("run_graph_query".to_string());
        set
    }

    #[test]
    fn test_validate_seek_to_time_valid() {
        let tool_call = ToolCall {
            name: "seek_to_time".to_string(),
            params: json!({
                "start_ts_ms": 1000,
                "end_ts_ms": 5000,
            }),
        };

        let allowed = create_allowed_tools();
        let result = validate_tool_call(&tool_call, &allowed);

        match result {
            ValidationResult::Valid { scene_altering } => {
                assert!(scene_altering);
            }
            _ => panic!("Expected valid result"),
        }
    }

    #[test]
    fn test_validate_seek_to_time_invalid_range() {
        let tool_call = ToolCall {
            name: "seek_to_time".to_string(),
            params: json!({
                "start_ts_ms": 5000,
                "end_ts_ms": 1000,
            }),
        };

        let allowed = create_allowed_tools();
        let result = validate_tool_call(&tool_call, &allowed);

        match result {
            ValidationResult::Invalid { reason } => {
                assert!(reason.contains("end_ts_ms must be greater"));
            }
            _ => panic!("Expected invalid result"),
        }
    }

    #[test]
    fn test_validate_seek_to_bbox_valid() {
        let tool_call = ToolCall {
            name: "seek_to_bbox".to_string(),
            params: json!({
                "min_lat": 37.0,
                "min_lon": -122.0,
                "max_lat": 38.0,
                "max_lon": -121.0,
            }),
        };

        let allowed = create_allowed_tools();
        let result = validate_tool_call(&tool_call, &allowed);

        match result {
            ValidationResult::Valid { .. } => {}
            _ => panic!("Expected valid result"),
        }
    }

    #[test]
    fn test_validate_seek_to_bbox_invalid_coords() {
        let tool_call = ToolCall {
            name: "seek_to_bbox".to_string(),
            params: json!({
                "min_lat": -91.0,
                "min_lon": -122.0,
                "max_lat": 38.0,
                "max_lon": -121.0,
            }),
        };

        let allowed = create_allowed_tools();
        let result = validate_tool_call(&tool_call, &allowed);

        match result {
            ValidationResult::Invalid { reason } => {
                assert!(reason.contains("Latitude must be between"));
            }
            _ => panic!("Expected invalid result"),
        }
    }

    #[test]
    fn test_validate_set_layers_valid() {
        let tool_call = ToolCall {
            name: "set_layers".to_string(),
            params: json!({
                "layers": ["AIRCRAFT", "SATELLITE"],
            }),
        };

        let allowed = create_allowed_tools();
        let result = validate_tool_call(&tool_call, &allowed);

        match result {
            ValidationResult::Valid { .. } => {}
            _ => panic!("Expected valid result"),
        }
    }

    #[test]
    fn test_validate_set_layers_invalid() {
        let tool_call = ToolCall {
            name: "set_layers".to_string(),
            params: json!({
                "layers": ["INVALID_LAYER"],
            }),
        };

        let allowed = create_allowed_tools();
        let result = validate_tool_call(&tool_call, &allowed);

        match result {
            ValidationResult::Invalid { reason } => {
                assert!(reason.contains("Invalid layer"));
            }
            _ => panic!("Expected invalid result"),
        }
    }

    #[test]
    fn test_validate_graph_query_allowed_template() {
        let tool_call = ToolCall {
            name: "run_graph_query".to_string(),
            params: json!({
                "template": "get_evidence_chain",
                "params": {
                    "alert_id": "ALERT-001"
                }
            }),
        };

        let allowed = create_allowed_tools();
        let result = validate_tool_call(&tool_call, &allowed);

        match result {
            ValidationResult::Valid { scene_altering } => {
                assert!(!scene_altering); // Graph queries are not scene-altering
            }
            _ => panic!("Expected valid result"),
        }
    }

    #[test]
    fn test_validate_disallowed_tool() {
        let tool_call = ToolCall {
            name: "malicious_tool".to_string(),
            params: json!({}),
        };

        let allowed = create_allowed_tools();
        let result = validate_tool_call(&tool_call, &allowed);

        match result {
            ValidationResult::Invalid { reason } => {
                assert!(reason.contains("not in the allowed tools list"));
            }
            _ => panic!("Expected invalid result"),
        }
    }
}
