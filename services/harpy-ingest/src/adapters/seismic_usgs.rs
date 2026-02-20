use super::Provider;
use anyhow::Context;
use async_trait::async_trait;
use chrono::{Duration, SecondsFormat, Utc};
use harpy_proto::harpy::v1::{Position, TrackDelta, TrackKind};
use reqwest::Url;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration as StdDuration;

const DEFAULT_QUERY_URL: &str = "https://earthquake.usgs.gov/fdsnws/event/1/query";

#[derive(Debug, Clone)]
struct BBox {
    min_lat: f64,
    min_lon: f64,
    max_lat: f64,
    max_lon: f64,
}

pub struct UsgsSeismicProvider {
    provider_id: String,
    client: reqwest::Client,
    query_url: String,
    min_magnitude: f64,
    max_results: usize,
    lookback_minutes: i64,
    bbox: Option<BBox>,
}

#[derive(Debug, Deserialize)]
struct UsgsFeatureCollection {
    features: Vec<UsgsFeature>,
}

#[derive(Debug, Deserialize)]
struct UsgsFeature {
    id: String,
    properties: Option<UsgsProperties>,
    geometry: Option<UsgsGeometry>,
}

#[derive(Debug, Deserialize)]
struct UsgsProperties {
    mag: Option<f64>,
    place: Option<String>,
    time: Option<i64>,
    alert: Option<String>,
    tsunami: Option<i64>,
    sig: Option<i64>,
    status: Option<String>,
    title: Option<String>,
}

#[derive(Debug, Deserialize)]
struct UsgsGeometry {
    // GeoJSON: [lon, lat, depth_km]
    coordinates: Vec<f64>,
}

impl UsgsSeismicProvider {
    pub fn from_env() -> anyhow::Result<Self> {
        let query_url =
            std::env::var("USGS_QUERY_URL").unwrap_or_else(|_| DEFAULT_QUERY_URL.to_string());
        let min_magnitude = env_f64("USGS_MIN_MAGNITUDE").unwrap_or(2.5);
        let max_results = env_usize("USGS_MAX_RESULTS", 250);
        let lookback_minutes = env_i64("USGS_LOOKBACK_MINUTES", 180);

        let bbox = match (
            env_f64("SEISMIC_MIN_LAT"),
            env_f64("SEISMIC_MIN_LON"),
            env_f64("SEISMIC_MAX_LAT"),
            env_f64("SEISMIC_MAX_LON"),
        ) {
            (Some(min_lat), Some(min_lon), Some(max_lat), Some(max_lon)) => Some(BBox {
                min_lat,
                min_lon,
                max_lat,
                max_lon,
            }),
            _ => None,
        };

        let client = reqwest::Client::builder()
            .timeout(StdDuration::from_secs(20))
            .build()
            .context("failed to build USGS HTTP client")?;

        Ok(Self {
            provider_id: "usgs-earthquake".to_string(),
            client,
            query_url,
            min_magnitude,
            max_results,
            lookback_minutes,
            bbox,
        })
    }

    fn build_query_url(&self) -> anyhow::Result<Url> {
        let end_time = Utc::now();
        let start_time = end_time - Duration::minutes(self.lookback_minutes.max(1));

        let mut params = vec![
            ("format", "geojson".to_string()),
            ("eventtype", "earthquake".to_string()),
            ("orderby", "time".to_string()),
            ("limit", self.max_results.to_string()),
            ("minmagnitude", self.min_magnitude.to_string()),
            // USGS rejects overly precise timestamps; use second precision ISO-8601.
            (
                "starttime",
                start_time.to_rfc3339_opts(SecondsFormat::Secs, true),
            ),
            (
                "endtime",
                end_time.to_rfc3339_opts(SecondsFormat::Secs, true),
            ),
        ];

        if let Some(bbox) = &self.bbox {
            params.push(("minlatitude", bbox.min_lat.to_string()));
            params.push(("minlongitude", bbox.min_lon.to_string()));
            params.push(("maxlatitude", bbox.max_lat.to_string()));
            params.push(("maxlongitude", bbox.max_lon.to_string()));
        }

        Url::parse_with_params(&self.query_url, params).context("invalid USGS query URL")
    }

    fn to_tracks(&self, response: UsgsFeatureCollection) -> Vec<TrackDelta> {
        response
            .features
            .into_iter()
            .filter_map(|feature| {
                let geometry = feature.geometry?;
                if geometry.coordinates.len() < 2 {
                    return None;
                }
                let lon = geometry.coordinates[0];
                let lat = geometry.coordinates[1];
                let depth_km = geometry.coordinates.get(2).copied().unwrap_or(0.0);
                let alt = -depth_km * 1000.0;

                let props = feature.properties.unwrap_or(UsgsProperties {
                    mag: None,
                    place: None,
                    time: None,
                    alert: None,
                    tsunami: None,
                    sig: None,
                    status: None,
                    title: None,
                });

                let ts_ms = props
                    .time
                    .map(|ms| ms.max(0) as u64)
                    .unwrap_or_else(|| Utc::now().timestamp_millis().max(0) as u64);

                let mut meta = HashMap::new();
                if let Some(mag) = props.mag {
                    meta.insert("magnitude".to_string(), format!("{mag:.2}"));
                }
                if let Some(place) = props.place {
                    meta.insert("place".to_string(), place);
                }
                if let Some(alert) = props.alert {
                    meta.insert("alert_level".to_string(), alert);
                }
                if let Some(tsunami) = props.tsunami {
                    meta.insert("tsunami".to_string(), tsunami.to_string());
                }
                if let Some(sig) = props.sig {
                    meta.insert("significance".to_string(), sig.to_string());
                }
                if let Some(status) = props.status {
                    meta.insert("status".to_string(), status);
                }
                if let Some(title) = props.title {
                    meta.insert("title".to_string(), title);
                }

                Some(TrackDelta {
                    id: format!("USGS-{}", feature.id),
                    kind: TrackKind::Ground as i32,
                    position: Some(Position { lat, lon, alt }),
                    heading: 0.0,
                    speed: 0.0,
                    ts_ms,
                    provider_id: self.provider_id.clone(),
                    meta,
                })
            })
            .collect()
    }
}

#[async_trait]
impl Provider for UsgsSeismicProvider {
    async fn fetch(&self) -> anyhow::Result<Vec<TrackDelta>> {
        let url = self.build_query_url()?;
        let response = self
            .client
            .get(url)
            .send()
            .await
            .context("USGS request failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("USGS query failed: {} {}", status, body);
        }

        let payload: UsgsFeatureCollection = response
            .json()
            .await
            .context("failed parsing USGS GeoJSON response")?;

        Ok(self.to_tracks(payload))
    }

    fn provider_id(&self) -> &str {
        &self.provider_id
    }
}

fn env_f64(name: &str) -> Option<f64> {
    std::env::var(name).ok()?.parse::<f64>().ok()
}

fn env_i64(name: &str, default: i64) -> i64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(default)
}

fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(default)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn provider() -> UsgsSeismicProvider {
        UsgsSeismicProvider {
            provider_id: "usgs-earthquake".to_string(),
            client: reqwest::Client::new(),
            query_url: DEFAULT_QUERY_URL.to_string(),
            min_magnitude: 2.5,
            max_results: 100,
            lookback_minutes: 60,
            bbox: None,
        }
    }

    #[test]
    fn parses_geojson_to_tracks() {
        let payload = UsgsFeatureCollection {
            features: vec![UsgsFeature {
                id: "abcd1234".to_string(),
                properties: Some(UsgsProperties {
                    mag: Some(4.2),
                    place: Some("10km S of Testville".to_string()),
                    time: Some(1_700_000_000_000),
                    alert: Some("green".to_string()),
                    tsunami: Some(0),
                    sig: Some(312),
                    status: Some("reviewed".to_string()),
                    title: Some("M 4.2 - 10km S of Testville".to_string()),
                }),
                geometry: Some(UsgsGeometry {
                    coordinates: vec![-122.5, 37.6, 12.3],
                }),
            }],
        };

        let tracks = provider().to_tracks(payload);
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].id, "USGS-abcd1234");
        assert_eq!(tracks[0].kind, TrackKind::Ground as i32);
        assert!(tracks[0].position.is_some());
    }
}
