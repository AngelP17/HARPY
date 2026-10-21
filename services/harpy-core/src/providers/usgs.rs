//! USGS earthquake GeoJSON summary feeds.
//! https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php
//!
//! US Government work, public domain. Feeds regenerate about once a minute.

use crate::model::{NormalizedRecord, ObservationType};
use serde_json::{json, Value};

pub const SOURCE_ID: &str = "usgs";
pub const LICENSE_CLASS: &str = "public-domain-us-gov";
pub const KIND: &str = "earthquake";
pub const FEED_DAY: &str =
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";
pub const FEED_WEEK: &str =
    "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";

#[derive(Debug, Default)]
pub struct Parsed {
    pub records: Vec<NormalizedRecord>,
    pub invalid: Vec<String>,
    pub generated_at: Option<i64>,
}

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum FeedError {
    #[error("payload is not JSON: {0}")]
    NotJson(String),
    #[error("payload is not a GeoJSON FeatureCollection")]
    NotFeatureCollection,
    #[error("feed metadata reports status {0}")]
    BadStatus(i64),
}

/// Parse and validate a summary feed. A structurally invalid feed is an error (provider
/// unhealthy). Individually invalid features are skipped and reported, never repaired.
pub fn parse_feed(body: &[u8]) -> Result<Parsed, FeedError> {
    let root: Value =
        serde_json::from_slice(body).map_err(|e| FeedError::NotJson(e.to_string()))?;
    if root.get("type").and_then(Value::as_str) != Some("FeatureCollection") {
        return Err(FeedError::NotFeatureCollection);
    }
    if let Some(status) = root.pointer("/metadata/status").and_then(Value::as_i64) {
        if status != 200 {
            return Err(FeedError::BadStatus(status));
        }
    }
    let features = root
        .get("features")
        .and_then(Value::as_array)
        .ok_or(FeedError::NotFeatureCollection)?;

    let mut out = Parsed {
        generated_at: root.pointer("/metadata/generated").and_then(Value::as_i64),
        ..Default::default()
    };
    for (i, feature) in features.iter().enumerate() {
        match normalize_feature(feature) {
            Ok(rec) => out.records.push(rec),
            Err(reason) => {
                let id = feature.get("id").and_then(Value::as_str).unwrap_or("?");
                out.invalid.push(format!("feature[{i}] id={id}: {reason}"));
            }
        }
    }
    Ok(out)
}

pub fn normalize_feature(feature: &Value) -> Result<NormalizedRecord, String> {
    let id = feature
        .get("id")
        .and_then(Value::as_str)
        .filter(|s| !s.trim().is_empty())
        .ok_or("missing id")?;
    let props = feature.get("properties").ok_or("missing properties")?;
    let geometry = feature.get("geometry").ok_or("missing geometry")?;
    if geometry.get("type").and_then(Value::as_str) != Some("Point") {
        return Err("geometry is not a Point".into());
    }
    let coords = geometry
        .get("coordinates")
        .and_then(Value::as_array)
        .filter(|c| c.len() >= 2)
        .ok_or("missing coordinates")?;
    let lon = coords[0].as_f64().ok_or("lon not a number")?;
    let lat = coords[1].as_f64().ok_or("lat not a number")?;
    if !(-180.0..=180.0).contains(&lon) || !(-90.0..=90.0).contains(&lat) {
        return Err(format!("coordinates out of range ({lat}, {lon})"));
    }
    let depth_km = coords.get(2).and_then(Value::as_f64);
    let time = props
        .get("time")
        .and_then(Value::as_i64)
        .ok_or("missing time")?;
    let updated = props.get("updated").and_then(Value::as_i64);

    let pick = |k: &str| props.get(k).cloned().unwrap_or(Value::Null);
    let attributes = json!({
        "mag": pick("mag"),
        "mag_type": pick("magType"),
        "place": pick("place"),
        "title": pick("title"),
        "event_type": pick("type"),
        "review_status": pick("status"),
        "tsunami_flag": pick("tsunami"),
        "significance": pick("sig"),
        "pager_alert": pick("alert"),
        "felt_reports": pick("felt"),
        "network": pick("net"),
        "depth_km": depth_km,
        "station_count": pick("nst"),
        "azimuthal_gap_deg": pick("gap"),
        "rms_s": pick("rms"),
    });

    // The summary feed carries no formal location error; dmin/gap/rms are quality indicators,
    // surfaced in attributes. Uncertainty stays null rather than invented.
    Ok(NormalizedRecord {
        observation_id: format!("{SOURCE_ID}:{id}"),
        observation_type: ObservationType::Measured,
        kind: KIND.to_string(),
        upstream_id: Some(id.to_string()),
        observed_at: time,
        source_updated_at: updated,
        geometry: Some(json!({ "type": "Point", "coordinates": [lon, lat] })),
        uncertainty: None,
        evidence_refs: vec![],
        source_url: props.get("url").and_then(Value::as_str).map(str::to_string),
        raw: feature.clone(),
        attributes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &[u8] = include_bytes!(
        "../../../../tests/fixtures/usgs/significant_month.2026-10-21.subset.geojson"
    );

    #[test]
    fn parses_recorded_real_feed() {
        let parsed = parse_feed(FIXTURE).unwrap();
        assert_eq!(parsed.records.len(), 3);
        assert!(parsed.invalid.is_empty());
        let first = &parsed.records[0];
        assert_eq!(first.observation_id, "usgs:us6000u3jl");
        assert_eq!(first.upstream_id.as_deref(), Some("us6000u3jl"));
        assert_eq!(first.observed_at, 1_792_470_038_737);
        assert_eq!(first.source_updated_at, Some(1_792_477_739_943));
        assert_eq!(
            first.geometry.as_ref().unwrap()["coordinates"][1],
            json!(-13.9906)
        );
        assert_eq!(first.attributes["mag"], json!(6.3));
        assert_eq!(first.attributes["depth_km"], json!(16.0));
        assert_eq!(
            first.source_url.as_deref(),
            Some("https://earthquake.usgs.gov/earthquakes/eventpage/us6000u3jl")
        );
        assert_eq!(first.observation_type, ObservationType::Measured);
    }

    #[test]
    fn empty_feed_is_valid_not_an_error() {
        let body = br#"{"type":"FeatureCollection","metadata":{"status":200},"features":[]}"#;
        let parsed = parse_feed(body).unwrap();
        assert!(parsed.records.is_empty());
    }

    #[test]
    fn http_200_with_garbage_is_an_error() {
        assert!(matches!(
            parse_feed(b"<html>maintenance</html>"),
            Err(FeedError::NotJson(_))
        ));
        assert_eq!(
            parse_feed(br#"{"type":"Feature"}"#).unwrap_err(),
            FeedError::NotFeatureCollection
        );
        assert_eq!(
            parse_feed(br#"{"type":"FeatureCollection","metadata":{"status":500},"features":[]}"#)
                .unwrap_err(),
            FeedError::BadStatus(500)
        );
    }

    #[test]
    fn invalid_features_are_skipped_not_repaired() {
        let body = br#"{"type":"FeatureCollection","features":[
            {"id":"ok1","type":"Feature","properties":{"time":1,"updated":2,"mag":1.0},"geometry":{"type":"Point","coordinates":[10,20,5]}},
            {"id":"bad1","type":"Feature","properties":{"time":1},"geometry":{"type":"Point","coordinates":[999,20,5]}},
            {"id":"bad2","type":"Feature","properties":{},"geometry":{"type":"Point","coordinates":[10,20,5]}}
        ]}"#;
        let parsed = parse_feed(body).unwrap();
        assert_eq!(parsed.records.len(), 1);
        assert_eq!(parsed.invalid.len(), 2);
    }
}
