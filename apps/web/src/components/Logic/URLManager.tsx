"use client";

import { useEffect } from "react";
import { useStore, VisionMode, AltitudeBand, SpeedBand } from "@/store/useStore";

const URLManager: React.FC = () => {
  const visionMode = useStore((state) => state.visionMode);
  const setVisionMode = useStore((state) => state.setVisionMode);
  const layers = useStore((state) => state.layers);
  const setLayers = useStore((state) => state.setLayers);
  const altitudeBand = useStore((state) => state.altitudeBand);
  const setAltitudeBand = useStore((state) => state.setAltitudeBand);
  const speedBand = useStore((state) => state.speedBand);
  const setSpeedBand = useStore((state) => state.setSpeedBand);
  const isLive = useStore((state) => state.isLive);
  const setIsLive = useStore((state) => state.setIsLive);
  const isPlaying = useStore((state) => state.isPlaying);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const playbackRate = useStore((state) => state.playbackRate);
  const setPlaybackRate = useStore((state) => state.setPlaybackRate);
  const currentTimeMs = useStore((state) => state.currentTimeMs);
  const setCurrentTimeMs = useStore((state) => state.setCurrentTimeMs);
  const cameraPose = useStore((state) => state.cameraPose);
  const setCameraPose = useStore((state) => state.setCameraPose);

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
          setLayers(parsedLayers);
        }
      }

      const parsedAltitudeBand = params.get("ab");
      if (parsedAltitudeBand) {
        setAltitudeBand(parsedAltitudeBand as AltitudeBand);
      }

      const parsedSpeedBand = params.get("sb");
      if (parsedSpeedBand) {
        setSpeedBand(parsedSpeedBand as SpeedBand);
      }

      const live = params.get("live");
      if (live) setIsLive(live === "1");

      const play = params.get("play");
      if (play) setIsPlaying(play === "1");

      const rate = params.get("rate");
      if (rate) setPlaybackRate(Number(rate));

      const time = params.get("t");
      if (time) setCurrentTimeMs(Number(time));

      const clat = params.get("clat");
      const clon = params.get("clon");
      const calt = params.get("calt");
      const chead = params.get("chead");
      const cpitch = params.get("cpitch");
      const croll = params.get("croll");
      if (clat && clon && calt && chead && cpitch && croll) {
        setCameraPose({
          lat: Number(clat),
          lon: Number(clon),
          alt: Number(calt),
          heading: Number(chead),
          pitch: Number(cpitch),
          roll: Number(croll),
        });
      }
      
      console.log("[URL] Restored state from hash");
    } catch (e) {
      console.error("[URL] Failed to parse hash", e);
    }
  }, [
    setAltitudeBand,
    setCameraPose,
    setCurrentTimeMs,
    setIsLive,
    setIsPlaying,
    setLayers,
    setPlaybackRate,
    setSpeedBand,
    setVisionMode,
  ]);

  // Sync state to URL
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams();
    params.set("v", visionMode);
    params.set("l", layers.join(","));
    params.set("ab", altitudeBand);
    params.set("sb", speedBand);
    params.set("live", isLive ? "1" : "0");
    params.set("play", isPlaying ? "1" : "0");
    params.set("rate", playbackRate.toString());
    
    // Only update time in URL if not live to avoid spamming history
    if (!isLive) {
      params.set("t", Math.floor(currentTimeMs).toString());
    }

    if (cameraPose) {
      params.set("clat", cameraPose.lat.toFixed(6));
      params.set("clon", cameraPose.lon.toFixed(6));
      params.set("calt", Math.round(cameraPose.alt).toString());
      params.set("chead", cameraPose.heading.toFixed(4));
      params.set("cpitch", cameraPose.pitch.toFixed(4));
      params.set("croll", cameraPose.roll.toFixed(4));
    }

    const newHash = `#${params.toString()}`;
    if (window.location.hash !== newHash) {
      window.history.replaceState(null, "", newHash);
    }
  }, [visionMode, layers, altitudeBand, speedBand, isLive, isPlaying, playbackRate, currentTimeMs, cameraPose]);

  return null;
};

export default URLManager;
