"use client";

import { useHarpyStore } from "@/state/store";
import { Radio, Wifi, Clock } from "lucide-react";

export function DataLinkBar() {
  const streamMode = useHarpyStore((s) => s.streamMode);
  const wsRttMs = useHarpyStore((s) => s.wsRttMs);
  const nowMs = useHarpyStore((s) => s.nowMs);

  const timeStr = nowMs
    ? new Date(nowMs).toISOString().substring(11, 19) + "Z"
    : "--:--:--Z";

  return (
    <div
      className="panel"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "10px 14px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 13,
            letterSpacing: "0.08em",
            fontWeight: 700,
          }}
        >
          HARPY
        </span>
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          Operator Console
        </span>
      </div>

      <div style={{ flex: 1 }} />

      <div className="pill" style={{ gap: 6 }}>
        <Radio size={12} />
        <span>DATA LINK</span>
      </div>

      <div className={`pill ${streamMode === "WS" ? "on" : ""}`}>
        <Wifi size={12} />
        <span>{streamMode === "WS" ? "LIVE WS" : "MOCK"}</span>
      </div>

      {wsRttMs !== null && (
        <div className="pill on">
          <span>RTT {Math.round(wsRttMs)}ms</span>
        </div>
      )}

      <div className="pill">
        <Clock size={12} />
        <span>{timeStr}</span>
      </div>
    </div>
  );
}
