use super::Provider;
use async_trait::async_trait;
use harpy_proto::harpy::v1::{Position, TrackDelta};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct TleMockProvider {
    provider_id: String,
}

impl TleMockProvider {
    pub fn new() -> Self {
        Self {
            provider_id: "mock-tle".to_string(),
        }
    }

    fn generate_satellites(&self, count: usize) -> Vec<TrackDelta> {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let mut satellites = Vec::with_capacity(count);

        // Common satellite orbits (simplified)
        // (name, inclination_deg, altitude_m, period_sec)
        let orbits = vec![
            ("ISS", 51.6, 408000.0, 90.0 * 60.0),      // ISS orbit
            ("GPS", 55.0, 20200000.0, 12.0 * 3600.0),  // GPS orbit
            ("Starlink", 53.0, 550000.0, 95.0 * 60.0), // Starlink orbit
        ];

        for i in 0..count {
            let orbit = &orbits[i % orbits.len()];
            let inclination = orbit.1;
            let altitude = orbit.2;
            let period = orbit.3; // seconds

            // Simple circular orbit calculation
            let phase = (ts as f64 / 1000.0) % period / period * 2.0 * std::f64::consts::PI;

            let lat = inclination * phase.sin();
            let lon = (phase.cos() * 180.0) % 360.0 - 180.0;

            let mut meta = HashMap::new();
            meta.insert("name".to_string(), format!("{}-{}", orbit.0, i));
            meta.insert("norad_id".to_string(), format!("{}", 25544 + i));
            meta.insert("orbit_type".to_string(), orbit.0.to_string());

            satellites.push(TrackDelta {
                id: format!("MOCK-SAT-{:03}", i),
                kind: 2, // Satellite
                position: Some(Position {
                    lat,
                    lon,
                    alt: altitude,
                }),
                heading: 0.0, // Not applicable for satellites
                speed: 0.0,   // Orbital velocity (simplified)
                ts_ms: ts,
                provider_id: self.provider_id.clone(),
                meta,
            });
        }

        satellites
    }
}

#[async_trait]
impl Provider for TleMockProvider {
    async fn fetch(&self) -> anyhow::Result<Vec<TrackDelta>> {
        Ok(self.generate_satellites(10))
    }

    fn provider_id(&self) -> &str {
        &self.provider_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tle_provider_count() {
        let provider = TleMockProvider::new();
        let tracks = provider.fetch().await.unwrap();

        assert_eq!(tracks.len(), 10);
        assert_eq!(provider.provider_id(), "mock-tle");
    }

    #[tokio::test]
    async fn test_tle_provider_satellites() {
        let provider = TleMockProvider::new();
        let tracks = provider.fetch().await.unwrap();

        // First satellite should be ISS-variant
        assert_eq!(tracks[0].id, "MOCK-SAT-000");
        assert_eq!(tracks[0].kind, 2); // Satellite
    }
}
