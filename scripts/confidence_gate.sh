#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NODE_LOG="/tmp/harpy-node-confidence.log"
NODE_HTTP_URL="${CONFIDENCE_GATE_NODE_URL:-http://127.0.0.1:8080}"
NODE_WS_URL="${CONFIDENCE_GATE_WS_URL:-ws://127.0.0.1:8080/ws}"
EXTERNAL_NODE="${CONFIDENCE_GATE_EXTERNAL_NODE:-0}"
HEALTH_TIMEOUT_SECONDS="${CONFIDENCE_GATE_HEALTH_TIMEOUT_SECONDS:-240}"

cleanup() {
  if [[ -n "${NODE_PID:-}" ]]; then
    kill "$NODE_PID" 2>/dev/null || true
    wait "$NODE_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ "$EXTERNAL_NODE" != "1" ]]; then
  cargo run -p harpy-node >"$NODE_LOG" 2>&1 &
  NODE_PID=$!
fi

READY=0
for _ in $(seq 1 "$HEALTH_TIMEOUT_SECONDS"); do
  if curl -fsS "${NODE_HTTP_URL}/health" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done
if [[ "$READY" -ne 1 ]]; then
  echo "confidence_gate: node did not become healthy at ${NODE_HTTP_URL}/health"
  if [[ -f "$NODE_LOG" ]]; then
    echo "---- node log tail ----"
    tail -n 80 "$NODE_LOG" || true
    echo "-----------------------"
  fi
  exit 1
fi

export CONFIDENCE_GATE_NODE_URL="$NODE_HTTP_URL"
export CONFIDENCE_GATE_WS_URL="$NODE_WS_URL"

node --input-type=module <<'JS'
let protobuf;
try {
  ({ default: protobuf } = await import("./node_modules/protobufjs/index.js"));
} catch {
  ({ default: protobuf } = await import("./packages/shared-types/node_modules/protobufjs/index.js"));
}

const nodeHttpUrl = process.env.CONFIDENCE_GATE_NODE_URL || "http://127.0.0.1:8080";
const nodeWsUrl = process.env.CONFIDENCE_GATE_WS_URL || "ws://127.0.0.1:8080/ws";
let WebSocketImpl = globalThis.WebSocket;
if (!WebSocketImpl) {
  const wsModule = await import("ws");
  WebSocketImpl = wsModule.WebSocket ?? wsModule.default;
}
if (!WebSocketImpl) {
  throw new Error("WebSocket implementation is unavailable");
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const toU8 = async (data) => {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  if (data instanceof Blob) {
    return new Uint8Array(await data.arrayBuffer());
  }
  throw new Error("Unknown websocket payload type");
};

const root = await protobuf.load("./proto/harpy/v1/harpy.proto");
const Envelope = root.lookupType("harpy.v1.Envelope");
const SubscriptionMode = root.lookupEnum("harpy.v1.SubscriptionMode").values;
const LayerType = root.lookupEnum("harpy.v1.LayerType").values;

const result = {
  health: null,
  acks: 0,
  providerStatus: 0,
  narrowTracks: 0,
  worldTracks: 0,
  metricsSeries: {},
};

result.health = await (await fetch(`${nodeHttpUrl}/health`)).json();

const ws = new WebSocketImpl(nodeWsUrl);
if ("binaryType" in ws) {
  ws.binaryType = "arraybuffer";
}
let phase = "boot";

ws.onmessage = async (ev) => {
  const env = Envelope.decode(await toU8(ev.data));
  if (env.subscriptionAck) {
    result.acks += 1;
    return;
  }
  if (env.providerStatus) {
    result.providerStatus += 1;
    return;
  }
  if (env.trackDeltaBatch) {
    const count = (env.trackDeltaBatch.deltas || []).length;
    if (phase === "narrow") {
      result.narrowTracks += count;
    } else if (phase === "world") {
      result.worldTracks += count;
    }
  }
};

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("WS open timeout")), 5000);
  ws.onopen = () => {
    clearTimeout(timeout);
    resolve();
  };
  ws.onerror = () => {
    clearTimeout(timeout);
    reject(new Error("WS open error"));
  };
});

const sendSub = (viewport) => {
  const payload = Envelope.create({
    schemaVersion: "1.0.0",
    serverTsMs: Date.now(),
    subscriptionRequest: {
      viewport,
      layers: [LayerType.LAYER_TYPE_AIRCRAFT],
      mode: SubscriptionMode.SUBSCRIPTION_MODE_LIVE,
      timeRange: { live: {} },
    },
  });
  ws.send(Envelope.encode(payload).finish());
};

phase = "narrow";
sendSub({ minLat: -85, minLon: -10, maxLat: -80, maxLon: 10 });
await sleep(2300);

phase = "world";
sendSub({ minLat: -90, minLon: -180, maxLat: 90, maxLon: 180 });
await sleep(2300);

const metricsText = await (await fetch(`${nodeHttpUrl}/metrics`)).text();
const readMetric = (name) => {
  const direct = metricsText.match(new RegExp(`^${name}\\s+([-+0-9.eE]+)$`, "m"));
  if (direct) {
    return Number(direct[1]);
  }
  const labeled = metricsText.match(new RegExp(`^${name}\\{[^\\n]*\\}\\s+([-+0-9.eE]+)$`, "m"));
  if (labeled) {
    return Number(labeled[1]);
  }
  return null;
};

result.metricsSeries.harpy_ws_connections = readMetric("harpy_ws_connections");
result.metricsSeries.harpy_tracks_sent = readMetric("harpy_tracks_sent");
result.metricsSeries.harpy_provider_status_sent = readMetric("harpy_provider_status_sent");

ws.close();
await sleep(200);

console.log(JSON.stringify(result));

if (result.health?.status !== "ok") process.exit(2);
if (result.acks < 2) process.exit(3);
if (result.worldTracks <= 0) process.exit(4);
if (result.narrowTracks > result.worldTracks) process.exit(5);
if (result.metricsSeries.harpy_ws_connections === null) process.exit(6);
if ((result.metricsSeries.harpy_tracks_sent ?? 0) <= 0) process.exit(7);
if ((result.metricsSeries.harpy_provider_status_sent ?? 0) <= 0) process.exit(8);
JS
