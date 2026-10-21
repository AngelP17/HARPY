# HARPY: Engineering Directive (v3, reviewed)

You are working on two existing repositories owned by Angel Pinzon:

- `AngelP17/HARPY` (destination repo, canonical product)
- `AngelP17/geowraith` (visual geolocation engine, imported in Milestone B)

The goal is ONE finished product: HARPY, a geospatial monitoring and investigation platform running on real, attributed data and real model inference. GeoWraith becomes a module inside it, not a second product.

The owner works a full-time job. Optimize for small, mergeable, verifiable PRs over ambitious parallel work.

---

## 1. Milestones

### Milestone A: HARPY Monitor v0.1 (public alpha)

A stranger can open a public, read-only URL and:

1. See real USGS earthquakes and real satellite positions (SGP4-propagated from CelesTrak) on a Cesium globe.
2. See per-provider health that reflects reality, including outages.
3. Scrub a timeline and replay what HARPY actually recorded, reconstructed from persisted observations.
4. Click any object and see its observation type, source, upstream ID, observed time, ingested time, and license.

Plus a public write-up covering architecture, failure handling, and known limitations.

Aircraft data is NOT a blocker for Milestone A. Add it when permitted, reliable access is confirmed.

Milestone A ships publicly regardless of GeoWraith's status.

### Milestone B: HARPY Unified v1.0

Everything in Milestone A, plus:

1. GeoWraith running real model inference on uploaded images, passing the accuracy gate (section 6).
2. Saved investigations linking events, images, inference results, and notes, surviving restart.
3. Reproducible report export (JSON + PDF) with sources, model versions, and unresolved questions.

HARPY is not called 1.0 until Milestone B is complete.

---

## 2. Non-negotiable rules

1. **No fabricated data in production paths.** No mock streams, synthetic tracks, deterministic fallback embeddings, or placeholder inference shown to users as real. If a source is down, show `SOURCE_UNAVAILABLE`. If data is old, show it with its original timestamp and a STALE state.
2. **Fixtures are for tests only.** Recorded real-source fixtures live under `tests/fixtures/`, are labeled as fixtures, and cannot be loaded by a production build. A demo mode, if it exists at all, must be an explicit user action with a persistent on-screen DEMO banner.
3. **Truth vs interpretation is a first-class concept** in backend contracts, UI, and exported reports (see section 3).
4. **Health is separate from content.** A successful response with zero events is healthy. An HTTP 200 with an invalid payload is unhealthy.
5. **Visual effects are labeled as visual effects.** The existing EO/NVG/FLIR modes are shaders, not sensors. Keep the visual identity, but relabel them (e.g. "Night style", "Thermal style") so nothing implies real sensor data.
6. **Respect provider terms.** Remove OpenSky as default (needs written permission for this use). For aircraft, use adsb.lol only after the owner confirms production use with the operator; record that in `docs/providers.md`. Respect OSM tile policy and Cesium ion terms. Document every provider's terms in `docs/providers.md`.
7. **No new infrastructure without a measured need.** No Redis, Postgres, Kubernetes, or extra microservices. Rust backend + SQLite (WAL) + Next.js/Cesium frontend + (Milestone B) a loopback-only GeoWraith worker.
8. **Public deployment is read-only** until abuse protection exists. Investigation creation, image upload, and inference are authenticated, rate-limited, and budget-capped. No anonymous paid AI calls, ever.
9. **No public camera feeds** before Milestone B. If added later, only official sources with documented APIs and terms (e.g. DOT/511 feeds, Windy Webcams API). Never scraped or unsecured cameras.
10. **Don't copy AGPL code.** World Monitor is a design reference only.
11. **A feature is done only with runtime evidence:** a passing test, a recent successful live run, and a demonstrated failure path. Never on the basis of fixtures alone or because the UI renders.

---

## 3. Observation contract (designed once, used by every source)

One `observations` table (append-only) and matching protobuf/JSON schemas. Typed core fields, plus a JSON `attributes` column for source-specific data. Do not build a generic everything-schema beyond this.

| Field | Purpose |
|---|---|
| `observation_id` | Stable HARPY identity |
| `revision` | Corrections create a new revision; history is never overwritten |
| `observation_type` | `measured` / `calculated` / `inferred` / `asserted` |
| `source_id` | Provider (e.g. `usgs`, `celestrak`) or model (e.g. `geowraith-geoclip`) |
| `upstream_id` | Provider's own record ID, when one exists |
| `observed_at` | When the source says it happened (or, for calculated, the propagation time) |
| `source_updated_at` | When the source last updated the record |
| `ingested_at` | When HARPY received it |
| `geometry` | GeoJSON point/area, WGS84 |
| `uncertainty` | Spatial/statistical uncertainty, nullable |
| `evidence_refs` | IDs of supporting records (e.g. the TLE used, the image hash) |
| `model_version` | Model + index version for inferred observations, nullable |
| `license_class` | From `docs/providers.md` |
| `source_url` | Link back to the source |
| `raw_payload_digest` | SHA-256 of the stored raw payload |
| `attributes` | JSON, source-specific (magnitude, NORAD ID, etc.) |

Plus a `provider_status` table and a documented retention policy.

### Display states (backend, UI, and reports must all carry these)

| State | Meaning |
|---|---|
| Live observation | Fresh source record, source and time identifiable |
| Stale observation | Last known genuine record, visibly outdated |
| Calculated position | SGP4-propagated from identified orbital elements (with element epoch) |
| AI inference | Ranked hypothesis with model version and uncertainty |
| Source unavailable | Provider failed; no simulated replacement |
| Insufficient evidence | No defensible conclusion; no coordinates shown |

---

## 4. Step 0: Audit before code (first deliverable)

Work on a new branch. Make no implementation changes. Produce `docs/audit/2026-10-current-state.md` containing:

- Entry points, services, ports, and how each is started (`make dev`, `make prod-ready-local`, compose files).
- Every backend that exists (there may be more than one competing implementation under `services/` and `crates/`), which is actually used, and which is dead.
- Every place mock or synthetic data can reach the UI. Known suspects to verify, not assume:
  - `NEXT_PUBLIC_STREAM_MODE=hybrid` and `MockStreamer` in `apps/web`
  - automatic mock fallback in `services/harpy-node` when provider auth fails
  - simplified orbital math in `services/harpy-node/src/adapters/tle_celestrak.rs`
- Current test results (pass/fail, and what each test actually exercises: fixture vs live).
- The WebSocket protobuf contract in `proto/` and the gap to the section 3 contract.
- Same inventory for `geowraith`: model loading paths, fallback tiers, index build, ports, CORS, benchmark scripts.
- An ADR at `docs/decisions/0001-canonical-architecture.md`: what to keep, merge, replace, retire.

Stop after the audit and wait for owner review.

---

## 5. Milestone A PRs (target ~5 weeks part-time)

One PR at a time, in order. Each keeps `main` buildable.

| # | PR | Acceptance proof |
|---|----|------------------|
| 1 | **Contracts + ADR.** Implement the section 3 schemas (protobuf for stream, JSON schema for HTTP). | Schema docs merged; existing app still builds and runs. |
| 2 | **SQLite storage.** WAL mode, migrations, append-only observations with revisions, provider_status, retention job. | Write, restart, read back identically; revision test preserves history. |
| 3 | **Kill production mocks + display states.** Remove mock fallback from production builds; implement the six display states in the UI. | Kill network to a provider: UI shows Source unavailable, zero synthetic objects appear. CI check that the production bundle does not import mock modules. |
| 4 | **USGS adapter.** Polling with backoff, dedupe on upstream ID, updates become revisions. | Live test: IDs match the USGS feed; timestamps preserved; outage test passes. |
| 5 | **CelesTrak + SGP4.** GP/OMM ingest, tested SGP4 (e.g. `sgp4` Rust crate), correct TEME to geodetic. Positions are `calculated`, with element epoch in evidence_refs; STALE when elements are old. | Unit tests against SGP4 verification vectors; ISS position within tolerance of an independent reference at a fixed time. |
| 6 | **Replay.** Playback reconstructed only from stored observations, with periodic snapshots. Out-of-range requests return "history unavailable". | Record 10 min live, replay, positions match stored records exactly. |
| 7 | **Observability.** Structured logs with request IDs, Prometheus metrics per provider (latency, errors, records, freshness), checked-in Grafana dashboard. | Dashboard screenshot during a simulated provider outage. |
| 8 | **Read-only public deploy.** Small VPS, TLS reverse proxy, backend on loopback, rate limiting, no write or upload endpoints exposed, scheduled SQLite backups. | Public URL live; restore-from-backup drill documented in `docs/operations/`. |
| 9 | **Docs + write-up.** README matches reality, `docs/providers.md`, runbook, known limitations, draft blog post. | Owner review. |
| 10 | **Aircraft (non-blocking).** adsb.lol adapter once access is confirmed. Per-aircraft last-seen, STALE then removal on a defined TTL. | Live test with real ICAO hex IDs; TTL behavior tested. |

### Core acceptance scenario (automated)

A real-source record enters HARPY, is validated and stored, appears on the Cesium map, can be selected, survives a backend restart, and reappears correctly when replaying its time window. Runs in CI against recorded real-source fixtures, and separately in the live lane against today's upstream.

### Test lanes (keep them separate)

- **CI:** unit + contract + core scenario using recorded real-source fixtures. Deterministic. Never depends on an external API being up.
- **Integration:** real processes, real SQLite, real WebSocket between backend and frontend.
- **Live acceptance:** hits real providers, validates IDs, timestamps, freshness. Scheduled. Only this lane can claim "live data works."

---

## 6. Milestone B: GeoWraith + investigations

Start only when the owner says go, after Milestone A is deployed.

### B1. Evaluation and accuracy gate (before any integration)

1. Evaluate current GeoWraith on Im2GPS3k (optionally YFCC4k) so results are comparable to published GeoCLIP numbers.
2. Check for leakage between the anchor/reference corpus and the test set; report what was removed.
3. Report accuracy at 1 / 25 / 200 / 750 / 2500 km, abstention rate, and accuracy on accepted (non-abstained) predictions.
4. The existing 56/58 result is historical only.

**Release thresholds are set by the owner BEFORE running the benchmark and recorded in `docs/decisions/`.** Placeholders to fill in:

- Accuracy on accepted predictions at 25 km: `____`
- Accuracy on accepted predictions at 200 km: `____`
- Maximum abstention rate: `____`

If the gate fails, Milestone B ships with region-level output and stronger abstention, or GeoWraith stays experimental. It does not ship with inflated claims.

### B2. Reproducible model setup

Script downloads ONNX weights and builds the index with checksums, licenses, and a version ID. Fix `.cache` path handling. Missing weights disable the feature with an explicit UI state. Remove the deterministic fallback and CLIP-text fallback from user-facing paths.

### B3. Inference seams (no multi-model gateway)

```typescript
// Required. GeoCLIP + reference index.
interface CandidateGenerator {
  generate(input: { image: Buffer; imageSha256: string }): Promise<{
    candidates: GeographicCandidate[]; // ranked, with scores
    modelVersion: string;
    indexVersion: string;
  }>;
}

// Optional. Starts as `disabled`.
interface CandidateReranker {
  rerank(input: {
    image: Buffer;
    candidates: GeographicCandidate[];
    evidence: EvidenceRecord[];
  }): Promise<{
    candidates: GeographicCandidate[];
    rationale: string[];      // visual cues cited
    modelVersion: string;
  } | { state: "disabled" | "unavailable" }>;
}
```

A cloud reranker is enabled only if the B1 benchmark shows it measurably improves accuracy or calibration. Pick one model based on fresh provider quotes and measured cost per correct answer. No price router, no model tournament.

### B4. Private worker

GeoWraith runs on loopback (e.g. `127.0.0.1:8090`, resolving the current 8080 collision). Remove `Access-Control-Allow-Origin: *`. HARPY Core is the only entry point. Enforce upload size limits and format validation; never fetch arbitrary server-side URLs. Uploads and inference require auth, rate limits, and a budget cap.

### B5. Investigations and reports

Saved cases in SQLite linking events, images (by hash), inference results as `inferred` observations, and notes. Report export in JSON + PDF carrying display states, sources, model/index versions, and unresolved questions.

**B acceptance scenario:** a previously unseen image runs through real model weights; its prediction, confidence, provenance, and uncertainty are saved, survive restart, and reproduce identically on rerun with the same model and index versions.

### B6. Framing

GeoWraith is presented as scene and region verification for events and imagery, returning ranked regions with uncertainty or an abstention. It is never marketed or designed for locating private individuals.

Import GeoWraith's backend with preserved Git history (subtree or filter-repo). Retire its marketing frontend. Archive the original repo only after a clean-install test passes.

---

## 7. Out of scope (until after v1.0)

- Multi-model AI gateway, cost routing, model tournaments
- Public or surveillance camera aggregation
- Structure-from-motion and meter-level geolocation claims
- Desktop packaging and installers
- Multi-tenant SaaS, RBAC beyond admin auth
- Visual redesign beyond honest states and provenance display

---

## 8. Working rules for agents

- Read `AGENTS.md`, this file, and the latest audit before starting a task.
- One focused branch and PR per numbered item. No overlapping PRs from multiple agents.
- Run relevant tests before pushing; paste output in the PR description.
- Every PR description includes: what changed, how it was verified (with evidence), failure paths tested, known limitations.
- If a requirement here conflicts with what you find in the code, stop and flag it instead of guessing.
- REA (`morluto/rea`) is optional dev tooling for inspecting HARPY/GeoWraith runtime behavior or open-source references. Do not use it against commercial services we aren't authorized to analyze (e.g. GeoSpy).

---

## 9. First task

Do Step 0 only, on a new branch. Deliver `docs/audit/2026-10-current-state.md` and `docs/decisions/0001-canonical-architecture.md`, then stop for review.
