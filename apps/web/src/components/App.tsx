"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { useCore } from "@/lib/selectors";
import { archiveIsFresh } from "@/lib/state";
import { age, utc } from "@/lib/format";
import Globe from "./Globe";
import TopBar from "./TopBar";
import Inspector from "./Inspector";
import EventsTable from "./EventsTable";
import Timeline from "./Timeline";
import { LayersSection, LegendSection, SourcesSection } from "./LeftRail";
import { Banner, StateChip } from "./ui";
import css from "./app.module.css";

type Tab = "inspect" | "events" | "layers" | "sources";

export default function App() {
  const core = useApp((s) => s.core);
  const syncError = useApp((s) => s.syncError);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>("events");

  // Initial load + poll for new snapshots. Refresh cadence comes from the deployment itself.
  useEffect(() => {
    const { syncCore } = useApp.getState();
    void syncCore();
    const interval = window.setInterval(() => void syncCore(), 60_000);
    const onVisible = () => document.visibilityState === "visible" && void syncCore();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Wall clock + live cursor + replay playback.
  useEffect(() => {
    let last = performance.now();
    const t = window.setInterval(() => {
      const wall = Date.now();
      const st = useApp.getState();
      const dt = performance.now() - last;
      last = performance.now();
      setNow(wall);
      if (st.mode === "live") {
        if (Math.floor(st.cursor / 86_400_000) !== Math.floor(wall / 86_400_000)) {
          st.set({ cursor: wall });
          st.ensureDays();
        } else st.set({ cursor: wall });
      } else if (st.playing) {
        const next = st.cursor + dt * st.speed;
        if (next >= wall) st.goLive();
        else st.setCursor(next);
      }
    }, 1000);
    return () => window.clearInterval(t);
  }, []);

  // Jump to the inspector on mobile whenever something new is selected.
  useEffect(
    () =>
      useApp.subscribe((s, prev) => {
        if (s.selection && s.selection !== prev.selection) setTab("inspect");
      }),
    [],
  );

  if (core.status === "loading") {
    return (
      <main className={css.boot}>
        <span className={css.wordmark}>HARPY</span>
        <p>Loading recorded observations…</p>
      </main>
    );
  }
  if (core.status === "error") {
    return (
      <main className={css.boot}>
        <span className={css.wordmark}>HARPY</span>
        <StateChip state="SOURCE_UNAVAILABLE" />
        <p>The observation archive could not be loaded: {core.error}</p>
        <p className={css.muted}>HARPY does not substitute demo data. Try again shortly.</p>
        <button className={css.btn} onClick={() => void useApp.getState().syncCore()}>
          Retry
        </button>
      </main>
    );
  }

  return (
    <div className={css.shell} data-tab={tab}>
      <TopBar now={now} />
      <Banners now={now} syncError={syncError} />
      <aside className={`${css.rail} ${css.left}`}>
        <LayersSection />
        <SourcesSection now={now} />
        <LegendSection />
      </aside>
      <main className={css.stage}>
        <Globe />
      </main>
      <aside className={`${css.rail} ${css.right}`}>
        <Inspector now={now} />
        <EventsTable />
      </aside>
      <footer className={css.bottom}>
        <Timeline now={now} />
      </footer>
      <nav className={css.tabs} aria-label="Panels">
        {(["events", "inspect", "layers", "sources"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? css.tabOn : undefined} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
      <section className={css.sheet} data-sheet={tab}>
        {tab === "inspect" && <Inspector now={now} />}
        {tab === "events" && <EventsTable />}
        {tab === "layers" && (
          <>
            <LayersSection />
            <LegendSection />
          </>
        )}
        {tab === "sources" && <SourcesSection now={now} />}
      </section>
    </div>
  );
}

function Banners({ now, syncError }: { now: number; syncError: string | null }) {
  const core = useCore();
  const mode = useApp((s) => s.mode);
  const cursor = useApp((s) => s.cursor);
  if (!core) return null;
  const { meta, providers } = core;
  const down = providers.providers.filter((p) => p.state === "UNAVAILABLE" || p.state === "NEVER_RUN");
  return (
    <div className={css.banners}>
      {mode === "replay" && (
        <Banner tone="info">
          Replaying recorded history at {utc(cursor)}. Everything shown is what HARPY stored, not a simulation.
        </Banner>
      )}
      {!archiveIsFresh(meta, now) && (
        <Banner tone="warn">
          This snapshot is {age(meta.generated_at, now)}. Ingestion normally runs every{" "}
          {Math.round(meta.deployment.refresh_interval_s / 60)} min, so records are marked stale rather than live.
        </Banner>
      )}
      {down.map((p) => (
        <Banner key={p.source_id} tone="error">
          {p.display_name} is {p.state === "NEVER_RUN" ? "not yet ingested" : "unavailable"}
          {p.last_success_at ? `; last good data ${age(p.last_success_at, now)}` : ""}. No substitute data is shown.
        </Banner>
      ))}
      {syncError && <Banner tone="warn">Could not refresh: {syncError}. Showing the last snapshot that loaded.</Banner>}
    </div>
  );
}
