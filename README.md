# HARPY Monitor

A geospatial monitor that only shows real data, says where every point came from, and tells you plainly when a source is down.

**Live:** https://angelp17.github.io/HARPY/

- **Earthquakes** from the USGS real-time feeds, every magnitude, with revision history when USGS corrects an event.
- **Satellites** (ISS and other stations, bright satellites, GPS, weather) propagated in your browser with SGP4 from CelesTrak element sets, cross-checked against the Rust backend.
- **Replay** of everything HARPY recorded (30 days of events, 10 days of element sets), with day/night lighting at the replay time.
- **Provenance** on click: upstream ID, source-updated vs ingested time, revision, license, and a SHA-256 of the exact upstream record.
- **Honest failure:** outages show as `SOURCE_UNAVAILABLE` or `STALE`. There is no mock mode, no demo stream, and no fallback data anywhere in the shipped build.

## Architecture

```
USGS GeoJSON ─┐                       ┌─ data/v1/*.json ─▶ GitHub Pages (static, every 15 min)
              ├─▶ harpy-core (Rust) ──┤
CelesTrak OMM ┘   SQLite WAL,         └─ harpy-core serve ─▶ live server (60 s), same documents
                  append-only revisions,
                  provider health, SGP4
                                         web: Next.js static export + Cesium + satellite.js
```

- One data contract: `docs/contracts/observation.md`.
- Decisions: `docs/decisions/`. What was wrong before: `docs/audit/2026-10-current-state.md`.
- Providers and terms: `docs/providers.md`. Operations: `docs/operations/`.

## Run it

```bash
npm ci
make test            # Rust + web tests against recorded real-source fixtures
make ingest          # pull real data into data/harpy.sqlite
make dev             # http://localhost:3000
# or
make serve           # harpy-core live server + web at http://127.0.0.1:8080
```

Requires Rust stable and Node 22.

## Verification

| Claim | Evidence |
|---|---|
| SGP4 is correct | Vallado verification vectors match to < 1 cm (`orbit.rs`) |
| Browser and backend agree | Rust golden positions reproduced by satellite.js within ~5 m (`orbit.test.ts`) |
| Revisions preserve history | Integration test: USGS corrects a magnitude, revision 1 and its raw record survive |
| Outages are honest | Integration test: two failed fetches make the provider `UNAVAILABLE`; nothing is synthesized |
| HTTP 200 garbage is a failure | Integration test |
| Restart and backup are safe | Integration tests: reopen identical; `VACUUM INTO` backup passes integrity check |
| No mocks ship | `check-no-mocks.mjs` scans the production bundle in CI |
| Live data works today | `monitor.yml` live acceptance table on every run |

## Roadmap

Milestone B (HARPY 1.0): GeoWraith visual geolocation as an `inferred` source, saved investigations, and reproducible reports. Blocked on model assets and an Im2GPS3k benchmark with owner-set thresholds; see `docs/decisions/0002-geowraith-accuracy-gate.md`.

## Credits

Earthquake data: U.S. Geological Survey. Orbital elements: CelesTrak. Imagery: Natural Earth. Globe: CesiumJS. SGP4: `sgp4` crate, satellite.js.
