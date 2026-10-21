import { describe, expect, it } from "vitest";
import { chooseElements, daysBetween, layerState, measuredState } from "./state";
import type { ElementSet, Meta } from "./types";

const meta = (generated_at: number, stale_after_s = 2700) =>
  ({ generated_at, deployment: { stale_after_s } }) as unknown as Meta;

describe("measuredState", () => {
  const now = 10_000_000;
  it("is LIVE only with a fresh archive and a reachable provider", () => {
    expect(measuredState("live", meta(now - 60_000), "HEALTHY", now)).toBe("LIVE");
    expect(measuredState("live", meta(now - 60_000), "DEGRADED", now)).toBe("LIVE");
  });
  it("goes STALE when the archive stops updating, regardless of provider", () => {
    expect(measuredState("live", meta(now - 2701_000), "HEALTHY", now)).toBe("STALE");
  });
  it("goes STALE when the provider is unavailable", () => {
    expect(measuredState("live", meta(now), "UNAVAILABLE", now)).toBe("STALE");
    expect(measuredState("live", null, "HEALTHY", now)).toBe("STALE");
  });
  it("is RECORDED during replay", () => {
    expect(measuredState("replay", meta(now), "HEALTHY", now)).toBe("RECORDED");
  });
});

describe("layerState", () => {
  it("reports SOURCE_UNAVAILABLE only when there is nothing genuine to show", () => {
    expect(layerState("UNAVAILABLE", false)).toBe("SOURCE_UNAVAILABLE");
    expect(layerState("NEVER_RUN", false)).toBe("SOURCE_UNAVAILABLE");
    expect(layerState("UNAVAILABLE", true)).toBeNull();
    expect(layerState("HEALTHY", false)).toBeNull(); // an empty window is not an outage
  });
});

describe("chooseElements", () => {
  const mk = (norad: number, epoch: number, rev = 1) =>
    ({ observed_at: epoch, revision: rev, attributes: { norad_id: norad } }) as unknown as ElementSet;
  it("picks the nearest epoch and withholds anything outside the window", () => {
    const day = 86_400_000;
    const picked = chooseElements([mk(1, 0), mk(1, 5 * day), mk(2, 10 * day)], 1 * day, 3 * day);
    expect(picked.get(1)?.observed_at).toBe(0);
    expect(picked.has(2)).toBe(false);
  });
});

describe("daysBetween", () => {
  it("lists UTC days overlapping a window", () => {
    const t = Date.parse("2026-10-20T03:00:00Z");
    expect(daysBetween(t - 86_400_000, t)).toEqual(["2026-10-19", "2026-10-20"]);
  });
});
