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

const kindToColor = (kind: number): number => {
  switch (kind) {
    case 1: // AIRCRAFT
      return 0x00ff00ff;
    case 2: // SATELLITE
      return 0x00bfffff;
    case 3: // GROUND
      return 0xffaa00ff;
    case 4: // VESSEL
      return 0x00ffffff;
    default:
      return 0xffffffff;
  }
};

const trackStore = new Map<string, Track>();
let allowedKinds = new Set<number>([1, 2, 3, 4]);
let declutterStep = 1;
const workerCtx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

workerCtx.onmessage = (event: MessageEvent) => {
  const { type, deltas, kinds, cameraHeightM } = event.data;
  
  if (type === "TRACK_DELTA_BATCH") {
    for (const delta of deltas) {
      const normalized: Track = {
        id: delta.id,
        providerId: delta.providerId ?? delta.provider_id ?? "unknown",
        lat: delta.position?.lat ?? 0,
        lon: delta.position?.lon ?? 0,
        alt: delta.position?.alt ?? 0,
        heading: delta.heading,
        speed: delta.speed,
        kind: delta.kind,
        colorRgba: kindToColor(delta.kind ?? 0),
        tsMs: Number(delta.tsMs ?? delta.ts_ms ?? Date.now()),
      };
      if (allowedKinds.has(normalized.kind)) {
        trackStore.set(delta.id, normalized);
      } else {
        trackStore.delete(delta.id);
      }
    }
    
    // Periodically send full state to pack-worker or when triggered
    // For now, let's send it every 100ms
    sendToPackWorker();
    return;
  }

  if (type === "SET_ACTIVE_KINDS" && Array.isArray(kinds)) {
    allowedKinds = new Set<number>(kinds);
    for (const [id, track] of trackStore) {
      if (!allowedKinds.has(track.kind)) {
        trackStore.delete(id);
      }
    }
    sendToPackWorker(true);
    return;
  }

  if (type === "SET_CAMERA_LOD" && typeof cameraHeightM === "number") {
    // Simple altitude-banded declutter. Higher altitude => keep fewer points.
    if (cameraHeightM > 12_000_000) {
      declutterStep = 16;
    } else if (cameraHeightM > 6_000_000) {
      declutterStep = 12;
    } else if (cameraHeightM > 3_000_000) {
      declutterStep = 8;
    } else if (cameraHeightM > 1_500_000) {
      declutterStep = 5;
    } else if (cameraHeightM > 700_000) {
      declutterStep = 3;
    } else {
      declutterStep = 1;
    }
    sendToPackWorker(true);
  }
};

let lastPackTime = 0;
const sendToPackWorker = (force = false) => {
  const now = Date.now();
  if (!force && now - lastPackTime < 100) return;
  lastPackTime = now;
  
  const allTracks = Array.from(trackStore.values());
  const tracks =
    declutterStep <= 1
      ? allTracks
      : allTracks.filter((_, index) => index % declutterStep === 0);
  workerCtx.postMessage({ type: "PACK_REQUEST", tracks });
};

export {};
