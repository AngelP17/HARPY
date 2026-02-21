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
  freshness: Freshness;
  lastUpdateMs: number;
  source: string;
};

type VisionState = {
  mode: VisionMode;
  bloom: number;
  sharpen: number;
};

type HarpyState = {
  nowMs: number;
  tickNow: (ms: number) => void;

  streamMode: "WS" | "MOCK";
  setStreamMode: (m: "WS" | "MOCK") => void;
  wsRttMs: number | null;
  setWsRttMs: (v: number | null) => void;

  layers: Record<LayerId, LayerState>;
  toggleLayer: (id: LayerId) => void;

  tracks: Record<string, Track>;
  ingestTracks: (tracks: Track[]) => void;

  providers: Record<string, ProviderStatus>;
  ingestProviderStatus: (ps: ProviderStatus) => void;

  vision: VisionState;
  setVisionMode: (m: VisionMode) => void;
  setBloom: (v: number) => void;
  setSharpen: (v: number) => void;

  preset: PresetId;
  setPreset: (p: PresetId) => void;

  viewport: ViewportBbox | null;
  setViewport: (v: ViewportBbox | null) => void;

  recomputeFreshness: () => void;
};

const FRESHNESS_THRESHOLDS: [number, Freshness][] = [
  [10_000, "FRESH"],
  [30_000, "AGING"],
  [90_000, "STALE"],
  [Infinity, "CRITICAL"],
];

function computeFreshness(lastMs: number, nowMs: number): Freshness {
  if (lastMs === 0) return "CRITICAL";
  const age = nowMs - lastMs;
  for (const [threshold, f] of FRESHNESS_THRESHOLDS) {
    if (age < threshold) return f;
  }
  return "CRITICAL";
}

export const useHarpyStore = create<HarpyState>((set) => ({
  nowMs: Date.now(),
  tickNow: (ms) => set({ nowMs: ms }),

  streamMode: "MOCK",
  setStreamMode: (m) => set({ streamMode: m }),
  wsRttMs: null,
  setWsRttMs: (v) => set({ wsRttMs: v }),

  layers: {
    AIR: { enabled: true, items: 0, freshness: "FRESH", lastUpdateMs: Date.now(), source: "ADS-B" },
    SAT: { enabled: true, items: 0, freshness: "FRESH", lastUpdateMs: Date.now(), source: "CelesTrak" },
    SEISMIC: { enabled: false, items: 0, freshness: "STALE", lastUpdateMs: 0, source: "USGS" },
    WEATHER: { enabled: false, items: 0, freshness: "STALE", lastUpdateMs: 0, source: "NWS" },
  },
  toggleLayer: (id) =>
    set((s) => ({
      layers: {
        ...s.layers,
        [id]: { ...s.layers[id], enabled: !s.layers[id].enabled },
      },
    })),

  tracks: {},
  ingestTracks: (tracks) =>
    set((s) => {
      const next = { ...s.tracks };
      const layerCounts: Partial<Record<LayerId, number>> = {};
      for (const t of tracks) {
        next[t.id] = t;
        const layer = t.kind as string;
        if (layer in s.layers) {
          layerCounts[layer as LayerId] = (layerCounts[layer as LayerId] ?? 0) + 1;
        }
      }
      const nextLayers = { ...s.layers };
      for (const [lid, count] of Object.entries(layerCounts)) {
        const key = lid as LayerId;
        nextLayers[key] = { ...nextLayers[key], items: count, lastUpdateMs: Date.now() };
      }
      return { tracks: next, layers: nextLayers };
    }),

  providers: {},
  ingestProviderStatus: (ps) =>
    set((s) => ({
      providers: { ...s.providers, [ps.provider_id]: ps },
    })),

  vision: { mode: "EO", bloom: 0.3, sharpen: 0.2 },
  setVisionMode: (m) => set((s) => ({ vision: { ...s.vision, mode: m } })),
  setBloom: (v) => set((s) => ({ vision: { ...s.vision, bloom: v } })),
  setSharpen: (v) => set((s) => ({ vision: { ...s.vision, sharpen: v } })),

  preset: "DC",
  setPreset: (p) => set({ preset: p, tracks: {} }),

  viewport: null,
  setViewport: (v) => set({ viewport: v }),

  recomputeFreshness: () =>
    set((s) => {
      const now = s.nowMs;
      const nextLayers = { ...s.layers };
      for (const lid of Object.keys(nextLayers) as LayerId[]) {
        const l = nextLayers[lid];
        nextLayers[lid] = {
          ...l,
          freshness: computeFreshness(l.lastUpdateMs, now),
        };
      }
      return { layers: nextLayers };
    }),
}));
