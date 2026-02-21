#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  echo "Stopping local HARPY processes..."
  kill 0 || true
}
trap cleanup EXIT

echo "Starting harpy-node on :8080"
cargo +stable run -p harpy-node &
NODE_PID=$!

echo "Starting web app on :3000"
export NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws"
npm --prefix apps/web install
npm --prefix apps/web run dev &

wait "${NODE_PID}"
