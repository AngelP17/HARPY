import { useMemo } from "react";
import { useApp } from "./store";
import { chooseElements } from "./state";
import type { Earthquake, ElementSet, ProviderStatus } from "./types";

export function useCore() {
  const core = useApp((s) => s.core);
  return core.status === "ok" ? core.data : null;
}

export function useProvider(layer: "earthquakes" | "satellites"): ProviderStatus | undefined {
  const core = useCore();
  return core?.providers.providers.find((p) => p.layer === layer);
}

/** Earthquakes whose event time falls in the display window ending at the cursor. */
export function useQuakesInWindow(): { quakes: Earthquake[]; loading: boolean; errors: string[] } {
  const eqDays = useApp((s) => s.eqDays);
  const cursor = useApp((s) => s.cursor);
  const windowMs = useApp((s) => s.windowMs);
  const minMag = useApp((s) => s.minMagnitude);
  return useMemo(() => {
    const from = cursor - windowMs;
    const quakes: Earthquake[] = [];
    const errors: string[] = [];
    let loading = false;
    for (const doc of Object.values(eqDays)) {
      if (doc.status === "loading") loading = true;
      else if (doc.status === "error") errors.push(doc.error);
      else
        for (const q of doc.data.observations) {
          if (q.observed_at < from || q.observed_at > cursor) continue;
          if ((q.attributes.mag ?? -Infinity) < minMag && minMag > 0) continue;
          quakes.push(q);
        }
    }
    quakes.sort((a, b) => b.observed_at - a.observed_at);
    return { quakes, loading, errors };
  }, [eqDays, cursor, windowMs, minMag]);
}

/** Element sets usable at the cursor (nearest epoch within the allowed offset), per group filter. */
export function useElementsAtCursor(): { elements: ElementSet[]; withheld: number } {
  const core = useCore();
  const satDays = useApp((s) => s.satDays);
  const mode = useApp((s) => s.mode);
  const groups = useApp((s) => s.satGroups);
  // Re-evaluate the choice at most once a minute in live mode; epochs move slowly.
  const cursor = useApp((s) => (s.mode === "live" ? Math.floor(s.cursor / 60_000) * 60_000 : s.cursor));
  return useMemo(() => {
    if (!core) return { elements: [], withheld: 0 };
    const maxOff = core.meta.rules.elements_max_offset_s * 1000;
    const pool: ElementSet[] = [...core.satLatest.observations];
    if (mode === "replay")
      for (const d of Object.values(satDays)) if (d.status === "ok") pool.push(...d.data.observations);
    const visible = pool.filter((e) => groups[e.attributes.group] !== false);
    const chosen = chooseElements(visible, cursor, maxOff);
    const allIds = new Set(visible.map((e) => e.attributes.norad_id));
    return { elements: [...chosen.values()], withheld: allIds.size - chosen.size };
  }, [core, satDays, mode, groups, cursor]);
}
