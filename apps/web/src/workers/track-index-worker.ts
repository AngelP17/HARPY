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
const workerCtx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

workerCtx.onmessage = (event: MessageEvent) => {
  const { type, deltas } = event.data;
  
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
      trackStore.set(delta.id, normalized);
    }
    
    // Periodically send full state to pack-worker or when triggered
    // For now, let's send it every 100ms
    sendToPackWorker();
  }
};

let lastPackTime = 0;
const sendToPackWorker = () => {
  const now = Date.now();
  if (now - lastPackTime < 100) return;
  lastPackTime = now;
  
  const tracks = Array.from(trackStore.values());
  workerCtx.postMessage({ type: "PACK_REQUEST", tracks });
};

export {};
