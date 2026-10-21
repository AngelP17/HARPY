# HARPY runbook

## Deployments

| | Public archive (default) | Live server (optional) |
|---|---|---|
| Where | GitHub Pages, `https://angelp17.github.io/HARPY/` | Any Linux host behind a TLS proxy |
| Data cadence | Every 15 min (GitHub cron, can lag) | USGS every 60 s, CelesTrak per group every 2 h |
| Database | `harpy.sqlite.zst` on the orphan `harpy-data` branch | Local file, `harpy-core backup` on a timer |
| Writes from the public | None (static files) | None (no write routes) |

## One-time setup for the public archive

1. Merge the PR into `main`.
2. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Actions → Monitor (ingest + publish) → Run workflow** (tick "force CelesTrak" for the first run).
4. The first run backfills 7 days from the USGS weekly feed and creates the `harpy-data` branch. The run summary shows the ingest report and the live acceptance table.

## Routine checks

- Actions tab: each Monitor run should be green. A red run with "Live acceptance failed" means an upstream or freshness check failed; the honest state was still published.
- The site's top bar shows snapshot age. More than ~1 h means the schedule isn't running.

## Incidents

**USGS or CelesTrak unavailable.** Nothing to do immediately; the UI shows `UNAVAILABLE`/`STALE`, stored data stays. Check the fetch log panel for the error. If CelesTrak returns 403, we've been throttled or blocked: raise `HARPY_CELESTRAK_MIN_REFRESH_SECS`, drop groups, and contact CelesTrak if it persists.

**Schedule stopped.** GitHub disables cron workflows after 60 days without repo activity. Re-enable under Actions → Monitor → "Enable workflow", then run it manually.

**Database corrupt or lost.**
```bash
git fetch origin harpy-data
git show FETCH_HEAD:harpy.sqlite.zst > harpy.sqlite.zst && zstd -d harpy.sqlite.zst
./target/release/harpy-core check --db harpy.sqlite      # expects "integrity":"ok"
```
If the branch is gone, deleting nothing else and re-running the workflow starts a fresh store (7-day USGS backfill; satellite history restarts).

**Need to wipe and restart.** `git push origin --delete harpy-data`, then run the workflow.

## Backup and restore drill (do this once, and after schema changes)

```bash
cargo build --release -p harpy-core
./target/release/harpy-core ingest --db /tmp/drill.sqlite
./target/release/harpy-core backup --db /tmp/drill.sqlite --to /tmp/drill-backup.sqlite   # VACUUM INTO + integrity check
rm /tmp/drill.sqlite*
./target/release/harpy-core check --db /tmp/drill-backup.sqlite
./target/release/harpy-core export --db /tmp/drill-backup.sqlite --out /tmp/drill-site
```
The integration test `backup_produces_consistent_copy` runs the same path in CI.

## Live server

```bash
docker build -f deploy/Dockerfile -t harpy .
docker run -d --name harpy -p 127.0.0.1:8080:8080 -v harpy-data:/data harpy
```
Put Caddy or nginx in front for TLS and per-IP rate limits (see `deploy/Caddyfile`). `/health` is liveness, `/ready` runs an integrity check, `/metrics` is Prometheus. Keep `/metrics` off the public internet.

Metrics: `harpy_fetch_total{provider,result}`, `harpy_fetch_duration_seconds{provider}`, `harpy_records_total{provider,outcome}`, `harpy_provider_last_success_seconds{provider}`. Alert when `time() - harpy_provider_last_success_seconds > 900` for usgs.
