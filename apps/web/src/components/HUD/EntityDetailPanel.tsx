"use client";

import React from "react";
import { Target, Navigation, Gauge, Clock, X } from "lucide-react";
import { clsx } from "clsx";
import styles from "./HUD.module.css";
import { useStore } from "@/store/useStore";

const kindToString = (kind: number): string => {
  switch (kind) {
    case 1:
      return "AIRCRAFT";
    case 2:
      return "SATELLITE";
    case 3:
      return "GROUND";
    case 4:
      return "VESSEL";
    case 5:
      return "DETECTION";
    case 6:
      return "CAMERA";
    default:
      return "UNKNOWN";
  }
};

const formatCoord = (value: number, precision = 5): string => {
  if (isNaN(value)) return "--";
  return value.toFixed(precision);
};

const formatAltitude = (altMeters: number): string => {
  if (isNaN(altMeters)) return "--";
  const altFeet = altMeters * 3.28084;
  return `${Math.round(altFeet).toLocaleString()} FT (${Math.round(altMeters).toLocaleString()} M)`;
};

const formatSpeed = (speedMs: number): string => {
  if (isNaN(speedMs)) return "--";
  const speedKnots = speedMs * 1.94384;
  return `${Math.round(speedKnots)} KT (${Math.round(speedMs * 3.6)} KM/H)`;
};

const formatHeading = (heading: number): string => {
  if (isNaN(heading)) return "--";
  return `${Math.round(heading)}°`;
};

const formatTimestamp = (tsMs: number): string => {
  if (isNaN(tsMs) || tsMs <= 0) return "--:--:--";
  const date = new Date(tsMs);
  return date.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const EntityDetailPanel: React.FC = () => {
  const selectedTrack = useStore((state) => state.selectedTrack);
  const setSelectedTrack = useStore((state) => state.setSelectedTrack);

  if (!selectedTrack) {
    return null;
  }

  const kindStr = kindToString(selectedTrack.kind);

  return (
    <div className={clsx("hud-panel", styles.entityPanel)}>
      <div className={styles.panelHeader}>
        <Target size={14} />
        <span>TARGET_INTEL_RECON</span>
        <button
          className={styles.closeButton}
          onClick={() => setSelectedTrack(null)}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      <div className={styles.entityContent}>
        <div className={styles.entitySection}>
          <div className={styles.entityField}>
            <span className={styles.label}>TRACK_ID</span>
            <span className={styles.value} style={{ fontWeight: 800, letterSpacing: '0.05em' }}>{selectedTrack.id}</span>
          </div>
          <div className={styles.entityField}>
            <span className={styles.label}>UPLINK</span>
            <span className={styles.value}>{selectedTrack.providerId}</span>
          </div>
          <div className={styles.entityField}>
            <span className={styles.label}>CATEGORY</span>
            <span className={styles.kindBadge}>{kindStr}</span>
          </div>
        </div>

        <div className={styles.separator} />

        <div className={styles.entitySection}>
          <div className={styles.entityIconRow}>
            <Navigation size={12} className={styles.accentIcon} />
            <span className={styles.sectionLabel}>GEOSPATIAL_FIX</span>
          </div>
          <div className={styles.entityField}>
            <span className={styles.label}>LATITUDE</span>
            <span className={styles.value}>{formatCoord(selectedTrack.lat)}</span>
          </div>
          <div className={styles.entityField}>
            <span className={styles.label}>LONGITUDE</span>
            <span className={styles.value}>{formatCoord(selectedTrack.lon)}</span>
          </div>
          <div className={styles.entityField}>
            <span className={styles.label}>ALTITUDE</span>
            <span className={styles.value} style={{ color: 'var(--accent)', fontWeight: 700 }}>{formatAltitude(selectedTrack.alt)}</span>
          </div>
        </div>

        <div className={styles.separator} />

        <div className={styles.entitySection}>
          <div className={styles.entityIconRow}>
            <Gauge size={12} className={styles.accentIcon} />
            <span className={styles.sectionLabel}>KINEMATICS</span>
          </div>
          <div className={styles.entityField}>
            <span className={styles.label}>BEARING</span>
            <span className={styles.value}>{formatHeading(selectedTrack.heading)}</span>
          </div>
          <div className={styles.entityField}>
            <span className={styles.label}>VELOCITY</span>
            <span className={styles.value}>{formatSpeed(selectedTrack.speed)}</span>
          </div>
        </div>

        <div className={styles.separator} />

        <div className={styles.entitySection}>
          <div className={styles.entityIconRow}>
            <Clock size={12} className={styles.accentIcon} />
            <span className={styles.sectionLabel}>TEMPORAL_MARK</span>
          </div>
          <div className={styles.entityField}>
            <span className={styles.label}>LAST_LINK</span>
            <span className={styles.value} style={{ fontStyle: 'italic' }}>{formatTimestamp(selectedTrack.tsMs)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityDetailPanel;
