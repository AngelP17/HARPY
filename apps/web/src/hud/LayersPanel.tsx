"use client";

import { useHarpyStore } from "@/state/store";
import { Plane, Satellite, Activity, Cloud } from "lucide-react";
import type { LayerId } from "@/state/types";
import React from "react";

const LAYER_CONFIG: Array<{
  id: LayerId;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "AIR", label: "Aircraft", icon: <Plane size={14} /> },
  { id: "SAT", label: "Satellites", icon: <Satellite size={14} /> },
  { id: "SEISMIC", label: "Seismic", icon: <Activity size={14} /> },
  { id: "WEATHER", label: "Weather", icon: <Cloud size={14} /> },
];

function freshnessLabel(
  freshness: string,
  lastUpdate: number,
  now: number,
): string {
  if (freshness === "FRESH") {
    const age = now - lastUpdate;
    if (age < 5000) return "just now";
    return `${Math.round(age / 1000)}s ago`;
  }
  if (freshness === "AGING") return "aging";
  if (freshness === "STALE") return "stale";
  return "critical";
}

export function LayersPanel() {
  const layers = useHarpyStore((s) => s.layers);
  const toggleLayer = useHarpyStore((s) => s.toggleLayer);
  const nowMs = useHarpyStore((s) => s.nowMs);

  return (
    <div
      className="panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        overflow: "auto",
      }}
    >
      <div className="panelHeader">
        <span className="panelTitle">Data Layers</span>
      </div>
      <div
        className="panelBody"
        style={{ display: "flex", flexDirection: "column", gap: 6 }}
      >
        {LAYER_CONFIG.map((cfg) => {
          const layer = layers[cfg.id];
          const dim =
            !layer.enabled ||
            layer.freshness === "STALE" ||
            layer.freshness === "CRITICAL";
          return (
            <div
              key={cfg.id}
              className={`row ${dim ? "dim" : ""}`}
              onClick={() => toggleLayer(cfg.id)}
              style={{ cursor: "pointer" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                }}
              >
                {cfg.icon}
                <div className="kv">
                  <span className="k1">{cfg.label}</span>
                  <span className="k2">
                    {layer.source} &middot;{" "}
                    {freshnessLabel(layer.freshness, layer.lastUpdate, nowMs)}
                  </span>
                </div>
              </div>
              <span
                className="k2"
                style={{ minWidth: 36, textAlign: "right" }}
              >
                {layer.items}
              </span>
              <span
                className={`pill ${layer.enabled ? "on" : "off"}`}
                style={{ minWidth: 40, textAlign: "center" }}
              >
                {layer.enabled ? "ON" : "OFF"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
