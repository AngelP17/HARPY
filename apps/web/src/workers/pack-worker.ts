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

const workerCtx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

workerCtx.onmessage = (event: MessageEvent) => {
  const { type, tracks } = event.data;
  
  if (type === "PACK_REQUEST") {
    packTracks(tracks);
  }
};

const packTracks = (tracks: Track[]) => {
  const N = tracks.length;
  
  const positions = new Float64Array(N * 3); // Better precision for lat/lon/alt
  const headings = new Float32Array(N);
  const speeds = new Float32Array(N);
  const kinds = new Uint8Array(N);
  const colors = new Uint32Array(N); // Store RGBA in 32bit or 4x8bit
  const ids: string[] = new Array(N);
  const providerIds: string[] = new Array(N);
  
  // Note: For id_table mapping, we'll keep it simple for now
  // and send the string IDs separately if needed
  
  for (let i = 0; i < N; i++) {
    const t = tracks[i];
    ids[i] = t.id;
    providerIds[i] = t.providerId;
    positions[i * 3 + 0] = t.lat;
    positions[i * 3 + 1] = t.lon;
    positions[i * 3 + 2] = t.alt;
    
    headings[i] = t.heading;
    speeds[i] = t.speed;
    kinds[i] = t.kind;
    colors[i] = t.colorRgba;
  }
  
  const payload = {
    type: "RENDER_PAYLOAD",
    positions: positions.buffer,
    headings: headings.buffer,
    speeds: speeds.buffer,
    kinds: kinds.buffer,
    colors: colors.buffer,
    ids,
    providerIds,
    count: N,
  };
  
  // Transfer buffers to main thread
  workerCtx.postMessage(payload, [
    positions.buffer,
    headings.buffer,
    speeds.buffer,
    kinds.buffer,
    colors.buffer,
  ]);
};

export {};
