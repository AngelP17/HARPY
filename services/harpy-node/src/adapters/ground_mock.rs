use super::Provider;
use async_trait::async_trait;
use harpy_proto::harpy::v1::{Position, TrackDelta};
use std::collections::HashMap;
use std::f64::consts::PI;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Clone)]
pub enum GroundProfile {
    Sensor,
    Weather,
}

pub struct GroundMockProvider {
    provider_id: String,
    profile: GroundProfile,
}

impl GroundMockProvider {
    pub fn sensor() -> Self {
        Self {
            provider_id: "mock-sensor".to_string(),
            profile: GroundProfile::Sensor,
        }
    }

    pub fn weather() -> Self {
        Self {
            provider_id: "mock-weather".to_string(),
            profile: GroundProfile::Weather,
        }
    }

    fn generate_tracks(&self) -> Vec<TrackDelta> {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let phase = (ts as f64 / 1000.0) % 900.0 / 900.0 * 2.0 * PI;

        match self.profile {
            GroundProfile::Sensor => self.generate_sensor_tracks(ts, phase),
            GroundProfile::Weather => self.generate_weather_tracks(ts, phase),
        }
    }

    fn generate_sensor_tracks(&self, ts: u64, phase: f64) -> Vec<TrackDelta> {
        let anchors = [
            ("SENSOR-SF-01", 37.7749, -122.4194),
            ("SENSOR-OAK-02", 37.8044, -122.2712),
            ("SENSOR-SJC-03", 37.3382, -121.8863),
            ("SENSOR-SMF-04", 38.5816, -121.4944),
        ];

        anchors
            .iter()
            .enumerate()
            .map(|(idx, (id, lat, lon))| {
                let drift = (phase + idx as f64 * 0.6).sin() * 0.06;
                let mut meta = HashMap::new();
                meta.insert("sensor_type".to_string(), "camera".to_string());
                meta.insert("zone".to_string(), "bay-area".to_string());
                meta.insert("signal".to_string(), format!("{:.2}", 0.7 + drift.abs()));
                TrackDelta {
                    id: (*id).to_string(),
                    kind: 3, // Ground
                    position: Some(Position {
                        lat: lat + drift,
                        lon: lon + drift * 0.6,
                        alt: 20.0 + idx as f64 * 4.0,
                    }),
                    heading: ((phase * 45.0) + idx as f64 * 55.0) % 360.0,
                    speed: 4.0 + (idx as f64 * 0.5),
                    ts_ms: ts,
                    provider_id: self.provider_id.clone(),
                    meta,
                }
            })
            .collect()
    }

    fn generate_weather_tracks(&self, ts: u64, phase: f64) -> Vec<TrackDelta> {
        let cells = [
            ("WX-SF", 37.70, -122.45),
            ("WX-NORTH", 38.05, -122.65),
            ("WX-EAST", 37.70, -121.95),
            ("WX-SOUTH", 37.15, -121.95),
        ];

        cells
            .iter()
            .enumerate()
            .map(|(idx, (id, lat, lon))| {
                let wobble = (phase * 1.4 + idx as f64).cos() * 0.12;
                let mut meta = HashMap::new();
                meta.insert("cell_type".to_string(), "precipitation".to_string());
                meta.insert(
                    "intensity".to_string(),
                    format!("{:.2}", 0.55 + wobble.abs()),
                );
                meta.insert("radar_band".to_string(), "S".to_string());
                TrackDelta {
                    id: (*id).to_string(),
                    kind: 3, // Ground
                    position: Some(Position {
                        lat: lat + wobble,
                        lon: lon - wobble * 0.5,
                        alt: 1500.0 + idx as f64 * 250.0,
                    }),
                    heading: ((phase * 60.0) + idx as f64 * 70.0) % 360.0,
                    speed: 18.0 + idx as f64 * 2.5,
                    ts_ms: ts,
                    provider_id: self.provider_id.clone(),
                    meta,
                }
            })
            .collect()
    }
}

#[async_trait]
impl Provider for GroundMockProvider {
    async fn fetch(&self) -> anyhow::Result<Vec<TrackDelta>> {
        Ok(self.generate_tracks())
    }

    fn provider_id(&self) -> &str {
        &self.provider_id
    }
}
