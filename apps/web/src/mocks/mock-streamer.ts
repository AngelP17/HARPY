import { harpy } from "@harpy/shared-types";

interface MockTrackSeed {
  id: string;
  baseLat: number;
  baseLon: number;
  latAmp: number;
  lonAmp: number;
  baseAlt: number;
  altAmp: number;
  phase: number;
  speed: number;
  headingOffset: number;
  kind: harpy.v1.TrackKind;
}

const TRACK_COUNT = 72;
const TWO_PI = Math.PI * 2;

const wrapLongitude = (lon: number): number => {
  let wrapped = ((lon + 180) % 360 + 360) % 360 - 180;
  if (wrapped === -180) {
    wrapped = 180;
  }
  return wrapped;
};

const clampLatitude = (lat: number): number => Math.max(-85, Math.min(85, lat));

const buildTrackSeeds = (): MockTrackSeed[] => {
  const seeds: MockTrackSeed[] = [];
  for (let i = 0; i < TRACK_COUNT; i += 1) {
    const kind =
      i % 4 === 0
        ? harpy.v1.TrackKind.TRACK_KIND_AIRCRAFT
        : i % 4 === 1
          ? harpy.v1.TrackKind.TRACK_KIND_SATELLITE
          : i % 4 === 2
            ? harpy.v1.TrackKind.TRACK_KIND_GROUND
            : harpy.v1.TrackKind.TRACK_KIND_VESSEL;

    seeds.push({
      id: `track_${i}`,
      baseLat: -58 + (i % 12) * 10.5,
      baseLon: -170 + ((i * 37) % 340),
      latAmp: 0.6 + (i % 5) * 0.35,
      lonAmp: 0.9 + (i % 7) * 0.4,
      baseAlt: 300 + ((i * 113) % 14500),
      altAmp: 120 + ((i * 29) % 800),
      phase: ((i * 0.61803398875) % 1) * TWO_PI,
      speed: 95 + (i % 11) * 22,
      headingOffset: (i * 47) % 360,
      kind,
    });
  }
  return seeds;
};

export class MockStreamer {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onMessage: (data: ArrayBuffer) => void;
  private tick = 0;
  private readonly trackSeeds: MockTrackSeed[] = buildTrackSeeds();

  constructor(onMessage: (data: ArrayBuffer) => void) {
    this.onMessage = onMessage;
  }

  start() {
    this.intervalId = setInterval(() => {
      this.generateBatch();
    }, 1000);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private emitEnvelope(envelope: harpy.v1.IEnvelope) {
    const bytes = harpy.v1.Envelope.encode(harpy.v1.Envelope.create(envelope)).finish();
    const frame = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    this.onMessage(frame);
  }

  private generateBatch() {
    const now = Date.now();
    const t = this.tick;
    const deltas: harpy.v1.ITrackDelta[] = this.trackSeeds.map((seed, index) => {
      const angular = t * 0.09 + seed.phase;
      const lat = clampLatitude(seed.baseLat + Math.sin(angular) * seed.latAmp);
      const lon = wrapLongitude(seed.baseLon + Math.cos(angular * 0.82) * seed.lonAmp);
      const alt = Math.max(0, seed.baseAlt + Math.sin(angular * 1.41) * seed.altAmp);
      const heading = (seed.headingOffset + t * 4 + index) % 360;
      const speed = Math.max(0, seed.speed + Math.cos(angular * 1.17) * 18);

      return {
        id: seed.id,
        position: { lat, lon, alt },
        heading,
        speed,
        kind: seed.kind,
        providerId: "mock-streamer",
        meta: {
          source: "deterministic",
          track_group: String(index % 6),
        },
        tsMs: now,
      };
    });

    this.emitEnvelope({
      schemaVersion: "1.0.0",
      serverTsMs: now,
      trackDeltaBatch: { deltas },
    });

    if (t % 2 === 0) {
      this.emitEnvelope({
        schemaVersion: "1.0.0",
        serverTsMs: now,
        providerStatus: {
          providerId: "mock-streamer",
          circuitState: harpy.v1.CircuitState.CIRCUIT_STATE_CLOSED,
          freshness: harpy.v1.Freshness.FRESHNESS_FRESH,
          lastSuccessTsMs: now,
          failureCount: 0,
          meta: {
            mode: "offline",
            source: "mock-streamer",
          },
        },
      });
    }

    this.tick += 1;
  }
}
