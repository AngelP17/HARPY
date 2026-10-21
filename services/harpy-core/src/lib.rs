//! HARPY core: real-source ingestion, observation store, SGP4, replay documents, read-only API.

pub mod api;
pub mod db;
pub mod export;
pub mod model;
pub mod orbit;
pub mod providers;
pub mod status;

use providers::{celestrak, usgs, Ingestor};
use std::time::Duration;
use tokio::sync::Mutex;

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

#[derive(Debug, Clone)]
pub struct Retention {
    pub earthquake_days: i64,
    pub elements_days: i64,
    pub fetch_log_days: i64,
}

impl Retention {
    pub fn from_env() -> Self {
        let get = |k: &str, d: i64| {
            std::env::var(k)
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(d)
        };
        Self {
            earthquake_days: get("HARPY_RETENTION_EARTHQUAKE_DAYS", 30),
            elements_days: get("HARPY_RETENTION_ELEMENTS_DAYS", 14),
            fetch_log_days: get("HARPY_RETENTION_FETCH_LOG_DAYS", 14),
        }
    }
}

pub async fn apply_retention(store: &Mutex<db::Store>, r: &Retention) -> anyhow::Result<()> {
    let now = now_ms();
    let day = 86_400_000;
    let mut s = store.lock().await;
    let eq = s.prune(usgs::KIND, now - r.earthquake_days * day)?;
    let el = s.prune(celestrak::KIND, now - r.elements_days * day)?;
    let fl = s.prune_fetch_log(now - r.fetch_log_days * day)?;
    if eq + el + fl > 0 {
        tracing::info!(
            earthquakes = eq,
            elements = el,
            fetch_log = fl,
            "retention pruned rows"
        );
    }
    Ok(())
}

/// The long-running scheduler used by `serve`.
pub async fn run_scheduler(
    store: std::sync::Arc<Mutex<db::Store>>,
    ingestor: Ingestor,
    retention: Retention,
    usgs_interval: Duration,
) {
    let mut usgs_tick = tokio::time::interval(usgs_interval);
    let mut celestrak_tick = tokio::time::interval(Duration::from_secs(600));
    let mut maintenance_tick = tokio::time::interval(Duration::from_secs(3600));
    usgs_tick.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
    loop {
        tokio::select! {
            _ = usgs_tick.tick(), if ingestor.cfg.enable_usgs => { ingestor.run_usgs(&store).await; }
            _ = celestrak_tick.tick(), if ingestor.cfg.enable_celestrak => { ingestor.run_celestrak(&store, false).await; }
            _ = maintenance_tick.tick() => {
                if let Err(e) = apply_retention(&store, &retention).await {
                    tracing::error!(error = %e, "retention failed");
                }
            }
        }
    }
}
