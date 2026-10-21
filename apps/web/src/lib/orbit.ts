// Client-side SGP4 (satellite.js, AFSPC mode 'a') to match services/harpy-core/src/orbit.rs.
// Positions computed here are CALCULATED observations: derived, never measured.

import { eciToGeodetic, gstime, json2satrec, propagate, type SatRec } from "satellite.js";
import type { ElementSet, OmmRecord } from "./types";

export interface SatPosition {
  lat: number;
  lon: number;
  altKm: number;
  speedKmS: number;
}

const cache = new WeakMap<object, SatRec | null>();

export function satrecFor(el: ElementSet): SatRec | null {
  const omm = el.attributes.omm;
  if (cache.has(omm)) return cache.get(omm) ?? null;
  let rec: SatRec | null = null;
  try {
    rec = json2satrec(omm as unknown as Parameters<typeof json2satrec>[0], "a");
  } catch {
    rec = null;
  }
  cache.set(omm, rec);
  return rec;
}

export function positionAt(rec: SatRec, at: number): SatPosition | null {
  const date = new Date(at);
  const pv = propagate(rec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const gmst = gstime(date);
  const geo = eciToGeodetic(pv.position, gmst);
  const v = pv.velocity && typeof pv.velocity !== "boolean" ? pv.velocity : { x: 0, y: 0, z: 0 };
  const lon = (geo.longitude * 180) / Math.PI;
  return {
    lat: (geo.latitude * 180) / Math.PI,
    lon: ((((lon + 180) % 360) + 360) % 360) - 180,
    altKm: geo.height,
    speedKmS: Math.hypot(v.x, v.y, v.z),
  };
}

/** Sample one orbital period around `at` for drawing the selected satellite's track. */
export function orbitTrack(el: ElementSet, at: number, samples = 120): SatPosition[] {
  const rec = satrecFor(el);
  if (!rec) return [];
  const periodMs = el.attributes.period_min * 60_000;
  const out: SatPosition[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = at - periodMs / 2 + (periodMs * i) / samples;
    const p = positionAt(rec, t);
    if (p) out.push(p);
  }
  return out;
}

export function ommEpochMs(omm: OmmRecord): number {
  const iso = omm.EPOCH.endsWith("Z") ? omm.EPOCH : `${omm.EPOCH}Z`;
  return Date.parse(iso);
}
