#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  kill 0 || true
}
trap cleanup EXIT

echo "[1/4] Build harpy-node (release)"
cargo +stable build -p harpy-node --release

echo "[2/4] Install frontend dependencies"
npm --prefix apps/web install

echo "[3/4] Build shared types + web"
npm --prefix packages/shared-types run build
NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws" npm --prefix apps/web run build

echo "[4/4] Start harpy-node + web (production mode)"
./target/release/harpy-node &
NODE_PID=$!
NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws" npm --prefix apps/web run start &

echo "HARPY local-prod running:"
echo "  Web:     http://localhost:3000"
echo "  Node:    http://localhost:8080/health"
echo "  Metrics: http://localhost:8080/metrics"

wait "${NODE_PID}"
