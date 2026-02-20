"use client";

import React, { useState, useEffect, useRef } from "react";
import { Terminal, ArrowRight, Zap, Shield } from "lucide-react";
import styles from "./HUD.module.css";
import { useStore } from "@/store/useStore";
import { clsx } from "clsx";

interface IntentPreview {
  tool:
    | "seek_to_time"
    | "seek_to_bbox"
    | "set_layers"
    | "run_graph_query"
    | "get_provider_status"
    | "get_track_info";
  args: Record<string, unknown>;
  risk: "LOW" | "HIGH";
  explanation: string;
}

interface AipResponse {
  success: boolean;
  request_id: string;
  result?: unknown;
  explanation?: string;
  requires_confirmation?: boolean;
  confirmation_token?: string;
  error?: string;
}

const TOOL_SCOPE_BY_ROLE: Record<string, string> = {
  VIEWER: "aip:query,graph:query",
  OPERATOR: "aip:query,aip:execute,graph:query,graph:query:advanced",
  ADMIN: "aip:query,aip:execute,graph:query,graph:query:advanced,graph:export",
};

const toCanonicalLayer = (raw: string): string | null => {
  const normalized = raw.trim().toUpperCase();
  if (["AIR", "AIRCRAFT", "ADSB", "ADS-B"].includes(normalized)) return "AIRCRAFT";
  if (["SAT", "SATELLITE", "TLE"].includes(normalized)) return "SATELLITE";
  if (["GROUND", "WX", "RADAR"].includes(normalized)) return "GROUND";
  if (["SENSOR", "SENS", "CAM", "CAMERA"].includes(normalized)) return "CAMERA";
  if (["DETECTION", "CV"].includes(normalized)) return "DETECTION";
  if (["ALERT", "ALERTS"].includes(normalized)) return "ALERT";
  if (["VESSEL", "SHIP", "MARITIME"].includes(normalized)) return "VESSEL";
  return null;
};

const parseLayers = (input: string): string[] => {
  const tokens = input
    .replace(/[^a-zA-Z0-9,_\-\s]/g, " ")
    .split(/[\s,]+/)
    .filter(Boolean);

  const layers = tokens
    .map(toCanonicalLayer)
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set(layers));
};

const CommandPalette: React.FC = () => {
  const showCommandPalette = useStore((state) => state.showCommandPalette);
  const setShowCommandPalette = useStore((state) => state.setShowCommandPalette);
  const setLayers = useStore((state) => state.setLayers);
  const setIsLive = useStore((state) => state.setIsLive);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const setCurrentTimeMs = useStore((state) => state.setCurrentTimeMs);
  const setShowGraphQuery = useStore((state) => state.setShowGraphQuery);
  const setCommandFeedback = useStore((state) => state.setCommandFeedback);
  const setFocusTrackId = useStore((state) => state.setFocusTrackId);
  const userRole = useStore((state) => state.userRole);

  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<IntentPreview | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const streamMode = (process.env.NEXT_PUBLIC_STREAM_MODE || "hybrid").toLowerCase();
  const isOfflineMode = streamMode === "offline";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOfflineMode) {
          return;
        }
        setShowCommandPalette(!showCommandPalette);
      }
      if (e.key === "Escape" && showCommandPalette) {
        setShowCommandPalette(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOfflineMode, showCommandPalette, setShowCommandPalette]);

  useEffect(() => {
    if (showCommandPalette) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showCommandPalette]);

  const buildPreview = (rawInput: string): IntentPreview | null => {
    const trimmed = rawInput.trim();
    if (trimmed.length < 3) return null;

    const lower = trimmed.toLowerCase();
    const now = Date.now();

    if (
      lower.includes("provider")
      || lower.includes("data link")
      || lower.includes("status")
      || lower.includes("health")
    ) {
      return {
        tool: "get_provider_status",
        args: {},
        risk: "LOW",
        explanation: "Fetch provider health/freshness status",
      };
    }

    const alertMatch = trimmed.match(/alert[\s:=]+([a-z0-9_-]+)/i);
    if (lower.includes("evidence") && alertMatch?.[1]) {
      return {
        tool: "run_graph_query",
        args: {
          template: "get_evidence_chain",
          params: { alert_id: alertMatch[1] },
          page: 1,
          per_page: 50,
        },
        risk: "LOW",
        explanation: "Run evidence-chain graph query for alert",
      };
    }

    const sensorMatch = trimmed.match(/sensor[\s:=]+([a-z0-9_-]+)/i);
    if (sensorMatch?.[1]) {
      return {
        tool: "run_graph_query",
        args: {
          template: "get_tracks_by_sensor",
          params: { sensor_id: sensorMatch[1] },
          page: 1,
          per_page: 50,
        },
        risk: "LOW",
        explanation: "Get tracks observed by specified sensor",
      };
    }

    const trackInfoMatch = trimmed.match(/track(?:\s+info)?[\s:=]+([a-z0-9_-]+)/i);
    if (trackInfoMatch?.[1] && (lower.includes("info") || lower.includes("detail"))) {
      return {
        tool: "get_track_info",
        args: { track_id: trackInfoMatch[1] },
        risk: "LOW",
        explanation: "Fetch track metadata from graph index",
      };
    }

    if (trackInfoMatch?.[1] && (lower.includes("associate") || lower.includes("related"))) {
      return {
        tool: "run_graph_query",
        args: {
          template: "find_associated_tracks",
          params: { track_id: trackInfoMatch[1] },
          page: 1,
          per_page: 25,
        },
        risk: "LOW",
        explanation: "Find proximity/time associated tracks",
      };
    }

    if (trackInfoMatch?.[1]) {
      return {
        tool: "get_track_info",
        args: { track_id: trackInfoMatch[1] },
        risk: "LOW",
        explanation: "Query track info and prepare map focus",
      };
    }

    if (lower.includes("layer")) {
      const parsedLayers = parseLayers(trimmed);
      if (parsedLayers.length === 0) {
        return null;
      }

      return {
        tool: "set_layers",
        args: { layers: parsedLayers },
        risk: "HIGH",
        explanation: "Update active layer visibility in the current scene",
      };
    }

    if (lower.includes("bbox") || lower.includes("bounding box")) {
      const numbers = trimmed.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      if (numbers.length >= 4) {
        return {
          tool: "seek_to_bbox",
          args: {
            min_lat: numbers[0],
            min_lon: numbers[1],
            max_lat: numbers[2],
            max_lon: numbers[3],
          },
          risk: "HIGH",
          explanation: "Move camera to the requested bounding box",
        };
      }
    }

    return {
      tool: "seek_to_time",
      args: {
        start_ts_ms: now - 15 * 60 * 1000,
        end_ts_ms: now,
      },
      risk: "HIGH",
      explanation: "Seek timeline to the most recent 15 minutes",
    };
  };

  const applyPreviewState = (intent: IntentPreview) => {
    if (intent.tool === "seek_to_time") {
      const endTsMs = Number(intent.args.end_ts_ms);
      if (Number.isFinite(endTsMs) && endTsMs > 0) {
        setIsLive(false);
        setIsPlaying(false);
        setCurrentTimeMs(endTsMs);
      }
      return;
    }

    if (intent.tool === "set_layers") {
      const layerMap: Record<string, string> = {
        AIRCRAFT: "ADSB",
        SATELLITE: "TLE_SAT",
        CAMERA: "SENS_CV",
        DETECTION: "SENS_CV",
        GROUND: "WX_RADAR",
        ALERT: "WX_RADAR",
        VESSEL: "WX_RADAR",
      };

      const requested = Array.isArray(intent.args.layers) ? intent.args.layers : [];
      const internal = requested
        .map((layer) => layerMap[String(layer)])
        .filter((value): value is string => Boolean(value));

      if (internal.length > 0) {
        setLayers(Array.from(new Set(internal)));
      }
      return;
    }

    if (intent.tool === "run_graph_query") {
      setShowGraphQuery(true);
      return;
    }

    if (intent.tool === "get_track_info") {
      const trackId = String(intent.args.track_id || "");
      if (trackId) {
        setFocusTrackId(trackId);
      }
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    setError(null);
    setPreview(buildPreview(val));
  };

  const execute = async () => {
    if (!preview) return;
    if (isOfflineMode) {
      setError("AI command execution is disabled in offline mode.");
      return;
    }

    setProcessing(true);
    setError(null);

    const aipUrl = process.env.NEXT_PUBLIC_AIP_URL || "http://localhost:8084";
    const actorId = "hud-operator";
    const scopes = TOOL_SCOPE_BY_ROLE[userRole] ?? TOOL_SCOPE_BY_ROLE.OPERATOR;

    const basePayload = {
      query: input,
      actor_id: actorId,
      apply: true,
      explain: false,
      confirm: preview.risk === "HIGH",
      tool_call: {
        name: preview.tool,
        params: preview.args,
      },
    };

    try {
      let response = await fetch(`${aipUrl}/aip/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-harpy-actor-id": actorId,
          "x-harpy-role": userRole,
          "x-harpy-scopes": scopes,
          "x-harpy-attrs": JSON.stringify({}),
        },
        body: JSON.stringify(basePayload),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `AIP request failed (${response.status})`);
      }

      let body = (await response.json()) as AipResponse;

      if (body.requires_confirmation && body.confirmation_token) {
        response = await fetch(`${aipUrl}/aip/query`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-harpy-actor-id": actorId,
            "x-harpy-role": userRole,
            "x-harpy-scopes": scopes,
            "x-harpy-attrs": JSON.stringify({}),
          },
          body: JSON.stringify({
            ...basePayload,
            confirmation_token: body.confirmation_token,
          }),
        });

        if (!response.ok) {
          const confirmBody = await response.text();
          throw new Error(confirmBody || `AIP confirmation failed (${response.status})`);
        }

        body = (await response.json()) as AipResponse;
      }

      if (!body.success) {
        throw new Error(body.error || "AIP execution failed");
      }

      applyPreviewState(preview);

      setCommandFeedback({
        id: Date.now(),
        title: "AI Command Applied",
        detail: `${preview.tool} executed with deterministic HUD updates.`,
        severity: "SUCCESS",
        atMs: Date.now(),
      });

      setProcessing(false);
      setInput("");
      setPreview(null);
      setShowCommandPalette(false);
    } catch (executeError) {
      const message = executeError instanceof Error ? executeError.message : "Unknown error";
      setError(message);
      setCommandFeedback({
        id: Date.now(),
        title: "AI Command Failed",
        detail: message,
        severity: "ERROR",
        atMs: Date.now(),
      });
      setProcessing(false);
    }
  };

  if (!showCommandPalette) return null;

  return (
    <div className={styles.modalOverlay} onClick={() => setShowCommandPalette(false)}>
      <div className={styles.commandPalette} onClick={(event) => event.stopPropagation()}>
        <div className={styles.commandInputWrapper}>
          <Terminal size={18} className={styles.accentIcon} />
          <input
            ref={inputRef}
            className={styles.commandInput}
            placeholder="Try: 'track info t_77', 'sensor cam_12', 'layers aircraft satellite', 'bbox 30 -90 31 -89'"
            value={input}
            onChange={handleInput}
            onKeyDown={(e) => e.key === "Enter" && execute()}
          />
        </div>

        {preview && (
          <div className={styles.commandPreview}>
            <div className={styles.previewHeader}>
              <Zap size={12} />
              <span>AI_INTENT_PREVIEW</span>
              {preview.risk === "HIGH" && (
                <span className={styles.riskBadge}>
                  <Shield size={10} />
                  CONFIRMATION_REQUIRED
                </span>
              )}
            </div>

            <pre className={styles.previewJson}>{JSON.stringify(preview, null, 2)}</pre>
            <div className={styles.exportInfo}>{preview.explanation}</div>
            {error ? <div className={styles.critical}>{error}</div> : null}

            <div className={styles.previewActions}>
              <button
                className={clsx(styles.actionButton, styles.confirmButton)}
                onClick={execute}
                disabled={processing || isOfflineMode}
                title={isOfflineMode ? "AIP service disabled in offline mode" : undefined}
              >
                {processing ? "EXECUTING..." : "CONFIRM_AND_EXECUTE"}
                {!processing && <ArrowRight size={12} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommandPalette;
