use super::Provider;
use anyhow::Context;
use async_trait::async_trait;
use harpy_proto::harpy::v1::{Position, TrackDelta, TrackKind};
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;

const DEFAULT_API_BASE: &str = "https://opensky-network.org";
const DEFAULT_AUTH_URL: &str =
    "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";

#[derive(Debug, Clone)]
struct BBox {
    min_lat: f64,
    min_lon: f64,
    max_lat: f64,
    max_lon: f64,
}

#[derive(Debug)]
struct TokenState {
    access_token: String,
    expires_at: Instant,
}

pub struct OpenSkyProvider {
    provider_id: String,
    client: reqwest::Client,
    api_base: String,
    auth_url: String,
    client_id: Option<String>,
    client_secret: Option<String>,
    bbox: Option<BBox>,
    include_extended: bool,
    max_tracks: usize,
    token: Mutex<Option<TokenState>>,
}

#[derive(Debug, Deserialize)]
struct OpenSkyStatesResponse {
    #[allow(dead_code)]
    time: Option<u64>,
    states: Option<Vec<Vec<Value>>>,
}

#[derive(Debug, Deserialize)]
struct OpenSkyTokenResponse {
    access_token: String,
    expires_in: Option<u64>,
}

impl OpenSkyProvider {
    pub fn from_env() -> anyhow::Result<Self> {
        let api_base =
            std::env::var("OPENSKY_BASE_URL").unwrap_or_else(|_| DEFAULT_API_BASE.to_string());
        let auth_url =
            std::env::var("OPENSKY_AUTH_URL").unwrap_or_else(|_| DEFAULT_AUTH_URL.to_string());
        let client_id = std::env::var("OPENSKY_CLIENT_ID")
            .ok()
            .filter(|v| !v.trim().is_empty());
        let client_secret = std::env::var("OPENSKY_CLIENT_SECRET")
            .ok()
            .filter(|v| !v.trim().is_empty());
        let include_extended = env_bool("OPENSKY_INCLUDE_EXTENDED", false);
        let max_tracks = env_usize("OPENSKY_MAX_TRACKS", 500);

        let bbox = match (
            env_f64("ADSB_MIN_LAT"),
            env_f64("ADSB_MIN_LON"),
            env_f64("ADSB_MAX_LAT"),
            env_f64("ADSB_MAX_LON"),
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
            .timeout(Duration::from_secs(20))
            .build()
            .context("failed to build OpenSky HTTP client")?;

        Ok(Self {
            provider_id: "opensky".to_string(),
            client,
            api_base,
            auth_url,
            client_id,
            client_secret,
            bbox,
            include_extended,
            max_tracks,
            token: Mutex::new(None),
        })
    }

    async fn get_access_token_if_configured(&self) -> anyhow::Result<Option<String>> {
        if self.client_id.is_none() || self.client_secret.is_none() {
            return Ok(None);
        }

        {
            let guard = self.token.lock().await;
            if let Some(existing) = guard.as_ref() {
                if Instant::now() + Duration::from_secs(30) < existing.expires_at {
                    return Ok(Some(existing.access_token.clone()));
                }
            }
        }

        let fresh = self.request_access_token().await?;
        let token_value = fresh.access_token.clone();
        let mut guard = self.token.lock().await;
        *guard = Some(fresh);
        Ok(Some(token_value))
    }

    async fn request_access_token(&self) -> anyhow::Result<TokenState> {
        let client_id = self
            .client_id
            .as_deref()
            .context("OPENSKY_CLIENT_ID missing")?;
        let client_secret = self
            .client_secret
            .as_deref()
            .context("OPENSKY_CLIENT_SECRET missing")?;

        let response = self
            .client
            .post(&self.auth_url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .form(&[
                ("grant_type", "client_credentials"),
                ("client_id", client_id),
                ("client_secret", client_secret),
            ])
            .send()
            .await
            .context("failed to request OpenSky OAuth token")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("OpenSky token request failed: {} {}", status, body);
        }

        let payload: OpenSkyTokenResponse = response
            .json()
            .await
            .context("failed parsing OpenSky token response")?;

        let ttl = payload.expires_in.unwrap_or(1800).max(60);
        Ok(TokenState {
            access_token: payload.access_token,
            expires_at: Instant::now() + Duration::from_secs(ttl),
        })
    }

    fn build_states_url(&self) -> anyhow::Result<reqwest::Url> {
        let mut params: Vec<(&str, String)> = Vec::new();
        if let Some(bbox) = &self.bbox {
            params.push(("lamin", bbox.min_lat.to_string()));
            params.push(("lomin", bbox.min_lon.to_string()));
            params.push(("lamax", bbox.max_lat.to_string()));
            params.push(("lomax", bbox.max_lon.to_string()));
        }
        if self.include_extended {
            params.push(("extended", "1".to_string()));
        }

        let base = format!("{}/api/states/all", self.api_base.trim_end_matches('/'));
        reqwest::Url::parse_with_params(&base, params).context("invalid OpenSky URL")
    }

    fn to_tracks(&self, payload: OpenSkyStatesResponse) -> Vec<TrackDelta> {
        let mut tracks = Vec::new();
        let response_ts_ms = payload.time.unwrap_or_else(now_secs) * 1000;

        for row in payload.states.unwrap_or_default() {
            if tracks.len() >= self.max_tracks {
                break;
            }
            let Some(icao24) = value_as_str(row.first()) else {
                continue;
            };
            let Some(lat) = value_as_f64(row.get(6)) else {
                continue;
            };
            let Some(lon) = value_as_f64(row.get(5)) else {
                continue;
            };

            let last_contact_ms = value_as_u64(row.get(4))
                .map(|s| s * 1000)
                .unwrap_or(response_ts_ms);
            let alt = value_as_f64(row.get(13))
                .or_else(|| value_as_f64(row.get(7)))
                .unwrap_or(0.0);
            let heading = value_as_f64(row.get(10)).unwrap_or(0.0);
            let speed = value_as_f64(row.get(9)).unwrap_or(0.0);

            let mut meta = HashMap::new();
            if let Some(callsign) = value_as_str(row.get(1)) {
                meta.insert("callsign".to_string(), callsign.trim().to_string());
            }
            if let Some(country) = value_as_str(row.get(2)) {
                meta.insert("origin_country".to_string(), country.to_string());
            }
            if let Some(squawk) = value_as_str(row.get(14)) {
                meta.insert("squawk".to_string(), squawk.to_string());
            }

            tracks.push(TrackDelta {
                id: format!("OPENSKY-{icao24}"),
                kind: TrackKind::Aircraft as i32,
                position: Some(Position { lat, lon, alt }),
                heading,
                speed,
                ts_ms: last_contact_ms,
                provider_id: self.provider_id.clone(),
                meta,
            });
        }

        tracks
    }
}

#[async_trait]
impl Provider for OpenSkyProvider {
    async fn fetch(&self) -> anyhow::Result<Vec<TrackDelta>> {
        let url = self.build_states_url()?;
        let token = self.get_access_token_if_configured().await?;

        let mut request = self.client.get(url.clone());
        if let Some(ref token) = token {
            request = request.bearer_auth(token);
        }
        let response = request.send().await.context("OpenSky request failed")?;

        let response = if response.status() == reqwest::StatusCode::UNAUTHORIZED
            && self.client_id.is_some()
            && self.client_secret.is_some()
        {
            let mut guard = self.token.lock().await;
            *guard = None;
            drop(guard);

            let retry_token = self.get_access_token_if_configured().await?;
            let mut retry = self.client.get(url);
            if let Some(token) = retry_token {
                retry = retry.bearer_auth(token);
            }
            retry.send().await.context("OpenSky retry request failed")?
        } else {
            response
        };

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("OpenSky /states/all failed: {} {}", status, body);
        }

        let payload: OpenSkyStatesResponse = response
            .json()
            .await
            .context("failed to parse OpenSky states response")?;

        Ok(self.to_tracks(payload))
    }

    fn provider_id(&self) -> &str {
        &self.provider_id
    }
}

fn value_as_str(value: Option<&Value>) -> Option<String> {
    match value? {
        Value::String(v) => Some(v.clone()),
        Value::Number(v) => Some(v.to_string()),
        _ => None,
    }
}

fn value_as_f64(value: Option<&Value>) -> Option<f64> {
    match value? {
        Value::Number(v) => v.as_f64(),
        Value::String(v) => v.parse::<f64>().ok(),
        _ => None,
    }
}

fn value_as_u64(value: Option<&Value>) -> Option<u64> {
    match value? {
        Value::Number(v) => v.as_u64(),
        Value::String(v) => v.parse::<u64>().ok(),
        _ => None,
    }
}

fn env_f64(name: &str) -> Option<f64> {
    std::env::var(name).ok()?.parse::<f64>().ok()
}

fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(default)
}

fn env_bool(name: &str, default: bool) -> bool {
    match std::env::var(name) {
        Ok(v) => matches!(
            v.trim().to_ascii_lowercase().as_str(),
            "1" | "true" | "yes" | "on"
        ),
        Err(_) => default,
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
