# Local Production Readiness (99.99%)

To claim 99.99% local-production readiness:

- CI green
- `make prod-ready-local` passes (build + boot + endpoints + soak)
- WS contract tests pass
- Confidence gate passes (>= 84.7%)
- Docs match reality (Option A local-first)

Run:
```bash
make confidence-refactor
make prod-ready-local
```
