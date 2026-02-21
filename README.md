# 🦅 HARPY

![Status](https://img.shields.io/badge/status-Active_Development-brightgreen)
![Phase](https://img.shields.io/badge/phase-0_(Repo_Setup_%2B_Contracts)-orange)
![Stack](https://img.shields.io/badge/stack-Rust_%7C_Next.js_%7C_Cesium_%7C_Protobuf-blue)
![License](https://img.shields.io/badge/license-Proprietary-lightgrey)

> Lawful, compliance-first geospatial intelligence fusion platform with DVR-native time travel, explainable ontology links, and deterministic GPU rendering.

**Author:** Angel L. Pinzon  
**Spec Version:** YC-Grade Build Specification v2.2  
**Status:** Active Development (Phase 0)

## Table of Contents

- [Overview (Executive Summary)](#overview-executive-summary)
- [Non-Negotiable Constraints](#non-negotiable-constraints)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
  - [System Ontology (Nodes + Edges)](#system-ontology-nodes--edges)
  - [Service Topology (Mermaid)](#service-topology-mermaid)
  - [Frontend Architecture](#frontend-architecture)
  - [Backend Architecture](#backend-architecture)
  - [AI Operator Interface](#ai-operator-interface)
- [Deployment](#deployment)
- [Engineering Guidelines](#engineering-guidelines)
- [Testing Strategy](#testing-strategy)
- [Roadmap (Phased Checklist)](#roadmap-phased-checklist)
- [Useful Resources](#useful-resources)
- [Key Documents](#key-documents)
- [Appendix: Link Schema](#appendix-link-schema)
- [Contributing](#contributing)
- [License](#license)

## Overview (Executive Summary)

HARPY normalizes heterogeneous sensor feeds (ADS-B, satellite TLE, camera feeds, weather radar, seismic) into a spatiotemporal ontology of nodes and edges, then renders that fused picture through a GPU-accelerated tactical HUD.

```mermaid
graph LR
    subgraph Inputs["📡 Sensor Feeds"]
        ADSB["ADS-B<br/>Aircraft"]
        TLE["TLE<br/>Satellites"]
        CAM["Cameras"]
        SEIS["Seismic"]
        WX["Weather"]
    end
    
    subgraph Fusion["🔧 Fusion Engine"]
        NORM["Normalization"]
        ONTO["Ontology Graph<br/>Nodes + Edges"]
        ALERT["Alert Generation"]
    end
    
    subgraph Output["🎯 Output"]
        HUD["Tactical HUD<br/>CesiumJS"]
    end
    
    ADSB --> NORM
    TLE --> NORM
    CAM --> NORM
    SEIS --> NORM
    WX --> NORM
    
    NORM --> ONTO
    ONTO --> ALERT
    ONTO --> HUD
    ALERT --> HUD
```

### Core Product Differentiators

1. **DVR-native time travel**: Scrub backward/forward across the entire fused picture.
2. **Explainable fusion**: Dynamic ontology graph shows why alerts fired via evidence chains.
3. **Deterministic, high-scale rendering**: Cesium Primitives fed by worker-packed TypedArrays.
4. **Deploy-anywhere posture**: Cloud, GovCloud, or air-gapped edge.

## Non-Negotiable Constraints

1. **Lawful + compliant usage only**: Respect provider terms, privacy laws, and operational boundaries.
2. **All-in Cesium**: Globe-to-street continuity; Cesium Entity API forbidden above ~500 objects.
3. **Strict client data plane**: Main thread renders only; workers own parsing, indexing, clustering, packing.
4. **Binary-first transport**: Protobuf frames over WebSocket; JSON only as dev fallback.
5. **Rust-first backend**: Axum + Tokio, single binaries, predictable latency, no GC pauses.
6. **Operator-grade reliability**: Health model, circuit breakers, backpressure, observability, runbooks.
7. **Auditability required**: Every operator action and AI action is audit logged.
8. **Adapter compliance docs required**: Every provider adapter must be documented in `ADAPTERS.md` (rate limits + TOS).

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router + React + TypeScript (strict) |
| 3D Rendering | CesiumJS (Primitive API only) |
| Optional 2D | Deck.gl for heatmaps/arcs |
| State Management | Zustand (UI/HUD/scene), React Query (REST only) |
| Post Processing | Cesium `PostProcessStage` chain |
| Relay Service | `harpy-relay` (Rust, Axum) |
| Ingest Service | `harpy-ingest` (Rust, Axum + Tokio) |
| Fusion Service | `harpy-fusion` (Rust) |
| Graph API | `harpy-graph` (Rust) |
| AI Operator Service | `harpy-aip` (Rust or TypeScript) |
| Optional Detection | `harpy-detect` (Python, optional) |
| Hot State | Redis |
| Cold/Audit | PostgreSQL |
| Object Storage | S3 / MinIO |
| Graph Locality | Postgres + H3 cell columns |
| Transport | WebSocket + Protobuf |
| Infra | OCI containers, docker-compose, Kubernetes |
| Security | mTLS between services, signed JWTs, zero-trust internal |
| Observability | Health model, circuit breakers, audit logging |

## Project Structure

```text
HARPY/
├── apps/
│   └── web/                    # Next.js frontend
├── services/
│   ├── harpy-relay/            # WebSocket relay service
│   ├── harpy-ingest/           # Data ingestion service
│   ├── harpy-fusion/           # Fusion/rules engine
│   ├── harpy-graph/            # Graph query API
│   ├── harpy-aip/              # AI platform service
│   └── harpy-detect/           # Optional CV inference
├── proto/                      # Protobuf definitions
├── packages/
│   └── shared-types/           # Shared TypeScript types
├── docker-compose.yml          # Local development stack
├── ADAPTERS.md                 # Provider limits + TOS (to create)
├── AGENTS.md                   # Agent operating context
└── README.md                   # This specification
```

```mermaid
graph
    subgraph Structure["📁 Project Structure"]
        APPS["apps/<br/>Frontend"]
        SERVICES["services/<br/>Backend"]
        CRATES["crates/<br/>Shared"]
        PROTO["proto/<br/>Contracts"]
        DEPLOY["deploy/<br/>K8s/Helm"]
    end
    
    subgraph Apps["🖥️ apps/"]
        WEB["web/<br/>Next.js + Cesium"]
    end
    
    subgraph Svc["🔧 services/"]
        RELAY["harpy-relay"]
        INGEST["harpy-ingest"]
        FUSION["harpy-fusion"]
        GRAPH["harpy-graph"]
        AIP["harpy-aip"]
        DETECT["harpy-detect"]
    end
    
    subgraph Shared["📦 crates/"]
        PROTO_CRATE["harpy-proto"]
        CORE["harpy-core"]
        HEALTH["harpy-health"]
    end
    
    APPS --> WEB
    SERVICES --> RELAY
    SERVICES --> INGEST
    SERVICES --> FUSION
    SERVICES --> GRAPH
    SERVICES --> AIP
    SERVICES --> DETECT
    CRATES --> PROTO_CRATE
    CRATES --> CORE
    CRATES --> HEALTH
```

## Quick Start

### Prerequisites

- Rust toolchain (`cargo`)
- Node.js 20+
- Docker + Docker Compose
- Protobuf compiler (`protoc`)

### Backend Modes

```bash
# Offline mode (mock providers, no external APIs required)
make dev-up-offline

# Online mode (real providers enabled)
make dev-up-online
```

`make dev-up` defaults to offline mode.

### Frontend Modes

```bash
cd apps/web

# Offline globe + offline stream
npm run dev:offline

# Hybrid mode (WS first, mock fallback)
npm run dev:hybrid

# Online mode (WS only + online OSM tiles)
npm run dev:online
```

### Health + Logs

```bash
make dev-health
make dev-status
make dev-logs
make dev-down
```

### Local Production-Readiness (Single Node Demo Spine)

```bash
# Run local single-node confidence checks (WS filtering + metrics)
make confidence-gate

# Build + boot local production stack and run readiness soak checks
make prod-ready-local

# Launch local production stack (without automated gate)
make prod-local
```

### Environment Variables (Operational)

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://harpy:harpy@localhost:5432/harpy` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `ENABLE_REAL_ADSB` | Use OpenSky adapter instead of mock ADS-B | `false` (`.env.offline`) / `true` (`.env.online`) |
| `ENABLE_REAL_TLE` | Use CelesTrak adapter instead of mock TLE | `false` / `true` |
| `ENABLE_REAL_SEISMIC` | Use USGS seismic adapter | `false` / `true` |
| `ENABLE_REAL_WEATHER_NWS` | Use NWS weather adapter | `false` / `true` |
| `ENABLE_REAL_RADAR_NEXRAD` | Use NEXRAD radar adapter | `false` / `true` |
| `OPENSKY_CLIENT_ID` | OpenSky OAuth client ID (optional) | empty (anonymous mode) |
| `OPENSKY_CLIENT_SECRET` | OpenSky OAuth client secret (optional) | empty (anonymous mode) |
| `OPENSKY_ANON_MIN_INTERVAL_SECS` | OpenSky anonymous poll floor | `300` |
| `WS_PORT` | WebSocket relay port | `8080` |
| `NEXT_PUBLIC_STREAM_MODE` | Frontend stream source (`offline`/`online`/`hybrid`) | `hybrid` |
| `NEXT_PUBLIC_MAP_MODE` | Frontend basemap source (`offline`/`online`) | `online` |
| `NEXT_PUBLIC_CESIUM_ION_TOKEN` | Optional token for custom Cesium ion assets | empty |

## Architecture

### System Ontology (Nodes + Edges)

#### Node Entities

| Entity | Description |
|---|---|
| `Track` | Moving object (aircraft, satellite, ground, vessel) |
| `Sensor` | Observation point (camera, radar, seismic station) |
| `Detection` | CV inference tied to a sensor frame |
| `Alert` | Rule/anomaly/convergence event requiring attention |
| `Overlay` | UI-only rendering primitive (no data semantics) |

#### Edge Entity: Link

```text
[Alert] --is_evidenced_by--> [Detection] --captured_by--> [Sensor]
[Track] --observed_by--> [Sensor]
[Track] --associated_with--> [Track]
```

```mermaid
graph LR
    subgraph EvidenceChain["🔗 Evidence Chain Example"]
        ALERT["🚨 Alert<br/>Aircraft Proximity"]
        DETECT["🔍 Detection<br/>CV Inference"]
        SENSOR["📡 Sensor<br/>Camera-001"]
        TRACK1["✈️ Track-001"]
        TRACK2["✈️ Track-002"]
    end
    
    ALERT -->|is_evidenced_by| DETECT
    DETECT -->|captured_by| SENSOR
    SENSOR -->|observed| TRACK1
    SENSOR -->|observed| TRACK2
    TRACK1 -->|proximity| TRACK2
```

**Rule:** Every `Alert` must carry an evidence chain expressed as `Link` edges.

#### Graph Storage and Query

- Hot graph: Postgres tables with indexed foreign keys plus H3 cell columns for locality.
- Optional later-phase similarity: pgvector embeddings for "similar events."
- Graph query API: pre-approved templates only (`/graph/query`) to avoid arbitrary query execution.

### Service Topology (Mermaid)

```mermaid
graph LR
    subgraph Frontend
        WEB["apps/web
Next.js + Cesium"]
    end

    subgraph Backend
        RELAY["harpy-relay
WS fanout auth rate limits"]
        INGEST["harpy-ingest
adapters normalization"]
        FUSION["harpy-fusion
convergence rules alerts"]
        GRAPH["harpy-graph
graph query API"]
        AIP["harpy-aip
AI Operator Interface"]
        DETECT["harpy-detect
optional CV"]
    end

    subgraph Storage
        REDIS[(Redis)]
        PG[(PostgreSQL)]
        S3[(S3/MinIO)]
    end

    subgraph Providers
        ADSB[ADS-B]
        TLE[TLE]
        CAM[Camera]
        WX[Weather Radar]
        SEIS[Seismic]
    end

    WEB <-->|WS protobuf| RELAY
    RELAY --> INGEST
    INGEST --> FUSION
    FUSION --> GRAPH
    RELAY --> AIP
    AIP --> GRAPH

    INGEST --> ADSB
    INGEST --> TLE
    INGEST --> CAM
    INGEST --> WX
    INGEST --> SEIS

    INGEST --> REDIS
    INGEST --> PG
    FUSION --> PG
    GRAPH --> PG
    INGEST --> S3
```

### Frontend Architecture

#### Rendering Stack

- Next.js App Router + React + strict TypeScript.
- CesiumJS Primitive API only (`PointPrimitiveCollection`, `BillboardCollection`, `PolylineCollection`).
- Deck.gl optional for heatmaps/arcs.
- Cesium `PostProcessStage` chain for EO/CRT/NVG/FLIR plus bloom, sharpen, and vignette effects.

#### Client Data Plane (Workers + Transferables)

Main thread only renders. Workers handle all heavy data-plane operations and publish Transferable ArrayBuffers.

| Worker | Responsibility |
|---|---|
| `ws-decode-worker` | Protobuf decode, validation, versioning |
| `track-index-worker` | Dedup, smoothing, interpolation, H3 bucketing |
| `cluster-worker` | Layer-specific clustering rules |
| `pack-worker` | Pack float buffers (lat/lon/alt/heading/speed + colors + id map) |

```mermaid
graph LR
    WS[WebSocket] --> W1[ws-decode-worker]
    W1 --> W2[track-index-worker]
    W2 --> W3[cluster-worker]
    W3 --> W4[pack-worker]
    W4 --> MAIN[Main Thread Cesium Primitive Updates]
```

```mermaid
sequenceDiagram
    participant WS as WebSocket
    participant W1 as ws-decode-worker
    participant W2 as track-index-worker
    participant W3 as cluster-worker
    participant W4 as pack-worker
    participant Main as Main Thread
    participant Cesium as Cesium Primitives

    WS->>W1: Protobuf Envelope
    W1->>W1: Decode
    W1->>W2: TrackDelta[]
    
    W2->>W2: Dedup & Index
    W2->>W3: IndexedTracks
    
    W3->>W3: Cluster
    W3->>W4: Clusters
    
    W4->>W4: Pack TypedArrays
    W4->>Main: Transferable ArrayBuffers
    
    Main->>Cesium: Update Primitives
```

#### TypedArray Buffer Contract (TypeScript)

```typescript
interface RenderPayload {
  positions: Float32Array;  // [lat, lon, alt] * N
  headings: Float32Array;   // N
  speeds: Float32Array;     // N
  kinds: Uint8Array;        // N (enum)
  colors: Uint8Array;       // [r,g,b,a] * N
  ids: Uint32Array;         // N (index into string table)
  id_table: string[];       // cached, sent rarely
}
```

#### UX Surface

| Surface | Location | Function |
|---|---|---|
| DVR Timeline | Bottom | LIVE toggle, scrubber, speed (1x/2x/4x/8x), event markers, seek latency badge |
| DATA LINK | Top-right | Per-provider freshness, circuit state, WebSocket RTT |
| Alert Stack | Right rail | Severity-ranked alerts with expandable evidence chain graph |
| Command Palette | `Ctrl/Cmd+K` | Jump to track/sensor/alert, saved queries, playback commands |
| Shareable Scenes | URL state | Schema-versioned scene encode/decode with safe defaults |

```mermaid
graph TB
    subgraph HUD["🖥️ HUD Layout"]
        TOP["Top Bar<br/>Mode Controls<br/>DATA LINK Panel"]
        RIGHT["Right Rail<br/>Alert Stack"]
        BOTTOM["Bottom Bar<br/>DVR Timeline"]
        CENTER["Center<br/>Cesium Globe"]
        PALETTE["Cmd+K<br/>Command Palette"]
    end
    
    subgraph Controls["🎮 Controls"]
        DVR["DVR:<br/>▶️ ⏸️ ⏮️ ⏭️<br/>1x 2x 4x 8x"]
        LAYERS["Layers:<br/>✈️ 🛰️ 📹 🌊"]
        VISION["Vision:<br/>EO CRT NVG FLIR"]
        HEALTH["Health:<br/>Fresh/Aging/Stale"]
    end
    
    TOP --> LAYERS
    TOP --> VISION
    TOP --> HEALTH
    RIGHT --> HEALTH
    BOTTOM --> DVR
    CENTER --> PALETTE
```

### Backend Architecture

#### Services

| Service | Stack | Purpose |
|---|---|---|
| `harpy-relay` | Axum | WebSocket fanout, auth, rate limits |
| `harpy-ingest` | Axum + Tokio | Provider adapters, normalization |
| `harpy-fusion` | Rust | Convergence + rules engine, emits alerts + links |
| `harpy-graph` | Rust | Graph query API over Postgres |
| `harpy-aip` | Rust or TS | AI operator interface |
| `harpy-detect` | Python (optional) | On-demand CV inference |

#### Storage

| Tier | Technology | Purpose |
|---|---|---|
| Hot state | Redis | Tracks, sensors, subscriptions, freshness |
| Cold/audit | Postgres | Delta index, alerts, link graph, audit logs |
| Object storage | S3/MinIO | Compressed delta segments, snapshots |
| Graph locality | Postgres + H3 columns | Fast region-local graph filtering |

```mermaid
graph TB
    subgraph StorageTiers["💾 Storage Tiers"]
        HOT["🔥 Hot<br/>Redis<br/>1 hour TTL<br/>Active tracks"]
        WARM["📊 Warm<br/>PostgreSQL<br/>30 days<br/>History + Graph"]
        COLD["❄️ Cold<br/>S3/MinIO<br/>7 years<br/>Compliance"]
    end
    
    subgraph AccessPatterns["📈 Access Patterns"]
        REALTIME["Real-time<br/>Streaming"]
        QUERY["Graph Queries<br/>Alerts"]
        AUDIT["Audit Logs<br/>Compliance"]
    end
    
    REALTIME --> HOT
    QUERY --> WARM
    AUDIT --> COLD
```

#### Streaming Protocol (Protobuf)

- Transport: WebSocket with protobuf frames.
- Client subscription dimensions: viewport + layers + time-range (live or playback).
- Server emits frame types:
  - `TrackDeltaBatch` (droppable under backpressure)
  - `AlertUpsert` (never dropped)
  - `ProviderStatus` (never dropped)
  - `SnapshotMeta`
  - `LinkUpsert`
- Backpressure rule: drop `TrackDeltaBatch` first; never drop `AlertUpsert` or `ProviderStatus`.

```mermaid
graph TB
    subgraph Messages["📨 Message Types"]
        TRACK["TrackDeltaBatch<br/>Position updates<br/>⚠️ Droppable"]
        ALERT["AlertUpsert<br/>Alert state<br/>🔒 Never drop"]
        STATUS["ProviderStatus<br/>Health info<br/>🔒 Never drop"]
        SNAPSHOT["SnapshotMeta<br/>Playback data"]
        LINK["LinkUpsert<br/>Graph edges"]
    end
    
    subgraph Priority["🎯 Priority Handling"]
        HIGH["High Priority<br/>Critical alerts<br/>Health status"]
        LOW["Low Priority<br/>Position updates"]
    end
    
    TRACK --> LOW
    ALERT --> HIGH
    STATUS --> HIGH
    SNAPSHOT --> LOW
    LINK --> LOW
```

```proto
syntax = "proto3";
package harpy.v1;

message Envelope {
  string schema_version = 1; // semantic versioning in envelopes
  oneof payload {
    TrackDeltaBatch track_delta_batch = 10;
    AlertUpsert alert_upsert = 11;
    ProviderStatus provider_status = 12;
    SnapshotMeta snapshot_meta = 13;
    LinkUpsert link_upsert = 14;
  }
}
```

#### Health Model (Rust)

- Circuit breaker states: `Closed -> Open -> HalfOpen -> Closed`.
- Freshness levels: `Fresh`, `Aging`, `Stale`, `Critical`.
- Failover behavior: primary provider to fallback provider, surfaced as `ProviderDegraded` alert.

```mermaid
stateDiagram-v2
    [*] --> Closed: Initial
    Closed --> Open: Error rate > 50%
    Open --> HalfOpen: 30s timeout
    HalfOpen --> Closed: Success
    HalfOpen --> Open: Failure
    
    note right of Closed
        Normal operation
        Requests forwarded
    end note
    
    note left of Open
        Circuit tripped
        Returns fallback
        ProviderDegraded alert
    end note
```

| Freshness | HUD Behavior |
|---|---|
| `Fresh` | Normal rendering |
| `Aging` | Subtle dim |
| `Stale` | Fade with timestamp badge |
| `Critical` | Pulsing red border and provider degraded signal |

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Freshness {
    Fresh,
    Aging,
    Stale,
    Critical,
}
```

### AI Operator Interface

The AI Operator Interface (AIP) receives schema summaries and uses tools to produce safe `SEEK`/filter requests. The model never receives raw camera video.

**Primary endpoint:** `/aip/query`

#### AIP Tools

- `seek_to_time(range)`
- `seek_to_bbox(bbox)`
- `set_layers(layer_mask)`
- `run_graph_query(template, params)`

```mermaid
graph LR
    subgraph AI["🤖 AI Operator"]
        LLM["LLM<br/>Schema Summary"]
        TOOLS["Tool Allow-List"]
    end
    
    subgraph Guardrails["🛡️ Guardrails"]
        VALID["Validation"]
        CONFIRM["Human Confirm"]
        AUDIT["Audit Log"]
    end
    
    subgraph Actions["⚡ Actions"]
        SEEK["seek_to_time"]
        BBOX["seek_to_bbox"]
        LAYERS["set_layers"]
        QUERY["run_graph_query"]
    end
    
    LLM --> TOOLS
    TOOLS --> VALID
    VALID --> CONFIRM
    CONFIRM --> ACTIONS
    ACTIONS --> AUDIT
```

#### Guardrails

- Allow-list query templates only.
- Strict validation of tool parameters.
- Audit log every AI action.
- Human confirmation required for scene-altering actions.
- Show structured request before execution for explainability.

#### Operator UX

- Chat/command panel with suggested actions and recent queries.
- Explicit preview/apply flow before snapping scene state.
- Explain mode that returns the exact structured request before execution.

## Deployment

### Cloud, GovCloud, Air-Gapped

```mermaid
graph TB
    subgraph DeploymentModes["🚀 Deployment Modes"]
        LOCAL["💻 Local Dev<br/>docker-compose<br/>Single node"]
        CLOUD["☁️ Cloud<br/>VPC + WAF<br/>Private subnets"]
        GOV["🏛️ GovCloud<br/>Hardened K8s<br/>RBAC + mTLS"]
        AIR["🔒 Air-Gapped<br/>No external calls<br/>Local replay"]
    end
    
    subgraph Infra["🔧 Infrastructure"]
        K8S["Kubernetes"]
        HELM["Helm Charts"]
        KUST["Kustomize"]
    end
    
    LOCAL --> K8S
    CLOUD --> K8S
    GOV --> K8S
    AIR --> K8S
    
    K8S --> HELM
    K8S --> KUST
```

- **Local dev**: Single-node docker-compose stack.
- **Cloud**: VPC deployment, private subnets, WAF ingress.
- **GovCloud**: Hardened Kubernetes profile.
- **Air-gapped**: No external calls, local-only replay and operation.

### Security Baseline

- mTLS between services.
- Signed JWTs for service-to-service auth.
- Zero-trust internal networking model.
- Secrets in environment/secret store only (never in frontend).
- Default minimal retention with per-provider retention policy as code.
- RBAC/ABAC roles are part of the enterprise posture (Phase 4).
- Audit logging includes operator and AI queries, seeks, exports, and scene actions.

## Engineering Guidelines

### TypeScript (Frontend)

- Use strict mode.
- Prefer explicit types for public APIs.
- Use Zustand for scene/UI/HUD state.
- Use React Query only for non-streaming REST.
- Use Transferables for large worker payloads (avoid structured clone for large arrays).

### Rust (Backend)

- Use Axum for HTTP/WebSocket services.
- Use Tokio for async runtime.
- Prefer single-binary outputs.
- Apply circuit breaker and backpressure patterns to external calls.

### Protocol + Platform Rules

- Protobuf for all streaming messages.
- JSON only as dev fallback.
- Semantic versioning in message envelopes.
- Do not use Cesium Entity API above ~500 objects.
- Audit log every operator query/seek/export and AI action.

## Testing Strategy

### Unit Tests

- Worker logic (parsing, indexing, clustering).
- Protocol encoding/decoding.
- Fusion rules engine.

### Integration Tests

- WebSocket subscription lifecycle.
- Provider adapter error handling.
- Circuit breaker behavior.

### Performance Tests

- Bundle size monitoring in CI.
- Worker compile time in CI.
- Render frame budget target: 16 ms.

## Roadmap (Phased Checklist)

| Phase | Timeline | Deliverables |
|---|---|---|
| **Phase 0** | 2-3 days | Monorepo, `harpy.proto` v1, mock providers, docker-compose, CI |
| **Phase 1** | Week 1-2 | Console + live streaming + health |
| **Phase 2** | Week 3 | DVR time-travel + snapshots + shareable scenes |
| **Phase 3** | Week 4-6 | Dynamic ontology + fusion alerts + graph queries |
| **Phase 4** | Week 7+ | Enterprise posture (K8s/RBAC/GovCloud), optional CV |

```mermaid
gantt
    title HARPY Development Roadmap
    dateFormat YYYY-MM-DD
    section Phase 0
    Infrastructure         :done, p0, 2026-02-18, 3d
    section Phase 1
    Live Streaming         :done, p1, after p0, 10d
    section Phase 2
    DVR + Snapshots        :p2, after p1, 7d
    section Phase 3
    Fusion + Alerts        :p3, after p2, 14d
    section Phase 4
    Enterprise             :p4, after p3, 14d
```

### Phase 0

- [x] Workspace structure: `apps/web`, `services/*`, `proto`, `packages/shared-types`.
- [x] Define `harpy.proto` v1 contracts (`TrackDeltaBatch`, `AlertUpsert`, `ProviderStatus`, `SnapshotMeta`, `LinkUpsert`).
- [x] Create deterministic mock providers (ADS-B + TLE mock streamer in frontend).
- [x] Configure local stack (`postgres + redis + relay + ingest`) in docker-compose.
- [x] Configure CI (`lint`, `test`, `build`, frontend build, compose smoke checks).

### Phase 1

- [x] Frontend shell: Cesium Viewer + HUD chrome (layers, controls, data link, mode bar).
- [x] Vision mode chain (EO/CRT/NVG/FLIR) with `PostProcessStage` controls.
- [x] Worker pipeline: `ws-decode -> track-index -> cluster -> pack -> primitives`.
- [ ] Layer toggles drive subscription messages (connected to mock but not to WS).
- [ ] Clustering v0 by mission semantics (aircraft, satellites, cameras).
- [ ] `harpy-relay` fanout with auth placeholder, subscription registry, backpressure.
- [ ] `harpy-ingest` primary/fallback adapter scaffolds with normalization.
- [ ] Provider health + circuit breaker emissions (`ProviderStatus`).
- [ ] Hot-state Redis caching + TTL staleness behavior.
- [ ] Author `ADAPTERS.md` with provider limits/TOS/retention defaults.

### Phase 2

- [ ] Bottom timeline controls: LIVE toggle, scrub, play/pause, speed, seek latency.
- [ ] Shareable scene URLs with versioned state encode/decode.
- [ ] Playback rendering from snapshot + delta ranges.
- [ ] Satellite propagation against playback clock.
- [ ] Delta log segments with snapshot index cadence.
- [ ] Seek API for viewport + time range retrieval.
- [ ] Enforce documented backpressure semantics.

### Phase 3

- [ ] Alert details panel renders evidence graph (`Alert -> Detection -> Sensor -> Track`).
- [ ] Safe graph query templates for common operator investigations.
- [ ] `harpy-fusion` v1: H3 bucketing, convergence rules, alert dedup TTL.
- [ ] `harpy-graph` template APIs with indexing + pagination.
- [ ] Full operator + AI action audit logging.

### Phase 4

- [ ] Kubernetes manifests + hardened Helm charts + GovCloud profile.
- [ ] RBAC/ABAC roles, signed exports, watermarking.
- [ ] Optional `harpy-detect` with on-demand camera inference and privacy filters.

## Useful Resources

- [CesiumJS Documentation](https://cesium.com/learn/cesiumjs-learn/)
- [Cesium Primitive API Guide](https://cesium.com/learn/cesiumjs-learn/geometry-appearances/)
- [Axum Web Framework](https://docs.rs/axum/latest/axum/)
- [Tokio Runtime](https://tokio.rs/)
- [H3 Geospatial Indexing](https://h3geo.org/)

## Key Documents

| Document | Purpose |
|---|---|
| `README.md` | Full YC-grade specification v2.2 |
| `AGENTS.md` | Context for AI coding agents |
| `ADAPTERS.md` | Provider rate limits and TOS compliance |
| `proto/harpy/v1/harpy.proto` | Streaming protocol definitions |

## Appendix: Link Schema

```typescript
interface Link {
  id: string;
  from: { type: 'Track' | 'Sensor' | 'Detection' | 'Alert'; id: string };
  rel:
    | 'observed_by'
    | 'captured_by'
    | 'is_evidenced_by'
    | 'triggers'
    | 'associated_with';
  to: { type: 'Track' | 'Sensor' | 'Detection' | 'Alert'; id: string };
  ts_ms: number; // int64 epoch ms
  meta?: object;
}
```

## Contributing

- Preserve non-negotiable constraints in every PR.
- Keep protocol/schema changes backward-compatible and versioned.
- Update `AGENTS.md` and `ADAPTERS.md` whenever architecture or provider behavior changes.
- Add tests for worker logic, protocol contracts, and reliability flows (backpressure/circuit breaker).

## License

Proprietary - Copyright (c) 2026 Angel L. Pinzon. All rights reserved.
