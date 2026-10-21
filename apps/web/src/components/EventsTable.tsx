"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useProvider, useQuakesInWindow } from "@/lib/selectors";
import { layerState } from "@/lib/state";
import { magColor, num, utc } from "@/lib/format";
import { StateChip } from "./ui";
import css from "./app.module.css";

type SortKey = "time" | "mag" | "depth";

export default function EventsTable() {
  const { quakes, loading, errors } = useQuakesInWindow();
  const provider = useProvider("earthquakes");
  const selection = useApp((s) => s.selection);
  const select = useApp((s) => s.select);
  const flyTo = useApp((s) => s.flyTo);
  const [sort, setSort] = useState<SortKey>("time");
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle
      ? quakes.filter((x) => (x.attributes.place ?? "").toLowerCase().includes(needle) || x.upstream_id?.includes(needle))
      : quakes;
    const by: Record<SortKey, (a: (typeof quakes)[number]) => number> = {
      time: (a) => a.observed_at,
      mag: (a) => a.attributes.mag ?? -9,
      depth: (a) => a.attributes.depth_km ?? -9,
    };
    return [...filtered].sort((a, b) => by[sort](b) - by[sort](a)).slice(0, 400);
  }, [quakes, sort, q]);

  const empty = layerState(provider?.state, quakes.length > 0);

  return (
    <div className={css.events}>
      <div className={css.eventsHead}>
        <input
          className={css.search}
          placeholder="Filter by place or event ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Filter earthquakes"
        />
        <div className={css.sorts}>
          {(["time", "mag", "depth"] as SortKey[]).map((k) => (
            <button key={k} className={sort === k ? css.segOn : undefined} onClick={() => setSort(k)}>
              {k}
            </button>
          ))}
        </div>
      </div>
      {errors.length > 0 && <p className={css.errLine}>Could not load part of the window: {errors[0]}</p>}
      {empty ? (
        <div className={css.empty}>
          <StateChip state={empty} />
          <p>No earthquake records are available for this window, and the source is not reachable. Nothing is shown in their place.</p>
        </div>
      ) : rows.length === 0 ? (
        <p className={css.emptyLine}>{loading ? "Loading recorded events…" : "No events match this window and filter."}</p>
      ) : (
        <table className={css.table}>
          <thead>
            <tr>
              <th>Mag</th>
              <th>Place</th>
              <th>Depth</th>
              <th>UTC</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const c = x.geometry?.coordinates;
              const on = selection?.kind === "earthquake" && selection.id === x.observation_id;
              return (
                <tr
                  key={x.observation_id}
                  className={on ? css.rowOn : undefined}
                  onClick={() => {
                    select({ kind: "earthquake", id: x.observation_id });
                    if (c) flyTo(c[1], c[0]);
                  }}
                >
                  <td>
                    <span className={css.magDot} style={{ background: magColor(x.attributes.mag) }} />
                    {num(x.attributes.mag)}
                  </td>
                  <td className={css.place}>{x.attributes.place ?? x.upstream_id}</td>
                  <td>{num(x.attributes.depth_km, 0)} km</td>
                  <td>{utc(x.observed_at, false).slice(5)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
