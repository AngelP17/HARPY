# HARPY Execution Backlog (Phases 2-4)

Date: 2026-02-20  
Scope: Remaining work after Phase 1 backend milestone claim  
Owners: Claude (Backend), Gemini (Frontend)

## Rules

- Every item must have a reproducible verification step.
- No item is complete unless acceptance criteria are met.
- Backend and frontend must both pass contract compatibility against `proto/harpy/v1/harpy.proto`.

## P0 Blockers (Must Clear First)

- [x] `P0-1` Fix `harpy-fusion` compile failure (Rust let-chain syntax issue).
  - Owner: Claude
  - Acceptance:
    - `cargo check -p harpy-fusion` passes.
  - Verify:
    - `cargo check -p harpy-fusion`

- [x] `P0-2` Align `docker-compose.yml` with actual multi-service workflow used by teams.
  - Owner: Claude
  - Acceptance:
    - Active services include at least `postgres`, `redis`, `harpy-relay`, `harpy-ingest`, `harpy-fusion`, `harpy-graph`, `harpy-aip`.
  - Verify:
    - `docker-compose config --services`

- [x] `P0-3` Sync docs to reality (`TEAM_ALIGNMENT.md`, `README.md`) after blockers are fixed.
  - Owner: Claude
  - Acceptance:
    - No stale claims about pending work that is already implemented.
  - Verify:
    - Manual review of updated sections.

## Backend Phase 2 (Claude)

- [x] `B2-1` Snapshot model + storage contract.
  - Acceptance:
    - Snapshot metadata table or equivalent model exists.
    - Snapshot format documented (fields, compression, timestamps).
  - Verify:
    - Migration present and applied.

- [x] `B2-2` Periodic snapshot creation job.
  - Acceptance:
    - Ingest/worker emits snapshots at configured interval.
    - Failure path logs and retries are handled.
  - Verify:
    - Logs show periodic snapshots; metadata records increase over time.

- [x] `B2-3` Seek API for playback ranges.
  - Acceptance:
    - Endpoint accepts time range + viewport and returns snapshot+delta plan.
  - Verify:
    - `curl` request returns valid JSON with snapshot reference and deltas.

- [x] `B2-4` Relay playback mode support.
  - Acceptance:
    - Relay handles playback subscriptions and routes historical batches.
  - Verify:
    - Playback subscription receives historical `TrackDeltaBatch`.

- [x] `B2-5` Backpressure semantics enforced in code.
  - Acceptance:
    - `TrackDeltaBatch` droppable.
    - `AlertUpsert` and `ProviderStatus` never dropped.
  - Verify:
    - `backpressure.rs` module implements differentiated priority channels.

## Frontend Phase 1 Catch-Up (Gemini)

- [x] `F1-1` WebSocket + protobuf decode loop in workers.
  - Acceptance:
    - Client connects to `ws://localhost:8080/ws`.
    - Decodes envelope + track/provider payloads.
  - Verify:
    - Browser logs and UI state update from live stream.

- [x] `F1-2` Primitive-only Cesium rendering path.
  - Acceptance:
    - Tracks render via Primitive API, no Entity API usage for track sets.
  - Verify:
    - Code review + runtime render check.

- [x] `F1-3` DATA LINK health panel.
  - Acceptance:
    - Displays provider freshness/circuit status and WS status.
  - Verify:
    - Simulated provider state changes visible in HUD.

- [x] `F1-4` Layer-based subscription updates.
  - Acceptance:
    - Layer toggles send updated `SubscriptionRequest` and affect rendering.
  - Verify:
    - Turning layers off stops matching tracks in viewport.

## Backend Phase 3 (Claude)

- [ ] `B3-1` Fusion rules engine v1 (beyond baseline convergence).
  - Acceptance:
    - At least 3 rule templates (e.g., convergence, anomaly, proximity).
    - Dedup TTL policy in effect.
  - Verify:
    - Rule tests and generated alerts in `alerts` table.

- [ ] `B3-2` Alert + link publication pipeline.
  - Acceptance:
    - `AlertUpsert`/`LinkUpsert` persisted and published to relay channels.
  - Verify:
    - Redis channel traffic + relay fanout observed.

- [ ] `B3-3` Graph query API hardened.
  - Acceptance:
    - Allow-listed templates only.
    - Pagination + parameter validation.
  - Verify:
    - Positive/negative API tests.

- [ ] `B3-4` Audit logging for operator actions.
  - Acceptance:
    - Graph query actions insert into `audit_log` with actor/action/details.
  - Verify:
    - SQL query on `audit_log` returns expected rows.

## Frontend Phase 2-3 (Gemini)

- [x] `F2-1` DVR timeline (live/scrub/play/speed/event markers).
  - Acceptance:
    - UI controls update playback position and mode.
  - Verify:
    - Time changes reflected in rendered scene.

- [x] `F2-2` Shareable scene URLs.
  - Acceptance:
    - URL encodes/decodes viewport/layers/time mode with schema version.
  - Verify:
    - Open link restores same scene state.

- [x] `F3-1` Alert stack + evidence detail panel.
  - Acceptance:
    - Alerts ordered by severity.
    - Expand shows linked evidence chain.
  - Verify:
    - Live alert appears and chain is inspectable.

- [x] `F3-2` Graph query UI templates.
  - Acceptance:
    - Runs approved templates and renders paginated results.
  - Verify:
    - Query responses match API output.

## Backend Phase 4 (Claude)

- [ ] `B4-1` AIP execution guardrails complete.
  - Acceptance:
    - Tool allow-list + strict arg validation + confirmation gate for scene-altering actions.
  - Verify:
    - Tests for blocked tool, invalid args, and missing confirmation.

- [ ] `B4-2` Signed export workflow.
  - Acceptance:
    - Export endpoint issues signed token + watermark metadata.
    - Verification path documented.
  - Verify:
    - Token decodes and includes expected claims.

- [ ] `B4-3` RBAC + ABAC enforcement.
  - Acceptance:
    - Role and attribute checks applied to graph/aip sensitive endpoints.
  - Verify:
    - Unauthorized requests fail; authorized requests pass.

- [ ] `B4-4` Enterprise deployment artifacts validated.
  - Acceptance:
    - Kustomize base + GovCloud overlay apply cleanly.
    - Helm chart renders successfully.
  - Verify:
    - `kubectl kustomize deploy/k8s/base`
    - `kubectl kustomize deploy/k8s/govcloud`
    - `helm template harpy deploy/helm/harpy`

- [ ] `B4-5` Optional `harpy-detect` service integration.
  - Acceptance:
    - On-demand detection endpoint available with privacy filters.
  - Verify:
    - `GET /health` and `POST /detect` smoke tests pass.

## Frontend Phase 4 (Gemini)

- [x] `F4-1` AI operator UX (palette/chat + structured request preview).
  - Acceptance:
    - Preview appears before apply.
    - Human confirm required for scene mutations.
  - Verify:
    - Confirm gate prevents accidental apply.

- [x] `F4-2` Export UI + watermark visibility.
  - Acceptance:
    - User can request signed export and see watermark metadata.
  - Verify:
    - Export response displayed and downloadable token payload handled.

- [x] `F4-3` Role-aware UI states.
  - Acceptance:
    - Restricted actions hidden/disabled without proper claims.
  - Verify:
    - Role-switch test shows expected capability gating.

## Integration Milestones

- [ ] `M1` Live E2E: `harpy-ingest -> Redis -> harpy-relay -> frontend`.
  - Owner: Claude + Gemini
  - Verify:
    - Live tracks visible and filtered by viewport/layers.

- [ ] `M2` Alert E2E: `harpy-fusion -> Redis -> harpy-relay -> frontend alert stack`.
  - Owner: Claude + Gemini
  - Verify:
    - Generated alert appears in UI with evidence links.

- [ ] `M3` AI E2E: `frontend -> harpy-aip -> harpy-graph -> audit_log`.
  - Owner: Claude + Gemini
  - Verify:
    - Tool action executes and audit record is persisted.

## Weekly Reporting Template

Use this format in standups:

```text
Week of YYYY-MM-DD
- Completed: [IDs]
- In Progress: [IDs]
- Blocked: [IDs + blocker reason]
- Next: [IDs]
```
