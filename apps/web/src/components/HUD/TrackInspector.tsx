"use client";

import React from "react";
import { Crosshair, LocateFixed, X } from "lucide-react";
import { clsx } from "clsx";
import styles from "./HUD.module.css";
import { useStore } from "@/store/useStore";

const kindToLabel = (kind: number): string => {
  switch (kind) {
    case 1:
      return "AIRCRAFT";
    case 2:
      return "SATELLITE";
    case 3:
      return "GROUND";
    case 4:
      return "VESSEL";
    default:
      return "UNKNOWN";
  }
};

const TrackInspector: React.FC = () => {
  const selectedTrack = useStore((state) => state.selectedTrack);
  const setSelectedTrack = useStore((state) => state.setSelectedTrack);
  const setFocusTrackId = useStore((state) => state.setFocusTrackId);

  return (
    <div className={clsx("hud-panel", styles.trackInspectorPanel)}>
      <div className={styles.panelHeader}>
        <Crosshair size={14} />
        <span>TRACK_INTEL</span>
      </div>
      {selectedTrack ? (
        <div className={styles.trackInspectorBody}>
          <div className={styles.trackInspectorHead}>
            <span className={styles.trackInspectorId}>{selectedTrack.id}</span>
            <div className={styles.trackInspectorActions}>
              <button
                type="button"
                className={styles.trackInspectorAction}
                onClick={() => setFocusTrackId(selectedTrack.id)}
                aria-label="Focus selected track"
              >
                <LocateFixed size={10} />
                <span>FOCUS</span>
              </button>
              <button
                type="button"
                className={styles.trackInspectorClose}
                onClick={() => setSelectedTrack(null)}
                aria-label="Clear selected track"
              >
                <X size={10} />
              </button>
            </div>
          </div>
          <div className={styles.trackInspectorGrid}>
            <span>TYPE</span>
            <span>{kindToLabel(selectedTrack.kind)}</span>
            <span>PROVIDER</span>
            <span>{selectedTrack.providerId}</span>
            <span>LAT</span>
            <span>{isNaN(selectedTrack.lat) ? "--" : selectedTrack.lat.toFixed(4)}</span>
            <span>LON</span>
            <span>{isNaN(selectedTrack.lon) ? "--" : selectedTrack.lon.toFixed(4)}</span>
            <span>ALT</span>
            <span>{isNaN(selectedTrack.alt) ? "--" : `${Math.round(selectedTrack.alt)}m`}</span>
            <span>HDG</span>
            <span>{isNaN(selectedTrack.heading) ? "--" : `${Math.round(selectedTrack.heading)}°`}</span>
            <span>SPD</span>
            <span>{isNaN(selectedTrack.speed) ? "--" : Math.round(selectedTrack.speed)}</span>
            <span>TS</span>
            <span>{new Date(selectedTrack.tsMs).toISOString().substring(11, 19)}</span>
          </div>
        </div>
      ) : (
        <div className={styles.trackInspectorEmpty}>Click any map point to inspect track data.</div>
      )}
    </div>
  );
};

export default TrackInspector;
