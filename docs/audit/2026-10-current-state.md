# Step 0 audit: HARPY and GeoWraith, as found (2026-10-21)

Baseline: `AngelP17/HARPY@b35bdf3` and `AngelP17/geowraith` (main, 29 commits).
Method: read the code, ran what could run. Findings are stated as observed, not as the old docs described them.

## HARPY

### Entry points and services

| Thing | What it actually was |
|---|---|
| `make dev` / `scripts/dev.sh` | `harpy-node` on :8080 + Next dev on :3000 |
| `make dev-up*` | docker compose: postgres, redis, minio, harpy-relay, harpy-ingest, harpy-fusion, harpy-graph, harpy-aip |
| `services/harpy-node` | The only backend the web app actually used. Axum, WebSocket protobuf stream, `/health`, `/metrics`. No persistence. |
| `services/harpy-relay/ingest/fusion/graph/aip`, `crates/*` | A second, competing multi-service architecture (Redis/Postgres). Not wired to the shipped UI path. Dead weight. |
| `deploy/k8s`, `deploy/helm` | Kubernetes manifests for the multi-service stack. Never deployable as shipped. |
| `services/harpy-detect` | Python stub. |

### Where fabricated data reached the UI (all confirmed in code)

1. **Every provider defaulted to mock.** `provider_loop_adsb` and `provider_loop_tle` used `AdsbMockProvider` / `TleMockProvider` unless `ENABLE_REAL_*` was set.
2. **Silent fallback.** If OpenSky or CelesTrak failed to initialise, the code logged a warning and fell back to the deterministic mock. AGENTS.md made this mandatory ("Fallback-to-mock on provider errors is mandatory", "Demo is never empty").
3. **Ground sensors, weather, cameras were 100% synthetic.** `GroundMockProvider::{sensor, weather, camera}` had no real counterpart at all.
4. **The "real" CelesTrak adapter faked positions.** `estimate_position(inclination, raan, mean_anomaly, index)` placed satellites using the record's array index, not orbital propagation. There was no SGP4.
5. **Frontend MockStreamer.** `NEXT_PUBLIC_STREAM_MODE` defaulted to `hybrid`, which started `MockStreamer` whenever the WebSocket wasn't connected; `offline` mode used only the mock. `DEMO_MODE` densified it.
6. **Vision modes.** EO/NVG/FLIR were post-process shaders with sensor names.
7. **Provider freshness** was computed from the mock's own tick, so mock data always read FRESH.

### Tests

- `harpy-node` had 3 unit tests (viewport/layer filtering) and a WS contract test. All exercised mock output; none touched an upstream or a database.
- Readiness/confidence gates (`scripts/*_gate.sh`, `evidence/`) checked that services booted and the demo was non-empty, which the mocks guaranteed. They could not fail on fake data.
- Playwright `phase-proof.spec.ts` ran against the mock stream.

### Contract

`proto/harpy/v1/harpy.proto` `TrackDelta` had id/kind/position/heading/speed/ts/provider_id/meta. No observation type, no upstream ID, no source-updated vs ingested time, no revision, no license, no digest. Gap to the section 3 contract: essentially everything.

## GeoWraith

| Item | Finding |
|---|---|
| Model weights | `vision_model_q4.onnx`, `location_model_uint8.onnx` expected under `backend/.cache/geoclip/`. **Not in the repo** (gitignored); no download/checksum script. A fresh clone cannot run GeoCLIP. |
| Fallback tiers | GeoCLIP ONNX, then CLIP text matching (`@xenova/transformers`), then a deterministic fallback. Lower tiers return coordinates in the same response shape. |
| Accuracy claim | 56/58 within 10 km on a self-assembled 58-image validation set; 17-image holdout. Not comparable to published benchmarks. |
| Ports | Backend 8080 (collides with harpy-node), frontend 3001. |
| CORS / auth | `Access-Control-Allow-Origin: *`, `/api/predict` unauthenticated. |
| Verifier | Optional local Ollama `qwen3.5:9b`; README states it did not improve the 56/58 result. |

## Conclusion

The old HARPY was a convincing HUD over generated data, with gates designed to keep it looking alive. The real pieces worth keeping were the Next.js + Cesium choice and the provider-polling idea. Everything else is replaced; see ADR 0001.
