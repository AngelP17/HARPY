use super::Provider;
use anyhow::Context;
use async_trait::async_trait;
use harpy_proto::harpy::v1::{Position, TrackDelta, TrackKind};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::f64::consts::PI;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;

const DEFAULT_BASE_URL: &str = "https://celestrak.org";
const EARTH_RADIUS_M: f64 = 6_378_137.0;
const EARTH_MU_M3_S2: f64 = 3.986_004_418e14;

#[derive(Debug)]
struct CacheState {
    fetched_at: Instant,
    tracks: Vec<TrackDelta>,
}

pub struct CelesTrakProvider {
    provider_id: String,
    client: reqwest::Client,
    base_url: String,
    group: String,
    max_tracks: usize,
    min_refresh: Duration,
    user_agent: String,
    cache: Mutex<Option<CacheState>>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct CelesTrakOmm {
    #[serde(rename = "OBJECT_NAME")]
    object_name: Option<String>,
    #[serde(rename = "OBJECT_ID")]
    object_id: Option<String>,
    #[serde(rename = "NORAD_CAT_ID")]
    norad_cat_id: Option<Value>,
    #[serde(rename = "EPOCH")]
    epoch: Option<String>,
    #[serde(rename = "INCLINATION")]
    inclination: Option<f64>,
    #[serde(rename = "RA_OF_ASC_NODE")]
    raan: Option<f64>,
    #[serde(rename = "MEAN_ANOMALY")]
    mean_anomaly: Option<f64>,
    #[serde(rename = "MEAN_MOTION")]
    mean_motion: Option<f64>,
    #[serde(rename = "ECCENTRICITY")]
    eccentricity: Option<f64>,
}

impl CelesTrakProvider {
    pub fn from_env() -> anyhow::Result<Self> {
        let base_url =
            std::env::var("CELESTRAK_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
        let group = std::env::var("CELESTRAK_GROUP").unwrap_or_else(|_| "STATIONS".to_string());
        let max_tracks = env_usize("CELESTRAK_MAX_TRACKS", 200);
        let min_refresh = Duration::from_secs(env_u64("CELESTRAK_MIN_REFRESH_SECS", 7200));
        let user_agent = std::env::var("CELESTRAK_USER_AGENT")
            .unwrap_or_else(|_| "HARPY/0.1 (+https://example.invalid)".to_string());

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("failed to build CelesTrak HTTP client")?;

        Ok(Self {
            provider_id: "celestrak-gp".to_string(),
            client,
            base_url,
            group,
            max_tracks,
            min_refresh,
            user_agent,
            cache: Mutex::new(None),
        })
    }

    fn build_url(&self) -> anyhow::Result<reqwest::Url> {
        let endpoint = format!(
            "{}/NORAD/elements/gp.php",
            self.base_url.trim_end_matches('/')
        );
        reqwest::Url::parse_with_params(
            &endpoint,
            [("GROUP", self.group.as_str()), ("FORMAT", "JSON")],
        )
        .context("invalid CelesTrak URL")
    }

    fn to_tracks(&self, payload: Vec<CelesTrakOmm>) -> Vec<TrackDelta> {
        let mut output = Vec::with_capacity(payload.len().min(self.max_tracks));

        for (index, item) in payload.into_iter().enumerate() {
            if output.len() >= self.max_tracks {
                break;
            }

            let track_id = item
                .norad_cat_id
                .as_ref()
                .and_then(value_to_string)
                .map(|cat| format!("CELESTRAK-{cat}"))
                .unwrap_or_else(|| format!("CELESTRAK-UNK-{index:05}"));

            let (lat, lon) =
                estimate_position(item.inclination, item.raan, item.mean_anomaly, index);
            let (alt_m, speed_mps) = estimate_orbit(item.mean_motion);
            let ts_ms = parse_epoch_ms(item.epoch.as_deref()).unwrap_or_else(now_ms);

            let mut meta = HashMap::new();
            if let Some(name) = item.object_name {
                meta.insert("name".to_string(), name);
            }
            if let Some(object_id) = item.object_id {
                meta.insert("object_id".to_string(), object_id);
            }
            if let Some(ecc) = item.eccentricity {
                meta.insert("eccentricity".to_string(), format!("{ecc:.8}"));
            }
            if let Some(mean_motion) = item.mean_motion {
                meta.insert(
                    "mean_motion_rev_per_day".to_string(),
                    format!("{mean_motion:.8}"),
                );
            }

            output.push(TrackDelta {
                id: track_id,
                kind: TrackKind::Satellite as i32,
                position: Some(Position {
                    lat,
                    lon,
                    alt: alt_m,
                }),
                heading: 0.0,
                speed: speed_mps,
                ts_ms,
                provider_id: self.provider_id.clone(),
                meta,
            });
        }

        output
    }
}

#[async_trait]
impl Provider for CelesTrakProvider {
    async fn fetch(&self) -> anyhow::Result<Vec<TrackDelta>> {
        {
            let guard = self.cache.lock().await;
            if let Some(cached) = guard.as_ref() {
                if cached.fetched_at.elapsed() < self.min_refresh {
                    return Ok(cached.tracks.clone());
                }
            }
        }

        let url = self.build_url()?;
        let response = self
            .client
            .get(url)
            .header("User-Agent", &self.user_agent)
            .send()
            .await
            .context("CelesTrak request failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("CelesTrak GP query failed: {} {}", status, body);
        }

        let payload: Vec<CelesTrakOmm> = response
            .json()
            .await
            .context("failed to parse CelesTrak JSON payload")?;

        let tracks = self.to_tracks(payload);
        let mut guard = self.cache.lock().await;
        *guard = Some(CacheState {
            fetched_at: Instant::now(),
            tracks: tracks.clone(),
        });

        Ok(tracks)
    }

    fn provider_id(&self) -> &str {
        &self.provider_id
    }
}

fn estimate_position(
    inclination_deg: Option<f64>,
    raan_deg: Option<f64>,
    anomaly_deg: Option<f64>,
    index_seed: usize,
) -> (f64, f64) {
    let inclination = inclination_deg.unwrap_or(53.0).to_radians();
    let anomaly = anomaly_deg
        .unwrap_or(((index_seed * 17) % 360) as f64)
        .to_radians();
    let raan = raan_deg
        .unwrap_or(((index_seed * 29) % 360) as f64)
        .to_radians();

    let lat = (inclination.sin() * anomaly.sin()).asin().to_degrees();
    let lon = normalize_degrees((raan + anomaly).to_degrees() - 180.0);
    (lat, lon)
}

fn estimate_orbit(mean_motion_rev_per_day: Option<f64>) -> (f64, f64) {
    let Some(mean_motion) = mean_motion_rev_per_day else {
        return (550_000.0, 7_600.0);
    };
    if mean_motion <= 0.0 {
        return (550_000.0, 7_600.0);
    }

    let n = mean_motion * 2.0 * PI / 86_400.0;
    let semi_major_axis = (EARTH_MU_M3_S2 / (n * n)).cbrt();
    let altitude = (semi_major_axis - EARTH_RADIUS_M).max(100_000.0);
    let speed = (EARTH_MU_M3_S2 / semi_major_axis).sqrt();
    (altitude, speed)
}

fn parse_epoch_ms(value: Option<&str>) -> Option<u64> {
    let raw = value?;
    chrono::DateTime::parse_from_rfc3339(raw)
        .map(|dt| dt.timestamp_millis() as u64)
        .ok()
}

fn normalize_degrees(value: f64) -> f64 {
    let mut normalized = value % 360.0;
    if normalized > 180.0 {
        normalized -= 360.0;
    }
    if normalized < -180.0 {
        normalized += 360.0;
    }
    normalized
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(v) => Some(v.clone()),
        Value::Number(v) => Some(v.to_string()),
        _ => None,
    }
}

fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(default)
}

fn env_u64(name: &str, default: u64) -> u64 {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(default)
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn provider() -> CelesTrakProvider {
        CelesTrakProvider {
            provider_id: "celestrak-gp".to_string(),
            client: reqwest::Client::new(),
            base_url: DEFAULT_BASE_URL.to_string(),
            group: "STATIONS".to_string(),
            max_tracks: 10,
            min_refresh: Duration::from_secs(1),
            user_agent: "HARPY-test".to_string(),
            cache: Mutex::new(None),
        }
    }

    #[test]
    fn parses_celestrak_payload() {
        let payload = vec![CelesTrakOmm {
            object_name: Some("ISS".to_string()),
            object_id: Some("1998-067A".to_string()),
            norad_cat_id: Some(Value::String("25544".to_string())),
            epoch: Some("2026-02-20T12:00:00.000000+00:00".to_string()),
            inclination: Some(51.64),
            raan: Some(120.0),
            mean_anomaly: Some(230.0),
            mean_motion: Some(15.5),
            eccentricity: Some(0.0002),
        }];

        let tracks = provider().to_tracks(payload);
        assert_eq!(tracks.len(), 1);
        assert_eq!(tracks[0].id, "CELESTRAK-25544");
        assert_eq!(tracks[0].kind, TrackKind::Satellite as i32);
        assert!(tracks[0].position.is_some());
    }
}
