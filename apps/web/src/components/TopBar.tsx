"use client";

import { useApp } from "@/lib/store";
import { useCore } from "@/lib/selectors";
import { archiveIsFresh } from "@/lib/state";
import { age, utc } from "@/lib/format";
import css from "./app.module.css";

export default function TopBar({ now }: { now: number }) {
  const core = useCore();
  const mode = useApp((s) => s.mode);
  const cursor = useApp((s) => s.cursor);
  const goLive = useApp((s) => s.goLive);
  const meta = core?.meta;
  const fresh = meta ? archiveIsFresh(meta, now) : false;

  return (
    <header className={css.topbar}>
      <div className={css.brand}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
          <path d="M12 2 3 7v10l9 5 9-5V7z" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
        <span className={css.wordmark}>HARPY</span>
        <span className={css.product}>Monitor</span>
      </div>

      <div className={css.topMeta}>
        {meta && (
          <span
            className={`${css.pill} ${fresh ? "" : css.pillWarn}`}
            title={`Snapshot generated ${utc(meta.generated_at)}. Expected every ${Math.round(
              meta.deployment.refresh_interval_s / 60,
            )} min.`}
          >
            {meta.deployment.mode === "static-archive" ? "Archive" : "Live server"} · snapshot {age(meta.generated_at, now)}
          </span>
        )}
        <button
          className={`${css.pill} ${mode === "live" ? css.pillLive : css.pillReplay}`}
          onClick={goLive}
          title={mode === "live" ? "Showing the present" : "Replaying recorded history. Click to return to live."}
        >
          <span className={css.dot} />
          {mode === "live" ? "LIVE" : "REPLAY · back to live"}
        </button>
        <time className={css.clock} dateTime={new Date(cursor).toISOString()}>
          {utc(mode === "live" ? now : cursor)}
        </time>
      </div>
    </header>
  );
}
