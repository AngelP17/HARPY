use super::Provider;
use anyhow::Context;
use async_trait::async_trait;
use chrono::{DateTime, Datelike, Duration, Utc};
use harpy_proto::harpy::v1::{Position, TrackDelta, TrackKind};
use reqwest::Url;
use serde::Deserialize;
use std::collections::HashMap;
use std::time::{Duration as StdDuration, Instant};
use tokio::sync::Mutex;

const DEFAULT_BUCKET_URL: &str = "https://unidata-nexrad-level2-chunks.s3.amazonaws.com";
const DEFAULT_STATIONS: &str = "KABR,KTLX,KATX,KAMX,KDGX";
const DEFAULT_USER_AGENT: &str = "HARPY/0.1 (contact@example.com)";
const DEFAULT_STATIONS_URL: &str = "https://api.weather.gov/radar/stations";

#[derive(Debug, Clone)]
struct RadarStationInfo {
    id: String,
    name: Option<String>,
    lat: f64,
    lon: f64,
    elevation_m: Option<f64>,
}

#[derive(Debug, Clone)]
struct StationCache {
    fetched_at: Instant,
    stations: HashMap<String, RadarStationInfo>,
}

pub struct NexradRadarProvider {
    provider_id: String,
    client: reqwest::Client,
    bucket_url: String,
    user_agent: String,
    stations_url: String,
    stations: Vec<String>,
    max_keys_per_station: usize,
    station_cache_ttl: StdDuration,
    station_cache: Mutex<Option<StationCache>>,
}

#[derive(Debug, Deserialize)]
struct RadarStationsResponse {
    features: Vec<RadarStationFeature>,
}

#[derive(Debug, Deserialize)]
struct RadarStationFeature {
    geometry: Option<RadarGeometry>,
    properties: Option<RadarStationProperties>,
}

#[derive(Debug, Deserialize)]
struct RadarGeometry {
    coordinates: Vec<f64>,
}

#[derive(Debug, Deserialize)]
struct RadarStationProperties {
    id: Option<String>,
    name: Option<String>,
    elevation: Option<RadarValue>,
}

#[derive(Debug, Deserialize)]
struct RadarValue {
    value: Option<f64>,
}

#[derive(Debug, Clone)]
struct RadarObject {
    key: String,
    last_modified: DateTime<Utc>,
}

impl NexradRadarProvider {
    pub fn from_env() -> anyhow::Result<Self> {
        let bucket_url =
            std::env::var("NEXRAD_BUCKET_URL").unwrap_or_else(|_| DEFAULT_BUCKET_URL.to_string());
        let stations_input =
            std::env::var("NEXRAD_STATIONS").unwrap_or_else(|_| DEFAULT_STATIONS.to_string());
        let stations = parse_station_list(&stations_input);
        let user_agent =
            std::env::var("NEXRAD_USER_AGENT").unwrap_or_else(|_| DEFAULT_USER_AGENT.to_string());
        let stations_url = std::env::var("NEXRAD_STATIONS_URL")
            .unwrap_or_else(|_| DEFAULT_STATIONS_URL.to_string());
        let max_keys_per_station = env_usize("NEXRAD_MAX_KEYS_PER_STATION", 400);

        let client = reqwest::Client::builder()
            .timeout(StdDuration::from_secs(25))
            .build()
            .context("failed to build NEXRAD HTTP client")?;

        Ok(Self {
            provider_id: "nexrad-level2".to_string(),
            client,
            bucket_url,
            user_agent,
            stations_url,
            stations,
            max_keys_per_station,
            station_cache_ttl: StdDuration::from_secs(24 * 60 * 60),
            station_cache: Mutex::new(None),
        })
    }

    async fn get_station_map(&self) -> anyhow::Result<HashMap<String, RadarStationInfo>> {
        {
            let guard = self.station_cache.lock().await;
            if let Some(cache) = guard.as_ref() {
                if cache.fetched_at.elapsed() < self.station_cache_ttl {
                    return Ok(cache.stations.clone());
                }
            }
        }

        let response = self
            .client
            .get(&self.stations_url)
            .header("User-Agent", &self.user_agent)
            .send()
            .await
            .context("NWS radar stations request failed")?;
        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("NWS radar stations endpoint failed: {} {}", status, body);
        }

        let payload: RadarStationsResponse = response
            .json()
            .await
            .context("failed parsing NWS radar stations response")?;

        let mut map = HashMap::new();
        for feature in payload.features {
            let Some(properties) = feature.properties else {
                continue;
            };
            let Some(geometry) = feature.geometry else {
                continue;
            };
            if geometry.coordinates.len() < 2 {
                continue;
            }
            let Some(id) = properties.id else {
                continue;
            };

            let info = RadarStationInfo {
                id: id.clone(),
                name: properties.name,
                lon: geometry.coordinates[0],
                lat: geometry.coordinates[1],
                elevation_m: properties.elevation.and_then(|v| v.value),
            };
            map.insert(id.to_ascii_uppercase(), info);
        }

        let cache = StationCache {
            fetched_at: Instant::now(),
            stations: map.clone(),
        };
        *self.station_cache.lock().await = Some(cache);
        Ok(map)
    }

    async fn fetch_latest_object_for_station(
        &self,
        station: &str,
    ) -> anyhow::Result<Option<RadarObject>> {
        let today = Utc::now().date_naive();
        let yesterday = today - Duration::days(1);

        // Query today's and yesterday's prefixes to handle UTC date rollovers.
        let mut best: Option<RadarObject> = None;
        for day in [today, yesterday] {
            if let Some(obj) = self.fetch_latest_for_date(station, day).await? {
                if best
                    .as_ref()
                    .map(|current| obj.last_modified > current.last_modified)
                    .unwrap_or(true)
                {
                    best = Some(obj);
                }
            }
        }

        Ok(best)
    }

    async fn fetch_latest_for_date(
        &self,
        station: &str,
        day: chrono::NaiveDate,
    ) -> anyhow::Result<Option<RadarObject>> {
        let prefix = format!(
            "{}/1/{:04}{:02}{:02}",
            station,
            day.year(),
            day.month(),
            day.day()
        );

        let url = Url::parse_with_params(
            self.bucket_url.trim_end_matches('/'),
            [
                ("list-type", "2".to_string()),
                ("prefix", prefix),
                ("max-keys", self.max_keys_per_station.to_string()),
            ],
        )
        .context("invalid NEXRAD bucket URL")?;

        let xml = self
            .client
            .get(url)
            .send()
            .await
            .context("NEXRAD list objects request failed")?
            .text()
            .await
            .context("failed reading NEXRAD list objects response")?;

        Ok(latest_radar_object_from_xml(&xml))
    }

    fn to_track(&self, station: &RadarStationInfo, object: &RadarObject) -> TrackDelta {
        let mut meta = HashMap::new();
        meta.insert("radar_station".to_string(), station.id.clone());
        if let Some(name) = &station.name {
            meta.insert("radar_name".to_string(), name.clone());
        }
        meta.insert("bucket_key".to_string(), object.key.clone());
        meta.insert("bucket_source".to_string(), self.bucket_url.clone());
        meta.insert(
            "last_modified_iso".to_string(),
            object.last_modified.to_rfc3339(),
        );

        TrackDelta {
            id: format!("NEXRAD-{}", station.id),
            kind: TrackKind::Ground as i32,
            position: Some(Position {
                lat: station.lat,
                lon: station.lon,
                alt: station.elevation_m.unwrap_or(0.0),
            }),
            heading: 0.0,
            speed: 0.0,
            ts_ms: object.last_modified.timestamp_millis().max(0) as u64,
            provider_id: self.provider_id.clone(),
            meta,
        }
    }
}

#[async_trait]
impl Provider for NexradRadarProvider {
    async fn fetch(&self) -> anyhow::Result<Vec<TrackDelta>> {
        let station_map = self.get_station_map().await?;
        let mut tracks = Vec::new();

        for code in &self.stations {
            let Some(station) = station_map.get(code) else {
                tracing::warn!("NEXRAD station {} not found in NWS station metadata", code);
                continue;
            };

            if let Some(obj) = self.fetch_latest_object_for_station(code).await? {
                tracks.push(self.to_track(station, &obj));
            }
        }

        Ok(tracks)
    }

    fn provider_id(&self) -> &str {
        &self.provider_id
    }
}

fn parse_station_list(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim().to_ascii_uppercase())
        .filter(|s| s.len() == 4)
        .collect()
}

fn latest_radar_object_from_xml(xml: &str) -> Option<RadarObject> {
    let keys = extract_tag_values(xml, "Key");
    let timestamps = extract_tag_values(xml, "LastModified");
    let mut best: Option<RadarObject> = None;

    for (key, ts) in keys.into_iter().zip(timestamps.into_iter()) {
        let Ok(parsed) = DateTime::parse_from_rfc3339(&ts) else {
            continue;
        };
        let candidate = RadarObject {
            key,
            last_modified: parsed.with_timezone(&Utc),
        };
        if best
            .as_ref()
            .map(|current| candidate.last_modified > current.last_modified)
            .unwrap_or(true)
        {
            best = Some(candidate);
        }
    }

    best
}

fn extract_tag_values(xml: &str, tag: &str) -> Vec<String> {
    let open = format!("<{tag}>");
    let close = format!("</{tag}>");
    let mut values = Vec::new();
    let mut cursor = 0usize;

    while let Some(start_rel) = xml[cursor..].find(&open) {
        let start = cursor + start_rel + open.len();
        let Some(end_rel) = xml[start..].find(&close) else {
            break;
        };
        let end = start + end_rel;
        values.push(xml[start..end].to_string());
        cursor = end + close.len();
    }
    values
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

    #[test]
    fn parses_station_list() {
        let stations = parse_station_list("KABR, KTLX, bad, KATX");
        assert_eq!(stations, vec!["KABR", "KTLX", "KATX"]);
    }

    #[test]
    fn extracts_latest_radar_object() {
        let xml = r#"<?xml version="1.0" encoding="UTF-8"?>
        <ListBucketResult>
          <Contents>
            <Key>KABR/1/20260220-141358-001-S</Key>
            <LastModified>2026-02-20T14:14:01.000Z</LastModified>
          </Contents>
          <Contents>
            <Key>KABR/1/20260220-141358-002-I</Key>
            <LastModified>2026-02-20T14:14:13.000Z</LastModified>
          </Contents>
        </ListBucketResult>"#;

        let latest = latest_radar_object_from_xml(xml).expect("latest");
        assert_eq!(latest.key, "KABR/1/20260220-141358-002-I");
        assert_eq!(
            latest.last_modified.to_rfc3339(),
            "2026-02-20T14:14:13+00:00"
        );
    }
}
