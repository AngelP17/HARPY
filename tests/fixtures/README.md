# Recorded real-source fixtures (TEST ONLY)

These files are real upstream records captured once and frozen for deterministic tests.
They are never loaded by a production build (CI enforces this; see `scripts/check-no-fixtures-in-prod.sh`).

| File | Origin | Captured | Notes |
|---|---|---|---|
| `usgs/significant_month.2026-10-21.subset.geojson` | https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson | 2026-10-21 UTC | First 3 of 15 features, unmodified field values. `metadata.count` still reads 15 from the original feed. Public domain (USGS). |
| `celestrak/iss.2020-07-12.omm.json` | CelesTrak GP OMM JSON, ISS (ZARYA) element set as reproduced in the `sgp4` crate (MIT) documentation | epoch 2020-07-12 | Used for format/parsing and propagation sanity tests only. |

SGP4 numerical correctness is tested against the Vallado SGP4 verification vectors
(Vallado et al., "Revisiting Spacetrack Report #3", AIAA 2006-6753), copied into
`services/harpy-core/src/orbit.rs` tests.
