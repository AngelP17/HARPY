"use client";

import React from "react";
import { AlertTriangle, ChevronRight, LocateFixed, TimerReset } from "lucide-react";
import styles from "./HUD.module.css";
import { clsx } from "clsx";
import { useStore } from "@/store/useStore";

const AlertStack: React.FC = () => {
  const alerts = useStore((state) => state.alerts);
  const selectedAlertId = useStore((state) => state.selectedAlertId);
  const setSelectedAlertId = useStore((state) => state.setSelectedAlertId);
  const linksById = useStore((state) => state.linksById);
  const setFocusTrackId = useStore((state) => state.setFocusTrackId);
  const setHighlightedTrackIds = useStore((state) => state.setHighlightedTrackIds);
  const setIsLive = useStore((state) => state.setIsLive);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const setCurrentTimeMs = useStore((state) => state.setCurrentTimeMs);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "ALERT_SEVERITY_CRITICAL": return styles.critical;
      case "ALERT_SEVERITY_WARNING":
      case "ALERT_SEVERITY_HIGH":
        return styles.high;
      case "ALERT_SEVERITY_MEDIUM": return styles.medium;
      case "ALERT_SEVERITY_LOW": return styles.low;
      default: return styles.info;
    }
  };

  const formatTime = (ms: number) => {
    return new Date(ms).toLocaleTimeString([], { hour12: false });
  };

  return (
    <div className={styles.alertStackContainer}>
      {alerts.length === 0 ? (
        <span className={styles.emptyMsg}>NO_ACTIVE_ALERTS</span>
      ) : (
        alerts.map((alert) => (
          <div 
            key={alert.id} 
            className={clsx(styles.alertItem, getSeverityColor(alert.severity), {
              [styles.alertSelected]: selectedAlertId === alert.id
            })}
            data-testid={`alert-item-${alert.id}`}
            onClick={() => {
              const nextSelected = selectedAlertId === alert.id ? null : alert.id;
              setSelectedAlertId(nextSelected);
              if (nextSelected) {
                setIsLive(false);
                setIsPlaying(false);
                setCurrentTimeMs(alert.tsMs);
                const trackIds = new Set<string>();
                let firstTrackId: string | null = null;
                for (const evidenceId of alert.evidenceLinkIds) {
                  const link = linksById[evidenceId];
                  if (!link) continue;
                  if (link.fromType === "NODE_TYPE_TRACK") {
                    trackIds.add(link.fromId);
                    if (!firstTrackId) firstTrackId = link.fromId;
                  }
                  if (link.toType === "NODE_TYPE_TRACK") {
                    trackIds.add(link.toId);
                    if (!firstTrackId) firstTrackId = link.toId;
                  }
                }
                setHighlightedTrackIds(trackIds);
                if (firstTrackId) setFocusTrackId(firstTrackId);
              } else {
                setHighlightedTrackIds(new Set<string>());
              }
            }}
          >
            <div className={styles.alertHeader}>
              <div className={styles.alertTitleRow}>
                <AlertTriangle size={12} />
                <span className={styles.alertTitle}>{alert.title}</span>
              </div>
              <span className={styles.alertTime}>{formatTime(alert.tsMs)}</span>
            </div>
            
            {selectedAlertId === alert.id && (
              <div className={styles.alertDetails}>
                <p className={styles.alertDesc}>{alert.description}</p>
                
                {alert.evidenceLinkIds.length > 0 && (
                  <div className={styles.evidenceSection}>
                    <span className={styles.evidenceLabel}>EVIDENCE_CHAIN</span>
                    {alert.evidenceLinkIds.map((id) => {
                      const link = linksById[id];
                      const fromTrack = link?.fromType === "NODE_TYPE_TRACK" ? link.fromId : null;
                      const toTrack = link?.toType === "NODE_TYPE_TRACK" ? link.toId : null;
                      return (
                        <div key={id} className={styles.evidenceLink}>
                          <ChevronRight size={10} />
                          <span>
                            {link
                              ? `${link.fromType.replace("NODE_TYPE_", "")}:${link.fromId} -> ${link.rel} -> ${link.toType.replace("NODE_TYPE_", "")}:${link.toId}`
                              : `LINK_ID: ${id.substring(0, 8)}...`}
                          </span>
                          {(fromTrack || toTrack) ? (
                            <div className={styles.evidenceActions}>
                              <button
                                type="button"
                                className={styles.evidenceAction}
                                data-testid={`alert-focus-${id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setFocusTrackId(fromTrack ?? toTrack);
                                }}
                              >
                                <LocateFixed size={10} />
                                <span>FOCUS</span>
                              </button>
                              <button
                                type="button"
                                className={styles.evidenceAction}
                                data-testid={`alert-seek-${id}`}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setIsLive(false);
                                  setIsPlaying(false);
                                  setCurrentTimeMs(link?.tsMs || alert.tsMs);
                                }}
                              >
                                <TimerReset size={10} />
                                <span>SEEK</span>
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default AlertStack;
