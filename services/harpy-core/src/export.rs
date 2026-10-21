//! Data documents served to the web app under `data/v1/`.
//!
//! The same builders back both deployments: `harpy-core export` writes them as static files
//! (GitHub Pages archive), `harpy-core serve` renders them per request. The web app has one
//! data path regardless of deployment.

use crate::db::Store;
use crate::model::Observation;
use crate::providers::{celestrak, usgs};
use crate::status;
use anyhow::{bail, Result};
use chrono::{DateTime, NaiveDate, Utc};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::path::Path;

pub const CONTRACT_VERSION: &str = "harpy.observation/1";
const DAY_MS: i64 = 86_400_000;
const HOUR_MS: i64 = 3_600_000;

#[derive(Debug, Clone)]
pub struct DeploymentInfo {
    /// `static-archive` or `live-server`
    pub mode: &'static str,
    /// How often new data is expected to arrive in this deployment.
    pub refresh_interval_s: u64,
    /// After this long without a new snapshot the archive itself is stale.
    pub stale_after_s: u64,
    pub retention_days: i64,
    pub commit: Option<String>,
}

pub struct Builder<'a> {
    pub store: &'a Store,
    pub now: i64,
    pub deploy: &'a DeploymentInfo,
}

pub fn day_of(ms: i64) -> NaiveDate {
    DateTime::<Utc>::from_timestamp_millis(ms)
        .map(|d| d.date_naive())
        .unwrap_or_default()
}

fn day_start_ms(d: NaiveDate) -> i64 {
    d.and_hms_opt(0, 0, 0).unwrap().and_utc().timestamp_millis()
}

pub fn parse_day(s: &str) -> Result<NaiveDate> {
    let d = NaiveDate::parse_from_str(s, "%Y-%m-%d")?;
    if d.format("%Y-%m-%d").to_string() != s {
        bail!("non-canonical date");
    }
    Ok(d)
}

impl<'a> Builder<'a> {
    fn retention_start(&self) -> i64 {
        self.now - self.deploy.retention_days * DAY_MS
    }

    fn days(&self, kind: &str) -> Result<Vec<NaiveDate>> {
        let Some((min, max)) = self.store.observed_range(kind)? else {
            return Ok(vec![]);
        };
        let start = day_of(min.max(self.retention_start()));
        let end = day_of(max.min(self.now + DAY_MS));
        let mut out = vec![];
        let mut d = start;
        while d <= end {
            out.push(d);
            d = d.succ_opt().unwrap();
        }
        Ok(out)
    }

    pub fn meta(&self) -> Result<Value> {
        let (eq_ids, eq_revs) = self.store.count(usgs::KIND)?;
        let (sat_ids, sat_revs) = self.store.count(celestrak::KIND)?;
        let range = |r: Option<(i64, i64)>| {
            r.map(|(a, b)| json!({"from": a, "to": b}))
                .unwrap_or(Value::Null)
        };
        Ok(json!({
            "contract_version": CONTRACT_VERSION,
            "schema_version": crate::db::SCHEMA_VERSION,
            "generated_at": self.now,
            "commit": self.deploy.commit,
            "deployment": {
                "mode": self.deploy.mode,
                "refresh_interval_s": self.deploy.refresh_interval_s,
                "stale_after_s": self.deploy.stale_after_s,
                "retention_days": self.deploy.retention_days,
            },
            "rules": {
                // An element set farther than this from the display time is not propagated.
                "elements_max_offset_s": 3 * 86_400,
                // A provider record is LIVE only while the archive itself is fresh.
                "live_requires_fresh_archive": true,
            },
            "history": {
                "earthquakes_observed": range(self.store.observed_range(usgs::KIND)?),
                "earthquakes_recorded": range(self.store.ingested_range(usgs::KIND)?),
                "elements_epochs": range(self.store.observed_range(celestrak::KIND)?),
                "elements_recorded": range(self.store.ingested_range(celestrak::KIND)?),
            },
            "counts": {
                "earthquakes": eq_ids, "earthquake_revisions": eq_revs,
                "satellites": sat_ids, "element_revisions": sat_revs,
            },
        }))
    }

    pub fn providers(&self) -> Result<Value> {
        Ok(json!({ "generated_at": self.now, "providers": status::all(self.store)? }))
    }

    pub fn fetch_log(&self) -> Result<Value> {
        Ok(json!({ "generated_at": self.now, "entries": self.store.fetch_log(None, 150)? }))
    }

    pub fn earthquake_index(&self) -> Result<Value> {
        let from = self.retention_start();
        let obs = self
            .store
            .latest_in_window(usgs::KIND, from, self.now + DAY_MS)?;
        let mut per_day: BTreeMap<NaiveDate, u64> = BTreeMap::new();
        let mut per_hour: BTreeMap<i64, (u64, f64)> = BTreeMap::new();
        for o in &obs {
            *per_day.entry(day_of(o.observed_at)).or_default() += 1;
            let h = per_hour
                .entry(o.observed_at.div_euclid(HOUR_MS) * HOUR_MS)
                .or_default();
            h.0 += 1;
            if let Some(m) = o.attributes.get("mag").and_then(Value::as_f64) {
                h.1 = h.1.max(m);
            }
        }
        let days: Vec<Value> = self
            .days(usgs::KIND)?
            .into_iter()
            .map(|d| {
                json!({"date": d.to_string(), "count": per_day.get(&d).copied().unwrap_or(0),
                             "path": format!("earthquakes/day/{d}.json")})
            })
            .collect();
        let hourly: Vec<Value> = per_hour
            .into_iter()
            .map(|(h, (n, m))| json!({"hour_start": h, "count": n, "max_mag": m}))
            .collect();
        Ok(json!({ "generated_at": self.now, "days": days, "hourly": hourly }))
    }

    pub fn earthquake_day(&self, day: NaiveDate) -> Result<Value> {
        let start = day_start_ms(day);
        let end = start + DAY_MS - 1;
        let latest = self.store.latest_in_window(usgs::KIND, start, end)?;
        let revisions = self
            .store
            .revisions_in_window(usgs::KIND, start - DAY_MS, end + DAY_MS)?;
        Ok(json!({
            "generated_at": self.now,
            "date": day.to_string(),
            "observations": with_history(latest, &revisions),
        }))
    }

    pub fn satellites_latest(&self) -> Result<Value> {
        Ok(
            json!({ "generated_at": self.now, "observations": self.store.latest_all(celestrak::KIND)? }),
        )
    }

    pub fn satellites_index(&self) -> Result<Value> {
        let days: Vec<Value> = self
            .days(celestrak::KIND)?
            .into_iter()
            .map(|d| json!({"date": d.to_string(), "path": format!("satellites/day/{d}.json")}))
            .collect();
        Ok(json!({ "generated_at": self.now, "days": days }))
    }

    /// Every element-set revision whose epoch falls on `day`, for replay propagation.
    pub fn satellites_day(&self, day: NaiveDate) -> Result<Value> {
        let start = day_start_ms(day);
        let obs = self
            .store
            .revisions_in_window(celestrak::KIND, start, start + DAY_MS - 1)?;
        Ok(json!({ "generated_at": self.now, "date": day.to_string(), "observations": obs }))
    }

    /// Write every document to `<out>/data/v1/`.
    pub fn write_all(&self, out: &Path) -> Result<ExportSummary> {
        let base = out.join("data").join("v1");
        let mut files = 0usize;
        let mut write = |rel: String, v: Value| -> Result<()> {
            let p = base.join(&rel);
            std::fs::create_dir_all(p.parent().unwrap())?;
            let tmp = p.with_extension("json.tmp");
            std::fs::write(&tmp, serde_json::to_vec(&v)?)?;
            std::fs::rename(&tmp, &p)?;
            files += 1;
            Ok(())
        };
        write("meta.json".into(), self.meta()?)?;
        write("providers.json".into(), self.providers()?)?;
        write("fetch-log.json".into(), self.fetch_log()?)?;
        write("earthquakes/index.json".into(), self.earthquake_index()?)?;
        for d in self.days(usgs::KIND)? {
            write(format!("earthquakes/day/{d}.json"), self.earthquake_day(d)?)?;
        }
        write("satellites/latest.json".into(), self.satellites_latest()?)?;
        write("satellites/index.json".into(), self.satellites_index()?)?;
        for d in self.days(celestrak::KIND)? {
            write(format!("satellites/day/{d}.json"), self.satellites_day(d)?)?;
        }
        Ok(ExportSummary { files })
    }
}

#[derive(Debug)]
pub struct ExportSummary {
    pub files: usize,
}

/// Attach a compact revision history to each latest observation.
fn with_history(latest: Vec<Observation>, revisions: &[Observation]) -> Vec<Value> {
    let mut by_id: BTreeMap<&str, Vec<&Observation>> = BTreeMap::new();
    for r in revisions {
        by_id.entry(r.observation_id.as_str()).or_default().push(r);
    }
    latest
        .into_iter()
        .map(|o| {
            let history: Vec<Value> = by_id
                .get(o.observation_id.as_str())
                .map(|revs| {
                    revs.iter()
                        .map(|r| {
                            json!({"revision": r.revision, "ingested_at": r.ingested_at,
                                        "source_updated_at": r.source_updated_at,
                                        "raw_payload_digest": r.raw_payload_digest})
                        })
                        .collect()
                })
                .unwrap_or_default();
            let mut v = serde_json::to_value(&o).unwrap();
            v["history"] = Value::Array(history);
            v
        })
        .collect()
}
