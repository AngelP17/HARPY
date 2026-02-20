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
    | "get_news_brief"
    | "get_market_snapshot"
    | "translate_text";
  args: Record<string, unknown>;
  risk: "LOW" | "HIGH";
  explanation: string;
}

const CommandPalette: React.FC = () => {
  const showCommandPalette = useStore((state) => state.showCommandPalette);
  const setShowCommandPalette = useStore((state) => state.setShowCommandPalette);
  
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
    if (trimmed.length < 4) return null;

    const lower = trimmed.toLowerCase();
    const now = Date.now();
    const coordinateMatch = trimmed.match(
      /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
    );
    const translateMatch = trimmed.match(/^translate\s+(.+?)\s+(?:to|->)\s+([a-z]{2,8})$/i);

    if (translateMatch) {
      return {
        tool: "translate_text",
        args: {
          text: translateMatch[1],
          target_lang: translateMatch[2].toUpperCase(),
        },
        risk: "LOW",
        explanation: "Translate freeform operator text to the requested language",
      };
    }

    if (
      lower.includes("market")
      || lower.includes("crypto")
      || lower.includes("commodity")
      || lower.includes("price")
    ) {
      return {
        tool: "get_market_snapshot",
        args: {},
        risk: "LOW",
        explanation: "Fetch latest commodity and crypto snapshot",
      };
    }

    if (lower.includes("news") || lower.includes("brief")) {
      const args: Record<string, unknown> = {};
      if (coordinateMatch) {
        args.lat = Number(coordinateMatch[1]);
        args.lon = Number(coordinateMatch[2]);
      } else {
        args.q = trimmed;
      }

      return {
        tool: "get_news_brief",
        args,
        risk: "LOW",
        explanation: "Fetch geopolitical headlines and sentiment summary",
      };
    }

    const trackMatch = lower.match(/track[\s:=]+([a-z0-9_-]+)/i);
    if (trackMatch?.[1]) {
      return {
        tool: "run_graph_query",
        args: {
          template: "related_tracks",
          params: { track_id: trackMatch[1] },
          page: 1,
          page_size: 25,
        },
        risk: "LOW",
        explanation: "Run graph template query for the selected track",
      };
    }

    if (lower.includes("layer")) {
      return {
        tool: "set_layers",
        args: { layer_mask: trimmed },
        risk: "HIGH",
        explanation: "Modify active layers in the current scene",
      };
    }

    return {
      tool: "seek_to_time",
      args: {
        start_ts_ms: now - 15 * 60 * 1000,
        end_ts_ms: now,
      },
      risk: "LOW",
      explanation: "Seek timeline to the most recent 15 minutes",
    };
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
    try {
      const aipUrl = process.env.NEXT_PUBLIC_AIP_URL || "http://localhost:8084";
      const response = await fetch(`${aipUrl}/aip/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actor_id: "hud-operator",
          tool: preview.tool,
          args: preview.args,
          apply: true,
          confirm: preview.risk === "HIGH",
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `AIP request failed (${response.status})`);
      }

      setProcessing(false);
      setInput("");
      setPreview(null);
      setShowCommandPalette(false);
    } catch (executeError) {
      const message = executeError instanceof Error ? executeError.message : "Unknown error";
      setError(message);
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
            placeholder="Try: 'track 123', 'news near 37.7,-122.4', 'market update', 'translate hello to es'..."
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
            
            <pre className={styles.previewJson}>
              {JSON.stringify(preview, null, 2)}
            </pre>
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
