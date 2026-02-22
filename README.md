# HARPY - Operator-Grade Geospatial HUD (Local-Production Ready)

HARPY is a working, local-production-ready geospatial operator HUD:
- Next.js + Cesium frontend (operator HUD)
- Single Rust node backend that streams Tracks + ProviderStatus over WebSocket
- Deterministic mock stream by default (never an empty demo)
- Optional real providers behind env flags (OpenSky, CelesTrak)

This repo is intentionally local-first: no Redis, no Postgres, no VPS required to run a real demo.

---

## What you can demo (video parity + more)

- Operator HUD chrome (Data Link, Layers, Vision, Presets)
- LIVE WebSocket streaming with RTT ping/pong
- Provider health + freshness (FRESH/AGING/STALE/CRITICAL)
- Vision modes (EO/NVG/FLIR) + bloom/sharpen
- Presets (camera jumps)
- Deterministic fallback stream (MOCK) when backend is down
- Local-prod gates: boot checks, endpoint checks, soak test, CI enforcement

---

## Quickstart (local dev)

### 1) Run everything (one command)
```bash
make dev
# Web:  http://localhost:3000
# Node: http://localhost:8080/health
# WS:   ws://localhost:8080/ws
```

### 2) Local production run

```bash
make prod-ready-local
# Runs build + boot + readiness checks + soak
```

---

## Runtime endpoints

- `GET /health` - node health
- `GET /metrics` - prometheus metrics (local-prod)
- `GET /ws` - WebSocket stream

---

## Environment flags (real providers)

By default, HARPY runs deterministic mocks.

Enable real providers if you want:

```bash
export ENABLE_REAL_ADSB=true
export OPENSKY_CLIENT_ID=...
export OPENSKY_CLIENT_SECRET=...

export ENABLE_REAL_TLE=true
export CELESTRAK_GROUP=STATIONS
```

If auth is missing or providers fail, HARPY falls back to mock automatically.

---

## Repo structure (what matters)

- `apps/web/` - operator HUD (Next.js + Cesium)
- `services/harpy-node/` - single Rust node (WS + providers)
- `scripts/` - readiness gates and confidence checks
- `evidence/` - refactor completion confidence inputs (checked-in)

---

## Production readiness (local)

Production-ready locally means:

- deterministic demo never breaks
- health/metrics exist
- contract tests exist
- CI enforces all gates
- docs match reality

See:
- `scripts/local_production_readiness.sh`
- `scripts/refactor_completion_confidence_gate.sh`
