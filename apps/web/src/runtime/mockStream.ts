import type { Track, ProviderStatus, PresetId, TrackKind } from "@/state/types";

const PRESET_CENTERS: Record<PresetId, { lat: number; lon: number }> = {
  DC: { lat: 38.8895, lon: -77.0353 },
  SF: { lat: 37.7749, lon: -122.4194 },
  PTY: { lat: 9.0, lon: -79.5 },
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return s / 2147483647;
  };
}

export function makeMockTick(preset: PresetId) {
  let tick = 0;
  const rand = seededRandom(42);
  const center = PRESET_CENTERS[preset];

  const aircraftSeeds = Array.from({ length: 20 }, (_, i) => ({
    id: `MOCK-AC-${String(i).padStart(3, "0")}`,
    baseLat: center.lat + (rand() - 0.5) * 4,
    baseLon: center.lon + (rand() - 0.5) * 6,
    heading: rand() * 360,
    speed: 200 + rand() * 100,
    alt: 8000 + rand() * 4000,
    latRate: (rand() - 0.5) * 0.008,
    lonRate: (rand() - 0.5) * 0.012,
  }));

  const satSeeds = Array.from({ length: 10 }, (_, i) => ({
    id: `MOCK-SAT-${String(i).padStart(3, "0")}`,
    inclination: 30 + rand() * 40,
    phase: rand() * Math.PI * 2,
    alt: 400_000 + rand() * 1_200_000,
    period: 5400 + rand() * 43200,
  }));

  return function mockTick(): { tracks: Track[]; providerStatus: ProviderStatus[] } {
    tick++;
    const now = Date.now();
    const tracks: Track[] = [];

    for (const ac of aircraftSeeds) {
      const t = tick * 0.04;
      tracks.push({
        id: ac.id,
        kind: "AIR" as TrackKind,
        lat: ac.baseLat + Math.sin(t + ac.heading * 0.01745) * ac.latRate * 50,
        lon: ac.baseLon + Math.cos(t * 0.8 + ac.heading * 0.01745) * ac.lonRate * 50,
        alt_m: ac.alt + Math.sin(t * 1.4) * 200,
        heading_deg: (ac.heading + Math.sin(t * 0.3) * 15 + 360) % 360,
        speed_mps: ac.speed + Math.sin(t) * 20,
        updated_ms: now,
      });
    }

    for (const sat of satSeeds) {
      const phase = ((now / 1000) % sat.period) / sat.period * Math.PI * 2;
      tracks.push({
        id: sat.id,
        kind: "SAT" as TrackKind,
        lat: sat.inclination * Math.sin(phase + sat.phase),
        lon: ((Math.cos(phase + sat.phase) * 180 + 360) % 360) - 180,
        alt_m: sat.alt,
        heading_deg: 0,
        speed_mps: 7600,
        updated_ms: now,
      });
    }

    const providerStatus: ProviderStatus[] = [
      {
        provider_id: "mock-adsb",
        state: "OK",
        freshness: "FRESH",
        last_update_ms: now,
        items: 20,
        source_label: "ADS-B",
      },
      {
        provider_id: "mock-tle",
        state: "OK",
        freshness: "FRESH",
        last_update_ms: now,
        items: 10,
        source_label: "CelesTrak",
      },
    ];

    return { tracks, providerStatus };
  };
}
