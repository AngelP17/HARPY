// Shareable selection links: #sat=25544 or #eq=us6000u3rr (USGS event ID).

import type { Selection } from "./store";

export function parseSelection(hash: string): Selection {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const sat = params.get("sat");
  if (sat && /^\d{1,9}$/.test(sat)) return { kind: "satellite", norad: Number(sat) };
  const eq = params.get("eq");
  if (eq && /^[a-z0-9]{4,32}$/i.test(eq)) return { kind: "earthquake", id: `usgs:${eq}` };
  return null;
}

export function selectionHash(sel: Selection): string {
  if (!sel) return "";
  return sel.kind === "satellite" ? `#sat=${sel.norad}` : `#eq=${sel.id.replace(/^usgs:/, "")}`;
}
