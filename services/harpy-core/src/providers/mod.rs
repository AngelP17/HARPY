//! Provider adapters and the fetch -> validate -> store lifecycle.

pub mod celestrak;
pub mod usgs;

use crate::db::Store;
use crate::model::FetchOutcome;
use crate::now_ms;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

#[derive(Debug, Clone)]
pub struct ProviderConfig {
    pub enable_usgs: bool,
    pub usgs_feed_url: String,
    /// Fetched once when the store has no earthquakes yet, to seed a week of history.
    pub usgs_bootstrap_url: Option<String>,
    pub enable_celestrak: bool,
    pub celestrak_base_url: String,
    pub celestrak_groups: Vec<String>,
    pub celestrak_min_refresh_ms: i64,
    pub user_agent: String,
    pub http_timeout: Duration,
    pub max_attempts: u32,
}

impl ProviderConfig {
    pub fn from_env() -> Self {
        let env = |k: &str| std::env::var(k).ok().filter(|v| !v.trim().is_empty());
        let flag = |k: &str, d: bool| {
            env(k)
                .map(|v| matches!(v.to_ascii_lowercase().as_str(), "1" | "true" | "yes" | "on"))
                .unwrap_or(d)
        };
        Self {
            enable_usgs: flag("HARPY_ENABLE_USGS", true),
            usgs_feed_url: env("HARPY_USGS_FEED_URL").unwrap_or_else(|| usgs::FEED_DAY.into()),
            usgs_bootstrap_url: match env("HARPY_USGS_BOOTSTRAP_URL").as_deref() {
                Some("none") => None,
                Some(u) => Some(u.to_string()),
                None => Some(usgs::FEED_WEEK.into()),
            },
            enable_celestrak: flag("HARPY_ENABLE_CELESTRAK", true),
            celestrak_base_url: env("HARPY_CELESTRAK_BASE_URL")
                .unwrap_or_else(|| celestrak::BASE_URL.into()),
            celestrak_groups: env("HARPY_CELESTRAK_GROUPS")
                .map(|g| {
                    g.split(',')
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty())
                        .collect()
                })
                .unwrap_or_else(|| {
                    celestrak::DEFAULT_GROUPS
                        .iter()
                        .map(|s| s.to_string())
                        .collect()
                }),
            celestrak_min_refresh_ms: env("HARPY_CELESTRAK_MIN_REFRESH_SECS")
                .and_then(|v| v.parse::<i64>().ok())
                .map(|s| s * 1000)
                .unwrap_or(celestrak::MIN_REFRESH_MS),
            user_agent: env("HARPY_USER_AGENT").unwrap_or_else(|| {
                "HARPY/0.1 (+https://github.com/AngelP17/HARPY; geospatial monitor)".into()
            }),
            http_timeout: Duration::from_secs(
                env("HARPY_HTTP_TIMEOUT_SECS")
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(30),
            ),
            max_attempts: env("HARPY_HTTP_MAX_ATTEMPTS")
                .and_then(|v| v.parse().ok())
                .unwrap_or(3),
        }
    }
}

pub struct Ingestor {
    client: reqwest::Client,
    pub cfg: ProviderConfig,
}

struct HttpResult {
    status: Option<u16>,
    body: Option<Vec<u8>>,
    error: Option<String>,
}

impl Ingestor {
    pub fn new(cfg: ProviderConfig) -> anyhow::Result<Self> {
        let client = reqwest::Client::builder()
            .user_agent(cfg.user_agent.clone())
            .timeout(cfg.http_timeout)
            .gzip(true)
            .build()?;
        Ok(Self { client, cfg })
    }

    /// GET with bounded retries on transport errors, 429 and 5xx. 4xx other than 429 is final.
    async fn get(&self, url: &str) -> HttpResult {
        let mut last = HttpResult {
            status: None,
            body: None,
            error: Some("not attempted".into()),
        };
        for attempt in 1..=self.cfg.max_attempts.max(1) {
            match self.client.get(url).send().await {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    if resp.status().is_success() {
                        match resp.bytes().await {
                            Ok(b) => {
                                return HttpResult {
                                    status: Some(status),
                                    body: Some(b.to_vec()),
                                    error: None,
                                }
                            }
                            Err(e) => {
                                last = HttpResult {
                                    status: Some(status),
                                    body: None,
                                    error: Some(format!("reading body: {e}")),
                                }
                            }
                        }
                    } else {
                        let retryable = status == 429 || status >= 500;
                        last = HttpResult {
                            status: Some(status),
                            body: None,
                            error: Some(format!("HTTP {status}")),
                        };
                        if !retryable {
                            return last;
                        }
                    }
                }
                Err(e) => {
                    last = HttpResult {
                        status: None,
                        body: None,
                        error: Some(format!("transport: {e}")),
                    }
                }
            }
            if attempt < self.cfg.max_attempts {
                tokio::time::sleep(Duration::from_millis(1000 * 2u64.pow(attempt - 1))).await;
            }
        }
        last
    }

    pub async fn run_usgs(&self, store: &Mutex<Store>) -> Vec<FetchOutcome> {
        let mut outcomes = Vec::new();
        let empty = store
            .lock()
            .await
            .count(usgs::KIND)
            .map(|(n, _)| n == 0)
            .unwrap_or(false);
        if empty {
            if let Some(url) = self.cfg.usgs_bootstrap_url.clone() {
                outcomes.push(self.ingest_usgs_url(store, &url).await);
            }
        }
        let url = self.cfg.usgs_feed_url.clone();
        outcomes.push(self.ingest_usgs_url(store, &url).await);
        outcomes
    }

    async fn ingest_usgs_url(&self, store: &Mutex<Store>, url: &str) -> FetchOutcome {
        let started = Instant::now();
        let started_at = now_ms();
        let http = self.get(url).await;
        let mut out = FetchOutcome {
            source_id: usgs::SOURCE_ID.into(),
            endpoint: url.into(),
            started_at,
            http_status: http.status,
            ..Default::default()
        };
        match (http.body, http.error) {
            (Some(body), None) => match usgs::parse_feed(&body) {
                Ok(parsed) => {
                    out.records_seen = (parsed.records.len() + parsed.invalid.len()) as u64;
                    out.records_invalid = parsed.invalid.len() as u64;
                    for msg in parsed.invalid.iter().take(5) {
                        tracing::warn!(source = usgs::SOURCE_ID, %msg, "invalid record skipped");
                    }
                    let mut s = store.lock().await;
                    match s.ingest_batch(
                        usgs::SOURCE_ID,
                        usgs::LICENSE_CLASS,
                        &parsed.records,
                        now_ms(),
                    ) {
                        Ok(c) => {
                            out.ok = true;
                            out.records_new = c.new;
                            out.records_revised = c.revised;
                            out.records_unchanged = c.unchanged;
                        }
                        Err(e) => out.error = Some(format!("storage: {e}")),
                    }
                }
                Err(e) => out.error = Some(format!("invalid payload: {e}")),
            },
            (_, err) => out.error = err.or(Some("empty body".into())),
        }
        self.finish(store, out, started).await
    }

    /// Fetch each configured group whose last successful download is older than the minimum
    /// refresh interval. Skipped groups produce no fetch_log row.
    pub async fn run_celestrak(&self, store: &Mutex<Store>, force: bool) -> Vec<FetchOutcome> {
        let mut outcomes = Vec::new();
        for group in &self.cfg.celestrak_groups {
            let url = celestrak::group_url(&self.cfg.celestrak_base_url, group);
            if !force {
                let last = store
                    .lock()
                    .await
                    .last_success_at(celestrak::SOURCE_ID, &url)
                    .ok()
                    .flatten();
                if let Some(last) = last {
                    if now_ms() - last < self.cfg.celestrak_min_refresh_ms {
                        tracing::info!(group, "celestrak group fresh enough, skipping download");
                        continue;
                    }
                }
            }
            outcomes.push(self.ingest_celestrak_group(store, group, &url).await);
        }
        outcomes
    }

    async fn ingest_celestrak_group(
        &self,
        store: &Mutex<Store>,
        group: &str,
        url: &str,
    ) -> FetchOutcome {
        let started = Instant::now();
        let started_at = now_ms();
        let http = self.get(url).await;
        let mut out = FetchOutcome {
            source_id: celestrak::SOURCE_ID.into(),
            endpoint: url.into(),
            started_at,
            http_status: http.status,
            ..Default::default()
        };
        match (http.body, http.error) {
            (Some(body), None) => match celestrak::parse_group(&body, group) {
                Ok(parsed) => {
                    out.records_seen = (parsed.records.len() + parsed.invalid.len()) as u64;
                    out.records_invalid = parsed.invalid.len() as u64;
                    let mut s = store.lock().await;
                    match s.ingest_batch(
                        celestrak::SOURCE_ID,
                        celestrak::LICENSE_CLASS,
                        &parsed.records,
                        now_ms(),
                    ) {
                        Ok(c) => {
                            out.ok = true;
                            out.records_new = c.new;
                            out.records_revised = c.revised;
                            out.records_unchanged = c.unchanged;
                        }
                        Err(e) => out.error = Some(format!("storage: {e}")),
                    }
                }
                Err(e) => out.error = Some(format!("invalid payload: {e}")),
            },
            (_, err) => out.error = err.or(Some("empty body".into())),
        }
        self.finish(store, out, started).await
    }

    async fn finish(
        &self,
        store: &Mutex<Store>,
        mut out: FetchOutcome,
        started: Instant,
    ) -> FetchOutcome {
        out.finished_at = now_ms();
        let result = if out.ok { "ok" } else { "error" };
        let labels = [
            ("provider", out.source_id.clone()),
            ("result", result.to_string()),
        ];
        metrics::counter!("harpy_fetch_total", &labels).increment(1);
        metrics::histogram!("harpy_fetch_duration_seconds", "provider" => out.source_id.clone())
            .record(started.elapsed().as_secs_f64());
        for (kind, n) in [
            ("new", out.records_new),
            ("revised", out.records_revised),
            ("unchanged", out.records_unchanged),
            ("invalid", out.records_invalid),
        ] {
            metrics::counter!("harpy_records_total", "provider" => out.source_id.clone(), "outcome" => kind)
                .increment(n);
        }
        if out.ok {
            metrics::gauge!("harpy_provider_last_success_seconds", "provider" => out.source_id.clone())
                .set(out.finished_at as f64 / 1000.0);
            tracing::info!(
                source = %out.source_id, endpoint = %out.endpoint, status = ?out.http_status,
                seen = out.records_seen, new = out.records_new, revised = out.records_revised,
                invalid = out.records_invalid, "fetch ok"
            );
        } else {
            tracing::warn!(
                source = %out.source_id, endpoint = %out.endpoint, status = ?out.http_status,
                error = ?out.error, "fetch failed"
            );
        }
        if let Err(e) = store.lock().await.record_fetch(&out) {
            tracing::error!(error = %e, "could not record fetch outcome");
        }
        out
    }
}
