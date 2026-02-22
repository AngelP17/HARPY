# AGENTS.md - HARPY (Current Reality + Roadmap)

This file is for AI coding agents working on HARPY.

Current shipped surface (Option A):
- `apps/web` operator HUD (Next.js + Cesium)
- `services/harpy-node` single Rust node
  - provider polling loops (mock by default)
  - WebSocket stream: `trackDeltaBatch`, `providerStatus`, `subscriptionAck`
  - per-client filtering supported (layers/bbox)
  - `/health` + `/metrics`

Roadmap (optional):
- multi-service split (relay/ingest/fusion/graph/aip)
- persistence (redis/postgres)
- DVR time travel + snapshots
- fusion rules + graph queries

Agents must not regress the local-first demo. If a change breaks local-prod gates, it is not complete.

---

## Non-negotiables (current)

- Demo is never empty: MOCK fallback must keep UI alive.
- WS contract must stay stable (see `services/harpy-node/tests/ws_contract.rs`).
- CI must enforce local-prod readiness and the confidence gate.

---

## Commands

```bash
make dev
make prod-ready-local
make confidence-refactor
```

---

## Trust boundaries

- No secrets in frontend.
- Real provider auth only via env vars on the node.
- Fallback-to-mock on provider errors is mandatory.
