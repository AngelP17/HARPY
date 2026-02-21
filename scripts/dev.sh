#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  echo "Stopping..."
  kill 0 || true
}
trap cleanup EXIT

echo "Starting harpy-node on :8080"
cargo run -p harpy-node &
NODE_PID=$!

echo "Starting web on :3000"
cd apps/web
export NEXT_PUBLIC_RELAY_HOST="localhost:8080"
npm install --silent
npm run dev &

wait $NODE_PID
