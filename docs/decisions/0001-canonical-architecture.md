# ADR-0001: canonical HARPY architecture and migration boundary
**Date:** 2026-10-15  
**Status:** **PROPOSED FOR OWNER REVIEW**, not yet accepted or implemented.  
**Related audit:** [2026-10 current state](../audit/2026-10-current-state.md).  
**Scope:** Step 0 only, no implementation change.

## Context

HARPY has two executable architectures. The primary local-first path starts `services/harpy-node` (Axum WS and polling) with `apps/web` (Next.js/Cesium); it defaults to mocks. A separate Compose path uses Redis/Postgres/MinIO, `harpy-relay`, `harpy-ingest`, `harpy-fusion`, `harpy-graph`, and `harpy-aip`; this contains real USGS/NWS/NEXRAD adapters and a Postgres-dependent seek endpoint. Neither inspected path is proven to satisfy the new production-real-data requirements.

GeoWraith has a real TS/ONNX/GeoCLIP+HNSW inference implementation, but current fallback layers, model/index cache path inconsistency, missing checked-in artifacts, limited benchmark, and permissive API prevent immediate unqualified production integration.

Directive v3 establishes two independent milestones:
- **A / Monitor v0.1**: public read-only live USGS + correctly propagated CelesTrak, provenance, provider truth states, persisted history/replay. Ships independently of GeoWraith.
- **B / Unified v1.0**: authenticated GeoWraith scene/region verification, saved cases, reproducible exports, subject to pre-registered geolocation accuracy gate.

This ADR records recommended choices for review, not approval to implement them.

## Proposed decisions

### D1. Choose one canonical HARPY runtime

Use the existing single-node `harpy-node` as the core and retain the Next.js/Cesium `apps/web`. Incrementally migrate only proven logic from the older multi-service stack: USGS adapter, selected replay and event processing behavior, possibly alert/fusion routines after review. No forced rewrite of the map UI or the worker pipeline.

Keep the legacy services and Compose files **unchanged** until their active responsibilities have been mapped and parity has been verified. "Not launched by make dev" is not the same as "dead code". Record deprecation separately when safe.

**Why:** The simplest local runtime has the smallest mandatory infrastructure, and it already supports WS subscriptions, stream filtering, health and metrics. The older path is an adapter/replay reference rather than the production target.

### D2. Durable, truthful observation store

Add SQLite in WAL mode to the canonical core, with forward-only migrations, append-only revisioned observations and provider status. Keep raw upstream payload references/digests and explicit UTC event/ingest/source times. Treat source-id, upstream-id, entity-id, observation-id and revision as distinct concepts.

Do not replace all source-specific data with an unbounded generic schema. Follow Directive v3: typed common fields plus JSON attributes, matching versioned protobuf/HTTP contracts. Spatial indexes can be introduced when measured needs justify them.

Define retention, batch-write recovery, startup database integrity and backup/restore behavior. **Proposed**, not present in harpy-node today.

### D3. The operational data-plane must fail visibly, not fabricate

- Only use a real adapter when properly configured; failures produce status changes and an honest empty/stale state.
- Disable synthetic ground-camera, weather, sensor, mock ADS-B, and mock TLE in operational builds; retained fixtures must be segregated and unmistakably marked.
- Separate measured observations from SGP4-calculated positions and AI inferences.
- Record TLE/OMM epoch, propagation time, and prediction source; SGP4 must be validated against trusted vectors before showing geographic satellite positions as calculated.
- Align the map, provider-health, timeline and export contracts with this labeling.

The old `AGENTS.md` demands automatic mock fallback. **Decision pending owner approval:** Directive v3 should supersede it, and PR 1 must update the repository agent policy explicitly. Leaving both policies active is unsafe for agentic implementation.

### D4. Preserve compatibility intentionally

Keep existing `proto/harpy/v1/harpy.proto` field numbers intact. Introduce additive fields/messages for provenance, revisions, geometry, accuracy/uncertainty and evidence. Preserve existing WS subscriptions while building a versioned HTTP API for event/history/health; do not silently reinterpret existing `TrackDelta.ts_ms` as a newly added record timestamp.

Replay must query persisted observations, reconstruct correct state across revisions, and return a documented "history unavailable" when requested time predates collection. A frontend `fetch('/seek')` plus mocked Playwright result is not a valid implementation.

### D5. GeoWraith is a module, integrated only after evaluation

In Milestone B, import the backend into HARPY with preserved history and launch it as a **loopback-only**, private worker behind HARPY Core. Separate the **required** CandidateGenerator (GeoCLIP + matching reference index) from the **optional** CandidateReranker (disabled unless independently shown to improve results). Do not introduce a multi-provider AI router in v1.

Use one stable absolute model-cache configuration, pinned model/index versions and hashes, license metadata, deterministic bootstrap, and explicit failure when required assets are absent. An EXIF GPS coordinate is input metadata, not visually verified geolocation; do not promote it to a high-confidence independent conclusion.

Pre-register 25 km and 200 km accepted-prediction accuracy plus maximum abstention targets **before** running Im2GPS3k. Evaluate against unseen photos with leakage screening; withhold fine-grained coordinates when unsupported. Failure of the gate does not block the already released Monitor milestone.

### D6. Public alpha, no anonymous compute

Publish read-only monitoring views over HTTPS with provenance, rate limiting, license-compliant source usage, budget-aware deployment and backup/restore. Do not expose anonymous upload, inference, or write endpoints. Authenticated cases and uploads are a later milestone. Respect upstream provider, OSM tile and Cesium terms; aircraft source remains optional and permission-dependent.

No mandatory Redis, Postgres, MinIO, Kubernetes, Grafana service or hosted LLM for local core boot. A checked-in Grafana dashboard is observability packaging, not a required runtime dependency.

### D7. Release evidence is three independent lanes

1. **CI:** Rust/TS tests, protobuf contracts and explicitly tagged recorded real-source fixtures, with seeded deterministic conditions.
2. **Integration:** actual running processes, SQLite, WS and browser interactions, restart and persistence.
3. **Live acceptance:** current provider HTTP requests with source IDs, original timestamps, licensed usage, valid coordinates, and explicit failure-state observations.

A feature is ready only after a recent, documented live run and an actual failure demonstration in addition to fixture and integration success. Preserve reports/screenshots/logs as evidence. Historical successful CI from February 2026 is not an October 2026 run.

## Proposed boundaries

| Component | Boundary | Migration treatment |
|---|---|---|
| `apps/web` | Single public browser UI; Cesium + worker processing | Keep; truth states; replace mock streaming production import |
| `services/harpy-node` | Single backend; canonical ingest, storage, replay, WS, provenance | Keep, extend |
| `harpy-ingest` | USGS and other external provider implementations | Port tested adapters, then assess retirement |
| `harpy-relay` | Legacy Redis WS and `/seek` | Review replay/seek behavior; reimplement against SQLite core |
| `harpy-fusion`, `harpy-graph`, `harpy-aip` | Legacy distributed rules/queries/AI | Defer; inventory, preserve until consciously retired |
| `backend` in GeoWraith | Private image inference engine | Milestone B import; secure and pin real weights/index |
| GeoWraith Vite UI | Separate product/marketing surface | Retire only after functional migration |
| REA | Local authorized reverse engineering/instrumentation | Optional developer tool; **not** HARPY production dependency |
| World Monitor | Open-source comparison and UX reference | Study; do not copy AGPL code into proprietary HARPY |

## Consequences and risks

Positive: smaller deployable surface, real source provenance, a clear path from Monitor alpha to unified investigation product, and independent release gates.

Risks:
- SQLite write throughput and historical volume need measurements; avoid inventing required distributed infrastructure.
- CelesTrak element freshness and TEME-to-geodetic conversion require credible time/frame tests.
- Legacy services might contain functionality relied on by CI or undocumented integrations.
- The web app currently has default hybrid/offline and seed behavior; removing it may expose previously hidden UI defects.
- GeoWraith accuracy can be weaker on an independent geographically balanced benchmark. Product must abstain rather than overclaim.
- Public map tile and aviation-feed terms require operational review.
- Current lack of clean local execution is an audit limitation, not an indication that code builds or fails.

## Migration approval checkpoints

1. **Now:** Owner reviews the source audit and this ADR. No code changes.
2. **PR 1:** Make source-of-truth/AGENTS policy consistent; additive observation contracts; existing tests green.
3. **PR 2 onward:** SQLite, mock isolation, authentic adapters, SGP4, playback, observability; acceptance evidence per PR.
4. **Milestone A gate:** External public read-only HARPY Monitor observed working with genuinely attributable USGS + calculated CelesTrak positions, durable replay and provider failure semantics.
5. **Milestone B gate:** Pre-registered benchmark targets, actual GeoWraith inference, secure private worker, durable case+export, independent acceptance evidence.

**Explicit stop condition:** Audit delivered for review. Nothing has been migrated, simulated data is still present in the current main implementation, and neither milestone has been certified.
