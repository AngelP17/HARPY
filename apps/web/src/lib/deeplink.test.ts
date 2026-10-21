import { describe, expect, it } from "vitest";
import { parseSelection, selectionHash } from "./deeplink";

describe("deep links", () => {
  it("parses satellite and earthquake links", () => {
    expect(parseSelection("#sat=25544")).toEqual({ kind: "satellite", norad: 25544 });
    expect(parseSelection("#eq=us6000u3rr")).toEqual({ kind: "earthquake", id: "usgs:us6000u3rr" });
  });
  it("rejects malformed input", () => {
    expect(parseSelection("")).toBeNull();
    expect(parseSelection("#sat=abc")).toBeNull();
    expect(parseSelection("#eq=<script>")).toBeNull();
  });
  it("round-trips", () => {
    for (const h of ["#sat=25544", "#eq=us6000u3rr"]) expect(selectionHash(parseSelection(h))).toBe(h);
    expect(selectionHash(null)).toBe("");
  });
});
