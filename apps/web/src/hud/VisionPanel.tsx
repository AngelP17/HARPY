"use client";

import { useHarpyStore } from "@/state/store";
import type { VisionMode } from "@/state/types";
import { Eye } from "lucide-react";

const MODES: VisionMode[] = ["EO", "NVG", "FLIR"];

export function VisionPanel() {
  const vision = useHarpyStore((s) => s.vision);
  const setVisionMode = useHarpyStore((s) => s.setVisionMode);
  const setBloom = useHarpyStore((s) => s.setBloom);
  const setSharpen = useHarpyStore((s) => s.setSharpen);

  return (
    <div className="panel" style={{ width: "100%" }}>
      <div className="panelHeader">
        <span className="panelTitle">Vision</span>
        <Eye size={14} color="var(--muted)" />
      </div>
      <div
        className="panelBody"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {MODES.map((m) => (
            <button
              key={m}
              className={`pill button ${vision.mode === m ? "on" : "off"}`}
              onClick={() => setVisionMode(m)}
              style={{ flex: 1 }}
            >
              {m}
            </button>
          ))}
        </div>

        <div>
          <label
            style={{
              fontSize: 11,
              color: "var(--muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            Bloom: {Math.round(vision.bloom * 100)}%
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={vision.bloom}
            onChange={(e) => setBloom(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <label
            style={{
              fontSize: 11,
              color: "var(--muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            Sharpen: {Math.round(vision.sharpen * 100)}%
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={vision.sharpen}
            onChange={(e) => setSharpen(parseFloat(e.target.value))}
            style={{ width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
