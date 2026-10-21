// Display-state rules (docs/contracts/observation.md). Pure functions, unit-tested.
// The UI must never show a record as LIVE unless every condition below holds.

import type { ElementSet, Meta, ProviderState } from "./types";

export type DisplayState =
  | "LIVE" // fresh genuine source record, archive fresh, provider reachable
  | "STALE" // last known genuine record; the archive or provider is behind
  | "RECORDED" // genuine record shown while replaying recorded history
  | "CALCULATED" // SGP4 position from an identified element set
  | "INFERRED" // model hypothesis (Milestone B, GeoWraith)
  | "SOURCE_UNAVAILABLE" // provider failed and there is nothing genuine to show
  | "INSUFFICIENT_EVIDENCE"; // no defensible value; nothing is drawn

export type TimeMode = "live" | "replay";

export const DAY_MS = 86_400_000;

/** Age of the data snapshot itself. On a static archive this is how far behind ingestion is. */
export function archiveAgeMs(meta: Meta, now: number): number {
  return Math.max(0, now - meta.generated_at);
}

export function archiveIsFresh(meta: Meta, now: number): boolean {
  return archiveAgeMs(meta, now) <= meta.deployment.stale_after_s * 1000;
}

export function providerReachable(state: ProviderState | undefined): boolean {
  return state === "HEALTHY" || state === "DEGRADED";
}

export function measuredState(
  mode: TimeMode,
  meta: Meta | null,
  provider: ProviderState | undefined,
  now: number,
): DisplayState {
  if (mode === "replay") return "RECORDED";
  if (!meta) return "STALE";
  if (archiveIsFresh(meta, now) && providerReachable(provider)) return "LIVE";
  return "STALE";
}

/** Layer-level state: what to tell the user when a layer has nothing to draw. */
export function layerState(provider: ProviderState | undefined, hasAnyData: boolean): DisplayState | null {
  if (hasAnyData) return null;
  if (provider === "UNAVAILABLE" || provider === "NEVER_RUN" || provider === undefined) {
    return "SOURCE_UNAVAILABLE";
  }
  return null; // provider fine, genuinely empty window: an honest empty state, not an error
}

/**
 * For each satellite, choose the stored element set whose epoch is closest to `at`,
 * and only if it is within the allowed offset. Otherwise the satellite is withheld.
 */
export function chooseElements(
  revisions: ElementSet[],
  at: number,
  maxOffsetMs: number,
): Map<number, ElementSet> {
  const best = new Map<number, ElementSet>();
  for (const r of revisions) {
    const norad = r.attributes.norad_id;
    const off = Math.abs(r.observed_at - at);
    if (off > maxOffsetMs) continue;
    const cur = best.get(norad);
    if (!cur || off < Math.abs(cur.observed_at - at)) best.set(norad, r);
  }
  return best;
}

/** UTC calendar days overlapping [from, to], as YYYY-MM-DD. */
export function daysBetween(from: number, to: number): string[] {
  const out: string[] = [];
  const start = Math.floor(from / DAY_MS) * DAY_MS;
  for (let t = start; t <= to; t += DAY_MS) out.push(new Date(t).toISOString().slice(0, 10));
  return out;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
