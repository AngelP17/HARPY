import type { ReactNode } from "react";
import type { DisplayState } from "@/lib/state";
import type { ProviderState } from "@/lib/types";
import css from "./app.module.css";

export const STATE_META: Record<DisplayState, { label: string; tone: string; help: string }> = {
  LIVE: { label: "Live", tone: "live", help: "Fresh record from a reachable source." },
  STALE: { label: "Stale", tone: "stale", help: "Last known genuine record. The source or archive is behind." },
  RECORDED: { label: "Recorded", tone: "recorded", help: "Genuine record, shown while replaying history." },
  CALCULATED: { label: "Calculated", tone: "calc", help: "SGP4 position from an identified element set." },
  INFERRED: { label: "Inferred", tone: "inferred", help: "Model hypothesis with uncertainty (GeoWraith, Milestone B)." },
  SOURCE_UNAVAILABLE: { label: "Source unavailable", tone: "down", help: "Provider failed. Nothing is simulated in its place." },
  INSUFFICIENT_EVIDENCE: { label: "Insufficient evidence", tone: "none", help: "No defensible value, so nothing is drawn." },
};

export function StateChip({ state, compact }: { state: DisplayState; compact?: boolean }) {
  const m = STATE_META[state];
  return (
    <span className={`${css.chip} ${css[`tone_${m.tone}`]}`} title={m.help} data-state={state}>
      <span className={css.dot} />
      {compact ? null : m.label}
    </span>
  );
}

const PROVIDER_TONE: Record<ProviderState, string> = {
  HEALTHY: "live",
  DEGRADED: "stale",
  UNAVAILABLE: "down",
  NEVER_RUN: "none",
};

export function ProviderChip({ state }: { state: ProviderState }) {
  return (
    <span className={`${css.chip} ${css[`tone_${PROVIDER_TONE[state]}`]}`} data-provider-state={state}>
      <span className={css.dot} />
      {state.replace("_", " ").toLowerCase()}
    </span>
  );
}

export function TypeTag({ type }: { type: string }) {
  return <span className={css.typeTag}>{type}</span>;
}

export function Section({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className={css.section}>
      <header className={css.sectionHead}>
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className={css.kv}>
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Banner({ tone, children }: { tone: "warn" | "error" | "info"; children: ReactNode }) {
  return (
    <div className={`${css.banner} ${css[`banner_${tone}`]}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={css.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? css.segOn : undefined}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <label className={css.toggle}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={css.switch} aria-hidden />
      <span>{label}</span>
    </label>
  );
}
