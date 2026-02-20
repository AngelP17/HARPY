"use client";

import React, { useEffect, useState } from "react";
import { Play, Pause, Radio } from "lucide-react";
import styles from "./HUD.module.css";
import { clsx } from "clsx";
import { useStore } from "@/store/useStore";

interface SeekApiOk {
  delta_ranges?: Array<{ estimated_deltas?: number }>;
  snapshot?: { id?: string } | null;
}

interface SeekApiResult {
  Ok?: SeekApiOk;
  Err?: { error?: string };
}

const resolveRelayHttpBase = (): string => {
  const envBase = process.env.NEXT_PUBLIC_RELAY_HTTP_URL;
  if (envBase) {
    return envBase;
  }
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws";
  if (wsUrl.startsWith("ws://")) {
    return wsUrl.replace("ws://", "http://").replace(/\/ws$/, "");
  }
  if (wsUrl.startsWith("wss://")) {
    return wsUrl.replace("wss://", "https://").replace(/\/ws$/, "");
  }
  return "http://localhost:8080";
};

const mapLayersToSeekKinds = (layers: string[]): string => {
  const kinds = new Set<string>();
  for (const layer of layers) {
    if (layer === "ADSB") {
      kinds.add("aircraft");
    } else if (layer === "TLE_SAT") {
      kinds.add("satellite");
    } else if (layer === "SENS_CV" || layer === "WX_RADAR") {
      kinds.add("ground");
    }
  }
  if (kinds.size === 0) {
    kinds.add("aircraft");
    kinds.add("satellite");
  }
  return Array.from(kinds).join(",");
};

const Timeline: React.FC = () => {
  const isLive = useStore((state) => state.isLive);
  const setIsLive = useStore((state) => state.setIsLive);
  const isPlaying = useStore((state) => state.isPlaying);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const playbackRate = useStore((state) => state.playbackRate);
  const setPlaybackRate = useStore((state) => state.setPlaybackRate);
  const currentTimeMs = useStore((state) => state.currentTimeMs);
  const setCurrentTimeMs = useStore((state) => state.setCurrentTimeMs);
  const layers = useStore((state) => state.layers);
  const seekMeta = useStore((state) => state.seekMeta);
  const setSeekMeta = useStore((state) => state.setSeekMeta);
  const [scrubWindowEndMs, setScrubWindowEndMs] = useState<number>(0);

  useEffect(() => {
    if (currentTimeMs <= 0) {
      const now = Date.now();
      setCurrentTimeMs(now);
    }
  }, [currentTimeMs, setCurrentTimeMs]);

  // Update time when playing
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        if (isLive) {
          setCurrentTimeMs(Date.now());
        } else {
          setCurrentTimeMs(currentTimeMs + 1000 * playbackRate);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, isLive, playbackRate, currentTimeMs, setCurrentTimeMs]);

  const togglePlay = () => {
    if (isLive) {
      setScrubWindowEndMs(currentTimeMs);
      setIsLive(false); // Pause live -> go to DVR mode at current time
      setIsPlaying(false);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const goLive = () => {
    const now = Date.now();
    setScrubWindowEndMs(now);
    setIsLive(true);
    setIsPlaying(true);
    setPlaybackRate(1);
    setCurrentTimeMs(now);
  };

  const formatTime = (ms: number) => {
    if (ms <= 0) {
      return "--:--:--";
    }
    return new Date(ms).toISOString().replace("T", " ").substring(0, 19);
  };

  const effectiveScrubWindowEndMs = scrubWindowEndMs > 0 ? scrubWindowEndMs : currentTimeMs;
  const currentMs = currentTimeMs > 0 ? currentTimeMs : effectiveScrubWindowEndMs;
  const windowEndMs = isLive ? currentMs : effectiveScrubWindowEndMs;
  const windowStartMs = Math.max(0, windowEndMs - 3_600_000);

  useEffect(() => {
    if (isLive || currentMs <= 0) {
      return;
    }
    const relayBase = resolveRelayHttpBase();
    const layersParam = mapLayersToSeekKinds(layers);
    const startTsMs = Math.max(0, currentMs - 3_600_000);
    const timeout = setTimeout(async () => {
      setSeekMeta({
        loading: true,
        estimatedDeltas: 0,
        snapshotId: null,
        error: null,
        updatedAtMs: Date.now(),
      });
      try {
        const params = new URLSearchParams({
          start_ts_ms: String(startTsMs),
          end_ts_ms: String(currentMs),
          layers: layersParam,
        });
        const response = await fetch(`${relayBase}/seek?${params.toString()}`, {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          throw new Error(`seek failed (${response.status})`);
        }
        const body = (await response.json()) as SeekApiResult;
        const ok = body.Ok;
        if (!ok) {
          throw new Error(body.Err?.error || "seek failed");
        }
        setSeekMeta({
          loading: false,
          error: null,
          estimatedDeltas: ok.delta_ranges?.[0]?.estimated_deltas ?? 0,
          snapshotId: ok.snapshot?.id ?? null,
          updatedAtMs: Date.now(),
        });
      } catch (error) {
        setSeekMeta({
          loading: false,
          estimatedDeltas: 0,
          snapshotId: null,
          error: error instanceof Error ? error.message : "seek failed",
          updatedAtMs: Date.now(),
        });
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [currentMs, isLive, layers, setSeekMeta]);

  return (
    <div className={clsx("hud-panel", styles.timelineBar)}>
      <div className={styles.timelineControls}>
        <button 
          className={clsx("hud-button", { [styles.liveActive]: isLive })}
          onClick={goLive}
        >
          <Radio size={12} className={clsx({ [styles.livePulse]: isLive })} />
          <span>LIVE</span>
        </button>
        
        <div className={styles.separator} />

        <button className="hud-button" onClick={togglePlay}>
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>

        <div className={styles.scrubberContainer}>
            <input 
              type="range" 
              className={styles.scrubber} 
              min={windowStartMs}
              max={windowEndMs}
              value={currentMs}
              onChange={(e) => {
                setIsLive(false);
                setCurrentTimeMs(Number(e.target.value));
              }}
              disabled={isLive}
            />
            <div className={styles.timeDisplay}>
              {formatTime(currentTimeMs)}
              {!isLive ? (
                <span className={styles.seekMeta}>
                  {seekMeta.loading
                    ? " SEEK..."
                    : seekMeta.error
                      ? " SEEK_ERR"
                      : ` Δ${seekMeta.estimatedDeltas}${seekMeta.snapshotId ? ` S:${seekMeta.snapshotId.substring(0, 8)}` : ""}`}
                </span>
              ) : null}
            </div>
        </div>

        <div className={styles.separator} />

        <div className={styles.speedControls}>
          <button 
            className={clsx("hud-button", { [styles.activeSpeed]: playbackRate === 1 })}
            onClick={() => setPlaybackRate(1)}
          >1x</button>
          <button 
            className={clsx("hud-button", { [styles.activeSpeed]: playbackRate === 2 })}
            onClick={() => setPlaybackRate(2)}
          >2x</button>
          <button 
            className={clsx("hud-button", { [styles.activeSpeed]: playbackRate === 4 })}
            onClick={() => setPlaybackRate(4)}
          >4x</button>
        </div>
      </div>
    </div>
  );
};

export default Timeline;
