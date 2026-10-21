import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { positionAt, satrecFor } from "./orbit";
import type { ElementSet, OmmRecord } from "./types";

// Recorded fixtures live at the repo root; they are test-only and never bundled.
const root = new URL("../../../../tests/fixtures/", import.meta.url);
const omm = JSON.parse(readFileSync(new URL("celestrak/iss.2020-07-12.omm.json", root), "utf8"))[0] as OmmRecord;
const golden = JSON.parse(readFileSync(new URL("golden/iss_positions.json", root), "utf8")) as {
  rows: { at_ms: number; lat: number; lon: number; alt_km: number }[];
};

const el = { attributes: { omm, period_min: 1440 / omm.MEAN_MOTION, norad_id: 25544 } } as unknown as ElementSet;

describe("client SGP4 agrees with harpy-core (Rust)", () => {
  const rec = satrecFor(el)!;
  it.each(golden.rows)("t=$at_ms", (row) => {
    const p = positionAt(rec, row.at_ms)!;
    // Measured 2026-10-21: altitude within 1 cm, horizontal within ~5 m (timing/GMST rounding
    // between libraries). SGP4 itself is good to ~1 km, so 1e-4 deg (~11 m) is the bound.
    expect(Math.abs(p.lat - row.lat)).toBeLessThan(1e-4);
    let dLon = Math.abs(p.lon - row.lon);
    if (dLon > 180) dLon = 360 - dLon;
    expect(dLon).toBeLessThan(1e-4);
    expect(Math.abs(p.altKm - row.alt_km)).toBeLessThan(0.01);
  });
});
