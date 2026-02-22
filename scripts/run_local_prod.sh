#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  if [[ -n "${WEB_PID:-}" ]]; then
    kill "$WEB_PID" 2>/dev/null || true
    wait "$WEB_PID" 2>/dev/null || true
  fi
  if [[ -n "${NODE_PID:-}" ]]; then
    kill "$NODE_PID" 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

wait_for_http() {
  local url="$1"
  local max_attempts="${2:-60}"
  local sleep_seconds="${3:-0.5}"

  local attempt=0
  until curl -fsS "$url" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [[ "$attempt" -ge "$max_attempts" ]]; then
      echo "Timed out waiting for $url"
      return 1
    fi
    sleep "$sleep_seconds"
  done
}

echo "[1/3] Build harpy-node (release)"
cargo build -p harpy-node --release

echo "[2/3] Build web app"
export NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws"
export NEXT_PUBLIC_RELAY_HTTP_URL="http://localhost:8080"
npm ci
npm --prefix packages/shared-types run build
npm --prefix apps/web run build

echo "[3/3] Run harpy-node + web"
./target/release/harpy-node &
NODE_PID=$!

npm --prefix apps/web run start &
WEB_PID=$!

echo "Waiting for services to become ready..."
wait_for_http "http://localhost:8080/health"
wait_for_http "http://localhost:3000"

echo "HARPY local-prod running:"
echo "  Web:     http://localhost:3000"
echo "  Health:  http://localhost:8080/health"
echo "  Metrics: http://localhost:8080/metrics"
wait $NODE_PID
