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

interface StreamCenter {
  lat: number;
  lon: number;
}

const AIRCRAFT_COUNT = 6000;
const SATELLITE_COUNT = 180;
const CAMERA_COUNT = 50;
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
  for (let i = 0; i < AIRCRAFT_COUNT; i += 1) {
    seeds.push({
      id: `ac_${i}`,
      baseLat: -60 + (i % 120) * 1.0,
      baseLon: -180 + ((i * 13) % 360),
      latAmp: 0.08 + (i % 7) * 0.03,
      lonAmp: 0.15 + (i % 9) * 0.04,
      baseAlt: 7_500 + ((i * 17) % 4_500),
      altAmp: 250 + ((i * 7) % 280),
      phase: ((i * 0.61803398875) % 1) * TWO_PI,
      speed: 190 + (i % 13) * 8,
      headingOffset: (i * 47) % 360,
      kind: harpy.v1.TrackKind.TRACK_KIND_AIRCRAFT,
    });
  }

  for (let i = 0; i < SATELLITE_COUNT; i += 1) {
    const index = AIRCRAFT_COUNT + i;
    seeds.push({
      id: `sat_${i}`,
      baseLat: -70 + (i % 28) * 5.0,
      baseLon: -180 + ((i * 29) % 360),
      latAmp: 0.6 + (i % 5) * 0.2,
      lonAmp: 1.0 + (i % 4) * 0.35,
      baseAlt: 420_000 + ((i * 3000) % 180_000),
      altAmp: 6_000 + ((i * 97) % 4_000),
      phase: ((index * 0.61803398875) % 1) * TWO_PI,
      speed: 7_500 + (i % 17) * 15,
      headingOffset: (index * 47) % 360,
      kind: harpy.v1.TrackKind.TRACK_KIND_SATELLITE,
    });
  }

  for (let i = 0; i < CAMERA_COUNT; i += 1) {
    const index = AIRCRAFT_COUNT + SATELLITE_COUNT + i;
    seeds.push({
      id: `cam_${i}`,
      baseLat: -58 + (i % 25) * 4.8,
      baseLon: -168 + ((i * 43) % 336),
      latAmp: 0.004,
      lonAmp: 0.004,
      baseAlt: 12 + (i % 5) * 2,
      altAmp: 0.2,
      phase: ((index * 0.61803398875) % 1) * TWO_PI,
      speed: 0.1,
      headingOffset: (index * 47) % 360,
      kind: harpy.v1.TrackKind.TRACK_KIND_GROUND,
    });
  }
  return seeds;
};

export class MockStreamer {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private onMessage: (data: ArrayBuffer) => void;
  private tick = 0;
  private readonly trackSeeds: MockTrackSeed[] = buildTrackSeeds();
  private readonly demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  private center: StreamCenter = { lat: 37.7749, lon: -122.4194 };

  constructor(onMessage: (data: ArrayBuffer) => void) {
    this.onMessage = onMessage;
  }

  start() {
    this.stop();
    this.intervalId = setInterval(() => {
      this.generateBatch();
    }, 500);
  }

  stop() {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  setCenter(center: StreamCenter) {
    this.center = center;
  }

  seekTo(tsMs: number) {
    const syntheticTick = Math.max(0, Math.floor((tsMs - 1_700_000_000_000) / 500));
    this.tick = syntheticTick;
    this.generateBatch();
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
      const offsetLat = this.demoMode ? this.center.lat : seed.baseLat;
      const offsetLon = this.demoMode ? this.center.lon : seed.baseLon;
      const latSpreadScale = this.demoMode ? (seed.kind === harpy.v1.TrackKind.TRACK_KIND_SATELLITE ? 6 : 1.8) : 1;
      const lonSpreadScale = this.demoMode ? (seed.kind === harpy.v1.TrackKind.TRACK_KIND_SATELLITE ? 9 : 2.4) : 1;

      const lat = clampLatitude(offsetLat + Math.sin(angular) * seed.latAmp * latSpreadScale);
      const lon = wrapLongitude(offsetLon + Math.cos(angular * 0.82) * seed.lonAmp * lonSpreadScale);
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
          track_group: String(index % 16),
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
