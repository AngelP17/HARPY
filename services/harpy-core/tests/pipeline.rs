//! Integration lane: real processes, real SQLite files, real HTTP.
//!
//! A local HTTP server replays RECORDED REAL-SOURCE FIXTURES (tests/fixtures) in place of the
//! upstream providers. This proves the pipeline end to end deterministically; it does not prove
//! today's upstream is reachable. That is the job of the live-acceptance workflow.

use axum::body::Body;
use axum::http::{Request, StatusCode};
use axum::routing::get;
use axum::Router;
use harpy_core::api::{self, AppState};
use harpy_core::db::Store;
use harpy_core::export::{Builder, DeploymentInfo};
use harpy_core::model::ProviderState;
use harpy_core::providers::{Ingestor, ProviderConfig};
use harpy_core::status;
use http_body_util::BodyExt;
use serde_json::Value;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tower::ServiceExt;

const USGS: &str =
    include_str!("../../../tests/fixtures/usgs/significant_month.2026-10-21.subset.geojson");
const ISS: &str = include_str!("../../../tests/fixtures/celestrak/iss.2020-07-12.omm.json");

/// Fixture upstream. `/usgs` serves the recorded feed; after `revise` is set it serves the same
/// feed with the first event's magnitude and `updated` changed, as USGS does on review.
async fn fixture_upstream(revise: Arc<AtomicUsize>, fail: Arc<AtomicUsize>) -> String {
    let usgs = move || {
        let revise = revise.clone();
        let fail = fail.clone();
        async move {
            if fail.load(Ordering::SeqCst) > 0 {
                return (
                    StatusCode::SERVICE_UNAVAILABLE,
                    "upstream maintenance".to_string(),
                );
            }
            let mut v: Value = serde_json::from_str(USGS).unwrap();
            if revise.load(Ordering::SeqCst) > 0 {
                v["features"][0]["properties"]["mag"] = Value::from(6.4);
                v["features"][0]["properties"]["updated"] = Value::from(1_792_480_000_000_i64);
            }
            (StatusCode::OK, v.to_string())
        }
    };
    let app = Router::new()
        .route("/usgs", get(usgs))
        .route("/gp.php", get(|| async { ISS.to_string() }))
        .route("/garbage", get(|| async { "<html>not json</html>" }));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    format!("http://{addr}")
}

fn cfg(base: &str) -> ProviderConfig {
    ProviderConfig {
        enable_usgs: true,
        usgs_feed_url: format!("{base}/usgs"),
        usgs_bootstrap_url: None,
        enable_celestrak: true,
        celestrak_base_url: format!("{base}/gp.php"),
        celestrak_groups: vec!["stations".into()],
        celestrak_min_refresh_ms: 2 * 3_600_000,
        user_agent: "harpy-test".into(),
        http_timeout: Duration::from_secs(5),
        max_attempts: 1,
    }
}

fn deploy() -> DeploymentInfo {
    DeploymentInfo {
        mode: "static-archive",
        refresh_interval_s: 900,
        stale_after_s: 2700,
        retention_days: 36500,
        commit: None,
    }
}

async fn get_json(app: &Router, uri: &str) -> (StatusCode, Value) {
    let resp = app
        .clone()
        .oneshot(Request::get(uri).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let status = resp.status();
    let bytes = resp.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[tokio::test]
async fn ingest_revise_restart_outage_export_serve() {
    let revise = Arc::new(AtomicUsize::new(0));
    let fail = Arc::new(AtomicUsize::new(0));
    let base = fixture_upstream(revise.clone(), fail.clone()).await;
    let dir = tempfile::tempdir().unwrap();
    let db = dir.path().join("harpy.sqlite");

    // 1. First ingest: 3 earthquakes, 1 element set, all revision 1.
    {
        let store = Mutex::new(Store::open(&db).unwrap());
        let ing = Ingestor::new(cfg(&base)).unwrap();
        let usgs = ing.run_usgs(&store).await;
        assert!(usgs[0].ok, "{:?}", usgs[0].error);
        assert_eq!(usgs[0].records_new, 3);
        let ct = ing.run_celestrak(&store, false).await;
        assert_eq!(ct.len(), 1);
        assert!(ct[0].ok && ct[0].records_new == 1);
        // Refresh throttle: a second run within 2h downloads nothing.
        assert!(ing.run_celestrak(&store, false).await.is_empty());
        // Same feed again: nothing new, nothing revised.
        let again = ing.run_usgs(&store).await;
        assert_eq!(
            (
                again[0].records_new,
                again[0].records_revised,
                again[0].records_unchanged
            ),
            (0, 0, 3)
        );
    }

    // 2. Restart: reopen the file, everything is still there and identical.
    let before = Store::open(&db).unwrap().latest_all("earthquake").unwrap();
    {
        let store = Store::open(&db).unwrap();
        assert_eq!(store.integrity_check().unwrap(), "ok");
        assert_eq!(store.latest_all("earthquake").unwrap(), before);
        assert_eq!(store.count("orbital_elements").unwrap(), (1, 1));
    }

    // 3. Upstream revises an event: revision 2 is appended, revision 1 is preserved.
    revise.store(1, Ordering::SeqCst);
    {
        let store = Mutex::new(Store::open(&db).unwrap());
        let ing = Ingestor::new(cfg(&base)).unwrap();
        let out = ing.run_usgs(&store).await;
        assert_eq!((out[0].records_new, out[0].records_revised), (0, 1));
        let hist = store.lock().await.history("usgs:us6000u3jl").unwrap();
        assert_eq!(hist.len(), 2);
        assert_eq!(hist[0].attributes["mag"], Value::from(6.3));
        assert_eq!(hist[1].attributes["mag"], Value::from(6.4));
        assert_ne!(hist[0].raw_payload_digest, hist[1].raw_payload_digest);
        // The raw upstream record behind each revision is retrievable.
        let raw = store
            .lock()
            .await
            .raw_record(&hist[0].raw_payload_digest)
            .unwrap()
            .unwrap();
        assert_eq!(raw["properties"]["mag"], Value::from(6.3));
    }

    // 4. Outage: two failed fetches -> UNAVAILABLE, stored observations untouched, nothing synthesized.
    fail.store(1, Ordering::SeqCst);
    {
        let store = Mutex::new(Store::open(&db).unwrap());
        let ing = Ingestor::new(cfg(&base)).unwrap();
        let o1 = ing.run_usgs(&store).await;
        let o2 = ing.run_usgs(&store).await;
        assert!(!o1[0].ok && !o2[0].ok);
        assert_eq!(o2[0].http_status, Some(503));
        let s = store.lock().await;
        let usgs = status::all(&s)
            .unwrap()
            .into_iter()
            .find(|p| p.info.source_id == "usgs")
            .unwrap();
        assert_eq!(usgs.state, ProviderState::Unavailable);
        assert_eq!(usgs.consecutive_failures, 2);
        assert!(usgs.last_success_at.is_some());
        assert_eq!(s.count("earthquake").unwrap(), (3, 4));
    }

    // 5. HTTP 200 with a garbage body is a failure, not data.
    {
        let store = Mutex::new(Store::open(dir.path().join("garbage.sqlite")).unwrap());
        let mut c = cfg(&base);
        c.usgs_feed_url = format!("{base}/garbage");
        let out = Ingestor::new(c).unwrap().run_usgs(&store).await;
        assert!(!out[0].ok);
        assert!(out[0].error.as_deref().unwrap().contains("invalid payload"));
    }

    // 6. Static export writes the full document set with provenance intact.
    let out_dir = dir.path().join("site");
    {
        let store = Store::open(&db).unwrap();
        let d = deploy();
        let b = Builder {
            store: &store,
            now: harpy_core::now_ms(),
            deploy: &d,
        };
        let summary = b.write_all(&out_dir).unwrap();
        assert!(summary.files >= 7);
    }
    let read = |rel: &str| -> Value {
        serde_json::from_slice(&std::fs::read(out_dir.join("data/v1").join(rel)).unwrap()).unwrap()
    };
    let meta = read("meta.json");
    assert_eq!(meta["contract_version"], "harpy.observation/1");
    assert_eq!(meta["counts"]["earthquakes"], 3);
    assert_eq!(meta["deployment"]["mode"], "static-archive");
    let providers = read("providers.json");
    assert_eq!(providers["providers"][0]["state"], "UNAVAILABLE");
    assert_eq!(providers["providers"][1]["state"], "HEALTHY");
    let index = read("earthquakes/index.json");
    let vanuatu_day = index["days"]
        .as_array()
        .unwrap()
        .iter()
        .find(|d| d["date"] == "2026-10-20")
        .expect("day present");
    assert_eq!(vanuatu_day["count"], 1);
    let day = read("earthquakes/day/2026-10-20.json");
    let ev = &day["observations"][0];
    assert_eq!(ev["observation_id"], "usgs:us6000u3jl");
    assert_eq!(ev["revision"], 2);
    assert_eq!(ev["observation_type"], "measured");
    assert_eq!(ev["history"].as_array().unwrap().len(), 2);
    assert_eq!(ev["license_class"], "public-domain-us-gov");
    assert!(ev["raw_payload_digest"].as_str().unwrap().len() == 64);
    let sats = read("satellites/latest.json");
    assert_eq!(
        sats["observations"][0]["attributes"]["omm"]["NORAD_CAT_ID"],
        25544
    );

    // 7. The live server renders the same documents and computes calculated positions.
    let app = api::router(
        AppState {
            db_path: Arc::new(db.clone()),
            deploy: Arc::new(deploy()),
            metrics: None,
        },
        None,
    );
    let (code, served_index) = get_json(&app, "/data/v1/earthquakes/index.json").await;
    assert_eq!(code, StatusCode::OK);
    assert_eq!(served_index["days"], index["days"]);
    let (code, served_day) = get_json(&app, "/data/v1/earthquakes/day/2026-10-20.json").await;
    assert_eq!(code, StatusCode::OK);
    assert_eq!(served_day["observations"][0]["revision"], 2);
    assert_eq!(
        get_json(&app, "/data/v1/earthquakes/day/2026-13-40.json")
            .await
            .0,
        StatusCode::NOT_FOUND
    );
    assert_eq!(
        get_json(&app, "/data/v1/../../etc/passwd").await.0,
        StatusCode::NOT_FOUND
    );
    let (code, ready) = get_json(&app, "/ready").await;
    assert_eq!(
        (code, ready["integrity"].as_str()),
        (StatusCode::OK, Some("ok"))
    );
    let (_, hist) = get_json(&app, "/api/v1/observations/usgs:us6000u3jl/history").await;
    assert_eq!(hist["revisions"].as_array().unwrap().len(), 2);
    assert_eq!(hist["revisions"][0]["raw_record"]["id"], "us6000u3jl");

    let iss_epoch = 1_594_516_747_402_i64;
    let (_, pos) = get_json(
        &app,
        &format!(
            "/api/v1/satellites/25544/position?t={}",
            iss_epoch + 600_000
        ),
    )
    .await;
    assert_eq!(pos["display_state"], "CALCULATED");
    assert_eq!(pos["observation_type"], "calculated");
    assert_eq!(pos["evidence_refs"][0], "celestrak:25544@1");
    let alt_m = pos["geometry"]["coordinates"][2].as_f64().unwrap();
    assert!((350_000.0..460_000.0).contains(&alt_m), "{alt_m}");
    // Outside the 3-day window there is no defensible position: withheld, not extrapolated.
    let (_, far) = get_json(
        &app,
        &format!(
            "/api/v1/satellites/25544/position?t={}",
            iss_epoch + 4 * 86_400_000
        ),
    )
    .await;
    assert_eq!(far["display_state"], "INSUFFICIENT_EVIDENCE");
    assert!(far.get("geometry").is_none());
}

#[tokio::test]
async fn backup_produces_consistent_copy() {
    let dir = tempfile::tempdir().unwrap();
    let db = dir.path().join("a.sqlite");
    let base = fixture_upstream(Arc::new(AtomicUsize::new(0)), Arc::new(AtomicUsize::new(0))).await;
    let store = Mutex::new(Store::open(&db).unwrap());
    Ingestor::new(cfg(&base)).unwrap().run_usgs(&store).await;
    let copy = dir.path().join("backup.sqlite");
    store.lock().await.backup_to(&copy).unwrap();
    let restored = Store::open(&copy).unwrap();
    assert_eq!(restored.integrity_check().unwrap(), "ok");
    assert_eq!(
        restored.latest_all("earthquake").unwrap(),
        store.lock().await.latest_all("earthquake").unwrap()
    );
}
