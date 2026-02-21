#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  echo "Stopping local HARPY dev services..."
  kill 0 || true
}
trap cleanup EXIT

echo "Starting harpy-node on :8080"
cargo +1.83.0 run -p harpy-node &
NODE_PID=$!

echo "Starting web app on :3000"
export NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws"
export NEXT_PUBLIC_RELAY_HTTP_URL="http://localhost:8080"
npm --prefix apps/web install
npm --prefix apps/web run dev &

wait $NODE_PID
