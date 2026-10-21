# Observation contract `harpy.observation/1`

Implemented in `services/harpy-core/src/model.rs`, mirrored in `apps/web/src/lib/types.ts`.

## Observation (one revision)

| Field | Type | Meaning |
|---|---|---|
| `observation_id` | string | Stable HARPY identity, `<source>:<upstream id>` |
| `revision` | int ≥ 1 | New revision when the upstream record's digest changes. Old revisions are never modified. |
| `observation_type` | `measured` \| `calculated` \| `inferred` \| `asserted` | How it came to exist |
| `kind` | string | `earthquake`, `orbital_elements`, `satellite_position` |
| `source_id` | string | `usgs`, `celestrak`, `harpy-sgp4`; later `geowraith-geoclip` |
| `upstream_id` | string? | The provider's own ID |
| `observed_at` | unix ms | When the source says it happened. For element sets: the element epoch. |
| `source_updated_at` | unix ms? | When the source last changed the record |
| `ingested_at` | unix ms | When HARPY stored this revision |
| `geometry` | GeoJSON? | WGS84. Null for records with no fixed location (element sets). |
| `uncertainty` | JSON? | Only when the source provides it. Never invented. |
| `evidence_refs` | string[] | e.g. `celestrak:25544@3` for a calculated position |
| `model_version` | string? | Inferred observations only |
| `license_class` | string | See `docs/providers.md` |
| `source_url` | string? | Link back to the source record |
| `raw_payload_digest` | hex SHA-256 | Canonical JSON of the upstream record; the record itself is in `raw_records` |
| `attributes` | object | Source-specific (magnitude, OMM, etc.) |
| `history` | array | Export only: `{revision, ingested_at, source_updated_at, raw_payload_digest}` per revision |

## Display states

| State | Rule |
|---|---|
| `LIVE` | Live mode, archive younger than `stale_after_s`, provider `HEALTHY` or `DEGRADED` |
| `STALE` | Live mode and either the archive is old or the provider is not reachable |
| `RECORDED` | Any measured record while replaying history |
| `CALCULATED` | SGP4 position from an element set within 3 days of the display time |
| `INFERRED` | Model output (reserved, Milestone B) |
| `SOURCE_UNAVAILABLE` | A layer has nothing genuine to show and its provider is `UNAVAILABLE` or `NEVER_RUN` |
| `INSUFFICIENT_EVIDENCE` | No defensible value; nothing is drawn (e.g. no element set within 3 days) |

Rules live in `apps/web/src/lib/state.ts` and are unit-tested.

## Provider state

Derived from `fetch_log`, never from record counts. Only endpoints attempted in the latest cycle vote.

| State | Rule |
|---|---|
| `HEALTHY` | Every voting endpoint's last attempt succeeded with zero invalid records. An empty feed is healthy. |
| `DEGRADED` | Some voting endpoint failed once, or returned invalid records |
| `UNAVAILABLE` | Every voting endpoint has failed at least twice in a row |
| `NEVER_RUN` | No attempts recorded |

An HTTP 200 with a body that isn't the expected shape is a failure.

## Documents (`data/v1/`)

`meta.json`, `providers.json`, `fetch-log.json`, `earthquakes/index.json`, `earthquakes/day/YYYY-MM-DD.json`, `satellites/latest.json`, `satellites/index.json`, `satellites/day/YYYY-MM-DD.json`. The live server also exposes `/api/v1/observations/{id}/history` (with raw records) and `/api/v1/satellites/{norad}/position?t=`.
