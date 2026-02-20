"use client";

import React from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import styles from "./HUD.module.css";
import { clsx } from "clsx";
import { useStore } from "@/store/useStore";

const AlertStack: React.FC = () => {
  const alerts = useStore((state) => state.alerts);
  const selectedAlertId = useStore((state) => state.selectedAlertId);
  const setSelectedAlertId = useStore((state) => state.setSelectedAlertId);

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
            onClick={() => setSelectedAlertId(selectedAlertId === alert.id ? null : alert.id)}
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
                    {alert.evidenceLinkIds.map((id) => (
                      <div key={id} className={styles.evidenceLink}>
                        <ChevronRight size={10} />
                        <span>LINK_ID: {id.substring(0, 8)}...</span>
                      </div>
                    ))}
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
