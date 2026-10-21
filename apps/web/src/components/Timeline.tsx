"use client";

import { useMemo } from "react";
import { useApp } from "@/lib/store";
import { useCore } from "@/lib/selectors";
import { clamp } from "@/lib/state";
import { utc } from "@/lib/format";
import css from "./app.module.css";

const SPEEDS = [
  { v: 60, label: "1 min/s" },
  { v: 600, label: "10 min/s" },
  { v: 3600, label: "1 h/s" },
];

export default function Timeline({ now }: { now: number }) {
  const core = useCore();
  const mode = useApp((s) => s.mode);
  const cursor = useApp((s) => s.cursor);
  const playing = useApp((s) => s.playing);
  const speed = useApp((s) => s.speed);
  const { setCursor, setPlaying, setSpeed, goLive } = useApp.getState();

  const range = useMemo(() => {
    if (!core) return null;
    const h = core.meta.history.earthquakes_observed;
    const retentionStart = now - core.meta.deployment.retention_days * 86_400_000;
    if (!h) return null;
    const from = Math.max(h.from, retentionStart);
    return { from, to: now, recordingSince: core.meta.history.earthquakes_recorded?.from ?? null };
  }, [core, now]);

  const bars = useMemo(() => {
    if (!core || !range) return [];
    const span = range.to - range.from;
    const max = Math.max(1, ...core.eqIndex.hourly.map((b) => b.count));
    return core.eqIndex.hourly
      .filter((b) => b.hour_start >= range.from - 3_600_000)
      .map((b) => ({
        x: ((b.hour_start - range.from) / span) * 1000,
        w: Math.max(0.6, (3_600_000 / span) * 1000 - 0.3),
        h: 4 + (b.count / max) * 34,
        hot: b.max_mag >= 5,
      }));
  }, [core, range]);

  if (!range) {
    return (
      <div className={css.timeline}>
        <span className={css.muted}>History unavailable: no earthquake records in this archive yet.</span>
      </div>
    );
  }

  const span = range.to - range.from;
  const pos = clamp(((mode === "live" ? range.to : cursor) - range.from) / span, 0, 1);
  const recX = range.recordingSince ? clamp((range.recordingSince - range.from) / span, 0, 1) : null;
  const step = (ms: number) => setCursor(clamp((mode === "live" ? now : cursor) + ms, range.from, now));

  return (
    <div className={css.timeline}>
      <div className={css.tlControls}>
        <button className={css.iconBtn} onClick={() => step(-3_600_000)} aria-label="Back one hour">
          −1h
        </button>
        <button
          className={css.iconBtn}
          onClick={() => {
            if (mode === "live") setCursor(now - 86_400_000);
            setPlaying(!playing);
          }}
          aria-label={playing ? "Pause replay" : "Play replay"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button className={css.iconBtn} onClick={() => step(3_600_000)} aria-label="Forward one hour">
          +1h
        </button>
        <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))} aria-label="Replay speed" className={css.speed}>
          {SPEEDS.map((s) => (
            <option key={s.v} value={s.v}>
              {s.label}
            </option>
          ))}
        </select>
        <button className={`${css.iconBtn} ${mode === "live" ? css.liveOn : ""}`} onClick={goLive}>
          Live
        </button>
      </div>
      <div className={css.track}>
        <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className={css.hist} aria-hidden>
          {recX != null && recX > 0 && <rect x={0} y={0} width={recX * 1000} height={40} className={css.backfill} />}
          {bars.map((b, i) => (
            <rect key={i} x={b.x} y={40 - b.h} width={b.w} height={b.h} className={b.hot ? css.barHot : css.bar} />
          ))}
          <line x1={pos * 1000} x2={pos * 1000} y1={0} y2={40} className={css.cursorLine} />
        </svg>
        <input
          type="range"
          className={css.scrub}
          min={range.from}
          max={range.to}
          step={60_000}
          value={mode === "live" ? range.to : cursor}
          onChange={(e) => {
            setPlaying(false);
            setCursor(Number(e.target.value));
          }}
          aria-label="Display time"
          aria-valuetext={utc(mode === "live" ? now : cursor)}
        />
        <div className={css.tlLabels}>
          <span>{utc(range.from, false)}</span>
          {recX != null && recX > 0.02 && recX < 0.98 && (
            <span style={{ left: `${recX * 100}%` }} className={css.recMark} title="Before this point the window was seeded from the USGS 7-day feed when recording began.">
              recording since {utc(range.recordingSince, false).slice(5)}
            </span>
          )}
          <span>now</span>
        </div>
      </div>
    </div>
  );
}
