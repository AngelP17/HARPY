# HARPY architecture

How HARPY Monitor v0.1 works, end to end, with diagrams. Every diagram below describes code that exists in this repository; file paths are given so each claim can be checked.

- Contract details: [`docs/contracts/observation.md`](contracts/observation.md)
- Why it is built this way: [`docs/decisions/0001-canonical-architecture.md`](decisions/0001-canonical-architecture.md)
- Proof it runs on real data: [`docs/evidence/2026-10-21-first-live-run.md`](evidence/2026-10-21-first-live-run.md)

## Contents

1. [System overview](#1-system-overview)
2. [Repository map](#2-repository-map)
3. [Ingestion lifecycle](#3-ingestion-lifecycle)
4. [Scheduled production pipeline](#4-scheduled-production-pipeline)
5. [Storage model](#5-storage-model)
6. [Revisions: how corrections are kept](#6-revisions-how-corrections-are-kept)
7. [Provider health](#7-provider-health)
8. [Display states](#8-display-states)
9. [Satellite positions (SGP4)](#9-satellite-positions-sgp4)
10. [Replay](#10-replay)
11. [Web application](#11-web-application)
12. [Deployment topologies](#12-deployment-topologies)
13. [Verification lanes](#13-verification-lanes)
14. [Failure modes](#14-failure-modes)
15. [Roadmap: Milestone B (GeoWraith)](#15-roadmap-milestone-b-geowraith)

---

## 1. System overview

```mermaid
flowchart LR
    subgraph Upstream["Real public sources"]
        USGS["USGS Earthquake Hazards<br/>GeoJSON summary feeds"]
        CT["CelesTrak<br/>GP element sets (OMM JSON)"]
    end

    subgraph Core["harpy-core (Rust)"]
        ING["Provider adapters<br/>fetch, retry, validate"]
        DB[("SQLite WAL<br/>observations, raw_records,<br/>fetch_log")]
        HEALTH["Provider health<br/>derived from fetch_log"]
        SGP4["SGP4 propagator<br/>AFSPC mode"]
        DOCS["Document builder<br/>data/v1/*.json"]
        API["Read-only HTTP API<br/>+ /metrics"]
    end

    subgraph Delivery["Delivery"]
        PAGES["GitHub Pages<br/>static archive"]
        SERVER["Live server<br/>harpy-core serve"]
    end

    subgraph Browser["Browser"]
        WEB["Next.js static app<br/>Cesium globe"]
        SJS["satellite.js<br/>client SGP4"]
    end

    USGS -->|HTTPS| ING
    CT -->|HTTPS, max 1x per group per 2 h| ING
    ING --> DB
    DB --> HEALTH
    DB --> DOCS
    HEALTH --> DOCS
    SGP4 --> API
    DB --> API
    DOCS -->|harpy-core export| PAGES
    DOCS -->|rendered per request| SERVER
    API --- SERVER
    PAGES -->|GET data/v1| WEB
    SERVER -->|GET data/v1| WEB
    WEB --> SJS
```

The web app has exactly one way to get data: `GET data/v1/<document>.json`. Both deployments produce the same documents from the same builder (`services/harpy-core/src/export.rs`), so there is no alternate path to fall back to.

## 2. Repository map

```mermaid
flowchart TB
    ROOT["HARPY/"]
    ROOT --> CORE["services/harpy-core/"]
    ROOT --> WEB["apps/web/"]
    ROOT --> TESTS["tests/fixtures/<br/>recorded real records, test-only"]
    ROOT --> GHA[".github/workflows/"]
    ROOT --> DOCSDIR["docs/"]
    ROOT --> DEPLOY["deploy/<br/>Dockerfile, Caddyfile"]
    ROOT --> SCRIPTS["scripts/live-acceptance.mjs"]

    CORE --> C1["src/providers/usgs.rs, celestrak.rs, mod.rs"]
    CORE --> C2["src/db.rs + migrations/0001_init.sql"]
    CORE --> C3["src/status.rs"]
    CORE --> C4["src/orbit.rs"]
    CORE --> C5["src/export.rs"]
    CORE --> C6["src/api.rs, src/main.rs"]
    CORE --> C7["tests/pipeline.rs"]

    WEB --> W1["src/lib/: types, state rules, store,<br/>orbit, selectors, deeplink"]
    WEB --> W2["src/components/: Globe, Inspector,<br/>EventsTable, Timeline, LeftRail, TopBar"]
    WEB --> W3["scripts/: copy-cesium, check-no-mocks"]

    GHA --> G1["ci.yml"]
    GHA --> G2["monitor.yml"]
```

## 3. Ingestion lifecycle

Each fetch, for either provider, follows the same path (`services/harpy-core/src/providers/mod.rs`).

```mermaid
flowchart TD
    START(["Ingest cycle"]) --> THROTTLE{"CelesTrak group fetched<br/>in the last 2 h?"}
    THROTTLE -->|yes| SKIP["Skip download<br/>no fetch_log row"]
    THROTTLE -->|no, or USGS| GET["HTTP GET with User-Agent"]
    GET --> RESP{"Response"}
    RESP -->|transport error, 429, 5xx| RETRY{"Attempts left?<br/>max 3, backoff 1 s, 2 s"}
    RETRY -->|yes| GET
    RETRY -->|no| FAIL["Record failure:<br/>ok=false, http_status, error"]
    RESP -->|other 4xx| FAIL
    RESP -->|2xx| PARSE{"Body is the expected shape?<br/>FeatureCollection / OMM array"}
    PARSE -->|no: HTML, text, wrong type| FAIL
    PARSE -->|yes| EACH["Validate each record"]
    EACH --> VALID{"Record valid?<br/>id, coords in range, time,<br/>SGP4 accepts elements"}
    VALID -->|no| INVALID["Skip and count records_invalid<br/>never repaired"]
    VALID -->|yes| DIGEST["SHA-256 of canonical JSON"]
    DIGEST --> SAME{"Same digest as<br/>latest revision?"}
    SAME -->|yes| UNCHANGED["records_unchanged"]
    SAME -->|no, exists| REVISED["Insert revision n+1<br/>records_revised"]
    SAME -->|no, new id| NEW["Insert revision 1<br/>records_new"]
    UNCHANGED --> COMMIT
    REVISED --> COMMIT
    NEW --> COMMIT
    INVALID --> COMMIT
    COMMIT["One transaction per fetch"] --> OK["Record success in fetch_log<br/>metrics: harpy_fetch_total, harpy_records_total"]
```

Rules this enforces:

- An empty feed is a successful fetch.
- An HTTP 200 whose body isn't the expected shape is a failure.
- Bad records are skipped and counted, never "fixed".
- Nothing is ever generated to fill a gap.

## 4. Scheduled production pipeline

The public deployment runs as a GitHub Actions workflow every 15 minutes (`.github/workflows/monitor.yml`).

```mermaid
sequenceDiagram
    autonumber
    participant Cron as GitHub cron (*/15)
    participant Run as monitor.yml runner
    participant Data as harpy-data branch
    participant USGS as USGS
    participant CT as CelesTrak
    participant Pages as GitHub Pages

    Cron->>Run: start (concurrency group harpy-monitor)
    Run->>Data: git fetch harpy.sqlite.zst
    Data-->>Run: last database (or none on first run)
    Run->>Run: cargo build --release harpy-core
    Run->>USGS: GET all_week (first run only), all_day
    USGS-->>Run: GeoJSON
    Run->>CT: GET groups older than 2 h
    CT-->>Run: OMM JSON
    Run->>Run: harpy-core check (PRAGMA integrity_check)
    Run->>Run: harpy-core export --out site
    Run->>Run: node scripts/live-acceptance.mjs (13 checks)
    Run->>Run: build web (cached) + no-mock guard
    Run->>Data: VACUUM INTO, zstd -19, force-push single commit
    Run->>Pages: upload artifact, deploy
    Note over Run: A failed provider is recorded and published honestly.<br/>Live acceptance failure marks the run red after publishing.
```

## 5. Storage model

Schema: `services/harpy-core/migrations/0001_init.sql`.

```mermaid
erDiagram
    OBSERVATIONS {
        TEXT observation_id PK "usgs:us6000u3rr, celestrak:25544"
        INTEGER revision PK "1..n, append-only"
        TEXT observation_type "measured, calculated, inferred, asserted"
        TEXT kind "earthquake, orbital_elements"
        TEXT source_id
        TEXT upstream_id
        INTEGER observed_at "event time or element epoch, unix ms"
        INTEGER source_updated_at
        INTEGER ingested_at
        REAL lat
        REAL lon
        TEXT geometry "GeoJSON"
        TEXT uncertainty "only if the source provides it"
        TEXT evidence_refs "JSON array"
        TEXT model_version "Milestone B"
        TEXT license_class
        TEXT source_url
        TEXT raw_payload_digest FK "SHA-256"
        TEXT attributes "JSON, source-specific"
    }
    RAW_RECORDS {
        TEXT digest PK "SHA-256 of canonical JSON"
        TEXT source_id
        INTEGER fetched_at
        TEXT body "exact upstream record"
    }
    FETCH_LOG {
        INTEGER id PK
        TEXT source_id
        TEXT endpoint
        INTEGER started_at
        INTEGER finished_at
        INTEGER http_status
        INTEGER ok
        INTEGER records_seen
        INTEGER records_new
        INTEGER records_revised
        INTEGER records_unchanged
        INTEGER records_invalid
        TEXT error
    }
    OBSERVATIONS }o--|| RAW_RECORDS : "built from"
    FETCH_LOG ||..o{ OBSERVATIONS : "logs the fetch (conceptual, no FK)"
```

Retention runs after each ingest: earthquakes by event time (30 days on the public deploy), element sets by epoch (10 days), fetch log 14 days, then orphaned raw records.

## 6. Revisions: how corrections are kept

USGS regularly revises events after analyst review. HARPY keeps both versions. Proven in `tests/pipeline.rs`, step 3.

```mermaid
sequenceDiagram
    participant USGS
    participant Core as harpy-core
    participant DB as SQLite

    USGS->>Core: us6000u3jl M6.3, updated T1
    Core->>DB: digest A is new: insert revision 1, raw record A
    USGS->>Core: same event, same body
    Core->>DB: digest A matches latest: unchanged, no write
    USGS->>Core: us6000u3jl M6.4, updated T2 (reviewed)
    Core->>DB: digest B differs: insert revision 2, raw record B
    Note over DB: revision 1 (M6.3) and its raw record remain.<br/>The UI shows revision 2 with the full history list.
```

## 7. Provider health

Derived only from `fetch_log` (`services/harpy-core/src/status.rs`), never from how many records came back. Only endpoints attempted in the latest cycle (within 10 minutes of the newest attempt) vote. That stops a one-time bootstrap success from hiding a live outage.

```mermaid
stateDiagram-v2
    [*] --> NEVER_RUN
    NEVER_RUN --> HEALTHY: fetch ok, 0 invalid
    NEVER_RUN --> DEGRADED: fetch ok with invalid records
    NEVER_RUN --> DEGRADED: first failure
    HEALTHY --> DEGRADED: one failure, or invalid records
    DEGRADED --> HEALTHY: next fetch ok, 0 invalid
    DEGRADED --> UNAVAILABLE: every voting endpoint failed 2+ times in a row
    UNAVAILABLE --> HEALTHY: fetch ok
    HEALTHY --> HEALTHY: fetch ok, even with 0 records
```

## 8. Display states

Rules in `apps/web/src/lib/state.ts`, unit-tested in `state.test.ts`.

```mermaid
flowchart TD
    OBJ["Object to display"] --> KIND{"What is it?"}

    KIND -->|"measured record (earthquake)"| MODE{"Time mode"}
    MODE -->|replay| RECORDED["RECORDED"]
    MODE -->|live| FRESH{"Archive younger than stale_after_s<br/>AND provider HEALTHY or DEGRADED?"}
    FRESH -->|yes| LIVE["LIVE"]
    FRESH -->|no| STALE["STALE"]

    KIND -->|satellite| WIN{"Stored element set within<br/>3 days of display time?"}
    WIN -->|yes| PROP{"SGP4 propagates?"}
    PROP -->|yes| CALC["CALCULATED<br/>evidence ref: celestrak:NORAD@rev"]
    PROP -->|no| INSUF["INSUFFICIENT_EVIDENCE<br/>nothing drawn"]
    WIN -->|no| INSUF

    KIND -->|"empty layer"| LAYER{"Provider UNAVAILABLE<br/>or NEVER_RUN?"}
    LAYER -->|yes| UNAVAIL["SOURCE_UNAVAILABLE"]
    LAYER -->|no| EMPTY["Honest empty state<br/>(a quiet window is not an outage)"]

    KIND -->|"model output (Milestone B)"| INFERRED["INFERRED<br/>model version + uncertainty"]
```

## 9. Satellite positions (SGP4)

The same computation runs in Rust (`orbit.rs`, used by the API and tests) and in the browser (`apps/web/src/lib/orbit.ts`).

```mermaid
flowchart LR
    OMM["CelesTrak OMM element set<br/>EPOCH, mean motion, e, i, RAAN,<br/>arg. perigee, mean anomaly, B*"] --> CHOOSE{"Nearest epoch within<br/>3 days of time t?"}
    CHOOSE -->|no| WITHHOLD["Withheld<br/>INSUFFICIENT_EVIDENCE"]
    CHOOSE -->|yes| INIT["SGP4 init<br/>AFSPC compatibility mode"]
    INIT --> PROP["Propagate to t<br/>minutes since epoch"]
    PROP --> TEME["Position in TEME frame (km)"]
    TEME --> ROT["Rotate by IAU-82 GMST(t)"]
    ROT --> ECEF["Earth-fixed x, y, z"]
    ECEF --> GEO["WGS84 geodetic<br/>lat, lon, altitude"]
    GEO --> DRAW["Cesium point + label<br/>orbit track: one period around t"]
```

Accuracy evidence:

| Check | Result | Where |
|---|---|---|
| Rust vs Vallado SGP4 verification vectors (sat 00005, t = 0 to 1440 min) | under 1 cm per axis | `orbit.rs` `matches_vallado_verification_vectors` |
| GMST at J2000 vs reference 280.46061837° | under 1e-6° | `orbit.rs` `gmst_at_j2000_matches_reference` |
| Browser (satellite.js 6.0.2) vs Rust golden positions, 6 epochs over 2 days | ~5 m horizontal, ~1 cm altitude | `apps/web/src/lib/orbit.test.ts` |
| SGP4's own model error | ~1 km at epoch, grows 1 to 3 km/day | why the 3-day window exists |

## 10. Replay

Replay reconstructs only what HARPY stored (`apps/web/src/lib/store.ts`, `selectors.ts`).

```mermaid
sequenceDiagram
    participant User
    participant TL as Timeline scrubber
    participant Store as App store
    participant Data as data/v1

    User->>TL: drag to 2026-10-17 07:02Z
    TL->>Store: setCursor(t), mode = replay
    Store->>Data: earthquakes/day/2026-10-16.json, 2026-10-17.json
    Store->>Data: satellites/day/2026-10-14 ... 2026-10-18.json
    Data-->>Store: stored observations and element revisions
    Store->>Store: quakes with observed_at in [t - 24 h, t]
    Store->>Store: element set nearest t within 3 days, per satellite
    Store-->>User: RECORDED quakes, CALCULATED satellites,<br/>"N satellites withheld" for the rest
    Note over TL: Range is bounded by recorded history.<br/>Before it: "History unavailable".
```

## 11. Web application

```mermaid
flowchart TB
    subgraph Data["src/lib"]
        DATA["data.ts<br/>getDoc: one fetch path, typed errors"]
        STORE["store.ts (zustand)<br/>core docs, day docs, cursor, mode,<br/>selection, layers, style"]
        STATE["state.ts<br/>display-state rules"]
        SEL["selectors.ts<br/>quakes in window, elements at cursor"]
        ORB["orbit.ts<br/>satellite.js SGP4"]
        DL["deeplink.ts<br/>#sat= / #eq="]
    end

    subgraph UI["src/components"]
        APP["App.tsx<br/>polling, clock, playback, banners"]
        TOP["TopBar"]
        LEFT["LeftRail<br/>layers, sources, legend"]
        GLOBE["Globe.tsx<br/>Cesium primitives"]
        INS["Inspector<br/>provenance, revisions"]
        TBL["EventsTable"]
        TIME["Timeline<br/>hourly histogram + scrubber"]
    end

    DATA --> STORE
    STORE --> SEL
    STATE --> SEL
    SEL --> GLOBE
    SEL --> INS
    SEL --> TBL
    ORB --> GLOBE
    ORB --> INS
    DL --> APP
    APP --> TOP
    APP --> LEFT
    APP --> GLOBE
    APP --> INS
    APP --> TBL
    APP --> TIME
    TIME --> STORE
    GLOBE -->|click selects| STORE
```

Globe details:

- **Imagery:** Natural Earth II, bundled with CesiumJS and served from this site. No Cesium Ion token, no third-party tiles.
- **Lighting:** the day/night terminator follows the real sun position at the display time.
- **Styles:** Standard, Night, and Thermal look are imagery colour adjustments and are labelled as such. They are not sensor data.

## 12. Deployment topologies

```mermaid
flowchart LR
    subgraph A["Public archive (default)"]
        GA["GitHub Actions<br/>monitor.yml every 15 min"] --> GP["GitHub Pages<br/>static files"]
        GA <--> HD[("harpy-data branch<br/>harpy.sqlite.zst")]
        GP --> V1["Visitors<br/>read-only"]
    end

    subgraph B["Live server (optional)"]
        CADDY["Caddy / nginx<br/>TLS, per-IP rate limit,<br/>/metrics blocked"] --> HC["harpy-core serve<br/>127.0.0.1:8080<br/>scheduler + API + web"]
        HC <--> SQ[("SQLite WAL<br/>/data volume")]
        HC --> PROM["Prometheus scrape<br/>(internal)"]
        V2["Visitors<br/>read-only"] --> CADDY
    end
```

| | Public archive | Live server |
|---|---|---|
| Data cadence | 15 min (GitHub cron can lag) | USGS 60 s, CelesTrak per group 2 h |
| Write surface | None | None (no write routes; POST returns 405) |
| Backups | Every run, to `harpy-data` | `harpy-core backup` (VACUUM INTO) on a timer |
| Cost | Free on a public repo | One small VM |

## 13. Verification lanes

```mermaid
flowchart LR
    subgraph CI["ci.yml: every push and PR"]
        U["Rust unit tests<br/>parsers, health, SGP4 vectors"]
        I["Integration test<br/>real HTTP + SQLite:<br/>ingest, revise, restart,<br/>outage, export, API"]
        W["Web: tsc, eslint, vitest<br/>state rules, deep links,<br/>Rust vs JS golden"]
        B["next build + no-mock guard"]
    end

    subgraph LIVE["monitor.yml: every 15 min"]
        L["Live acceptance<br/>13 checks on today's data"]
    end

    FX["tests/fixtures<br/>recorded real records"] --> U
    FX --> I
    FX --> W
    UP["Real upstream"] --> L
```

| Lane | Proves | Never proves |
|---|---|---|
| CI | Code is correct and deterministic | That upstream is reachable today |
| Integration | Processes, files, HTTP, and restarts work together | That upstream is reachable today |
| Live acceptance | Real data arrived, IDs are real, timestamps are sane, ISS elements are current | Anything about code paths it didn't exercise |

## 14. Failure modes

| Failure | What HARPY does | Tested in |
|---|---|---|
| USGS returns 503 twice | Provider `UNAVAILABLE`, stored events kept, nothing synthesized, banner shown | `pipeline.rs` step 4 |
| HTTP 200 with an HTML maintenance page | Fetch recorded as failed ("invalid payload") | `pipeline.rs` step 5, `usgs.rs` |
| Empty feed | `HEALTHY`, honest empty window | `status.rs`, `usgs.rs` |
| A record with impossible coordinates | Skipped and counted as invalid; provider `DEGRADED` | `usgs.rs`, `status.rs` |
| CelesTrak plain-text throttle reply | Failure, not data | `celestrak.rs` |
| Element set older than 3 days | Satellite withheld, counted in the UI | `state.test.ts`, `pipeline.rs` step 7 |
| Ingestion stops running | Snapshot age grows; records flip to `STALE`; warning banner | `state.test.ts` |
| Archive can't be loaded at all | Full-screen `SOURCE_UNAVAILABLE`, retry button, no demo data | Screenshot below |
| Process restart | Identical data on reopen | `pipeline.rs` step 2 |
| Database loss | Restore from `harpy-data` or backup file | `backup_produces_consistent_copy`, runbook |

![Archive unavailable](images/archive-unavailable.jpg)

## 15. Roadmap: Milestone B (GeoWraith)

Not built yet. Blocked on model assets and an owner-set accuracy gate ([ADR 0002](decisions/0002-geowraith-accuracy-gate.md)).

```mermaid
flowchart TD
    G0["Owner sets accuracy thresholds<br/>(ADR 0002)"] --> G1["Scripted, checksummed GeoCLIP<br/>ONNX weights + index build"]
    G1 --> G2["Im2GPS3k benchmark<br/>with corpus leakage removed"]
    G2 --> GATE{"Meets thresholds?"}
    GATE -->|no| EXP["Region-level output or experimental only.<br/>No inflated claims."]
    GATE -->|yes| W["GeoWraith worker on 127.0.0.1:8090<br/>CandidateGenerator required,<br/>CandidateReranker starts disabled"]
    W --> AUTH["Authenticated, rate-limited, budget-capped<br/>uploads via harpy-core only"]
    AUTH --> INF["Results stored as INFERRED observations<br/>model + index version"]
    INF --> CASES["Investigations: events + images + inferences + notes"]
    CASES --> REPORT["JSON + PDF reports with provenance"]
```
