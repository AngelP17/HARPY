import type { PresetId, Track, ProviderStatus } from "@/state/types";

type PresetConfig = {
  center: [number, number];
  radius: number;
  airCount: number;
  satCount: number;
};

const PRESETS: Record<PresetId, PresetConfig> = {
  DC: { center: [38.8895, -77.0353], radius: 2.0, airCount: 20, satCount: 10 },
  SF: { center: [37.7749, -122.4194], radius: 2.5, airCount: 18, satCount: 12 },
  PTY: { center: [9.0, -79.5], radius: 1.8, airCount: 15, satCount: 8 },
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function makeMockTick(presetId: PresetId) {
  const config = PRESETS[presetId];
  const rng = seededRandom(42);

  const aircraft: Track[] = [];
  const satellites: Track[] = [];

  for (let i = 0; i < config.airCount; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * config.radius;
    aircraft.push({
      id: `MOCK-AC-${String(i).padStart(3, "0")}`,
      kind: "AIR",
      lat: config.center[0] + Math.cos(angle) * dist,
      lon: config.center[1] + Math.sin(angle) * dist,
      alt_m: 5000 + rng() * 10000,
      heading_deg: rng() * 360,
      speed_mps: 100 + rng() * 200,
      updated_ms: Date.now(),
    });
  }

  for (let i = 0; i < config.satCount; i++) {
    const angle = rng() * Math.PI * 2;
    satellites.push({
      id: `MOCK-SAT-${String(i).padStart(3, "0")}`,
      kind: "SAT",
      lat: config.center[0] + Math.cos(angle) * 20,
      lon: config.center[1] + Math.sin(angle) * 20,
      alt_m: 400_000 + rng() * 1_000_000,
      heading_deg: 0,
      speed_mps: 7600,
      updated_ms: Date.now(),
    });
  }

  let tick = 0;

  return () => {
    tick++;
    const now = Date.now();

    for (const t of aircraft) {
      const rad = t.heading_deg * (Math.PI / 180);
      t.lat += Math.cos(rad) * 0.002;
      t.lon += Math.sin(rad) * 0.002;
      t.heading_deg = (t.heading_deg + (rng() - 0.5) * 10 + 360) % 360;
      t.updated_ms = now;
    }

    for (const t of satellites) {
      t.lon = ((t.lon + 0.05 + 180) % 360) - 180;
      t.updated_ms = now;
    }

    const tracks: Track[] = [...aircraft, ...satellites];

    const providerStatus: ProviderStatus[] = [
      {
        provider_id: "mock-adsb",
        state: "OK",
        freshness: "FRESH",
        last_update_ms: now,
        items: aircraft.length,
        source_label: "ADS-B",
      },
      {
        provider_id: "mock-tle",
        state: "OK",
        freshness: "FRESH",
        last_update_ms: now,
        items: satellites.length,
        source_label: "CelesTrak",
      },
    ];

    return { tracks, providerStatus };
  };
}
