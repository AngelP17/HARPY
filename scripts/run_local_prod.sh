#!/usr/bin/env bash
set -euo pipefail

cleanup() { kill 0 || true; }
trap cleanup EXIT

echo "[1/3] Build harpy-node (release)"
cargo build -p harpy-node --release

echo "[2/3] Build web (Next)"
pushd apps/web >/dev/null
export NEXT_PUBLIC_RELAY_HOST="localhost:8080"
npm install --silent
npm run build
popd >/dev/null

echo "[3/3] Run harpy-node + web (Next start)"
./target/release/harpy-node &
NODE_PID=$!

pushd apps/web >/dev/null
export NEXT_PUBLIC_RELAY_HOST="localhost:8080"
npm run start &
popd >/dev/null

echo "HARPY local-prod running:"
echo "  Web:     http://localhost:3000"
echo "  Node:    http://localhost:8080/health"
echo "  Metrics: http://localhost:8080/metrics"
wait $NODE_PID
