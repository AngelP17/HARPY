#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  kill 0 || true
}
trap cleanup EXIT

echo "[1/3] Build harpy-node (release)"
cargo +1.83.0 build -p harpy-node --release

echo "[2/3] Build web app"
export NEXT_PUBLIC_WS_URL="ws://localhost:8080/ws"
export NEXT_PUBLIC_RELAY_HTTP_URL="http://localhost:8080"
npm --prefix apps/web install
npm --prefix apps/web run build

echo "[3/3] Run harpy-node + web"
./target/release/harpy-node &
NODE_PID=$!

npm --prefix apps/web run start &

echo "HARPY local-prod running:"
echo "  Web:     http://localhost:3000"
echo "  Health:  http://localhost:8080/health"
echo "  Metrics: http://localhost:8080/metrics"
wait $NODE_PID
