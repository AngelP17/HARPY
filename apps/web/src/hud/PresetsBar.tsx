"use client";

import { useHarpyStore } from "@/state/store";
import { MapPin } from "lucide-react";
import type { PresetId } from "@/state/types";

const PRESETS: Array<{ id: PresetId; label: string }> = [
  { id: "DC", label: "Washington DC" },
  { id: "SF", label: "SF Bay" },
  { id: "PTY", label: "Panama City" },
];

export function PresetsBar() {
  const preset = useHarpyStore((s) => s.preset);
  const setPreset = useHarpyStore((s) => s.setPreset);
  const streamMode = useHarpyStore((s) => s.streamMode);

  return (
    <div
      className="panel"
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "var(--muted)",
        }}
      >
        <MapPin size={14} />
        <span
          style={{
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}
        >
          Preset
        </span>
      </div>

      <div style={{ display: "flex", gap: 6 }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            className={`pill button ${preset === p.id ? "on" : ""}`}
            onClick={() => setPreset(p.id)}
            style={{ cursor: "pointer" }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div className="pill" style={{ gap: 4 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background:
              streamMode === "WS" ? "var(--ok)" : "var(--accent)",
            display: "inline-block",
          }}
        />
        <span>{streamMode === "WS" ? "LIVE" : "DEMO"}</span>
      </div>
    </div>
  );
}
