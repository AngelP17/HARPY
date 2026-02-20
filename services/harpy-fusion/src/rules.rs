//! Fusion Rules Engine
//!
//! Implements rule templates:
//! - H3 Convergence: Tracks from different providers in same H3 cell
//! - Proximity: Tracks within distance threshold
//! - Anomaly: Speed/altitude deviation from normal
//! - Pattern: Loitering detection (circular patterns)

use crate::{AlertUpsertRecord, LinkUpsertRecord, TrackObservation};
use serde_json::json;
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicU64, Ordering};
use uuid::Uuid;

/// Result of rule evaluation
#[derive(Debug, Clone)]
pub enum RuleResult {
    Alert {
        alert: AlertUpsertRecord,
        links: Vec<LinkUpsertRecord>,
    },
    Link(LinkUpsertRecord),
}

/// Rule engine managing all fusion rules
pub struct RuleEngine {
    h3_resolution: u8,
    convergence_rule: ConvergenceRule,
    proximity_rule: ProximityRule,
    anomaly_rule: AnomalyRule,
    loitering_rule: LoiteringRule,
    trigger_counts: HashMap<String, AtomicU64>,
}

impl RuleEngine {
    pub fn new(h3_resolution: u8) -> Self {
        let mut trigger_counts = HashMap::new();
        trigger_counts.insert("h3_convergence".to_string(), AtomicU64::new(0));
        trigger_counts.insert("proximity".to_string(), AtomicU64::new(0));
        trigger_counts.insert("anomaly_speed".to_string(), AtomicU64::new(0));
        trigger_counts.insert("anomaly_altitude".to_string(), AtomicU64::new(0));
        trigger_counts.insert("loitering".to_string(), AtomicU64::new(0));

        Self {
            h3_resolution,
            convergence_rule: ConvergenceRule::new(),
            proximity_rule: ProximityRule::new(5000.0), // 5km threshold
            anomaly_rule: AnomalyRule::new(50.0, 5000.0), // 50% speed change, 5000ft alt change
            loitering_rule: LoiteringRule::new(300.0, 0.7), // 5 min, 0.7 circularity
            trigger_counts,
        }
    }

    pub fn list_rules(&self) -> Vec<String> {
        vec![
            "h3_convergence".to_string(),
            "proximity".to_string(),
            "anomaly_speed".to_string(),
            "anomaly_altitude".to_string(),
            "loitering".to_string(),
        ]
    }

    pub fn get_rule_status(&self) -> Vec<crate::RuleStatus> {
        self.trigger_counts
            .iter()
            .map(|(name, count)| crate::RuleStatus {
                name: name.clone(),
                enabled: true,
                trigger_count: count.load(Ordering::Relaxed),
            })
            .collect()
    }

    pub async fn evaluate(
        &self,
        tracks: &[TrackObservation],
        cell_buckets: &HashMap<String, Vec<TrackObservation>>,
        now_ms: i64,
    ) -> Vec<RuleResult> {
        let mut results = Vec::new();

        // Run H3 convergence rule
        results.extend(self.convergence_rule.evaluate(cell_buckets, now_ms, self.h3_resolution));

        // Run proximity rule
        results.extend(self.proximity_rule.evaluate(tracks, now_ms));

        // Run anomaly detection
        results.extend(self.anomaly_rule.evaluate(tracks, now_ms));

        // Run loitering detection
        results.extend(self.loitering_rule.evaluate(tracks, now_ms));

        // Update trigger counts
        for result in &results {
            if let RuleResult::Alert { alert, .. } = result {
                if let Some(rule_name) = alert.meta.get("rule").and_then(|v| v.as_str()) {
                    if let Some(counter) = self.trigger_counts.get(rule_name) {
                        counter.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
        }

        results
    }
}

/// H3 Convergence Rule: Detects tracks from different providers in same H3 cell
struct ConvergenceRule;

impl ConvergenceRule {
    fn new() -> Self {
        Self
    }

    fn evaluate(
        &self,
        cell_buckets: &HashMap<String, Vec<TrackObservation>>,
        now_ms: i64,
        h3_resolution: u8,
    ) -> Vec<RuleResult> {
        let mut results = Vec::new();

        for (cell, tracks) in cell_buckets {
            if tracks.len() < 2 {
                continue;
            }

            // Check for multi-provider convergence
            let providers: HashSet<_> = tracks.iter().map(|t| t.provider_id.clone()).collect();
            if providers.len() < 2 {
                continue;
            }

            // Generate alerts for each track pair from different providers
            for i in 0..tracks.len() {
                for j in (i + 1)..tracks.len() {
                    let first = &tracks[i];
                    let second = &tracks[j];

                    // Skip if same provider
                    if first.provider_id == second.provider_id {
                        continue;
                    }

                    let link_id = Uuid::new_v4().to_string();
                    let alert_id = Uuid::new_v4().to_string();

                    let link = LinkUpsertRecord {
                        id: link_id.clone(),
                        from_type: "Track".to_string(),
                        from_id: first.id.clone(),
                        rel: "associated_with".to_string(),
                        to_type: "Track".to_string(),
                        to_id: second.id.clone(),
                        ts_ms: now_ms,
                        meta: json!({
                            "rule": "h3_convergence",
                            "cell": cell,
                            "h3_resolution": h3_resolution,
                            "providers": [first.provider_id.clone(), second.provider_id.clone()],
                            "track_kinds": [first.kind.clone(), second.kind.clone()],
                        }),
                    };

                    let alert = AlertUpsertRecord {
                        id: alert_id.clone(),
                        severity: "MEDIUM".to_string(),
                        title: "Multi-Provider Convergence".to_string(),
                        description: format!(
                            "Tracks {} ({}) and {} ({}) converged in H3 cell {} from different providers",
                            first.id, first.provider_id, second.id, second.provider_id, cell
                        ),
                        ts_ms: now_ms,
                        status: "ACTIVE".to_string(),
                        evidence_link_ids: vec![link_id.clone()],
                        meta: json!({
                            "rule": "h3_convergence",
                            "cell": cell,
                            "h3_resolution": h3_resolution,
                            "provider_count": providers.len(),
                            "track_count": tracks.len(),
                        }),
                    };

                    let evidence_link = LinkUpsertRecord {
                        id: Uuid::new_v4().to_string(),
                        from_type: "Alert".to_string(),
                        from_id: alert_id,
                        rel: "is_evidenced_by".to_string(),
                        to_type: "Track".to_string(),
                        to_id: first.id.clone(),
                        ts_ms: now_ms,
                        meta: json!({ "convergence_link": link_id }),
                    };

                    results.push(RuleResult::Alert {
                        alert,
                        links: vec![link, evidence_link],
                    });
                }
            }
        }

        results
    }
}

/// Proximity Rule: Detects tracks within distance threshold
struct ProximityRule {
    threshold_meters: f64,
}

impl ProximityRule {
    fn new(threshold_meters: f64) -> Self {
        Self { threshold_meters }
    }

    fn evaluate(&self, tracks: &[TrackObservation], now_ms: i64) -> Vec<RuleResult> {
        let mut results = Vec::new();

        for i in 0..tracks.len() {
            for j in (i + 1)..tracks.len() {
                let first = &tracks[i];
                let second = &tracks[j];

                let distance = haversine_distance(
                    first.lat, first.lon,
                    second.lat, second.lon,
                );

                if distance <= self.threshold_meters {
                    let link_id = Uuid::new_v4().to_string();
                    let alert_id = Uuid::new_v4().to_string();

                    let link = LinkUpsertRecord {
                        id: link_id.clone(),
                        from_type: "Track".to_string(),
                        from_id: first.id.clone(),
                        rel: "near".to_string(),
                        to_type: "Track".to_string(),
                        to_id: second.id.clone(),
                        ts_ms: now_ms,
                        meta: json!({
                            "rule": "proximity",
                            "distance_meters": distance,
                            "threshold_meters": self.threshold_meters,
                        }),
                    };

                    let alert = AlertUpsertRecord {
                        id: alert_id.clone(),
                        severity: if distance < 1000.0 { "CRITICAL" } else { "WARNING" }.to_string(),
                        title: "Proximity Alert".to_string(),
                        description: format!(
                            "Tracks {} and {} are {:.0}m apart (threshold: {:.0}m)",
                            first.id, second.id, distance, self.threshold_meters
                        ),
                        ts_ms: now_ms,
                        status: "ACTIVE".to_string(),
                        evidence_link_ids: vec![link_id.clone()],
                        meta: json!({
                            "rule": "proximity",
                            "distance_meters": distance,
                            "threshold_meters": self.threshold_meters,
                        }),
                    };

                    let evidence_link = LinkUpsertRecord {
                        id: Uuid::new_v4().to_string(),
                        from_type: "Alert".to_string(),
                        from_id: alert_id,
                        rel: "is_evidenced_by".to_string(),
                        to_type: "Track".to_string(),
                        to_id: first.id.clone(),
                        ts_ms: now_ms,
                        meta: json!({ "proximity_link": link_id }),
                    };

                    results.push(RuleResult::Alert {
                        alert,
                        links: vec![link, evidence_link],
                    });
                }
            }
        }

        results
    }
}

/// Anomaly Rule: Detects speed/altitude deviations
struct AnomalyRule {
    speed_change_threshold: f64,  // Percentage
    altitude_change_threshold: f64, // Meters
}

impl AnomalyRule {
    fn new(speed_change_threshold: f64, altitude_change_threshold: f64) -> Self {
        Self {
            speed_change_threshold,
            altitude_change_threshold,
        }
    }

    fn evaluate(&self, tracks: &[TrackObservation], now_ms: i64) -> Vec<RuleResult> {
        let mut results = Vec::new();

        for track in tracks {
            // Check for anomalous speed
            if let Some(speed) = track.speed {
                if speed > 300.0 { // > 300 m/s (~Mach 0.9) is unusual for civilian
                    let alert_id = Uuid::new_v4().to_string();

                    let alert = AlertUpsertRecord {
                        id: alert_id,
                        severity: "WARNING".to_string(),
                        title: "Speed Anomaly".to_string(),
                        description: format!(
                            "Track {} has unusual speed: {:.0} m/s ({:.0} knots)",
                            track.id, speed, speed * 1.94384
                        ),
                        ts_ms: now_ms,
                        status: "ACTIVE".to_string(),
                        evidence_link_ids: vec![],
                        meta: json!({
                            "rule": "anomaly_speed",
                            "speed_mps": speed,
                            "speed_knots": speed * 1.94384,
                            "threshold_mps": 300.0,
                        }),
                    };

                    results.push(RuleResult::Alert {
                        alert,
                        links: vec![],
                    });
                }
            }

            // Check for anomalous altitude
            if track.alt > 20000.0 { // > 20km is unusual
                let alert_id = Uuid::new_v4().to_string();

                let alert = AlertUpsertRecord {
                    id: alert_id,
                    severity: "INFO".to_string(),
                    title: "Altitude Anomaly".to_string(),
                    description: format!(
                        "Track {} at unusual altitude: {:.0}m ({:.0}ft)",
                        track.id, track.alt, track.alt * 3.28084
                    ),
                    ts_ms: now_ms,
                    status: "ACTIVE".to_string(),
                    evidence_link_ids: vec![],
                    meta: json!({
                        "rule": "anomaly_altitude",
                        "altitude_meters": track.alt,
                        "altitude_feet": track.alt * 3.28084,
                        "threshold_meters": 20000.0,
                    }),
                };

                results.push(RuleResult::Alert {
                    alert,
                    links: vec![],
                });
            }
        }

        results
    }
}

/// Loitering Rule: Detects circular flight patterns
struct LoiteringRule {
    min_duration_seconds: f64,
    min_circularity: f64,
}

impl LoiteringRule {
    fn new(min_duration_seconds: f64, min_circularity: f64) -> Self {
        Self {
            min_duration_seconds,
            min_circularity,
        }
    }

    fn evaluate(&self, _tracks: &[TrackObservation], _now_ms: i64) -> Vec<RuleResult> {
        // Loitering detection requires historical track data
        // This is a simplified version - full implementation would query track history
        // and analyze the path geometry for circular patterns
        Vec::new()
    }
}

/// Calculate haversine distance between two points in meters
fn haversine_distance(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const R: f64 = 6371e3; // Earth radius in meters

    let lat1_rad = lat1.to_radians();
    let lat2_rad = lat2.to_radians();
    let delta_lat = (lat2 - lat1).to_radians();
    let delta_lon = (lon2 - lon1).to_radians();

    let a = (delta_lat / 2.0).sin().powi(2)
        + lat1_rad.cos() * lat2_rad.cos() * (delta_lon / 2.0).sin().powi(2);
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());

    R * c
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_track(id: &str, lat: f64, lon: f64, speed: f64, alt: f64) -> TrackObservation {
        TrackObservation {
            id: id.to_string(),
            kind: "AIRCRAFT".to_string(),
            lat,
            lon,
            alt,
            heading: Some(90.0),
            speed: Some(speed),
            ts_ms: 1000,
            provider_id: "test".to_string(),
            meta: json!({}),
        }
    }

    #[test]
    fn test_haversine_distance() {
        // Distance between SFO and LAX ~540 km
        let dist = haversine_distance(37.6213, -122.3790, 33.9416, -118.4085);
        assert!(dist > 500_000.0 && dist < 600_000.0);
    }

    #[test]
    fn test_proximity_rule() {
        let rule = ProximityRule::new(10_000.0); // 10km threshold

        let tracks = vec![
            create_test_track("A", 37.7749, -122.4194, 100.0, 1000.0),
            create_test_track("B", 37.7849, -122.4094, 100.0, 1000.0), // ~1.4km away
        ];

        let results = rule.evaluate(&tracks, 1000);
        assert!(!results.is_empty(), "Should detect proximity");
    }

    #[test]
    fn test_anomaly_rule() {
        let rule = AnomalyRule::new(50.0, 5000.0);

        let tracks = vec![
            create_test_track("A", 37.7749, -122.4194, 400.0, 1000.0), // Speed anomaly
            create_test_track("B", 37.7849, -122.4094, 100.0, 25000.0), // Altitude anomaly
        ];

        let results = rule.evaluate(&tracks, 1000);
        assert_eq!(results.len(), 2, "Should detect both anomalies");
    }
}
