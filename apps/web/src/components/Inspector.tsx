"use client";

import { useApp } from "@/lib/store";
import { useCore, useElementsAtCursor, useProvider, useQuakesInWindow } from "@/lib/selectors";
import { measuredState } from "@/lib/state";
import { positionAt, satrecFor } from "@/lib/orbit";
import { age, coord, magColor, num, shortDigest, utc } from "@/lib/format";
import type { Earthquake, ElementSet } from "@/lib/types";
import { KV, Section, StateChip, TypeTag } from "./ui";
import css from "./app.module.css";

export default function Inspector({ now }: { now: number }) {
  const selection = useApp((s) => s.selection);
  const { quakes } = useQuakesInWindow();
  const { elements } = useElementsAtCursor();

  if (selection?.kind === "earthquake") {
    const q = quakes.find((x) => x.observation_id === selection.id);
    if (q) return <QuakeCard q={q} now={now} />;
    return <Gone text="That event is outside the current time window." />;
  }
  if (selection?.kind === "satellite") {
    const el = elements.find((e) => e.attributes.norad_id === selection.norad);
    if (el) return <SatCard el={el} now={now} />;
    return <Gone text="No element set for that satellite within 3 days of the display time, so its position is withheld." />;
  }
  return <Overview />;
}

function Gone({ text }: { text: string }) {
  const select = useApp((s) => s.select);
  return (
    <Section title="Inspector" aside={<button className={css.linkBtn} onClick={() => select(null)}>Clear</button>}>
      <div className={css.empty}>
        <StateChip state="INSUFFICIENT_EVIDENCE" />
        <p>{text}</p>
      </div>
    </Section>
  );
}

function Overview() {
  const core = useCore();
  const { quakes } = useQuakesInWindow();
  const { elements } = useElementsAtCursor();
  const largest = quakes.reduce<Earthquake | null>(
    (best, q) => ((q.attributes.mag ?? -9) > (best?.attributes.mag ?? -9) ? q : best),
    null,
  );
  const select = useApp((s) => s.select);
  const flyTo = useApp((s) => s.flyTo);
  return (
    <Section title="Overview">
      <div className={css.stats}>
        <div>
          <span className={css.statNum}>{quakes.length}</span>
          <span className={css.statLabel}>quakes, 24 h</span>
        </div>
        <div>
          <span className={css.statNum} style={{ color: magColor(largest?.attributes.mag ?? null) }}>
            {largest ? `M${num(largest.attributes.mag)}` : "none"}
          </span>
          <span className={css.statLabel}>largest</span>
        </div>
        <div>
          <span className={css.statNum}>{elements.length}</span>
          <span className={css.statLabel}>satellites</span>
        </div>
      </div>
      {largest && (
        <button
          className={css.cardBtn}
          onClick={() => {
            select({ kind: "earthquake", id: largest.observation_id });
            const c = largest.geometry?.coordinates;
            if (c) flyTo(c[1], c[0]);
          }}
        >
          <span>{largest.attributes.title ?? largest.observation_id}</span>
          <span className={css.muted}>{utc(largest.observed_at, false)}</span>
        </button>
      )}
      {core && (
        <p className={css.hint}>
          Recorded history: {core.meta.counts.earthquakes} events ({core.meta.counts.earthquake_revisions} revisions),{" "}
          {core.meta.counts.satellites} satellites ({core.meta.counts.element_revisions} element sets). Click anything on
          the globe for its provenance.
        </p>
      )}
    </Section>
  );
}

function QuakeCard({ q, now }: { q: Earthquake; now: number }) {
  const core = useCore();
  const mode = useApp((s) => s.mode);
  const select = useApp((s) => s.select);
  const flyTo = useApp((s) => s.flyTo);
  const provider = useProvider("earthquakes");
  const state = measuredState(mode, core?.meta ?? null, provider?.state, now);
  const a = q.attributes;
  const [lon, lat] = q.geometry?.coordinates ?? [0, 0];

  return (
    <Section title="Earthquake" aside={<button className={css.linkBtn} onClick={() => select(null)}>Close</button>}>
      <div className={css.headline}>
        <span className={css.bigMag} style={{ color: magColor(a.mag) }}>
          {a.mag != null ? `M${num(a.mag)}` : "M?"}
          <small>{a.mag_type}</small>
        </span>
        <div>
          <div className={css.title}>{a.place ?? "Unnamed location"}</div>
          <div className={css.chipRow}>
            <StateChip state={state} />
            <TypeTag type={q.observation_type} />
            {a.review_status && <TypeTag type={a.review_status} />}
            {a.tsunami_flag === 1 && (
              <span
                className={css.typeTag}
                title="USGS sets this flag for large oceanic events. It is not a tsunami warning; check tsunami.gov."
              >
                tsunami flag
              </span>
            )}
            {a.pager_alert && (
              <span
                className={css[`pager_${a.pager_alert}`] ?? css.typeTag}
                title="USGS PAGER estimated impact level (green, yellow, orange, red)"
              >
                PAGER {a.pager_alert}
              </span>
            )}
          </div>
        </div>
      </div>
      <KV
        rows={[
          ["Origin time", utc(q.observed_at)],
          ["Location", coord(lat, lon)],
          ["Depth", `${num(a.depth_km)} km`],
          ["Stations / gap", `${a.station_count ?? "n/a"} / ${a.azimuthal_gap_deg ?? "n/a"}°`],
        ]}
      />
      <h3 className={css.subhead}>Provenance</h3>
      <KV
        rows={[
          ["Source", `${q.source_id} (${a.network ?? "?"} network)`],
          ["Upstream ID", <code key="u">{q.upstream_id}</code>],
          ["Source updated", q.source_updated_at ? `${utc(q.source_updated_at)} (${age(q.source_updated_at, now)})` : "n/a"],
          ["Ingested", `${utc(q.ingested_at)} (${age(q.ingested_at, now)})`],
          ["Revision", `${q.revision}${q.revision > 1 ? " (corrected by source)" : ""}`],
          ["License", q.license_class],
          ["Record digest", <code key="d" title={q.raw_payload_digest}>{shortDigest(q.raw_payload_digest)}</code>],
        ]}
      />
      {q.history && q.history.length > 1 && (
        <>
          <h3 className={css.subhead}>Revision history</h3>
          <ol className={css.history}>
            {q.history.map((h) => (
              <li key={h.revision}>
                <span>r{h.revision}</span>
                <span>ingested {utc(h.ingested_at, false)}</span>
                <code>{shortDigest(h.raw_payload_digest)}</code>
              </li>
            ))}
          </ol>
        </>
      )}
      <div className={css.actions}>
        <button className={css.btn} onClick={() => flyTo(lat, lon, 5000)}>
          Fly to
        </button>
        {q.source_url && (
          <a className={css.btn} href={q.source_url} target="_blank" rel="noreferrer">
            USGS event page ↗
          </a>
        )}
      </div>
    </Section>
  );
}

function SatCard({ el, now }: { el: ElementSet; now: number }) {
  const mode = useApp((s) => s.mode);
  const cursor = useApp((s) => s.cursor);
  const select = useApp((s) => s.select);
  const flyTo = useApp((s) => s.flyTo);
  const at = mode === "live" ? now : cursor;

  const a = el.attributes;
  const rec = satrecFor(el);
  const p = rec ? positionAt(rec, at) : null;
  const offsetH = (at - el.observed_at) / 3_600_000;

  return (
    <Section title="Satellite" aside={<button className={css.linkBtn} onClick={() => select(null)}>Close</button>}>
      <div className={css.title}>{a.name ?? `NORAD ${a.norad_id}`}</div>
      <div className={css.chipRow}>
        <StateChip state={p ? "CALCULATED" : "INSUFFICIENT_EVIDENCE"} />
        <TypeTag type="calculated from measured elements" />
      </div>
      {p ? (
        <KV
          rows={[
            ["Position", coord(p.lat, p.lon)],
            ["Altitude", `${num(p.altKm, 1)} km`],
            ["Speed", `${num(p.speedKmS, 2)} km/s`],
            ["At", utc(at)],
          ]}
        />
      ) : (
        <p className={css.hint}>SGP4 could not propagate this element set to the display time, so no position is shown.</p>
      )}
      <h3 className={css.subhead}>Orbit</h3>
      <KV
        rows={[
          ["Period", `${num(a.period_min, 1)} min`],
          ["Perigee / apogee", `${num(a.perigee_km, 0)} / ${num(a.apogee_km, 0)} km`],
          ["Inclination", `${num(a.inclination_deg, 2)}°`],
          ["Group", a.group],
        ]}
      />
      <h3 className={css.subhead}>Provenance</h3>
      <KV
        rows={[
          ["Element source", `${el.source_id}, ${a.data_product}`],
          ["NORAD / COSPAR", `${a.norad_id} / ${a.intl_designator ?? "n/a"}`],
          ["Element epoch", `${utc(el.observed_at)} (${offsetH >= 0 ? "+" : ""}${offsetH.toFixed(1)} h from display time)`],
          ["Evidence ref", <code key="e">{`${el.observation_id}@${el.revision}`}</code>],
          ["Ingested", utc(el.ingested_at)],
          ["Propagator", "SGP4, AFSPC mode (satellite.js), matched to harpy-core"],
          ["Record digest", <code key="d" title={el.raw_payload_digest}>{shortDigest(el.raw_payload_digest)}</code>],
        ]}
      />
      <div className={css.actions}>
        {p && (
          <button className={css.btn} onClick={() => flyTo(p.lat, p.lon, p.altKm + 6000)}>
            Fly to
          </button>
        )}
        {el.source_url && (
          <a className={css.btn} href={el.source_url} target="_blank" rel="noreferrer">
            CelesTrak record ↗
          </a>
        )}
      </div>
    </Section>
  );
}
