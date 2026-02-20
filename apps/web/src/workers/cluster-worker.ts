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

interface LodState {
  declutterStep: number;
  clusterCellDegrees: number;
}

const workerCtx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

const clampLat = (value: number): number => Math.max(-89.999, Math.min(89.999, value));

const normalizeLon = (value: number): number => {
  const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
};

const shortTrackId = (id: string): string => {
  const trimmed = id.replace(/^(ac_|sat_|cam_|track_)/i, "");
  return trimmed.length > 6 ? trimmed.substring(0, 6) : trimmed;
};

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

const buildClusterLabel = (kind: number, count: number, sampleIds: string[], shellBand?: number): string => {
  if (kind === 1) {
    return `${count} AC · ${sampleIds.map(shortTrackId).join(",")}`;
  }
  if (kind === 2) {
    return `${count} SAT · SHELL ${shellBand ?? 0}`;
  }
  const cameraLikeCount = sampleIds.filter((id) => id.startsWith("cam_")).length;
  if (cameraLikeCount >= Math.ceil(sampleIds.length / 2)) {
    return `${count} CAM · METRO`;
  }
  return `${count} GND`;
};

const clusterTracks = (tracks: Track[], lod: LodState): Track[] => {
  if (lod.clusterCellDegrees <= 0) {
    return tracks.map((track) => ({ ...track, clusterCount: 1, clusterLabel: "" }));
  }

  type ClusterBucket = {
    kind: number;
    shellBand?: number;
    count: number;
    sumLat: number;
    sumLon: number;
    sumAlt: number;
    sumHeading: number;
    maxSpeed: number;
    newestTsMs: number;
    sampleIds: string[];
    primaryProviderId: string;
    track?: Track;
  };

  const buckets = new Map<string, ClusterBucket>();

  for (const track of tracks) {
    const cellDegrees = track.kind === 3 ? lod.clusterCellDegrees * 1.35 : lod.clusterCellDegrees;
    const latBucket = Math.floor((track.lat + 90) / cellDegrees);
    const lonBucket = Math.floor((track.lon + 180) / cellDegrees);
    const shellBand = track.kind === 2 ? Math.floor(track.alt / 120_000) : undefined;
    const key = `${track.kind}:${shellBand ?? "na"}:${latBucket}:${lonBucket}`;
    const existing = buckets.get(key);

    if (!existing) {
      buckets.set(key, {
        kind: track.kind,
        shellBand,
        count: 1,
        sumLat: track.lat,
        sumLon: track.lon,
        sumAlt: track.alt,
        sumHeading: track.heading,
        maxSpeed: track.speed,
        newestTsMs: track.tsMs,
        sampleIds: [track.id],
        primaryProviderId: track.providerId,
        track,
      });
      continue;
    }

    existing.count += 1;
    existing.sumLat += track.lat;
    existing.sumLon += track.lon;
    existing.sumAlt += track.alt;
    existing.sumHeading += track.heading;
    existing.maxSpeed = Math.max(existing.maxSpeed, track.speed);
    existing.newestTsMs = Math.max(existing.newestTsMs, track.tsMs);
    if (existing.sampleIds.length < 2) {
      existing.sampleIds.push(track.id);
    }
  }

  const clusters: Track[] = [];
  const singles: Track[] = [];

  for (const [bucketKey, bucket] of buckets) {
    if (bucket.count <= 1 && bucket.track) {
      singles.push({ ...bucket.track, clusterCount: 1, clusterLabel: "" });
      continue;
    }

    clusters.push({
      id: `cluster:${bucketKey}`,
      providerId: bucket.primaryProviderId,
      lat: clampLat(bucket.sumLat / bucket.count),
      lon: normalizeLon(bucket.sumLon / bucket.count),
      alt: bucket.sumAlt / bucket.count,
      heading: bucket.sumHeading / bucket.count,
      speed: bucket.maxSpeed,
      kind: bucket.kind,
      colorRgba: kindToColor(bucket.kind),
      tsMs: bucket.newestTsMs,
      clusterCount: bucket.count,
      clusterLabel: buildClusterLabel(bucket.kind, bucket.count, bucket.sampleIds, bucket.shellBand),
    });
  }

  const declutteredSingles =
    lod.declutterStep <= 1
      ? singles
      : singles.filter((_, index) => index % lod.declutterStep === 0);

  return [...clusters, ...declutteredSingles];
};

let latestTracks: Track[] = [];
let lod: LodState = { declutterStep: 1, clusterCellDegrees: 0 };
let lastEmitMs = 0;

const emitToPackWorker = (force = false) => {
  const now = Date.now();
  if (!force && now - lastEmitMs < 100) {
    return;
  }
  lastEmitMs = now;
  const clustered = clusterTracks(latestTracks, lod);
  workerCtx.postMessage({ type: "PACK_REQUEST", tracks: clustered });
};

workerCtx.onmessage = (event: MessageEvent) => {
  const { type, tracks, cameraHeightM } = event.data;

  if (type === "INDEXED_TRACKS" && Array.isArray(tracks)) {
    latestTracks = tracks as Track[];
    emitToPackWorker();
    return;
  }

  if (type === "SET_CAMERA_LOD" && typeof cameraHeightM === "number") {
    if (cameraHeightM > 12_000_000) {
      lod = { declutterStep: 8, clusterCellDegrees: 8 };
    } else if (cameraHeightM > 6_000_000) {
      lod = { declutterStep: 6, clusterCellDegrees: 4 };
    } else if (cameraHeightM > 3_000_000) {
      lod = { declutterStep: 4, clusterCellDegrees: 2 };
    } else if (cameraHeightM > 1_500_000) {
      lod = { declutterStep: 2, clusterCellDegrees: 1 };
    } else if (cameraHeightM > 700_000) {
      lod = { declutterStep: 1, clusterCellDegrees: 0.5 };
    } else {
      lod = { declutterStep: 1, clusterCellDegrees: 0 };
    }
    emitToPackWorker(true);
  }
};

export {};
