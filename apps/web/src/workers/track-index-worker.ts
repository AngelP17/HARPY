/// <reference lib="webworker" />

interface Track {
  id: string;
  providerId: string;
  lat: number;
  lon: number;
  alt: number;
  heading: number;
  speed: number;
  kind: number;
  colorRgba: number;
  tsMs: number;
}

interface FilterState {
  minAltM: number;
  maxAltM: number;
  minSpeedMs: number;
  maxSpeedMs: number;
}

const kindToColor = (kind: number): number => {
  switch (kind) {
    case 1:
      return 0x49d8ffff;
    case 2:
      return 0x8e7effff;
    case 3:
      return 0x69f4c9ff;
    case 4:
      return 0xffb769ff;
    default:
      return 0xe0ecffff;
  }
};

const clampLat = (value: number): number => Math.max(-89.999, Math.min(89.999, value));

const normalizeLon = (value: number): number => {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
};

const trackStore = new Map<string, Track>();
let allowedKinds = new Set<number>([1, 2, 3, 4]);
let activeFilter: FilterState = {
  minAltM: -1000,
  maxAltM: 2_000_000,
  minSpeedMs: 0,
  maxSpeedMs: 30_000,
};

const workerCtx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

const passesFilter = (track: Track): boolean => {
  if (!allowedKinds.has(track.kind)) {
    return false;
  }
  if (track.alt < activeFilter.minAltM || track.alt > activeFilter.maxAltM) {
    return false;
  }
  if (track.speed < activeFilter.minSpeedMs || track.speed > activeFilter.maxSpeedMs) {
    return false;
  }
  return true;
};

workerCtx.onmessage = (event: MessageEvent) => {
  const { type, deltas, kinds, filter } = event.data;

  if (type === "TRACK_DELTA_BATCH") {
    for (const delta of deltas) {
      const normalized: Track = {
        id: delta.id,
        providerId: delta.providerId ?? delta.provider_id ?? "unknown",
        lat: clampLat(delta.position?.lat ?? 0),
        lon: normalizeLon(delta.position?.lon ?? 0),
        alt: delta.position?.alt ?? 0,
        heading: Number(delta.heading ?? 0),
        speed: Number(delta.speed ?? 0),
        kind: Number(delta.kind ?? 0),
        colorRgba: kindToColor(Number(delta.kind ?? 0)),
        tsMs: Number(delta.tsMs ?? delta.ts_ms ?? Date.now()),
      };
      trackStore.set(delta.id, normalized);
    }
    sendToClusterWorker();
    return;
  }

  if (type === "SET_ACTIVE_KINDS" && Array.isArray(kinds)) {
    allowedKinds = new Set<number>(kinds);
    sendToClusterWorker(true);
    return;
  }

  if (type === "SET_FILTERS" && filter && typeof filter === "object") {
    activeFilter = {
      minAltM: Number(filter.minAltM ?? -1000),
      maxAltM: Number(filter.maxAltM ?? 2_000_000),
      minSpeedMs: Number(filter.minSpeedMs ?? 0),
      maxSpeedMs: Number(filter.maxSpeedMs ?? 30_000),
    };
    sendToClusterWorker(true);
  }
};

let lastEmitMs = 0;
const sendToClusterWorker = (force = false) => {
  const now = Date.now();
  if (!force && now - lastEmitMs < 100) {
    return;
  }
  lastEmitMs = now;
  const tracks = Array.from(trackStore.values()).filter(passesFilter);
  workerCtx.postMessage({ type: "INDEXED_TRACKS", tracks });
};

export {};
