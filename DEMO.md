# HARPY Demo Definition of Done

This checklist defines the visible acceptance criteria required to call each phase complete during operator demos.

## Quick Launch

```bash
make dev-demo
```

`dev-demo` boots the offline backend stack and starts the web client with `NEXT_PUBLIC_DEMO_MODE=true` so the viewport immediately shows dense, clustered motion (aircraft, satellites, and ground/camera entities). 

## Phase 1 — Live Streaming Console

- [ ] 2,000+ aircraft and 100+ satellites visible at world zoom.
- [ ] Layer toggles (ADS-B, TLE, Sensors/CV, WX) immediately add/remove corresponding map primitives.
- [ ] Dynamic clustering collapses/expands as camera altitude changes.
- [ ] Track selection shows an intel panel with provider, altitude, speed, heading, and timestamp.
- [ ] `FOCUS` action flies camera to selected target.
- [ ] Throughput + RTT in Data Link panel are non-zero while stream is active.
- [ ] Vision modes (`NORMAL`, `EO`, `CRT`, `NVG`, `FLIR`) produce visibly distinct frame output.

## Phase 2 — DVR Time Travel

- [ ] Scrubbing timeline sends seek/playback subscriptions and map rehydrates to historical state.
- [ ] Snapshot ID and delta estimate update in HUD on seek.
- [ ] Playback pause/resume and rate controls produce deterministic movement over historical data.

## Phase 3 — Explainable Fusion & Graph

- [ ] Alerts appear with severity and evidence links.
- [ ] Alert evidence chain renders node relationships and supports Focus/Seek/Related actions.
- [ ] Graph query templates highlight returned entities on map (not JSON-only output).
- [ ] Operator actions are visible in UI feedback and exported audit events.

## Phase 4 — Enterprise Controls

- [ ] RBAC/ABAC roles constrain privileged actions.
- [ ] Retention controls exposed with provider-level policy visibility.
- [ ] Optional CV inference is toggleable per camera/sensor feed.

## Demo Capture Guidance

For release PRs, attach screenshots that prove each checked box above in at least:

1. Global-density clustered view
2. Selected-target + focus action
3. Timeline playback seek state
4. Alert evidence chain + related graph action
