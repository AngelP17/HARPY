"use client";

import React, { useEffect, useState } from "react";
import { Play, Pause, Radio } from "lucide-react";
import styles from "./HUD.module.css";
import { clsx } from "clsx";
import { useStore } from "@/store/useStore";

const Timeline: React.FC = () => {
  const isLive = useStore((state) => state.isLive);
  const setIsLive = useStore((state) => state.setIsLive);
  const isPlaying = useStore((state) => state.isPlaying);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const playbackRate = useStore((state) => state.playbackRate);
  const setPlaybackRate = useStore((state) => state.setPlaybackRate);
  const currentTimeMs = useStore((state) => state.currentTimeMs);
  const setCurrentTimeMs = useStore((state) => state.setCurrentTimeMs);
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
