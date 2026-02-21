"use client";

import { useHarpyStore } from "@/state/store";
import type { LayerId, Freshness } from "@/state/types";
import { Plane, Satellite, Activity, CloudRain } from "lucide-react";

const LAYER_META: Record<
  LayerId,
  { label: string; icon: typeof Plane; source: string }
> = {
  AIR: { label: "Aircraft", icon: Plane, source: "ADS-B" },
  SAT: { label: "Satellites", icon: Satellite, source: "CelesTrak" },
  SEISMIC: { label: "Seismic", icon: Activity, source: "USGS" },
  WEATHER: { label: "Weather", icon: CloudRain, source: "NWS" },
};

function freshnessLabel(
  _f: Freshness,
  lastMs: number,
  nowMs: number,
): string {
  if (lastMs === 0) return "no data";
  const age = nowMs - lastMs;
  if (age < 5_000) return "just now";
  if (age < 60_000) return `${Math.round(age / 1000)}s ago`;
  if (age < 3_600_000) return `${Math.round(age / 60_000)}m ago`;
  return "stale";
}

function freshnessClass(f: Freshness): string {
  if (f === "FRESH") return "ok";
  if (f === "AGING") return "warn";
  return "bad";
}

export function LayersPanel() {
  const layers = useHarpyStore((s) => s.layers);
  const toggleLayer = useHarpyStore((s) => s.toggleLayer);
  const nowMs = useHarpyStore((s) => s.nowMs);

  return (
    <div className="panel" style={{ width: "100%" }}>
      <div className="panelHeader">
        <span className="panelTitle">Data Layers</span>
      </div>
      <div
        className="panelBody"
        style={{ display: "flex", flexDirection: "column", gap: 8 }}
      >
        {(Object.keys(LAYER_META) as LayerId[]).map((lid) => {
          const meta = LAYER_META[lid];
          const layer = layers[lid];
          const Icon = meta.icon;
          const dim =
            !layer.enabled ||
            layer.freshness === "STALE" ||
            layer.freshness === "CRITICAL";

          return (
            <div key={lid} className={`row ${dim ? "dim" : ""}`}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                }}
              >
                <Icon
                  size={16}
                  color={layer.enabled ? "var(--accent)" : "var(--muted)"}
                />
                <div className="kv">
                  <span className="k1">{meta.label}</span>
                  <span className="k2">
                    {meta.source} ·{" "}
                    {freshnessLabel(
                      layer.freshness,
                      layer.lastUpdateMs,
                      nowMs,
                    )}
                  </span>
                </div>
              </div>

              <span
                className={`badge ${freshnessClass(layer.freshness)}`}
                style={{ marginRight: 4 }}
              >
                {layer.items}
              </span>

              <button
                className={`pill button ${layer.enabled ? "on" : "off"}`}
                onClick={() => toggleLayer(lid)}
              >
                {layer.enabled ? "ON" : "OFF"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
