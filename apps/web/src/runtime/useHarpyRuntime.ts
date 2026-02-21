"use client";

import { useEffect, useRef } from "react";
import { useHarpyStore } from "@/state/store";
import { makeMockTick } from "./mockStream";
import type { LayerId } from "@/state/types";

function wsUrl(): string {
  const host = process.env.NEXT_PUBLIC_RELAY_HOST ?? "localhost:8080";
  const proto =
    typeof window !== "undefined" && location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${host}/ws`;
}

function enabledLayers(): string[] {
  const layers = useHarpyStore.getState().layers;
  return (Object.keys(layers) as LayerId[]).filter((k) => layers[k].enabled);
}

export function useHarpyRuntime() {
  const setStreamMode = useHarpyStore((s) => s.setStreamMode);
  const setWsRttMs = useHarpyStore((s) => s.setWsRttMs);
  const ingestTracks = useHarpyStore((s) => s.ingestTracks);
  const ingestProviderStatus = useHarpyStore((s) => s.ingestProviderStatus);
  const preset = useHarpyStore((s) => s.preset);
  const layers = useHarpyStore((s) => s.layers);
  const tickNow = useHarpyStore((s) => s.tickNow);
  const recompute = useHarpyStore((s) => s.recomputeFreshness);

  const wsRef = useRef<WebSocket | null>(null);
  const mockTickRef = useRef<ReturnType<typeof makeMockTick> | null>(null);

  useEffect(() => {
    let alive = true;

    const clock = setInterval(() => {
      tickNow(Date.now());
      recompute();
    }, 1000);

    mockTickRef.current = makeMockTick(preset);

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl());
        wsRef.current = ws;

        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            const t0 = Date.now();
            ws.send(JSON.stringify({ type: "ping", t0 }));
          }
        }, 3000);

        ws.onopen = () => {
          setStreamMode("WS");
          ws.send(
            JSON.stringify({
              type: "subscribe",
              preset,
              layers: enabledLayers(),
              bbox: useHarpyStore.getState().viewport,
            }),
          );
        };

        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.type === "pong" && typeof msg.t0 === "number") {
              setWsRttMs(Date.now() - msg.t0);
              return;
            }
            if (msg.type === "tracks" && Array.isArray(msg.tracks)) {
              ingestTracks(msg.tracks);
              return;
            }
            if (
              msg.type === "providerStatus" &&
              Array.isArray(msg.providerStatus)
            ) {
              for (const ps of msg.providerStatus) ingestProviderStatus(ps);
              return;
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onerror = () => {
          setStreamMode("MOCK");
        };

        ws.onclose = () => {
          clearInterval(pingInterval);
          setStreamMode("MOCK");
          setWsRttMs(null);
          if (!alive) return;
          setTimeout(connect, 1000);
        };
      } catch {
        setStreamMode("MOCK");
        setTimeout(connect, 1500);
      }
    };

    connect();

    const mockLoop = setInterval(() => {
      if (!mockTickRef.current) return;
      const { tracks, providerStatus } = mockTickRef.current();
      if (useHarpyStore.getState().streamMode === "MOCK") {
        ingestTracks(tracks);
        for (const ps of providerStatus) ingestProviderStatus(ps);
      }
    }, 1000);

    return () => {
      alive = false;
      clearInterval(clock);
      clearInterval(mockLoop);
      wsRef.current?.close();
    };
  }, [
    preset,
    tickNow,
    recompute,
    ingestTracks,
    ingestProviderStatus,
    setStreamMode,
    setWsRttMs,
  ]);

  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      type: "subscribe",
      preset,
      layers: enabledLayers(),
      bbox: useHarpyStore.getState().viewport,
    };
    ws.send(JSON.stringify(payload));
  }, [preset, layers]);
}
