import { create } from "zustand";
import type {
  Freshness,
  LayerId,
  PresetId,
  ProviderStatus,
  Track,
  ViewportBbox,
  VisionMode,
} from "./types";

type LayerState = {
  enabled: boolean;
  items: number;
  source: string;
  freshness: Freshness;
  lastUpdate: number;
  state: "OK" | "DEGRADED" | "DOWN";
};

type VisionState = {
  mode: VisionMode;
  bloom: number;
  sharpen: number;
};

type HarpyState = {
  tracks: Record<string, Track>;
  layers: Record<LayerId, LayerState>;
  vision: VisionState;
  preset: PresetId;
  streamMode: "MOCK" | "WS";
  wsRttMs: number | null;
  nowMs: number;
  viewport: ViewportBbox | null;

  toggleLayer: (id: LayerId) => void;
  setVision: (v: Partial<VisionState>) => void;
  setPreset: (p: PresetId) => void;
  setStreamMode: (m: "MOCK" | "WS") => void;
  setWsRttMs: (v: number | null) => void;
  setViewport: (v: ViewportBbox | null) => void;
  ingestTracks: (tracks: Track[]) => void;
  ingestProviderStatus: (ps: ProviderStatus) => void;
  tickNow: (ms: number) => void;
  recomputeFreshness: () => void;
};

const FRESHNESS_THRESHOLDS = { FRESH: 10_000, AGING: 30_000, STALE: 90_000 };

function computeFreshness(lastUpdate: number, now: number): Freshness {
  const age = now - lastUpdate;
  if (age < FRESHNESS_THRESHOLDS.FRESH) return "FRESH";
  if (age < FRESHNESS_THRESHOLDS.AGING) return "AGING";
  if (age < FRESHNESS_THRESHOLDS.STALE) return "STALE";
  return "CRITICAL";
}

function providerToLayer(providerId: string): LayerId | null {
  if (providerId.includes("adsb") || providerId.includes("opensky")) return "AIR";
  if (providerId.includes("tle") || providerId.includes("celestrak")) return "SAT";
  if (providerId.includes("seismic") || providerId.includes("usgs")) return "SEISMIC";
  if (providerId.includes("weather") || providerId.includes("nws")) return "WEATHER";
  return null;
}

const defaultLayers: Record<LayerId, LayerState> = {
  AIR: { enabled: true, items: 0, source: "ADS-B", freshness: "FRESH", lastUpdate: Date.now(), state: "OK" },
  SAT: { enabled: true, items: 0, source: "CelesTrak", freshness: "FRESH", lastUpdate: Date.now(), state: "OK" },
  SEISMIC: { enabled: false, items: 0, source: "USGS", freshness: "FRESH", lastUpdate: Date.now(), state: "OK" },
  WEATHER: { enabled: false, items: 0, source: "NWS", freshness: "FRESH", lastUpdate: Date.now(), state: "OK" },
};

export const useHarpyStore = create<HarpyState>((set) => ({
  tracks: {},
  layers: defaultLayers,
  vision: { mode: "EO", bloom: 0.3, sharpen: 0.2 },
  preset: "DC",
  streamMode: "MOCK",
  wsRttMs: null,
  nowMs: Date.now(),
  viewport: null,

  toggleLayer: (id) =>
    set((s) => ({
      layers: { ...s.layers, [id]: { ...s.layers[id], enabled: !s.layers[id].enabled } },
    })),

  setVision: (v) => set((s) => ({ vision: { ...s.vision, ...v } })),

  setPreset: (p) => set({ preset: p }),

  setStreamMode: (m) => set({ streamMode: m }),

  setWsRttMs: (v) => set({ wsRttMs: v }),

  setViewport: (v) => set({ viewport: v }),

  ingestTracks: (tracks) =>
    set((s) => {
      const next = { ...s.tracks };
      for (const t of tracks) next[t.id] = t;
      return { tracks: next };
    }),

  ingestProviderStatus: (ps) =>
    set((s) => {
      const layerId = providerToLayer(ps.provider_id);
      if (!layerId) return s;
      return {
        layers: {
          ...s.layers,
          [layerId]: {
            ...s.layers[layerId],
            items: ps.items,
            source: ps.source_label,
            freshness: ps.freshness as Freshness,
            lastUpdate: ps.last_update_ms,
            state: ps.state as "OK" | "DEGRADED" | "DOWN",
          },
        },
      };
    }),

  tickNow: (ms) => set({ nowMs: ms }),

  recomputeFreshness: () =>
    set((s) => {
      const now = s.nowMs;
      const layers = { ...s.layers };
      for (const id of Object.keys(layers) as LayerId[]) {
        const layer = layers[id];
        layers[id] = { ...layer, freshness: computeFreshness(layer.lastUpdate, now) };
      }
      return { layers };
    }),
}));
