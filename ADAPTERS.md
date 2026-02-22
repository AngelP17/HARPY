# ADAPTERS.md - HARPY Provider Adapters (Local-First)

HARPY runs deterministic mock providers by default to guarantee a reliable demo.

Real providers are optional and gated behind environment flags:
- ADS-B: OpenSky
- TLE: CelesTrak GP JSON endpoint

If real providers fail or are not configured, HARPY falls back to mocks.

---

## Provider configuration

### ADS-B (OpenSky)
Enable:
```bash
ENABLE_REAL_ADSB=true
OPENSKY_CLIENT_ID=...
OPENSKY_CLIENT_SECRET=...
```

Notes:
- Respect OpenSky TOS and rate limits.
- HARPY uses conservative polling defaults and timeouts.

### TLE (CelesTrak)

Enable:
```bash
ENABLE_REAL_TLE=true
CELESTRAK_GROUP=STATIONS
CELESTRAK_USER_AGENT="HARPY/0.1 (+https://example.invalid)"
```

Notes:
- Respect update cadence; avoid hammering.
- HARPY caches responses and enforces a minimum refresh interval.

---

## Mock providers (default)

- `mock-adsb`: moving aircraft tracks, deterministic
- `mock-tle`: satellite tracks, deterministic

These are designed to avoid:
- empty UI
- stalls
- bursts that cause flicker

---

## Compliance

You are responsible for using real providers lawfully and in accordance with their TOS.
