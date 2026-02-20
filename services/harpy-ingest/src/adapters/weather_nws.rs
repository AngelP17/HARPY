use super::Provider;
use anyhow::Context;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use harpy_proto::harpy::v1::{Position, TrackDelta, TrackKind};
use serde::Deserialize;
use std::collections::HashMap;
use std::time::Duration;
use tokio::sync::Mutex;

const DEFAULT_BASE_URL: &str = "https://api.weather.gov";
const DEFAULT_POINTS: &str = "37.7749,-122.4194";
const DEFAULT_USER_AGENT: &str = "HARPY/0.1 (contact@example.com)";

#[derive(Debug, Clone)]
struct WeatherPoint {
    lat: f64,
    lon: f64,
    key: String,
}

#[derive(Debug, Clone)]
struct PointMetadata {
    forecast_hourly_url: String,
    label: Option<String>,
}

pub struct NwsWeatherProvider {
    provider_id: String,
    client: reqwest::Client,
    base_url: String,
    user_agent: String,
    points: Vec<WeatherPoint>,
    point_meta: Mutex<HashMap<String, PointMetadata>>,
}

#[derive(Debug, Deserialize)]
struct PointsResponse {
    properties: PointsProperties,
}

#[derive(Debug, Deserialize)]
struct PointsProperties {
    #[serde(rename = "forecastHourly")]
    forecast_hourly: String,
    #[serde(rename = "relativeLocation")]
    relative_location: Option<RelativeLocation>,
}

#[derive(Debug, Deserialize)]
struct RelativeLocation {
    properties: RelativeLocationProperties,
}

#[derive(Debug, Deserialize)]
struct RelativeLocationProperties {
    city: Option<String>,
    state: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ForecastHourlyResponse {
    properties: ForecastHourlyProperties,
}

#[derive(Debug, Deserialize)]
struct ForecastHourlyProperties {
    periods: Vec<ForecastPeriod>,
}

#[derive(Debug, Deserialize)]
struct ForecastPeriod {
    #[serde(rename = "startTime")]
    start_time: Option<String>,
    temperature: Option<f64>,
    #[serde(rename = "temperatureUnit")]
    temperature_unit: Option<String>,
    #[serde(rename = "windSpeed")]
    wind_speed: Option<String>,
    #[serde(rename = "windDirection")]
    wind_direction: Option<String>,
    #[serde(rename = "shortForecast")]
    short_forecast: Option<String>,
    #[serde(rename = "probabilityOfPrecipitation")]
    precipitation_probability: Option<UnitValue>,
    #[serde(rename = "relativeHumidity")]
    relative_humidity: Option<UnitValue>,
}

#[derive(Debug, Deserialize)]
struct UnitValue {
    value: Option<f64>,
    #[serde(rename = "unitCode")]
    unit_code: Option<String>,
}

impl NwsWeatherProvider {
    pub fn from_env() -> anyhow::Result<Self> {
        let base_url =
            std::env::var("NWS_BASE_URL").unwrap_or_else(|_| DEFAULT_BASE_URL.to_string());
        let user_agent =
            std::env::var("NWS_USER_AGENT").unwrap_or_else(|_| DEFAULT_USER_AGENT.to_string());
        let points_raw = std::env::var("NWS_POINTS").unwrap_or_else(|_| DEFAULT_POINTS.to_string());
        let max_points = env_usize("NWS_MAX_POINTS", 10);
        let points = parse_points(&points_raw, max_points)?;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .context("failed building NWS HTTP client")?;

        Ok(Self {
            provider_id: "nws-weather".to_string(),
            client,
            base_url,
            user_agent,
            points,
            point_meta: Mutex::new(HashMap::new()),
        })
    }

    async fn get_or_fetch_point_metadata(
        &self,
        point: &WeatherPoint,
    ) -> anyhow::Result<PointMetadata> {
        if let Some(cached) = self.point_meta.lock().await.get(&point.key).cloned() {
            return Ok(cached);
        }

        let url = format!(
            "{}/points/{},{}",
            self.base_url.trim_end_matches('/'),
            point.lat,
            point.lon
        );
        let response = self
            .client
            .get(url)
            .header("User-Agent", &self.user_agent)
            .send()
            .await
            .context("NWS points request failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("NWS points endpoint failed: {} {}", status, body);
        }

        let payload: PointsResponse = response
            .json()
            .await
            .context("failed parsing NWS points response")?;

        let label = payload.properties.relative_location.and_then(|loc| {
            match (loc.properties.city, loc.properties.state) {
                (Some(city), Some(state)) => Some(format!("{city}, {state}")),
                (Some(city), None) => Some(city),
                _ => None,
            }
        });

        let metadata = PointMetadata {
            forecast_hourly_url: payload.properties.forecast_hourly,
            label,
        };
        self.point_meta
            .lock()
            .await
            .insert(point.key.clone(), metadata.clone());

        Ok(metadata)
    }

    async fn fetch_current_period(
        &self,
        forecast_url: &str,
    ) -> anyhow::Result<Option<ForecastPeriod>> {
        let response = self
            .client
            .get(forecast_url)
            .header("User-Agent", &self.user_agent)
            .send()
            .await
            .context("NWS forecast/hourly request failed")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("NWS forecast/hourly endpoint failed: {} {}", status, body);
        }

        let payload: ForecastHourlyResponse = response
            .json()
            .await
            .context("failed parsing NWS forecast/hourly response")?;
        Ok(payload.properties.periods.into_iter().next())
    }

    fn period_to_track(
        &self,
        point: &WeatherPoint,
        metadata: &PointMetadata,
        period: ForecastPeriod,
    ) -> Option<TrackDelta> {
        let ts_ms = period
            .start_time
            .as_deref()
            .and_then(parse_ts_ms)
            .unwrap_or_else(now_ms);

        let mut meta = HashMap::new();
        if let Some(label) = &metadata.label {
            meta.insert("location".to_string(), label.clone());
        }
        if let Some(temp) = period.temperature {
            meta.insert("temperature".to_string(), format!("{temp:.1}"));
        }
        if let Some(unit) = period.temperature_unit {
            meta.insert("temperature_unit".to_string(), unit);
        }
        if let Some(wind_speed) = period.wind_speed {
            meta.insert("wind_speed".to_string(), wind_speed);
        }
        if let Some(wind_dir) = period.wind_direction {
            meta.insert("wind_direction".to_string(), wind_dir);
        }
        if let Some(short) = period.short_forecast {
            meta.insert("short_forecast".to_string(), short);
        }
        if let Some(pop) = period
            .precipitation_probability
            .as_ref()
            .and_then(|v| v.value)
        {
            meta.insert("precip_probability_pct".to_string(), format!("{pop:.1}"));
        }
        if let Some(rh) = period.relative_humidity.as_ref().and_then(|v| v.value) {
            meta.insert("relative_humidity_pct".to_string(), format!("{rh:.1}"));
        }
        if let Some(code) = period
            .relative_humidity
            .as_ref()
            .and_then(|v| v.unit_code.clone())
            .or_else(|| {
                period
                    .precipitation_probability
                    .as_ref()
                    .and_then(|v| v.unit_code.clone())
            })
        {
            meta.insert("unit_code".to_string(), code);
        }

        Some(TrackDelta {
            id: format!("NWS-WX-{}", point.key),
            kind: TrackKind::Ground as i32,
            position: Some(Position {
                lat: point.lat,
                lon: point.lon,
                alt: 0.0,
            }),
            heading: 0.0,
            speed: 0.0,
            ts_ms,
            provider_id: self.provider_id.clone(),
            meta,
        })
    }
}

#[async_trait]
impl Provider for NwsWeatherProvider {
    async fn fetch(&self) -> anyhow::Result<Vec<TrackDelta>> {
        let mut tracks = Vec::with_capacity(self.points.len());

        for point in &self.points {
            let metadata = self.get_or_fetch_point_metadata(point).await?;
            if let Some(period) = self
                .fetch_current_period(&metadata.forecast_hourly_url)
                .await?
            {
                if let Some(track) = self.period_to_track(point, &metadata, period) {
                    tracks.push(track);
                }
            }
        }

        Ok(tracks)
    }

    fn provider_id(&self) -> &str {
        &self.provider_id
    }
}

fn parse_points(input: &str, max_points: usize) -> anyhow::Result<Vec<WeatherPoint>> {
    let mut points = Vec::new();
    for raw in input.split(';') {
        let part = raw.trim();
        if part.is_empty() {
            continue;
        }
        let mut pieces = part.split(',');
        let lat = pieces
            .next()
            .context("missing latitude in NWS_POINTS")?
            .trim()
            .parse::<f64>()
            .context("invalid latitude in NWS_POINTS")?;
        let lon = pieces
            .next()
            .context("missing longitude in NWS_POINTS")?
            .trim()
            .parse::<f64>()
            .context("invalid longitude in NWS_POINTS")?;

        points.push(WeatherPoint {
            lat,
            lon,
            key: format!("{lat:.4}_{lon:.4}"),
        });
        if points.len() >= max_points {
            break;
        }
    }

    if points.is_empty() {
        anyhow::bail!("NWS_POINTS produced no valid coordinates");
    }
    Ok(points)
}

fn parse_ts_ms(raw: &str) -> Option<u64> {
    DateTime::parse_from_rfc3339(raw)
        .ok()
        .map(|dt| dt.timestamp_millis().max(0) as u64)
}

fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(default)
}

fn now_ms() -> u64 {
    Utc::now().timestamp_millis().max(0) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_nws_points() {
        let points = parse_points("37.77,-122.41;34.05,-118.24", 10).expect("points");
        assert_eq!(points.len(), 2);
        assert_eq!(points[0].key, "37.7700_-122.4100");
    }

    #[test]
    fn converts_period_to_track() {
        let provider = NwsWeatherProvider {
            provider_id: "nws-weather".to_string(),
            client: reqwest::Client::new(),
            base_url: DEFAULT_BASE_URL.to_string(),
            user_agent: DEFAULT_USER_AGENT.to_string(),
            points: vec![],
            point_meta: Mutex::new(HashMap::new()),
        };
        let point = WeatherPoint {
            lat: 37.7,
            lon: -122.4,
            key: "37.7000_-122.4000".to_string(),
        };
        let meta = PointMetadata {
            forecast_hourly_url: "https://example.invalid".to_string(),
            label: Some("Daly City, CA".to_string()),
        };
        let period = ForecastPeriod {
            start_time: Some("2026-02-20T10:00:00-08:00".to_string()),
            temperature: Some(47.0),
            temperature_unit: Some("F".to_string()),
            wind_speed: Some("3 mph".to_string()),
            wind_direction: Some("ESE".to_string()),
            short_forecast: Some("Mostly Cloudy".to_string()),
            precipitation_probability: Some(UnitValue {
                value: Some(10.0),
                unit_code: Some("wmoUnit:percent".to_string()),
            }),
            relative_humidity: Some(UnitValue {
                value: Some(70.0),
                unit_code: Some("wmoUnit:percent".to_string()),
            }),
        };

        let track = provider
            .period_to_track(&point, &meta, period)
            .expect("track");
        assert_eq!(track.id, "NWS-WX-37.7000_-122.4000");
        assert_eq!(track.kind, TrackKind::Ground as i32);
        assert!(track.meta.contains_key("temperature"));
    }
}
