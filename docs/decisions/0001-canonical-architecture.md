# ADR 0001: Canonical architecture for HARPY Monitor v0.1

Status: accepted, 2026-10-21. Supersedes the "Option A" HUD and the multi-service roadmap.

## Context

The Step 0 audit (`docs/audit/2026-10-current-state.md`) found that every user-visible layer could be fed by generated data and that the project's own rules required it. The owner's directive is a real system, no fallbacks, publicly reachable, with provenance.

## Decision

1. **One backend: `services/harpy-core` (Rust).** Ingestion, SQLite store, provider health, SGP4, document export, read-only HTTP API, Prometheus metrics. Replaces harpy-node and all five multi-service crates, which are deleted (git history keeps them).
2. **SQLite (WAL), append-only revisions.** One `observations` table per the contract in `docs/contracts/observation.md`; corrections from a source become new revisions; the upstream record behind each revision is kept in `raw_records`, keyed by SHA-256. `fetch_log` records every attempt; health is derived from it.
3. **No mocks in any production path.** Mock providers, `MockStreamer`, demo mode and synthetic ground layers are deleted, not disabled. Recorded real-source fixtures exist only under `tests/fixtures/` and CI fails if the shipped bundle references them.
4. **Two providers for Milestone A:** USGS earthquakes (public domain) and CelesTrak GP elements (SGP4). OpenSky removed (needs written permission). Aircraft deferred until adsb.lol production use is confirmed.
5. **SGP4 in AFSPC compatibility mode, on both sides.** Rust (`sgp4` crate) is verified against the Vallado vectors to 1 cm; the browser (satellite.js 6.0.2, `json2satrec(omm, 'a')`) is verified against Rust golden positions (measured: within ~5 m horizontally, 1 cm in altitude). Element sets more than 3 days from the display time are not propagated.
6. **One data contract for every deployment.** The web app only ever reads `data/v1/*.json`. `harpy-core export` writes those as static files; `harpy-core serve` renders the same documents per request. There is no alternate data path to fall back to.
7. **Public deployment = GitHub Pages + scheduled GitHub Actions.** Every 15 minutes the monitor workflow restores the DB from the `harpy-data` branch, ingests, exports, runs live acceptance, publishes, and saves the DB. Read-only by construction: there is no server to write to.
8. **JSON polling instead of the protobuf WebSocket.** Volume is hundreds of records per cycle, refreshed every 15 min (static) or 60 s (server). A binary stream adds complexity with no measured benefit. Revisit if aircraft or another high-rate source is added.
9. **Frontend: Next.js static export + Cesium, rebuilt.** Self-hosted Natural Earth II imagery (no Ion token, no third-party tile terms), real sun lighting at the display time, CSS modules. Cesium runtime is copied from `node_modules` at build time instead of 400 vendored files.

## Deviations from the directive

- Directive 5.PR1 said protobuf for the stream; see decision 8.
- Directive suggested a VPS for the public deploy. GitHub Pages + Actions meets the same bar (public, read-only, scheduled backups via the data branch) at zero cost and with no host to maintain. `harpy-core serve` plus `deploy/Dockerfile` remain the path for a live-server deployment.
- A seventh display state, `RECORDED`, is added for genuine records shown during replay, so replayed history is never labelled `LIVE` or mislabelled `STALE`.

## Consequences

- The public site's freshness is bounded by the 15-minute schedule (GitHub may delay scheduled runs). The UI states snapshot age and degrades records to STALE when the archive is older than `stale_after_s`.
- GitHub disables scheduled workflows in repos with no activity for 60 days. The runbook covers re-enabling.
- Replay depth is bounded by retention: earthquakes 30 days, element sets 10 days (public deploy settings).
