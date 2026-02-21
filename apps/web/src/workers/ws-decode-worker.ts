/// <reference lib="webworker" />

import { harpy } from "@harpy/shared-types";

const workerCtx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

workerCtx.onmessage = (event: MessageEvent) => {
  const { data } = event;
  
  if (data instanceof ArrayBuffer) {
    try {
      const uint8 = new Uint8Array(data);
      const envelope = harpy.v1.Envelope.decode(uint8);
      
      // Dispatch based on payload
      if (envelope.trackDeltaBatch) {
        const deltas = envelope.trackDeltaBatch.deltas || [];
        workerCtx.postMessage({ type: "TRACK_DELTA_BATCH", deltas });
        workerCtx.postMessage({ type: "TRACK_BATCH_STATS", count: deltas.length, serverTsMs: Number(envelope.serverTsMs ?? 0) });
      } else if (envelope.alertUpsert) {
        const severityName = harpy.v1.AlertSeverity[envelope.alertUpsert.severity ?? 0] ?? "ALERT_SEVERITY_UNSPECIFIED";
        // Map alert to plain object
        const alert = {
          id: envelope.alertUpsert.id,
          title: envelope.alertUpsert.title,
          description: envelope.alertUpsert.description,
          severity: severityName,
          tsMs: Number(envelope.alertUpsert.tsMs),
          evidenceLinkIds: envelope.alertUpsert.evidenceLinkIds || []
        };
        workerCtx.postMessage({ type: "ALERT_UPSERT", alert });
      } else if (envelope.providerStatus) {
        const circuitName = harpy.v1.CircuitState[envelope.providerStatus.circuitState ?? 0] ?? "CIRCUIT_STATE_UNSPECIFIED";
        const freshnessName = harpy.v1.Freshness[envelope.providerStatus.freshness ?? 0] ?? "FRESHNESS_UNSPECIFIED";
        const lastSuccess = Number(envelope.providerStatus.lastSuccessTsMs ?? 0);
        const latencyMs = lastSuccess > 0 ? Math.max(0, Date.now() - lastSuccess) : 0;
        // Map protobuf to our store structure (if names differ)
        workerCtx.postMessage({ 
          type: "PROVIDER_STATUS", 
          status: {
            providerId: envelope.providerStatus.providerId,
            circuitState: circuitName,
            freshness: freshnessName,
            latencyMs,
            lastSuccessTsMs: lastSuccess,
            failureCount: envelope.providerStatus.failureCount ?? 0,
          } 
        });
      } else if (envelope.subscriptionAck) {
        workerCtx.postMessage({
          type: "SUBSCRIPTION_ACK",
          ack: {
            subscriptionId: envelope.subscriptionAck.subscriptionId,
            success: envelope.subscriptionAck.success,
            error: envelope.subscriptionAck.error,
          },
        });
      } else if (envelope.linkUpsert) {
        workerCtx.postMessage({
          type: "LINK_UPSERT",
          link: {
            id: envelope.linkUpsert.id,
            fromType: harpy.v1.NodeType[envelope.linkUpsert.from?.nodeType ?? 0] ?? "NODE_TYPE_UNSPECIFIED",
            fromId: envelope.linkUpsert.from?.nodeId ?? "",
            rel: envelope.linkUpsert.rel ?? "",
            toType: harpy.v1.NodeType[envelope.linkUpsert.to?.nodeType ?? 0] ?? "NODE_TYPE_UNSPECIFIED",
            toId: envelope.linkUpsert.to?.nodeId ?? "",
            tsMs: Number(envelope.linkUpsert.tsMs ?? 0),
          },
        });
      }
    } catch (err) {
      console.error("[WS-DECODE-WORKER] Decode Error:", err);
    }
  }
};

export {};
