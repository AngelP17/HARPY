//! The HARPY observation contract (docs/contracts/observation.md).
//!
//! One shape for every source: measured provider records, calculated positions,
//! and (Milestone B) model inferences. Source-specific data lives in `attributes`.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// How an observation came to exist. Never collapse these in the UI.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ObservationType {
    /// A record published by an external source (USGS event, CelesTrak element set).
    Measured,
    /// Derived deterministically from a measured record (SGP4 position).
    Calculated,
    /// Produced by a model (GeoWraith). Reserved for Milestone B.
    Inferred,
    /// Entered by a human analyst. Reserved for Milestone B.
    Asserted,
}

impl ObservationType {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Measured => "measured",
            Self::Calculated => "calculated",
            Self::Inferred => "inferred",
            Self::Asserted => "asserted",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "measured" => Some(Self::Measured),
            "calculated" => Some(Self::Calculated),
            "inferred" => Some(Self::Inferred),
            "asserted" => Some(Self::Asserted),
            _ => None,
        }
    }
}

/// A single revision of an observation, as stored and as exported.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Observation {
    pub observation_id: String,
    pub revision: i64,
    pub observation_type: ObservationType,
    /// `earthquake` | `orbital_elements` | `satellite_position`
    pub kind: String,
    pub source_id: String,
    pub upstream_id: Option<String>,
    /// Unix ms. When the source says it happened (for elements: the element epoch).
    pub observed_at: i64,
    /// Unix ms. When the source last updated the record, if it says.
    pub source_updated_at: Option<i64>,
    /// Unix ms. When HARPY received this revision.
    pub ingested_at: i64,
    /// GeoJSON geometry (WGS84). Null for records without a fixed location (element sets).
    pub geometry: Option<Value>,
    pub uncertainty: Option<Value>,
    pub evidence_refs: Vec<String>,
    pub model_version: Option<String>,
    pub license_class: String,
    pub source_url: Option<String>,
    /// SHA-256 (hex) of the canonical JSON of the upstream record this revision was built from.
    pub raw_payload_digest: String,
    pub attributes: Value,
}

/// A normalized record produced by a provider adapter before it is stored.
#[derive(Debug, Clone, PartialEq)]
pub struct NormalizedRecord {
    pub observation_id: String,
    pub observation_type: ObservationType,
    pub kind: String,
    pub upstream_id: Option<String>,
    pub observed_at: i64,
    pub source_updated_at: Option<i64>,
    pub geometry: Option<Value>,
    pub uncertainty: Option<Value>,
    pub evidence_refs: Vec<String>,
    pub source_url: Option<String>,
    pub raw: Value,
    pub attributes: Value,
}

/// Provider health, derived from fetch history. Independent of how many records came back.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProviderState {
    /// Last attempt succeeded with a valid payload (zero records is still healthy).
    Healthy,
    /// Last attempt succeeded but some records failed validation, or retries are in progress.
    Degraded,
    /// Last attempt(s) failed. Previously stored records remain, marked stale by age.
    Unavailable,
    /// Never attempted in this deployment.
    NeverRun,
}

/// Outcome of one provider fetch, persisted to `fetch_log`.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub struct FetchOutcome {
    pub source_id: String,
    pub endpoint: String,
    pub started_at: i64,
    pub finished_at: i64,
    pub http_status: Option<u16>,
    pub ok: bool,
    pub records_seen: u64,
    pub records_new: u64,
    pub records_revised: u64,
    pub records_unchanged: u64,
    pub records_invalid: u64,
    pub error: Option<String>,
}
