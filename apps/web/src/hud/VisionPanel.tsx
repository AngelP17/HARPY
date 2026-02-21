"use client";

import { useHarpyStore } from "@/state/store";
import type { VisionMode } from "@/state/types";

const MODES: VisionMode[] = ["EO", "NVG", "FLIR"];

export function VisionPanel() {
  const vision = useHarpyStore((s) => s.vision);
  const setVision = useHarpyStore((s) => s.setVision);

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        alignSelf: "flex-start",
      }}
    >
      <div className="panelHeader">
        <span className="panelTitle">Vision</span>
      </div>
      <div
        className="panelBody"
        style={{ display: "flex", flexDirection: "column", gap: 10 }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {MODES.map((m) => (
            <button
              key={m}
              className={`pill button ${vision.mode === m ? "on" : ""}`}
              onClick={() => setVision({ mode: m })}
              style={{ flex: 1, cursor: "pointer" }}
            >
              {m}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{
              fontSize: 11,
              color: "var(--muted)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Bloom</span>
            <span>{(vision.bloom * 100).toFixed(0)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={vision.bloom}
            onChange={(e) => setVision({ bloom: parseFloat(e.target.value) })}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label
            style={{
              fontSize: 11,
              color: "var(--muted)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>Sharpen</span>
            <span>{(vision.sharpen * 100).toFixed(0)}%</span>
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={vision.sharpen}
            onChange={(e) => setVision({ sharpen: parseFloat(e.target.value) })}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
        </div>
      </div>
    </div>
  );
}
