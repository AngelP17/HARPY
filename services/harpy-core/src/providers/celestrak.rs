//! CelesTrak General Perturbations (GP) element sets, OMM JSON.
//! https://celestrak.org/NORAD/documentation/gp-data-formats.php
//!
//! CelesTrak asks clients not to re-download the same group more than once per update cycle
//! (about every 2 hours); `ingest` enforces a minimum refresh per group.

use crate::model::{NormalizedRecord, ObservationType};
use crate::orbit;
use serde_json::{json, Value};

pub const SOURCE_ID: &str = "celestrak";
pub const LICENSE_CLASS: &str = "celestrak-public-attribution";
pub const KIND: &str = "orbital_elements";
pub const BASE_URL: &str = "https://celestrak.org/NORAD/elements/gp.php";
pub const DEFAULT_GROUPS: &[&str] = &["stations", "visual", "gps-ops", "weather"];
pub const MIN_REFRESH_MS: i64 = 2 * 60 * 60 * 1000;
const EARTH_MU_KM3_S2: f64 = 398_600.441_8;
const EARTH_RADIUS_KM: f64 = 6378.137;

pub fn group_url(base: &str, group: &str) -> String {
    format!("{}?GROUP={}&FORMAT=json", base.trim_end_matches('/'), group)
}

#[derive(Debug, Default)]
pub struct Parsed {
    pub records: Vec<NormalizedRecord>,
    pub invalid: Vec<String>,
}

#[derive(Debug, thiserror::Error, PartialEq)]
pub enum FeedError {
    #[error("payload is not a JSON array of OMM records: {0}")]
    NotOmmArray(String),
}

pub fn parse_group(body: &[u8], group: &str) -> Result<Parsed, FeedError> {
    let root: Value = serde_json::from_slice(body).map_err(|e| {
        // CelesTrak answers unknown groups / throttling with plain text.
        let snippet: String = String::from_utf8_lossy(body).chars().take(120).collect();
        FeedError::NotOmmArray(format!("{e}; body starts: {snippet:?}"))
    })?;
    let items = root
        .as_array()
        .ok_or_else(|| FeedError::NotOmmArray("top level is not an array".into()))?;
    let mut out = Parsed::default();
    for (i, item) in items.iter().enumerate() {
        match normalize(item, group) {
            Ok(rec) => out.records.push(rec),
            Err(reason) => {
                let id = item
                    .get("NORAD_CAT_ID")
                    .map(|v| v.to_string())
                    .unwrap_or_default();
                out.invalid
                    .push(format!("record[{i}] norad={id}: {reason}"));
            }
        }
    }
    Ok(out)
}

pub fn normalize(item: &Value, group: &str) -> Result<NormalizedRecord, String> {
    let elements: sgp4::Elements =
        serde_json::from_value(item.clone()).map_err(|e| format!("not a valid OMM: {e}"))?;
    orbit::validate(&elements).map_err(|e| format!("SGP4 rejected elements: {e}"))?;

    let epoch_ms = orbit::epoch_ms(&elements);
    let n_rad_s = elements.mean_motion * 2.0 * std::f64::consts::PI / 86_400.0;
    let semi_major_km = (EARTH_MU_KM3_S2 / (n_rad_s * n_rad_s)).cbrt();
    let apogee_km = semi_major_km * (1.0 + elements.eccentricity) - EARTH_RADIUS_KM;
    let perigee_km = semi_major_km * (1.0 - elements.eccentricity) - EARTH_RADIUS_KM;

    let norad = elements.norad_id;
    Ok(NormalizedRecord {
        observation_id: format!("{SOURCE_ID}:{norad}"),
        observation_type: ObservationType::Measured,
        kind: KIND.to_string(),
        upstream_id: Some(norad.to_string()),
        observed_at: epoch_ms,
        source_updated_at: None,
        geometry: None,
        uncertainty: None,
        evidence_refs: vec![],
        source_url: Some(format!(
            "https://celestrak.org/NORAD/elements/gp.php?CATNR={norad}&FORMAT=json"
        )),
        raw: item.clone(),
        attributes: json!({
            "name": elements.object_name,
            "intl_designator": elements.international_designator,
            "norad_id": norad,
            "group": group,
            "data_product": "GP mean elements (SGP4)",
            "period_min": 1440.0 / elements.mean_motion,
            "inclination_deg": elements.inclination,
            "eccentricity": elements.eccentricity,
            "apogee_km": apogee_km,
            "perigee_km": perigee_km,
            "omm": item,
        }),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const ISS: &[u8] =
        include_bytes!("../../../../tests/fixtures/celestrak/iss.2020-07-12.omm.json");

    #[test]
    fn parses_omm_fixture() {
        let parsed = parse_group(ISS, "stations").unwrap();
        assert_eq!(parsed.records.len(), 1);
        let r = &parsed.records[0];
        assert_eq!(r.observation_id, "celestrak:25544");
        assert_eq!(r.attributes["name"], json!("ISS (ZARYA)"));
        assert_eq!(r.observed_at, 1_594_516_747_402);
        let perigee = r.attributes["perigee_km"].as_f64().unwrap();
        assert!((400.0..440.0).contains(&perigee), "{perigee}");
    }

    #[test]
    fn plain_text_throttle_response_is_an_error() {
        let err = parse_group(
            b"GP data has not updated since your last successful download",
            "x",
        )
        .unwrap_err();
        assert!(matches!(err, FeedError::NotOmmArray(_)));
    }

    #[test]
    fn empty_group_is_valid() {
        assert!(parse_group(b"[]", "stations").unwrap().records.is_empty());
    }

    #[test]
    fn bad_record_is_skipped() {
        let body = br#"[{"OBJECT_NAME":"BROKEN","NORAD_CAT_ID":1,"EPOCH":"2020-07-12T01:19:07","MEAN_MOTION":0,"ECCENTRICITY":0.1,"INCLINATION":1,"RA_OF_ASC_NODE":1,"ARG_OF_PERICENTER":1,"MEAN_ANOMALY":1,"EPHEMERIS_TYPE":0,"CLASSIFICATION_TYPE":"U","ELEMENT_SET_NO":1,"REV_AT_EPOCH":1,"BSTAR":0,"MEAN_MOTION_DOT":0,"MEAN_MOTION_DDOT":0}]"#;
        let parsed = parse_group(body, "x").unwrap();
        assert!(parsed.records.is_empty());
        assert_eq!(parsed.invalid.len(), 1);
    }
}
