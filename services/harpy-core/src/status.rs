//! Provider health derived from the fetch log. Health never looks at record counts:
//! an empty feed fetched successfully is HEALTHY.

use crate::db::Store;
use crate::model::{FetchOutcome, ProviderState};
use crate::providers::{celestrak, usgs};
use anyhow::Result;
use serde::Serialize;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize)]
pub struct ProviderInfo {
    pub source_id: &'static str,
    pub display_name: &'static str,
    pub layer: &'static str,
    pub license_class: &'static str,
    pub attribution: &'static str,
    pub terms_url: &'static str,
}

pub const PROVIDERS: &[ProviderInfo] = &[
    ProviderInfo {
        source_id: usgs::SOURCE_ID,
        display_name: "USGS Earthquake Hazards Program",
        layer: "earthquakes",
        license_class: usgs::LICENSE_CLASS,
        attribution: "U.S. Geological Survey",
        terms_url:
            "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits",
    },
    ProviderInfo {
        source_id: celestrak::SOURCE_ID,
        display_name: "CelesTrak GP element sets",
        layer: "satellites",
        license_class: celestrak::LICENSE_CLASS,
        attribution: "CelesTrak (Dr. T.S. Kelso)",
        terms_url: "https://celestrak.org/NORAD/documentation/gp-data-formats.php",
    },
];

#[derive(Debug, Clone, Serialize)]
pub struct EndpointStatus {
    pub endpoint: String,
    pub ok: bool,
    pub last_attempt_at: i64,
    pub last_success_at: Option<i64>,
    pub consecutive_failures: u32,
    pub last_error: Option<String>,
    pub records_seen: u64,
    pub records_invalid: u64,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderStatus {
    #[serde(flatten)]
    pub info: ProviderInfo,
    pub state: ProviderState,
    pub last_attempt_at: Option<i64>,
    pub last_success_at: Option<i64>,
    pub consecutive_failures: u32,
    pub last_error: Option<String>,
    pub endpoints: Vec<EndpointStatus>,
}

/// Derive state from the most recent attempts of each endpoint.
pub fn derive(info: &ProviderInfo, log_newest_first: &[FetchOutcome]) -> ProviderStatus {
    let mut by_endpoint: BTreeMap<&str, Vec<&FetchOutcome>> = BTreeMap::new();
    for f in log_newest_first {
        by_endpoint.entry(f.endpoint.as_str()).or_default().push(f);
    }

    let mut endpoints = Vec::new();
    for (endpoint, fetches) in &by_endpoint {
        let latest = fetches[0];
        let consecutive_failures = fetches.iter().take_while(|f| !f.ok).count() as u32;
        endpoints.push(EndpointStatus {
            endpoint: endpoint.to_string(),
            ok: latest.ok,
            last_attempt_at: latest.started_at,
            last_success_at: fetches.iter().find(|f| f.ok).map(|f| f.finished_at),
            consecutive_failures,
            last_error: latest.error.clone(),
            records_seen: latest.records_seen,
            records_invalid: latest.records_invalid,
        });
    }

    // Only endpoints attempted in the latest ingest cycle vote. The one-time USGS bootstrap
    // feed (or a group skipped by CelesTrak's refresh throttle long ago) must not mask an outage.
    const CYCLE_MS: i64 = 10 * 60_000;
    let newest_attempt = endpoints.iter().map(|e| e.last_attempt_at).max();
    let voting: Vec<&EndpointStatus> = endpoints
        .iter()
        .filter(|e| {
            newest_attempt
                .map(|n| n - e.last_attempt_at <= CYCLE_MS)
                .unwrap_or(false)
        })
        .collect();

    let state = if voting.is_empty() {
        ProviderState::NeverRun
    } else if voting.iter().all(|e| e.ok && e.records_invalid == 0) {
        ProviderState::Healthy
    } else if voting.iter().all(|e| !e.ok && e.consecutive_failures >= 2) {
        ProviderState::Unavailable
    } else {
        ProviderState::Degraded
    };

    let last_error = voting
        .iter()
        .filter(|e| !e.ok)
        .find_map(|e| e.last_error.clone());
    ProviderStatus {
        info: info.clone(),
        state,
        last_attempt_at: newest_attempt,
        last_success_at: endpoints.iter().filter_map(|e| e.last_success_at).max(),
        consecutive_failures: voting
            .iter()
            .map(|e| e.consecutive_failures)
            .max()
            .unwrap_or(0),
        last_error,
        endpoints,
    }
}

pub fn all(store: &Store) -> Result<Vec<ProviderStatus>> {
    PROVIDERS
        .iter()
        .map(|info| Ok(derive(info, &store.fetch_log(Some(info.source_id), 200)?)))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn f(endpoint: &str, at: i64, ok: bool, invalid: u64) -> FetchOutcome {
        FetchOutcome {
            source_id: "usgs".into(),
            endpoint: endpoint.into(),
            started_at: at,
            finished_at: at + 100,
            ok,
            records_invalid: invalid,
            error: (!ok).then(|| "HTTP 503".to_string()),
            ..Default::default()
        }
    }

    #[test]
    fn never_run() {
        assert_eq!(derive(&PROVIDERS[0], &[]).state, ProviderState::NeverRun);
    }

    #[test]
    fn healthy_even_with_zero_records() {
        let s = derive(&PROVIDERS[0], &[f("a", 10, true, 0)]);
        assert_eq!(s.state, ProviderState::Healthy);
    }

    #[test]
    fn one_failure_degrades_two_make_unavailable() {
        let s = derive(&PROVIDERS[0], &[f("a", 20, false, 0), f("a", 10, true, 0)]);
        assert_eq!(s.state, ProviderState::Degraded);
        assert_eq!(s.last_success_at, Some(110));
        let s = derive(
            &PROVIDERS[0],
            &[
                f("a", 30, false, 0),
                f("a", 20, false, 0),
                f("a", 10, true, 0),
            ],
        );
        assert_eq!(s.state, ProviderState::Unavailable);
        assert_eq!(s.consecutive_failures, 2);
        assert_eq!(s.last_error.as_deref(), Some("HTTP 503"));
    }

    #[test]
    fn invalid_records_degrade() {
        assert_eq!(
            derive(&PROVIDERS[0], &[f("a", 10, true, 3)]).state,
            ProviderState::Degraded
        );
    }

    #[test]
    fn earlier_success_on_another_endpoint_does_not_mask_outage() {
        let hour = 3_600_000;
        let s = derive(
            &PROVIDERS[0],
            &[
                f("day", 2 * hour, false, 0),
                f("day", hour, false, 0),
                f("bootstrap", 0, true, 0),
            ],
        );
        assert_eq!(s.state, ProviderState::Unavailable);
        assert_eq!(s.last_success_at, Some(100));
    }

    #[test]
    fn stale_bootstrap_endpoint_does_not_vote() {
        let day = 24 * 3_600_000;
        let s = derive(
            &PROVIDERS[0],
            &[f("live", 2 * day, true, 0), f("bootstrap", 0, false, 0)],
        );
        assert_eq!(s.state, ProviderState::Healthy);
    }
}
