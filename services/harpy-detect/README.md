# harpy-detect (Optional Phase 4 Service)

On-demand detection adapter with privacy filters.

## Endpoints

- `GET /health`
- `POST /detect`

`POST /detect` accepts a base64-encoded image and optional detections, then applies privacy filters:

- `privacy_mode=blur` (default)
- `privacy_mode=redact`

## Run locally

```bash
cd services/harpy-detect
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8085
```
