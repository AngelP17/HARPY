# harpy-core configuration

All settings are environment variables; defaults are production-safe.

| Variable | Default | Purpose |
|---|---|---|
| `HARPY_ENABLE_USGS` / `HARPY_ENABLE_CELESTRAK` | `true` | Turn a provider off entirely (it then reports `NEVER_RUN`) |
| `HARPY_USGS_FEED_URL` | USGS `all_day.geojson` | Per-cycle feed |
| `HARPY_USGS_BOOTSTRAP_URL` | USGS `all_week.geojson` | Fetched once when no earthquakes are stored; `none` disables |
| `HARPY_USGS_INTERVAL_SECS` | `60` | `serve` only; minimum 30 |
| `HARPY_CELESTRAK_BASE_URL` | `https://celestrak.org/NORAD/elements/gp.php` | |
| `HARPY_CELESTRAK_GROUPS` | `stations,visual,gps-ops,weather` | Comma-separated CelesTrak groups |
| `HARPY_CELESTRAK_MIN_REFRESH_SECS` | `7200` | Per-group download throttle (CelesTrak policy) |
| `HARPY_USER_AGENT` | `HARPY/0.1 (+repo url)` | Identify yourself to providers |
| `HARPY_HTTP_TIMEOUT_SECS` | `30` | Per request |
| `HARPY_HTTP_MAX_ATTEMPTS` | `3` | Retries on transport errors, 429 and 5xx, with backoff |
| `HARPY_RETENTION_EARTHQUAKE_DAYS` | `30` | By event time |
| `HARPY_RETENTION_ELEMENTS_DAYS` | `14` | By element epoch (public deploy uses 10) |
| `HARPY_RETENTION_FETCH_LOG_DAYS` | `14` | |
| `HARPY_REFRESH_INTERVAL_SECS` | `900` export / USGS interval serve | Advertised in `meta.json` |
| `HARPY_STALE_AFTER_SECS` | 3 × refresh | After this the UI marks records STALE |
| `HARPY_COMMIT` | unset | Shown in `meta.json` |
| `RUST_LOG` | `harpy_core=info,tower_http=info` | Logs are JSON on stderr |

Web build: `NEXT_PUBLIC_BASE_PATH` (e.g. `/HARPY` for Pages, empty for a server at `/`), optional `NEXT_PUBLIC_DATA_URL` to read documents from another origin.

## Exit codes

`harpy-core ingest` exits 0 if at least one fetch succeeded, 2 if every attempted fetch failed (still recorded as data), 1 on storage/usage errors.
