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
  clusterCount?: number;
  clusterLabel?: string;
}

const workerCtx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

workerCtx.onmessage = (event: MessageEvent) => {
  const { type, tracks } = event.data;

  if (type === "PACK_REQUEST") {
    packTracks(tracks as Track[]);
  }
};

const packTracks = (tracks: Track[]) => {
  const trackCount = tracks.length;

  const positions = new Float64Array(trackCount * 3);
  const headings = new Float32Array(trackCount);
  const speeds = new Float32Array(trackCount);
  const kinds = new Uint8Array(trackCount);
  const colors = new Uint32Array(trackCount);
  const clusterCounts = new Uint16Array(trackCount);
  const ids: string[] = new Array(trackCount);
  const providerIds: string[] = new Array(trackCount);
  const labels: string[] = new Array(trackCount);

  for (let i = 0; i < trackCount; i += 1) {
    const track = tracks[i];
    ids[i] = track.id;
    providerIds[i] = track.providerId;
    labels[i] = track.clusterLabel ?? "";
    positions[i * 3 + 0] = track.lat;
    positions[i * 3 + 1] = track.lon;
    positions[i * 3 + 2] = track.alt;

    headings[i] = track.heading;
    speeds[i] = track.speed;
    kinds[i] = track.kind;
    colors[i] = track.colorRgba;
    clusterCounts[i] = Math.max(1, Math.round(track.clusterCount ?? 1));
  }

  workerCtx.postMessage(
    {
      type: "RENDER_PAYLOAD",
      positions: positions.buffer,
      headings: headings.buffer,
      speeds: speeds.buffer,
      kinds: kinds.buffer,
      colors: colors.buffer,
      clusterCounts: clusterCounts.buffer,
      ids,
      providerIds,
      labels,
      count: trackCount,
    },
    [positions.buffer, headings.buffer, speeds.buffer, kinds.buffer, colors.buffer, clusterCounts.buffer],
  );
};

export {};
