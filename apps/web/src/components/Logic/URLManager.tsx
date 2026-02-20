"use client";

import { useEffect } from "react";
import { useStore, VisionMode } from "@/store/useStore";

const URLManager: React.FC = () => {
  const visionMode = useStore((state) => state.visionMode);
  const setVisionMode = useStore((state) => state.setVisionMode);
  const layers = useStore((state) => state.layers);
  const isLive = useStore((state) => state.isLive);
  const setIsLive = useStore((state) => state.setIsLive);
  const isPlaying = useStore((state) => state.isPlaying);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const playbackRate = useStore((state) => state.playbackRate);
  const setPlaybackRate = useStore((state) => state.setPlaybackRate);
  const currentTimeMs = useStore((state) => state.currentTimeMs);
  const setCurrentTimeMs = useStore((state) => state.setCurrentTimeMs);

  // Load state from URL on mount
  useEffect(() => {
    if (typeof window === "undefined") return;

    const hash = window.location.hash.substring(1); // remove #
    if (!hash) return;

    try {
      const params = new URLSearchParams(hash);
      
      const vMode = params.get("v");
      if (vMode) setVisionMode(vMode as VisionMode);

      const l = params.get("l");
      if (l !== null) {
        const parsedLayers = l
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0);
        if (parsedLayers.length > 0) {
          useStore.setState({ layers: parsedLayers });
        }
      }

      const live = params.get("live");
      if (live) setIsLive(live === "1");

      const play = params.get("play");
      if (play) setIsPlaying(play === "1");

      const rate = params.get("rate");
      if (rate) setPlaybackRate(Number(rate));

      const time = params.get("t");
      if (time) setCurrentTimeMs(Number(time));
      
      console.log("[URL] Restored state from hash");
    } catch (e) {
      console.error("[URL] Failed to parse hash", e);
    }
  }, [setCurrentTimeMs, setIsLive, setIsPlaying, setPlaybackRate, setVisionMode]);

  // Sync state to URL
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams();
    params.set("v", visionMode);
    params.set("l", layers.join(","));
    params.set("live", isLive ? "1" : "0");
    params.set("play", isPlaying ? "1" : "0");
    params.set("rate", playbackRate.toString());
    
    // Only update time in URL if not live to avoid spamming history
    if (!isLive) {
      params.set("t", Math.floor(currentTimeMs).toString());
    }

    const newHash = `#${params.toString()}`;
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, "", newHash);
    }
  }, [visionMode, layers, isLive, isPlaying, playbackRate, currentTimeMs]);

  return null;
};

export default URLManager;
