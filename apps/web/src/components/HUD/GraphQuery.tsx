"use client";

import React, { useEffect, useState } from "react";
import { X, Database, Play } from "lucide-react";
import styles from "./HUD.module.css";
import { useStore } from "@/store/useStore";

const TEMPLATES = [
  { id: "find_associated_tracks", name: "Related Tracks", params: ["track_id"] },
  { id: "get_evidence_chain", name: "Alert Evidence Chain", params: ["alert_id"] },
  { id: "get_tracks_by_sensor", name: "Seen By Sensor", params: ["sensor_id"] },
  { id: "get_track_history", name: "Track Timeline", params: ["track_id"] },
];

type GraphQueryResult = Record<string, unknown>;

const GraphQuery: React.FC = () => {
  const showGraphQuery = useStore((state) => state.showGraphQuery);
  const setShowGraphQuery = useStore((state) => state.setShowGraphQuery);
  const setFocusTrackId = useStore((state) => state.setFocusTrackId);
  const setCurrentTimeMs = useStore((state) => state.setCurrentTimeMs);
  const setIsLive = useStore((state) => state.setIsLive);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  
  const [selectedTemplate, setSelectedTemplate] = useState(TEMPLATES[0]);
  const [params, setParams] = useState<Record<string, string>>({});
  const [results, setResults] = useState<GraphQueryResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const streamMode = (process.env.NEXT_PUBLIC_STREAM_MODE || "hybrid").toLowerCase();
  const isOfflineMode = streamMode === "offline";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowGraphQuery(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setShowGraphQuery]);

  if (!showGraphQuery) return null;

  const applyFirstResultToMap = () => {
    if (!results || results.length === 0) {
      return;
    }
    const first = results[0];
    const idCandidate = first.id ?? first.track_id ?? first.node_id;
    if (typeof idCandidate === "string" && idCandidate.length > 0) {
      setFocusTrackId(idCandidate);
    }
    const tsCandidate = first.ts_ms;
    if (typeof tsCandidate === "number" && Number.isFinite(tsCandidate) && tsCandidate > 0) {
      setIsLive(false);
      setIsPlaying(false);
      setCurrentTimeMs(tsCandidate);
    }
  };

  const handleRun = async () => {
    if (isOfflineMode) {
      setError("Graph query is disabled in offline mode.");
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    try {
      const graphUrl = process.env.NEXT_PUBLIC_GRAPH_URL || "http://localhost:8083";
      const response = await fetch(`${graphUrl}/graph/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template: selectedTemplate.id,
          params,
          page: 1,
          page_size: 50,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Graph query failed (${response.status})`);
      }

      const body = (await response.json()) as { rows?: GraphQueryResult[]; results?: GraphQueryResult[] };
      setResults(body.results ?? body.rows ?? []);
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : "Unknown error";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={() => setShowGraphQuery(false)}>
      <div className={styles.graphModal} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Database size={16} />
            <span>GRAPH_QUERY // KNOWLEDGE_BASE</span>
          </div>
          <button className={styles.closeButton} onClick={() => setShowGraphQuery(false)}>
            <X size={16} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.queryForm}>
            <label className={styles.label}>QUERY_TEMPLATE</label>
            <select 
              className={styles.select}
              value={selectedTemplate.id}
              onChange={(e) => {
                const t = TEMPLATES.find(t => t.id === e.target.value);
                if (t) setSelectedTemplate(t);
                setParams({});
                setResults(null);
                setError(null);
              }}
            >
              {TEMPLATES.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <div className={styles.paramsGrid}>
              {selectedTemplate.params.map(p => (
                <div key={p} className={styles.paramField}>
                  <label className={styles.label}>{p.toUpperCase()}</label>
                  <input 
                    className={styles.input} 
                    type="text" 
                    placeholder={`Enter ${p}...`}
                    value={params[p] || ""}
                    onChange={(e) => setParams({...params, [p]: e.target.value})}
                  />
                </div>
              ))}
            </div>

            <button 
              className={styles.runButton}
              onClick={handleRun}
              disabled={loading || isOfflineMode}
              title={isOfflineMode ? "Graph service disabled in offline mode" : undefined}
            >
              {loading ? "EXECUTING..." : "RUN_QUERY"}
              {!loading && <Play size={12} />}
            </button>
          </div>

          <div className={styles.resultsArea}>
            <label className={styles.label}>RESULTS</label>
            <div className={styles.graphActions}>
              <button
                className="hud-button"
                onClick={applyFirstResultToMap}
                disabled={!results || results.length === 0}
              >
                APPLY_TO_MAP
              </button>
            </div>
            <div className={styles.resultsContent}>
              {error ? (
                <span className={styles.critical}>{error}</span>
              ) : null}
              {results ? (
                <pre className={styles.jsonBlock}>
                  {JSON.stringify(results, null, 2)}
                </pre>
              ) : (
                <span className={styles.placeholder}>NO_RESULTS</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphQuery;
