"use client";

import { useHarpyStore } from "@/state/store";
import { Radio, Wifi, Clock } from "lucide-react";

export function DataLinkBar() {
  const streamMode = useHarpyStore((s) => s.streamMode);
  const wsRttMs = useHarpyStore((s) => s.wsRttMs);
  const nowMs = useHarpyStore((s) => s.nowMs);

  const timeStr = new Date(nowMs).toISOString().slice(11, 19) + "Z";
  const isWs = streamMode === "WS";

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "8px 16px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {isWs ? (
          <Wifi size={14} color="var(--accent)" />
        ) : (
          <Radio size={14} color="var(--warn)" />
        )}
        <span
          style={{
            fontSize: 12,
            letterSpacing: "0.08em",
            color: isWs ? "var(--accent)" : "var(--warn)",
          }}
        >
          {isWs ? "LIVE WS" : "MOCK"}
        </span>
      </div>

      {wsRttMs !== null && (
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          RTT {wsRttMs}ms
        </span>
      )}

      <div style={{ flex: 1 }} />

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Clock size={13} color="var(--muted)" />
        <span
          style={{
            fontSize: 12,
            fontFamily: "monospace",
            color: "var(--text)",
          }}
        >
          {timeStr}
        </span>
      </div>

      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.15em",
          color: "var(--muted)",
        }}
      >
        HARPY v0.1
      </span>
    </div>
  );
}
