use anyhow::{anyhow, bail, Context, Result};
use harpy_core::export::{Builder, DeploymentInfo};
use harpy_core::providers::{Ingestor, ProviderConfig};
use harpy_core::{api, db::Store, now_ms, orbit, Retention};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

const USAGE: &str = "harpy-core <command> [--flag value]...

Commands:
  serve    --db PATH [--bind 127.0.0.1:8080] [--web DIR]   Run scheduler + read-only API (+ static web)
  ingest   --db PATH [--only usgs|celestrak] [--force-celestrak]
                                                          One ingestion cycle, then exit
  export   --db PATH --out DIR                              Write data/v1 documents (static archive)
  check    --db PATH                                        Integrity check + counts
  backup   --db PATH --to FILE                              Consistent single-file copy (VACUUM INTO)
  position --db PATH --norad N [--at UNIX_MS]               SGP4 position from stored elements

Exit codes: 0 success; 1 usage/storage error; 2 `ingest` where every attempted fetch failed.
Environment: see docs/operations/configuration.md";

fn parse_flags(args: &[String]) -> Result<HashMap<String, String>> {
    let mut map = HashMap::new();
    let mut i = 0;
    while i < args.len() {
        let key = args[i]
            .strip_prefix("--")
            .ok_or_else(|| anyhow!("unexpected argument {}", args[i]))?;
        if key.starts_with("force") {
            map.insert(key.to_string(), "true".to_string());
            i += 1;
            continue;
        }
        let val = args
            .get(i + 1)
            .ok_or_else(|| anyhow!("--{key} needs a value"))?;
        map.insert(key.to_string(), val.clone());
        i += 2;
    }
    Ok(map)
}

fn deployment(mode: &'static str, refresh_s: u64) -> DeploymentInfo {
    let env_u64 = |k: &str, d: u64| {
        std::env::var(k)
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(d)
    };
    DeploymentInfo {
        mode,
        refresh_interval_s: env_u64("HARPY_REFRESH_INTERVAL_SECS", refresh_s),
        stale_after_s: env_u64("HARPY_STALE_AFTER_SECS", refresh_s * 3),
        retention_days: Retention::from_env().earthquake_days,
        commit: std::env::var("HARPY_COMMIT").ok().filter(|s| !s.is_empty()),
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "harpy_core=info,tower_http=info".into()),
        )
        .with(
            tracing_subscriber::fmt::layer()
                .json()
                .with_writer(std::io::stderr),
        )
        .init();
    match run().await {
        Ok(code) => std::process::exit(code),
        Err(e) => {
            tracing::error!(error = %format!("{e:#}"), "fatal");
            eprintln!("error: {e:#}");
            std::process::exit(1);
        }
    }
}

async fn run() -> Result<i32> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let Some(cmd) = args.first().cloned() else {
        println!("{USAGE}");
        return Ok(1);
    };
    let flags = parse_flags(&args[1..])?;
    let db_path = || -> Result<PathBuf> {
        flags
            .get("db")
            .map(PathBuf::from)
            .ok_or_else(|| anyhow!("--db is required\n\n{USAGE}"))
    };

    match cmd.as_str() {
        "serve" => {
            let db = db_path()?;
            let bind = flags
                .get("bind")
                .cloned()
                .unwrap_or_else(|| "127.0.0.1:8080".into());
            let web = flags.get("web").map(PathBuf::from);
            let usgs_interval = std::env::var("HARPY_USGS_INTERVAL_SECS")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(60u64);
            let handle =
                metrics_exporter_prometheus::PrometheusBuilder::new().install_recorder()?;
            let store = Arc::new(Mutex::new(Store::open(&db)?));
            let ingestor = Ingestor::new(ProviderConfig::from_env())?;
            tokio::spawn(harpy_core::run_scheduler(
                store.clone(),
                ingestor,
                Retention::from_env(),
                Duration::from_secs(usgs_interval.max(30)),
            ));
            let state = api::AppState {
                db_path: Arc::new(db),
                deploy: Arc::new(deployment("live-server", usgs_interval)),
                metrics: Some(handle),
            };
            let listener = tokio::net::TcpListener::bind(&bind)
                .await
                .with_context(|| format!("binding {bind}"))?;
            tracing::info!(%bind, "harpy-core serving (read-only)");
            axum::serve(listener, api::router(state, web))
                .with_graceful_shutdown(async {
                    let _ = tokio::signal::ctrl_c().await;
                })
                .await?;
            Ok(0)
        }
        "ingest" => {
            let mut cfg = ProviderConfig::from_env();
            match flags.get("only").map(String::as_str) {
                Some("usgs") => cfg.enable_celestrak = false,
                Some("celestrak") => cfg.enable_usgs = false,
                Some(other) => bail!("unknown provider {other}"),
                None => {}
            }
            let store = Mutex::new(Store::open(db_path()?)?);
            let ingestor = Ingestor::new(cfg)?;
            let mut outcomes = vec![];
            if ingestor.cfg.enable_usgs {
                outcomes.extend(ingestor.run_usgs(&store).await);
            }
            if ingestor.cfg.enable_celestrak {
                outcomes.extend(
                    ingestor
                        .run_celestrak(&store, flags.contains_key("force-celestrak"))
                        .await,
                );
            }
            harpy_core::apply_retention(&store, &Retention::from_env()).await?;
            println!("{}", serde_json::to_string_pretty(&outcomes)?);
            // A failed fetch is recorded data, not a crash. Exit 2 only when nothing worked,
            // so the scheduled job still exports the honest UNAVAILABLE state.
            let attempted = !outcomes.is_empty();
            Ok(if attempted && outcomes.iter().all(|o| !o.ok) {
                2
            } else {
                0
            })
        }
        "export" => {
            let out = flags
                .get("out")
                .map(PathBuf::from)
                .ok_or_else(|| anyhow!("--out is required"))?;
            let store = Store::open(db_path()?)?;
            let deploy = deployment("static-archive", 900);
            let b = Builder {
                store: &store,
                now: now_ms(),
                deploy: &deploy,
            };
            let summary = b.write_all(&out)?;
            println!(
                "{{\"files_written\": {}, \"out\": {:?}}}",
                summary.files, out
            );
            Ok(0)
        }
        "check" => {
            let store = Store::open(db_path()?)?;
            let integrity = store.integrity_check()?;
            let eq = store.count("earthquake")?;
            let el = store.count("orbital_elements")?;
            println!(
                "{}",
                serde_json::json!({"integrity": integrity, "earthquakes": eq.0, "earthquake_revisions": eq.1,
                    "satellites": el.0, "element_revisions": el.1})
            );
            Ok(if integrity == "ok" { 0 } else { 1 })
        }
        "backup" => {
            let to = flags
                .get("to")
                .map(PathBuf::from)
                .ok_or_else(|| anyhow!("--to is required"))?;
            let store = Store::open(db_path()?)?;
            store.backup_to(&to)?;
            let copy = Store::open_read_only(&to)?;
            let integrity = copy.integrity_check()?;
            println!(
                "{}",
                serde_json::json!({"backup": to, "integrity": integrity})
            );
            Ok(if integrity == "ok" { 0 } else { 1 })
        }
        "position" => {
            let store = Store::open(db_path()?)?;
            let norad: u64 = flags
                .get("norad")
                .ok_or_else(|| anyhow!("--norad is required"))?
                .parse()?;
            let at: i64 = flags
                .get("at")
                .map(|v| v.parse())
                .transpose()?
                .unwrap_or_else(now_ms);
            let revs = store.history(&format!("celestrak:{norad}"))?;
            let el = revs
                .iter()
                .min_by_key(|r| (r.observed_at - at).abs())
                .ok_or_else(|| anyhow!("no elements for {norad}"))?;
            let elements: sgp4::Elements = serde_json::from_value(el.attributes["omm"].clone())?;
            let p = orbit::propagate(&elements, at)?;
            println!("{}", serde_json::to_string_pretty(&p)?);
            Ok(0)
        }
        "help" | "--help" | "-h" => {
            println!("{USAGE}");
            Ok(0)
        }
        other => bail!("unknown command {other}\n\n{USAGE}"),
    }
}
