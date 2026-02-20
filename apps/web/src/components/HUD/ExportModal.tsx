"use client";

import React, { useEffect, useState } from "react";
import { Download, Lock, Shield, X } from "lucide-react";
import styles from "./HUD.module.css";
import { useStore } from "@/store/useStore";

const ExportModal: React.FC = () => {
  const showExport = useStore((state) => state.showExport);
  const setShowExport = useStore((state) => state.setShowExport);
  const userRole = useStore((state) => state.userRole);
  
  const [downloading, setDownloading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [trackId, setTrackId] = useState("track_0");
  const [error, setError] = useState<string | null>(null);
  const [watermarkTs] = useState(() => new Date().toISOString());
  const streamMode = (process.env.NEXT_PUBLIC_STREAM_MODE || "hybrid").toLowerCase();
  const isOfflineMode = streamMode === "offline";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowExport(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setShowExport]);

  if (!showExport) return null;

  const handleExport = async () => {
    if (isOfflineMode) {
      setError("Export is disabled in offline mode.");
      setToken(null);
      return;
    }

    setDownloading(true);
    setError(null);
    try {
      const graphUrl = process.env.NEXT_PUBLIC_GRAPH_URL || "http://localhost:8083";
      const response = await fetch(`${graphUrl}/graph/export`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: {
            template: "track_timeline",
            params: { track_id: trackId },
            page: 1,
            page_size: 100,
          },
          watermark: `HARPY-${userRole}-${watermarkTs}`,
          expires_in_secs: 900,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Export request failed (${response.status})`);
      }

      const body = (await response.json()) as { signed_export_jwt?: string };
      setToken(body.signed_export_jwt ?? null);
    } catch (exportError) {
      const message = exportError instanceof Error ? exportError.message : "Unknown error";
      setError(message);
      setToken(null);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={() => setShowExport(false)}>
      <div className={styles.graphModal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Download size={16} />
            <span>SECURE_EXPORT // WATERMARKING</span>
          </div>
          <button className={styles.closeButton} onClick={() => setShowExport(false)}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.queryForm}>
            <div className={styles.exportInfo}>
              <p>This action will generate a cryptographically signed snapshot of the current view.</p>
              <div className={styles.watermarkPreview}>
                <Lock size={12} />
                <span>WATERMARK: {userRole}{" // "}{watermarkTs}</span>
              </div>
              <label className={styles.label}>TRACK_ID</label>
              <input
                className={styles.input}
                value={trackId}
                onChange={(e) => setTrackId(e.target.value)}
                placeholder="track_0"
              />
              {error ? <span className={styles.critical}>{error}</span> : null}
            </div>

            {token ? (
              <div className={styles.resultsArea}>
                <label className={styles.label}>SIGNED_TOKEN</label>
                <div className={styles.resultsContent}>
                  <pre className={styles.jsonBlock}>{token}</pre>
                </div>
                <button 
                  className={styles.runButton} 
                  onClick={() => setShowExport(false)}
                >
                  DOWNLOAD COMPLETE
                </button>
              </div>
            ) : (
              <button 
                className={styles.runButton}
                onClick={handleExport}
                disabled={downloading || isOfflineMode}
                title={isOfflineMode ? "Export service disabled in offline mode" : undefined}
              >
                {downloading ? "SIGNING & PACKING..." : "GENERATE_EXPORT"}
                {!downloading && <Shield size={12} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
