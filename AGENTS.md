# AGENTS.md: HARPY

For AI coding agents (Claude Code, Codex) working in this repo. Read this, `docs/HARPY_DIRECTIVE.md`, and the latest file in `docs/audit/` before changing anything.

## What ships

- `services/harpy-core`: the only backend. Rust. Ingests USGS + CelesTrak, stores append-only revisions in SQLite, derives provider health, propagates SGP4, exports `data/v1` documents, serves a read-only API.
- `apps/web`: Next.js static export + Cesium. Reads only `data/v1/*.json`.
- `.github/workflows/monitor.yml`: the production pipeline for the public GitHub Pages deployment.

## Non-negotiables

1. **No fabricated data in production paths.** No mock providers, synthetic tracks, demo streams, placeholder inference, or "fallback" data of any kind. A failing source is shown as `SOURCE_UNAVAILABLE` / `STALE`. This replaces the old rule that mandated mock fallback; that rule is gone.
2. **Fixtures are test-only** and live under `tests/fixtures/` with provenance in its README. `apps/web/scripts/check-no-mocks.mjs` fails CI if the shipped bundle references them.
3. **Provenance on every observation** per `docs/contracts/observation.md`. Corrections are new revisions; never update or delete a stored revision except through retention.
4. **Health is not content.** Empty feed = healthy. HTTP 200 with a bad body = failure.
5. **Provider terms** in `docs/providers.md` are binding. Respect CelesTrak's refresh throttle and robots rules. No OpenSky, no scraped cameras.
6. **Visual styles are labelled as styles.** No sensor names on shaders.
7. **No new infrastructure** (Redis, Postgres, k8s, extra services) without a measured need recorded in an ADR.
8. **Done means evidence:** a passing test, a successful real run, and a demonstrated failure path.

## Commands

```bash
make test     # cargo test -p harpy-core + vitest (fixtures only, deterministic)
make lint     # fmt, clippy -D warnings, tsc, eslint
make ingest   # one real cycle into data/harpy.sqlite (needs internet)
make dev      # export + Next dev server
make serve    # live server + web on 127.0.0.1:8080
```

## Test lanes

- CI (`ci.yml`): deterministic, recorded real-source fixtures, never calls upstream.
- Integration (`services/harpy-core/tests/pipeline.rs`): real HTTP, real SQLite files, restart, outage, revision, export, API.
- Live acceptance (`scripts/live-acceptance.mjs`, run by `monitor.yml`): today's upstream. Only this lane may claim live data works.

## Agent roles

`.claude/agents/`: `Explore` and `researcher` (Haiku, read-only) for search and research; `worker` (Opus) for edits and test runs. Keep PRs small and one concern each.
