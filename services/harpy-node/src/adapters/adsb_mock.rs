use super::Provider;
use async_trait::async_trait;
use harpy_proto::harpy::v1::{Position, TrackDelta};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct AdsbMockProvider {
    provider_id: String,
}

impl AdsbMockProvider {
    pub fn new() -> Self {
        Self {
            provider_id: "mock-adsb".to_string(),
        }
    }

    fn generate_tracks(&self, count: usize) -> Vec<TrackDelta> {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;

        let mut tracks = Vec::with_capacity(count);

        let routes = [
            (37.7749, -122.4194, 37.6213, -122.3790),
            (37.3387, -121.8853, 37.7749, -122.4194),
            (38.5541, -121.9292, 37.7749, -122.4194),
            (38.8895, -77.0353, 39.1774, -76.6684),
            (38.9517, -77.4565, 38.8895, -77.0353),
        ];

        for i in 0..count {
            let route = &routes[i % routes.len()];
            let progress = ((ts / 1000) % 300) as f64 / 300.0;

            let lat = route.0 + (route.2 - route.0) * progress;
            let lon = route.1 + (route.3 - route.1) * progress;

            let mut meta = HashMap::new();
            meta.insert("callsign".to_string(), format!("MCK{:03}", i));
            meta.insert("squawk".to_string(), "1200".to_string());
            meta.insert(
                "altitude_ft".to_string(),
                format!("{}", 10000 + (i * 500)),
            );

            tracks.push(TrackDelta {
                id: format!("MOCK-AC-{:03}", i),
                kind: 1,
                position: Some(Position {
                    lat,
                    lon,
                    alt: 10000.0 + (i as f64 * 500.0),
                }),
                heading: self.calculate_heading(route.0, route.1, route.2, route.3),
                speed: 250.0,
                ts_ms: ts,
                provider_id: self.provider_id.clone(),
                meta,
            });
        }

        tracks
    }

    fn calculate_heading(&self, lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
        let d_lon = (lon2 - lon1).to_radians();
        let lat1_rad = lat1.to_radians();
        let lat2_rad = lat2.to_radians();

        let y = d_lon.sin() * lat2_rad.cos();
        let x = lat1_rad.cos() * lat2_rad.sin()
            - lat1_rad.sin() * lat2_rad.cos() * d_lon.cos();

        let bearing = y.atan2(x).to_degrees();
        (bearing + 360.0) % 360.0
    }
}

#[async_trait]
impl Provider for AdsbMockProvider {
    async fn fetch(&self) -> anyhow::Result<Vec<TrackDelta>> {
        Ok(self.generate_tracks(20))
    }

    fn provider_id(&self) -> &str {
        &self.provider_id
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_adsb_provider_count() {
        let provider = AdsbMockProvider::new();
        let tracks = provider.fetch().await.unwrap();
        assert_eq!(tracks.len(), 20);
        assert_eq!(provider.provider_id(), "mock-adsb");
    }

    #[tokio::test]
    async fn test_adsb_provider_determinism() {
        let provider = AdsbMockProvider::new();
        let tracks1 = provider.fetch().await.unwrap();
        let tracks2 = provider.fetch().await.unwrap();
        assert_eq!(tracks1[0].id, tracks2[0].id);
        assert_eq!(tracks1[0].id, "MOCK-AC-000");
    }
}
