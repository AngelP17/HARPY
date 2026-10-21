import { create } from "zustand";
import { DataError, getDoc } from "./data";
import { DAY_MS, daysBetween, type TimeMode } from "./state";
import type {
  DayDoc,
  Earthquake,
  EarthquakeIndex,
  ElementSet,
  FetchLogEntry,
  Meta,
  ProvidersDoc,
  SatelliteIndex,
} from "./types";

export type Selection = { kind: "earthquake"; id: string } | { kind: "satellite"; norad: number } | null;
export type GlobeStyle = "standard" | "night" | "thermal-look";
type Loadable<T> = { status: "loading" } | { status: "ok"; data: T } | { status: "error"; error: string };

interface CoreDocs {
  meta: Meta;
  providers: ProvidersDoc;
  eqIndex: EarthquakeIndex;
  satLatest: DayDoc<ElementSet>;
  satIndex: SatelliteIndex;
  fetchLog: { generated_at: number; entries: FetchLogEntry[] };
}

interface AppState {
  core: Loadable<CoreDocs>;
  lastSyncAt: number | null;
  syncError: string | null;
  eqDays: Record<string, Loadable<DayDoc<Earthquake>>>;
  satDays: Record<string, Loadable<DayDoc<ElementSet>>>;

  mode: TimeMode;
  cursor: number;
  playing: boolean;
  speed: number;
  windowMs: number;

  selection: Selection;
  showEarthquakes: boolean;
  showSatellites: boolean;
  minMagnitude: number;
  satGroups: Record<string, boolean>;
  showOrbit: boolean;
  globeStyle: GlobeStyle;
  focus: { lat: number; lon: number; altKm: number; at: number } | null;

  syncCore: () => Promise<void>;
  ensureDays: () => void;
  goLive: () => void;
  setCursor: (t: number) => void;
  setPlaying: (p: boolean) => void;
  setSpeed: (s: number) => void;
  select: (s: Selection) => void;
  flyTo: (lat: number, lon: number, altKm?: number) => void;
  set: (patch: Partial<AppState>) => void;
}

const msg = (e: unknown) => (e instanceof DataError || e instanceof Error ? e.message : String(e));

export const useApp = create<AppState>((set, get) => ({
  core: { status: "loading" },
  lastSyncAt: null,
  syncError: null,
  eqDays: {},
  satDays: {},

  mode: "live",
  cursor: Date.now(),
  playing: false,
  speed: 600,
  windowMs: DAY_MS,

  selection: null,
  showEarthquakes: true,
  showSatellites: true,
  minMagnitude: 0,
  satGroups: {},
  showOrbit: true,
  globeStyle: "standard",
  focus: null,

  syncCore: async () => {
    try {
      const [meta, providers, eqIndex, satLatest, satIndex, fetchLog] = await Promise.all([
        getDoc<Meta>("meta.json"),
        getDoc<ProvidersDoc>("providers.json"),
        getDoc<EarthquakeIndex>("earthquakes/index.json"),
        getDoc<DayDoc<ElementSet>>("satellites/latest.json"),
        getDoc<SatelliteIndex>("satellites/index.json"),
        getDoc<CoreDocs["fetchLog"]>("fetch-log.json"),
      ]);
      const prev = get().core;
      const changed = prev.status !== "ok" || prev.data.meta.generated_at !== meta.generated_at;
      const groups = { ...get().satGroups };
      for (const o of satLatest.observations) if (!(o.attributes.group in groups)) groups[o.attributes.group] = true;
      set({
        core: { status: "ok", data: { meta, providers, eqIndex, satLatest, satIndex, fetchLog } },
        lastSyncAt: Date.now(),
        syncError: null,
        satGroups: groups,
        // A new snapshot may have revised recent days: drop them so they reload.
        ...(changed ? { eqDays: {}, satDays: {} } : {}),
      });
      get().ensureDays();
    } catch (e) {
      // Keep whatever genuine data we already have; report the failure instead of hiding it.
      if (get().core.status === "ok") set({ syncError: msg(e) });
      else set({ core: { status: "error", error: msg(e) } });
    }
  },

  ensureDays: () => {
    const { core, cursor, windowMs, mode, eqDays, satDays } = get();
    if (core.status !== "ok") return;
    const known = new Set(core.data.eqIndex.days.map((d) => d.date));
    for (const day of daysBetween(cursor - windowMs, cursor)) {
      if (!known.has(day) || eqDays[day]) continue;
      set((s) => ({ eqDays: { ...s.eqDays, [day]: { status: "loading" } } }));
      getDoc<DayDoc<Earthquake>>(`earthquakes/day/${day}.json`)
        .then((data) => set((s) => ({ eqDays: { ...s.eqDays, [day]: { status: "ok", data } } })))
        .catch((e) => set((s) => ({ eqDays: { ...s.eqDays, [day]: { status: "error", error: msg(e) } } })));
    }
    if (mode !== "replay") return;
    const satKnown = new Set(core.data.satIndex.days.map((d) => d.date));
    const maxOff = core.data.meta.rules.elements_max_offset_s * 1000;
    for (const day of daysBetween(cursor - maxOff, cursor + DAY_MS)) {
      if (!satKnown.has(day) || satDays[day]) continue;
      set((s) => ({ satDays: { ...s.satDays, [day]: { status: "loading" } } }));
      getDoc<DayDoc<ElementSet>>(`satellites/day/${day}.json`)
        .then((data) => set((s) => ({ satDays: { ...s.satDays, [day]: { status: "ok", data } } })))
        .catch((e) => set((s) => ({ satDays: { ...s.satDays, [day]: { status: "error", error: msg(e) } } })));
    }
  },

  goLive: () => {
    set({ mode: "live", playing: false, cursor: Date.now() });
    get().ensureDays();
  },
  setCursor: (t) => {
    const prevDay = Math.floor(get().cursor / DAY_MS);
    const now = Date.now();
    if (t >= now - 1000) {
      set({ mode: "live", cursor: now, playing: false });
    } else {
      set({ mode: "replay", cursor: t });
    }
    if (Math.floor(t / DAY_MS) !== prevDay || get().mode === "replay") get().ensureDays();
  },
  setPlaying: (p) => set({ playing: p }),
  setSpeed: (s) => set({ speed: s }),
  select: (selection) => set({ selection }),
  flyTo: (lat, lon, altKm = 4000) => set({ focus: { lat, lon, altKm, at: Date.now() } }),
  set: (patch) => set(patch),
}));
