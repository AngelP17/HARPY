#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NODE_HTTP_URL="${PROD_READINESS_NODE_HTTP_URL:-http://127.0.0.1:8080}"
NODE_WS_URL="${PROD_READINESS_NODE_WS_URL:-ws://127.0.0.1:8080/ws}"
WEB_HTTP_URL="${PROD_READINESS_WEB_HTTP_URL:-http://127.0.0.1:3000}"
SOAK_SECONDS="${PROD_READINESS_SOAK_SECONDS:-45}"
SOAK_INTERVAL_SECONDS="${PROD_READINESS_SOAK_INTERVAL_SECONDS:-5}"

NODE_LOG="/tmp/harpy-node-prod-readiness.log"
WEB_LOG="/tmp/harpy-web-prod-readiness.log"

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

fail_with_logs() {
  local message="$1"
  echo "prod_readiness: ${message}"
  if [[ -f "$NODE_LOG" ]]; then
    echo "---- harpy-node log tail ----"
    tail -n 80 "$NODE_LOG" || true
    echo "-----------------------------"
  fi
  if [[ -f "$WEB_LOG" ]]; then
    echo "---- web log tail ----"
    tail -n 80 "$WEB_LOG" || true
    echo "----------------------"
  fi
  exit 1
}

wait_for_http() {
  local url="$1"
  local max_attempts="${2:-80}"
  local sleep_seconds="${3:-0.5}"

  local attempt=0
  until curl -fsS "$url" >/dev/null 2>&1; do
    attempt=$((attempt + 1))
    if [[ "$attempt" -ge "$max_attempts" ]]; then
      fail_with_logs "timed out waiting for ${url}"
    fi
    sleep "$sleep_seconds"
  done
}

echo "[1/5] Build harpy-node (release)"
cargo build -p harpy-node --release

echo "[2/5] Build web app (production)"
export NEXT_PUBLIC_WS_URL="$NODE_WS_URL"
export NEXT_PUBLIC_RELAY_HTTP_URL="$NODE_HTTP_URL"
npm ci
npm --prefix packages/shared-types run build
npm --prefix apps/web run build

echo "[3/5] Start local production stack"
./target/release/harpy-node >"$NODE_LOG" 2>&1 &
NODE_PID=$!

npm --prefix apps/web run start >"$WEB_LOG" 2>&1 &
WEB_PID=$!

echo "[4/5] Wait for endpoints"
wait_for_http "${NODE_HTTP_URL}/health"
wait_for_http "${NODE_HTTP_URL}/metrics"
wait_for_http "${NODE_HTTP_URL}/api/debug/snapshot"
wait_for_http "$WEB_HTTP_URL"

echo "[5/5] Run confidence + soak checks"
CONFIDENCE_GATE_EXTERNAL_NODE=1 \
  CONFIDENCE_GATE_NODE_URL="$NODE_HTTP_URL" \
  CONFIDENCE_GATE_WS_URL="$NODE_WS_URL" \
  ./scripts/confidence_gate.sh

# Ensure websocket connection and stream metrics are emitted deterministically before soak checks.
export PROD_READINESS_WS_URL="$NODE_WS_URL"
node --input-type=module <<'JS'
const wsUrl = process.env.PROD_READINESS_WS_URL || "ws://127.0.0.1:8080/ws";
let WebSocketImpl = globalThis.WebSocket;
if (!WebSocketImpl) {
  const wsModule = await import("ws");
  WebSocketImpl = wsModule.WebSocket ?? wsModule.default;
}
if (!WebSocketImpl) {
  throw new Error("WebSocket implementation is unavailable");
}
let protobuf;
try {
  ({ default: protobuf } = await import("./node_modules/protobufjs/index.js"));
} catch {
  ({ default: protobuf } = await import("./packages/shared-types/node_modules/protobufjs/index.js"));
}

const root = await protobuf.load("./proto/harpy/v1/harpy.proto");
const Envelope = root.lookupType("harpy.v1.Envelope");
const SubscriptionMode = root.lookupEnum("harpy.v1.SubscriptionMode").values;
const LayerType = root.lookupEnum("harpy.v1.LayerType").values;

await new Promise((resolve, reject) => {
  const ws = new WebSocketImpl(wsUrl);
  const timeout = setTimeout(() => {
    ws.close();
    reject(new Error("WS probe timeout"));
  }, 5000);
  ws.binaryType = "arraybuffer";
  ws.onopen = () => {
    const payload = Envelope.create({
      schemaVersion: "1.0.0",
      serverTsMs: Date.now(),
      subscriptionRequest: {
        viewport: { minLat: -90, minLon: -180, maxLat: 90, maxLon: 180 },
        layers: [LayerType.LAYER_TYPE_AIRCRAFT, LayerType.LAYER_TYPE_SATELLITE],
        mode: SubscriptionMode.SUBSCRIPTION_MODE_LIVE,
        timeRange: { live: {} },
      },
    });
    ws.send(Envelope.encode(payload).finish());
    setTimeout(() => {
      clearTimeout(timeout);
      ws.close();
      resolve();
    }, 2200);
  };
  ws.onerror = (err) => {
    clearTimeout(timeout);
    reject(err instanceof Error ? err : new Error("WS probe failed"));
  };
});
JS

finish_at=$((SECONDS + SOAK_SECONDS))
while [[ "$SECONDS" -lt "$finish_at" ]]; do
  health_payload="$(curl -fsS "${NODE_HTTP_URL}/health")"
  if [[ "$health_payload" != *"\"status\":\"ok\""* ]]; then
    fail_with_logs "health endpoint returned unhealthy payload"
  fi

  metrics_payload="$(curl -fsS "${NODE_HTTP_URL}/metrics")"
  if [[ "$metrics_payload" != *"harpy_ws_connections"* ]]; then
    fail_with_logs "metrics missing harpy_ws_connections"
  fi
  if [[ "$metrics_payload" != *"harpy_tracks_sent"* ]]; then
    fail_with_logs "metrics missing harpy_tracks_sent"
  fi
  if [[ "$metrics_payload" != *"harpy_provider_status_sent"* ]]; then
    fail_with_logs "metrics missing harpy_provider_status_sent"
  fi

  debug_snapshot_payload="$(curl -fsS "${NODE_HTTP_URL}/api/debug/snapshot")"
  if [[ "$debug_snapshot_payload" != *"\"providers\":"* ]]; then
    fail_with_logs "debug snapshot missing providers payload"
  fi

  curl -fsS "$WEB_HTTP_URL" >/dev/null
  sleep "$SOAK_INTERVAL_SECONDS"
done

echo "local_production_readiness: PASS"
