# ADR 0002: GeoWraith accuracy gate (Milestone B)

Status: **proposed, waiting on the owner.** Thresholds must be filled in and committed before any benchmark run.

## Blockers found in the audit

1. GeoCLIP ONNX weights are not in the GeoWraith repo and there is no scripted, checksummed download. A clean clone cannot run real inference.
2. No Im2GPS3k (or YFCC4k) copy or download script exists, so no comparable benchmark has ever been run.

## Gate (owner fills in before benchmarking)

Evaluated on Im2GPS3k after removing any overlap with the anchor/reference corpus:

- Accuracy on accepted predictions at 25 km: `____`
- Accuracy on accepted predictions at 200 km: `____`
- Maximum abstention rate: `____`

Also reported, not gated: accuracy at 1 / 750 / 2500 km, calibration curve, p50/p95 latency.

If the gate fails, GeoWraith ships region-level output with stronger abstention, or stays experimental. It does not ship with inflated claims.

## Integration shape (decided)

- `CandidateGenerator` (GeoCLIP + index): required. `CandidateReranker`: optional, starts `disabled`, enabled only if the benchmark shows a measurable gain.
- Worker on loopback (`127.0.0.1:8090`); harpy-core is the only entry point; uploads and inference authenticated and budget-capped. The public Pages deployment stays read-only and never exposes uploads.
- Results stored as `inferred` observations with `model_version` = model + index version.
