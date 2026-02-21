"use client";

import { useHarpyStore } from "@/state/store";
import type { PresetId } from "@/state/types";
import { MapPin } from "lucide-react";

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "DC", label: "Washington DC" },
  { id: "SF", label: "SF Bay" },
  { id: "PTY", label: "Panama City" },
];

export function PresetsBar() {
  const preset = useHarpyStore((s) => s.preset);
  const setPreset = useHarpyStore((s) => s.setPreset);

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        width: "100%",
      }}
    >
      <MapPin size={14} color="var(--muted)" />
      <span
        style={{
          fontSize: 11,
          letterSpacing: "0.1em",
          color: "var(--muted)",
          marginRight: 4,
        }}
      >
        PRESETS
      </span>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          className={`pill button ${preset === p.id ? "on" : "off"}`}
          onClick={() => setPreset(p.id)}
        >
          {p.label}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <span className="pill on" style={{ fontSize: 11 }}>
        LIVE
      </span>
    </div>
  );
}
