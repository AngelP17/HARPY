# HARPY + GeoWraith: current-state source audit
**Date:** 2026-10-15  
**Scope:** Step 0 of HARPY_DIRECTIVE v3. No implementation changes.  
**Status:** Source inspection completed; executable/runtime verification **not completed**.

## 0. Evidence and limitations

Source snapshots:
- HARPY main: [b35bdf36](https://github.com/AngelP17/HARPY/tree/b35bdf36ef6a66887b7204a79c99ee40a2c120f0), 2026-02-22.
- GeoWraith main: [9a3689bb](https://github.com/AngelP17/geowraith/tree/9a3689bbacd60e5bd64a22d936d003cfa44c020e), 2026-03-25.
- HARPY last [successful CI run](https://github.com/AngelP17/HARPY/actions/runs/22267889103): 2026-02-22, with Lint, Test, Build, Frontend, Smoke, Confidence Gate, Local Prod Readiness, and Refactor Confidence marked success.
- No GeoWraith GitHub Actions workflow runs were returned.
- GitHub source and CI metadata were inspected through the authorized repository connector. This audit environment cannot clone GitHub repositories, execute Rust/Node builds, run browsers, or contact live feeds. **No tests were freshly executed.** Treat CI conclusions as historical, not fresh acceptance.

Classification: **CONFIRMED BY SOURCE** means the cited code/docs clearly establish behavior; **HISTORICAL CI** means GitHub reports a completed run; **NOT VERIFIED** means implementation effectiveness is unknown without execution.

## 1. HARPY launch paths and active architecture

| Entry point | Runtime | Dependencies | Observed role |
|---|---|---|---|
| `make dev` / `scripts/dev.sh` | `cargo run -p harpy-node` on :8080 and Next.js on :3000 | Node/Rust, npm | Primary documented local runtime, mocks default |
| `make prod-local` / `scripts/run_local_prod.sh` | release harpy-node on :8080, Next.js on :3000 | local processes | Builds and starts single-node stack |
| `make prod-ready-local` / `scripts/local_production_readiness.sh` | same single-node stack | local processes, confidence gate | Boot, endpoints, metrics, WS and soak; not live provenance proof |
| `make docker-local-up` | `docker-compose.local.yml` node + web | Docker | Explicitly sets ENABLE_REAL_ADSB=false and ENABLE_REAL_TLE=false |
| `make dev-up` (alias for dev-up-offline) | multi-service compose | PostgreSQL, Redis, MinIO; relay, ingest, fusion, graph, aip | Separate legacy/offline path |
| `make dev-up-online` | multi-service compose with `.env.online` | same + optional live providers | Live flags for ADSB, TLE, seismic, weather, radar; not single-node |
| `make dev-demo` / `npm run dev:demo` | offline seeded/cinematic UI | demos | Explicit synthetic/demo workflow |
| `npm --prefix apps/web run dev:hybrid` | Next.js stream mode hybrid | WS and mock streamer | WS first with mock-capable fallback |

**Canonical candidate:** `services/harpy-node` (Rust/Axum) plus `apps/web` (Next.js/Cesium). Primary single node launches polling loops for ADS-B, TLE, synthetic ground sensors, synthetic ground weather, synthetic ground camera. Actual routes: GET /health, GET /metrics, GET /api/debug/snapshot, GET /ws. It binds 0.0.0.0 on NODE_PORT default 8080.

**Alternative existing stack, not dead:** `services/harpy-relay` (:8080, WS plus GET /seek), `services/harpy-ingest` (:8081, includes real USGS/NWS/NEXRAD adapters), `services/harpy-fusion` (:8082), `services/harpy-graph` (:8083), `services/harpy-aip` (:8084). `docker-compose.yml` launches these with Redis/Postgres/MinIO. They are also exercised by the existing offline CI Smoke lane, so marking them universally dead would be inaccurate. They are **not** part of the primary `make dev` single-node runtime.

Crates include `harpy-proto`, `harpy-core`, `harpy-health`; these support portions of the older/services stack. The precise reachability of every module still needs build artifact/dependency analysis. Leave all code intact at Step 0.

**Conflict:** `AGENTS.md` explicitly says "Demo is never empty: MOCK fallback must keep UI alive" and "Fallback-to-mock on provider errors is mandatory". That directly contradicts Directive v3 (real data, source unavailable). PR 1 must supersede those instructions deliberately. No agent should reconcile the conflict by silently keeping mocks.

Sources: [Makefile](https://github.com/AngelP17/HARPY/blob/main/Makefile), [scripts/dev.sh](https://github.com/AngelP17/HARPY/blob/main/scripts/dev.sh), [harpy-node/src/main.rs](https://github.com/AngelP17/HARPY/blob/main/services/harpy-node/src/main.rs), [multi-service compose](https://github.com/AngelP17/HARPY/blob/main/docker-compose.yml), [AGENTS.md](https://github.com/AngelP17/HARPY/blob/main/AGENTS.md).

## 2. HARPY authentic vs synthetic ingress

| Surface | Source-confirmed behavior | Consequence |
|---|---|---|
| Single-node ADS-B | ENABLE_REAL_ADSB=false default means AdsbMockProvider; failed OpenSky initialization chooses mock | Unusable as reliable operational observation |
| Single-node satellites | ENABLE_REAL_TLE=false default means TleMockProvider; failed CelesTrak initialization chooses mock | Same risk |
| Single-node ground sensor/weather/camera | All use GroundMockProvider unconditionally | Never display as physical measurements |
| Frontend stream | `CesiumViewer.tsx` imports MockStreamer; `NEXT_PUBLIC_STREAM_MODE` defaults to hybrid; mock is available unless mode is online | Live and fake may coexist without a reliable user-facing boundary |
| Playwright | `apps/web/playwright.config.ts` sets `NEXT_PUBLIC_STREAM_MODE=offline` and `NEXT_PUBLIC_E2E_SEED=true`; `phase-proof.spec.ts` intercepts `**/seek?**` and fabricates snapshot ID and delta count | Demonstrates UI behavior, not genuine seek implementation |
| Single-node playback | `Timeline.tsx` calls GET `/seek`; harpy-node has no /seek route | Single-node historical replay lacks matching backend |
| Multi-service playback | harpy-relay does implement GET `/seek` and Postgres-backed seek logic | Useful salvage candidate, but runtime completeness unverified |
| Real USGS | `services/harpy-ingest/src/adapters/seismic_usgs.rs` parses real USGS records | Reuse into canonical node, preserve upstream IDs and update times |
| Real weather/radar | NWS/NEXRAD adapters exist only in older ingestion path | Not present by default in primary single-node runtime |
| Real CelesTrak | CelesTrak adapter does fetch GP/OMM JSON | Positions are currently **not true propagated positions** |

### 2a. Satellite correctness (release blocker)

`services/harpy-node/src/adapters/tle_celestrak.rs` computes latitude via sin(inclination) and sin(mean anomaly), and longitude via RAAN plus mean anomaly. The helper `estimate_position` uses index-seeded defaults when fields are missing; `estimate_orbit` approximates altitude and speed. This is **not SGP4**. The `ts_ms` assigned to the track comes from the element-set epoch, not a defined current propagation timestamp. Must use tested SGP4 + time and coordinate-frame conversion and preserve orbital-element epoch.

Source: [tle_celestrak.rs](https://github.com/AngelP17/HARPY/blob/main/services/harpy-node/src/adapters/tle_celestrak.rs).

### 2b. Live provider failure semantics

`harpy-node` tracks success/failure counts, circuit state, and freshness; these are useful starting points. However a successfully polled mock provider can report FRESH, so current health does not prove source authenticity. No silent alternate source or mocked replacement should enter operational state. Source status, observation quality, and source age must be separate dimensions.

## 3. Wire contracts and v3 gap

Main stream contract: [proto/harpy/v1/harpy.proto](https://github.com/AngelP17/HARPY/blob/main/proto/harpy/v1/harpy.proto). Envelope already includes schema version, TrackDeltaBatch, ProviderStatus, subscription/ack, alerts, and snapshot metadata. TrackDelta has ID, TrackKind, position, heading, speed, timestamp, provider_id, and string-string metadata map. Position carries WGS84 lat/lon/alt. ProviderStatus has provider_id, circuit state, freshness, last success, failures, error and metadata.

**Missing vs Directive v3**: typed measured/calculated/inferred/asserted designation; durable stable observation identity and revision; separated observed/source-updated/ingested timestamps; upstream source ID and URL; raw-payload hash; attribution/license; typed uncertainty; model/index identity and evidence references; GeoJSON area geometry, durable storage; explicit source-unavailable/insufficient-evidence semantics in user views/reports.

**Recommended compatibility policy for PR 1:** keep existing protobuf field numbers stable. Add versioned optional metadata or an additive Observation message rather than repurposing TrackDelta in place. Document event revision identity separately from rapidly updated entity track IDs. Proposed SQLite `observations` is not yet implemented in harpy-node; do not assert otherwise.

## 4. Existing tests: what they really prove

| Evidence | Observed | NOT proven |
|---|---|---|
| GitHub Action CI run 22267889103 on 2026-02-22 | Eight jobs reported success | Today's clean build, any live data provider |
| Rust `harpy-node/tests/ws_contract.rs` | Spawns single node with both ENABLE_REAL flags false, exercises WS protobuf ack/tracks/status | Real feeds, SGP4 accuracy, durable playback |
| Frontend `phase-proof.spec.ts` | Mocks GET /seek payload, verifies layer toggles/metadata/alerts | Actual /seek response, SQLite state, historical replay |
| Frontend Playwright config | Offline/E2E seeded mode | Production authenticity |
| CI Smoke job | Boots old offline multi-service compose and validates health/Graph/AIP HTTP contracts | Single-node USGS/CelesTrak live data |
| Local Prod Readiness | Release build, health/metrics/debug endpoints, WS subscription, soak (~20s in CI) | Source licenses, event provenance, reliable geolocation |
| GeoWraith local docs | Report `npm run lint/build/test` and benchmarks, no current GitHub Actions run found | Fresh independent accuracy reproduction |

**Unexecuted test plan for next implementation PRs:** run local commands `cargo fmt --all -- --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test --all-features`, `npm --prefix apps/web run lint`, `npm --prefix apps/web run build`, `make prod-ready-local`; separately test live USGS/CelesTrak acquisition and SGP4 reference vectors. Do not conflate green fixture/CI with provider reachability.

## 5. GeoWraith entry points and execution

- `start.sh` starts Express backend :8080 plus Vite/React frontend :3001.
- `backend/src/index.ts` warms GeoCLIP and index then calls `app.listen(config.apiPort)`, default 8080; bind interface is not limited to 127.0.0.1 explicitly. Collides with harpy-node's 8080.
- `backend/src/app.ts` exposes GET /health, /ready, /live, /metrics, POST /api/predict, optional POST /api/predict/sfm. Permissive Access-Control-Allow-Origin: * and no evident auth middleware for predictions. Integrate behind private loopback/ HARPY authorization only.
- Backend uses Express, TypeScript, ONNX Runtime, Sharp, HNSW. Frontend uses Vite, React, MapLibre, with a landing page and demo console. Existing frontend is migration reference, not final architecture.

### 5a. Model/index reproducibility

- `clipExtractor.ts` resolves models relative to one directory above `process.cwd()`: repo-root `.cache/geoclip` when launched from `backend/`.
- `geoclipIndex.ts` resolves indexes relative to `process.cwd()`: `backend/.cache/geoclip` when launched from `backend/`.
- `backend/docs` and `docs/REPRODUCIBILITY_PLAYBOOK.md` describe model files under `backend/.cache/geoclip`, so runtime resolution is inconsistent. Fix by a single absolute configuration root, with startup validation.
- The required ONNX weights and unified cached reference index are not in the repository Git tree. Tracked coordinate catalog does **not** reproduce the 1,468-reference unified benchmark corpus on clean checkout by itself.
- `backend/src/index.ts` explicitly warns that missing model assets trigger fallback. `geoclipIndex.ts` automatically attempts CLIP city index and then deterministic coordinate vectors. `imageSignals.ts` also has deterministic embedding fallback. Production inference must fail closed, without emitting plausible substitute predictions.
- `GEOWRAITH_USE_UNIFIED_INDEX` is default false in `config.ts`, while the example env and reported benchmark enable it. Operational profile is not pinned without explicit configuration.
- Benchmark leakage guard checks known cache files for IDs with selected prefixes, and silently ignores unreadable cache files; this is useful but **not** full data-lineage leakage proof.

Sources: [GeoWraith clipExtractor.ts](https://github.com/AngelP17/geowraith/blob/main/backend/src/services/clipExtractor.ts), [geoclipIndex.ts](https://github.com/AngelP17/geowraith/blob/main/backend/src/services/geoclipIndex.ts), [imageSignals.ts](https://github.com/AngelP17/geowraith/blob/main/backend/src/services/imageSignals.ts), [leakage.ts](https://github.com/AngelP17/geowraith/blob/main/backend/src/benchmarks/validationBenchmark/leakage.ts), [playbook](https://github.com/AngelP17/geowraith/blob/main/docs/REPRODUCIBILITY_PLAYBOOK.md).

### 5b. Benchmark boundaries and EXIF

GeoWraith STATUS.md claims 56/58 within 10 km on a curated 58-image gallery, and a separate 17-image seed holdout. This is repository-reported historical data, not a generalization claim or a reproduced result. The verifier (qwen3.5:9b) was reported to offer no improvement. An Im2GPS3k benchmark with leakage screening and pre-registered gates remains necessary.

**Additional correctness risk:** `predictPipeline.ts` returns early for embedded EXIF GPS, with numeric confidence 0.99 and radius 25 m, before visual verification. EXIF is user-supplied metadata and can be edited; don't equate it to independent visual geolocation or meter-level accuracy. Represent it as an asserted metadata location separately from model inference.

## 6. Readiness blockers, ordered

| Priority | Finding | Next authorized phase |
|---|---|---|
| P0 | AGENTS.md requires mock fallback, contradicts new directive | PR 1 supersede policy |
| P0 | Production path emits mock aircraft, satellites, ground sensors/weather/camera | PR 3 isolate/remove production mocks |
| P0 | CelesTrak lat/lon approximation and TLE epoch used as track timestamp | PR 5 SGP4 + verification vectors |
| P0 | No persistence or /seek in canonical single node | PR 2 + PR 6 |
| P0 | Multi-service USGS not on canonical path | PR 4 migrate adapter |
| P1 | Observation/provenance contract insufficient | PR 1 additive schema |
| P1 | CI and E2E use offline/seeded/mock contracts | Add separate live acceptance lanes |
| P1 | GeoWraith model/index path mismatch, untracked artifacts, fallback inferencing | Milestone B, after benchmark |
| P1 | GeoWraith /api/predict exposed with wildcard CORS and no visible auth | Milestone B private-worker hardening |
| P1 | EXIF metadata represented as ~25 m/high-confidence location | Milestone B truth/provenance policy |
| P2 | Old stack duplication, Docker complexity, default dev startup ambiguity | ADR + measured retirement later |

## 7. Open questions for owner review

1. Approve single-node harpy-node as canonical, reusing USGS and replay ideas from multi-service components? ADR recommends yes; not yet implemented.
2. Confirm authoritative directive v3 supersedes HARPY's old AGENTS.md "never empty demo" rule in PR 1.
3. Select the allowed public basemap/imagery provider and record terms before public deployment.
4. Decide whether to preserve the legacy multi-service branch/build path temporarily or explicitly deprecate it once parity is verified. Do not delete early.
5. Accept that historical CI pass is insufficient: a person or connected CI runner must conduct the fresh tests that couldn't execute here.
6. GeoWraith benchmark gates (25-km accuracy, 200-km accuracy, max abstention) remain owner-unset; do not benchmark against self-chosen thresholds.

## 8. Audit completion checklist

- [x] Source-level inventory of both repos, startup paths, ports, provider flags, known mock and synthetic code paths, protocols, benchmarks and existing test types.
- [x] Separate historical CI status from fresh execution and live validation.
- [x] Identify conflicts between old agent instructions and Directive v3.
- [x] Draft canonical-architecture ADR.
- [ ] Fresh local builds/tests, actual live provider observations, recording/replay demonstration, clean model/index bootstrap. **Not performed here; no executable repository checkout/network available.**

**Stop gate:** No feature implementation, refactor, mock removal, or merge. Await owner review before PR 1.
