"use client";

import { useApp, type GlobeStyle } from "@/lib/store";
import { useCore, useElementsAtCursor, useProvider, useQuakesInWindow } from "@/lib/selectors";
import { layerState, type DisplayState } from "@/lib/state";
import { age, utc } from "@/lib/format";
import { ProviderChip, Section, Segmented, StateChip, STATE_META, Toggle } from "./ui";
import css from "./app.module.css";

const LEGEND: DisplayState[] = [
  "LIVE",
  "STALE",
  "RECORDED",
  "CALCULATED",
  "INFERRED",
  "SOURCE_UNAVAILABLE",
  "INSUFFICIENT_EVIDENCE",
];

export function LayersSection() {
  const s = useApp();
  const { quakes } = useQuakesInWindow();
  const { elements, withheld } = useElementsAtCursor();
  const eqProv = useProvider("earthquakes");
  const satProv = useProvider("satellites");
  const eqLayer = layerState(eqProv?.state, quakes.length > 0);
  const satLayer = layerState(satProv?.state, elements.length > 0);

  return (
    <Section title="Layers">
      <div className={css.layerRow}>
        <Toggle
          checked={s.showEarthquakes}
          onChange={(v) => s.set({ showEarthquakes: v })}
          label={
            <>
              Earthquakes <span className={css.count}>{quakes.length}</span>
            </>
          }
        />
        {eqLayer && <StateChip state={eqLayer} />}
      </div>
      <Segmented
        label="Minimum magnitude"
        value={s.minMagnitude}
        onChange={(v) => s.set({ minMagnitude: v })}
        options={[
          { value: 0, label: "All" },
          { value: 2.5, label: "M2.5+" },
          { value: 4.5, label: "M4.5+" },
          { value: 6, label: "M6+" },
        ]}
      />
      <p className={css.hint}>Events in the 24 h ending at the display time. USGS, all magnitudes.</p>

      <div className={css.layerRow}>
        <Toggle
          checked={s.showSatellites}
          onChange={(v) => s.set({ showSatellites: v })}
          label={
            <>
              Satellites <span className={css.count}>{elements.length}</span>
            </>
          }
        />
        {satLayer && <StateChip state={satLayer} />}
      </div>
      <div className={css.chipRow}>
        {Object.keys(s.satGroups)
          .sort()
          .map((g) => (
            <button
              key={g}
              className={`${css.groupChip} ${s.satGroups[g] ? css.groupOn : ""}`}
              aria-pressed={s.satGroups[g]}
              onClick={() => s.set({ satGroups: { ...s.satGroups, [g]: !s.satGroups[g] } })}
            >
              {g}
            </button>
          ))}
      </div>
      {withheld > 0 && (
        <p className={css.hint}>
          {withheld} satellite{withheld === 1 ? "" : "s"} withheld: no element set within 3 days of the display time.
        </p>
      )}
      <Toggle checked={s.showOrbit} onChange={(v) => s.set({ showOrbit: v })} label="Orbit track for selection" />

      <div className={css.styleRow}>
        <span className={css.label}>Globe style</span>
        <Segmented<GlobeStyle>
          label="Globe style"
          value={s.globeStyle}
          onChange={(v) => s.set({ globeStyle: v })}
          options={[
            { value: "standard", label: "Standard" },
            { value: "night", label: "Night" },
            { value: "thermal-look", label: "Thermal look" },
          ]}
        />
        <p className={css.hint}>Visual style only. HARPY has no thermal or night-vision sensor data.</p>
      </div>
    </Section>
  );
}

export function SourcesSection({ now }: { now: number }) {
  const core = useCore();
  if (!core) return null;
  return (
    <Section title="Sources" aside={<span className={css.muted}>{core.fetchLog.entries.length} recent fetches</span>}>
      {core.providers.providers.map((p) => (
        <article key={p.source_id} className={css.provider} data-provider={p.source_id}>
          <header>
            <strong>{p.display_name}</strong>
            <ProviderChip state={p.state} />
          </header>
          <div className={css.providerStats}>
            <span>last success {p.last_success_at ? age(p.last_success_at, now) : "never"}</span>
            <span>attempt {p.last_attempt_at ? age(p.last_attempt_at, now) : "never"}</span>
            {p.consecutive_failures > 0 && <span className={css.bad}>{p.consecutive_failures} failed in a row</span>}
          </div>
          {p.last_error && <code className={css.err}>{p.last_error}</code>}
          <footer>
            <a href={p.terms_url} target="_blank" rel="noreferrer">
              {p.attribution}
            </a>
            <span className={css.muted}>{p.license_class}</span>
          </footer>
        </article>
      ))}
      <details className={css.fetchLog}>
        <summary>Fetch log</summary>
        <table>
          <tbody>
            {core.fetchLog.entries.slice(0, 25).map((f, i) => (
              <tr key={i} className={f.ok ? undefined : css.bad}>
                <td>{utc(f.started_at, false).slice(5)}</td>
                <td>{f.source_id}</td>
                <td>{f.ok ? `+${f.records_new} ~${f.records_revised}` : f.error ?? `HTTP ${f.http_status}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Section>
  );
}

export function LegendSection() {
  return (
    <Section title="What the states mean">
      <ul className={css.legend}>
        {LEGEND.map((s) => (
          <li key={s}>
            <StateChip state={s} />
            <span>{STATE_META[s].help}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
