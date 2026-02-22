# HARPY Demo Script (video parity)

## Goal
Show HARPY is not an empty demo:
- LIVE WS mode works
- provider health/freshness updates
- vision modes are visible
- presets move camera
- toggles change streamed/rendered content
- if node dies, UI still runs in MOCK mode

---

## Steps

1) Start
```bash
make dev
```

2) Confirm Web + Node:
- Open: http://localhost:3000
- Open: http://localhost:8080/health
- Open: http://localhost:8080/metrics

3) On HUD:
- DATA LINK shows LIVE WS (not MOCK)
- RTT updates every few seconds

4) Layers:
- Toggle AIR off => aircraft disappear quickly
- Toggle SAT off => satellites disappear quickly

5) Presets:
- DC / SF / PTY => camera jumps and tracks appear in-region

6) Vision:
- EO -> NVG -> FLIR => clearly different post-processing

7) Failure mode:
- Stop node process
- UI must switch to MOCK (never blank)

8) Local-prod gate:
```bash
make prod-ready-local
```
