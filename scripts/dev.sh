#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  echo "Stopping local HARPY dev services..."
  kill 0 || true
}
trap cleanup EXIT

echo "Starting harpy-node on :8080"
cargo run -p harpy-node &
NODE_PID=$!

echo "Starting web app on :3000"
export NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws"
export NEXT_PUBLIC_RELAY_HTTP_URL="http://localhost:8080"
npm ci
npm --prefix packages/shared-types run build
npm --prefix apps/web run dev &

wait $NODE_PID
