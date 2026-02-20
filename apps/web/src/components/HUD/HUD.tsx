"use client";

import React from "react";
import { Activity, Bell, Layers, Radio, Zap, Database, Shield } from "lucide-react";
import styles from "./HUD.module.css";
import { clsx } from "clsx";
import { useStore, VisionMode } from "@/store/useStore";
import Timeline from "./Timeline";
import AlertStack from "./AlertStack";
import GraphQuery from "./GraphQuery";
import CommandPalette from "./CommandPalette";
import ExportModal from "./ExportModal";
import IntelPanel from "./IntelPanel";
import TrackInspector from "./TrackInspector";
import EntityDetailPanel from "./EntityDetailPanel";

const HUD: React.FC = () => {
  const visionMode = useStore((state) => state.visionMode);
  const setVisionMode = useStore((state) => state.setVisionMode);
  const layers = useStore((state) => state.layers);
  const toggleLayer = useStore((state) => state.toggleLayer);
  const connectionStatus = useStore((state) => state.connectionStatus);
  const providerStatus = useStore((state) => state.providerStatus);
  const dataPlaneStats = useStore((state) => state.dataPlaneStats);
  const setShowGraphQuery = useStore((state) => state.setShowGraphQuery);
  const setShowCommandPalette = useStore((state) => state.setShowCommandPalette);
  const setShowExport = useStore((state) => state.setShowExport);
  const userRole = useStore((state) => state.userRole);
  const setUserRole = useStore((state) => state.setUserRole);
  const streamMode = (process.env.NEXT_PUBLIC_STREAM_MODE || "hybrid").toLowerCase();
  const isOfflineMode = streamMode === "offline";
  const lastMessageDisplay =
    dataPlaneStats.lastMessageTsMs === null
      ? "--"
      : new Date(dataPlaneStats.lastMessageTsMs).toISOString().substring(11, 19);

  const modes: VisionMode[] = ["NORMAL", "EO", "CRT", "NVG", "FLIR"];

  return (
    <div className="hud-overlay">
      {/* Top Bar */}
      <div className={clsx("hud-panel", styles.topBar)}>
        <div className={styles.logo}>
          <Zap className={styles.accentIcon} size={18} />
          <span>HARPY // ALPHA_V0</span>
        </div>
        
        <div className={styles.modeBar}>
          {modes.map((mode) => (
            <button
              key={mode}
              className={clsx("hud-button", styles.modeButton, {
                [styles.activeMode]: visionMode === mode,
              })}
              onClick={() => setVisionMode(mode)}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className={styles.sysStatus}>
          <Activity size={14} className={clsx(styles.accentIcon, {
            [styles.statusDisconnected]: connectionStatus === "DISCONNECTED",
            [styles.statusConnecting]: connectionStatus === "CONNECTING",
          })} />
          <span>{connectionStatus}</span>
        </div>
      </div>

      {/* Main Grid */}
      <div className={styles.mainGrid}>
        {/* Left: Layers & Tools */}
        <div className={clsx("hud-panel", styles.leftPanel)}>
          <div className={styles.panelHeader}>
            <Layers size={14} />
            <span>LAYERS</span>
          </div>
          <div className={styles.layerList}>
            <button 
              className={clsx("hud-button", { [styles.activeLayer]: layers.includes("ADSB") })}
              onClick={() => toggleLayer("ADSB")}
            >
              ADS-B
            </button>
            <button 
              className={clsx("hud-button", { [styles.activeLayer]: layers.includes("TLE_SAT") })}
              onClick={() => toggleLayer("TLE_SAT")}
            >
              TLE_SAT
            </button>
            <button 
              className={clsx("hud-button", { [styles.activeLayer]: layers.includes("SENS_CV") })}
              onClick={() => toggleLayer("SENS_CV")}
            >
              SENS_CV
            </button>
            <button 
              className={clsx("hud-button", { [styles.activeLayer]: layers.includes("WX_RADAR") })}
              onClick={() => toggleLayer("WX_RADAR")}
            >
              WX_RADAR
            </button>
          </div>

          <div className={styles.separator} style={{ margin: "12px 0", height: "1px", width: "100%" }} />

          <div className={styles.panelHeader}>
            <Database size={14} />
            <span>TOOLS</span>
          </div>
          <div className={styles.layerList}>
            <button
              className="hud-button"
              onClick={() => setShowGraphQuery(true)}
              disabled={isOfflineMode}
              title={isOfflineMode ? "Graph service disabled in offline mode" : undefined}
              style={isOfflineMode ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            >
              GRAPH_QUERY
            </button>
            <button
              className="hud-button"
              onClick={() => setShowCommandPalette(true)}
              disabled={isOfflineMode}
              title={isOfflineMode ? "AIP service disabled in offline mode" : undefined}
              style={isOfflineMode ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
            >
              AI_CMD (CMD+K)
            </button>
            
            {userRole !== "VIEWER" && (
              <button
                className="hud-button"
                onClick={() => setShowExport(true)}
                disabled={isOfflineMode}
                title={isOfflineMode ? "Export service disabled in offline mode" : undefined}
                style={isOfflineMode ? { opacity: 0.5, cursor: "not-allowed" } : undefined}
              >
                EXPORT_SCENE
              </button>
            )}
            
            <div className={styles.separator} style={{ margin: "8px 0", height: "1px", width: "100%", opacity: 0.3 }} />
            
            <div className={styles.panelHeader}>
              <Shield size={10} />
              <span>ROLE: {userRole}</span>
            </div>
            <button 
              className="hud-button" 
              onClick={() => setUserRole(userRole === "ADMIN" ? "VIEWER" : "ADMIN")}
              style={{ fontSize: "8px", opacity: 0.7 }}
            >
              TOGGLE_ROLE (DEV)
            </button>
          </div>
        </div>

        <div className={styles.centerSpace} />

        {/* Right: Data Link & Alerts */}
        <div className={styles.rightPanelStack}>
          <div className={clsx("hud-panel", styles.dataLinkPanel)}>
            <div className={styles.panelHeader}>
              <Radio size={14} />
              <span>DATA_LINK</span>
            </div>
            <div className={styles.providerGrid}>
              {Object.values(providerStatus).length === 0 ? (
                <div className={styles.statusGrid}>
                  <div className={styles.statusItem}>
                    <span className={styles.label}>WS_RTT</span>
                    <span className={styles.value}>
                      {dataPlaneStats.wsRttMs === null ? "--" : Math.round(dataPlaneStats.wsRttMs)}MS
                    </span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.label}>THROUGHPUT</span>
                    <span className={styles.value}>{Math.round(dataPlaneStats.throughputTps)}/S</span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.label}>ALERTS</span>
                    <span className={styles.value}>{dataPlaneStats.alertsPerSec.toFixed(1)}/S</span>
                  </div>
                  <div className={styles.statusItem}>
                    <span className={styles.label}>LAST_MSG</span>
                    <span className={styles.value}>{lastMessageDisplay}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.statusGrid}>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>WS_RTT</span>
                      <span className={styles.value}>
                        {dataPlaneStats.wsRttMs === null ? "--" : Math.round(dataPlaneStats.wsRttMs)}MS
                      </span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>THROUGHPUT</span>
                      <span className={styles.value}>{Math.round(dataPlaneStats.throughputTps)}/S</span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>ALERTS</span>
                      <span className={styles.value}>{dataPlaneStats.alertsPerSec.toFixed(1)}/S</span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>LAST_MSG</span>
                      <span className={styles.value}>{lastMessageDisplay}</span>
                    </div>
                  </div>
                  <div className={styles.statusGrid}>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>TRACKS</span>
                      <span className={styles.value}>{dataPlaneStats.renderedTrackCount}</span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>RELAY_DROP</span>
                      <span className={styles.value}>{dataPlaneStats.relayBackpressureDropped}</span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>RELAY_SENT</span>
                      <span className={styles.value}>{dataPlaneStats.relayBackpressureSent}</span>
                    </div>
                    <div className={styles.statusItem}>
                      <span className={styles.label}>CLIENTS</span>
                      <span className={styles.value}>
                        {dataPlaneStats.relayConnectedClients}/{dataPlaneStats.relayPlaybackClients}
                      </span>
                    </div>
                  </div>
                  <div className={styles.renderedByKind}>
                    <span>AIR {dataPlaneStats.renderedByKind.AIRCRAFT ?? 0}</span>
                    <span>SAT {dataPlaneStats.renderedByKind.SATELLITE ?? 0}</span>
                    <span>GRD {dataPlaneStats.renderedByKind.GROUND ?? 0}</span>
                    <span>VES {dataPlaneStats.renderedByKind.VESSEL ?? 0}</span>
                  </div>
                  {Object.values(providerStatus).map((p) => (
                    <div key={p.providerId} className={styles.providerItem}>
                      <div className={styles.providerInfo}>
                        <span className={styles.providerIdLabel}>{p.providerId}</span>
                        <span className={clsx(styles.freshnessBadge, {
                          [styles.freshnessCritical]: p.freshness === "FRESHNESS_CRITICAL",
                          [styles.freshnessStale]: p.freshness === "FRESHNESS_STALE",
                          [styles.freshnessAging]: p.freshness === "FRESHNESS_AGING",
                          [styles.freshnessFresh]: p.freshness === "FRESHNESS_FRESH",
                        })}>
                          {p.freshness.replace("FRESHNESS_", "")}
                        </span>
                      </div>
                      <div className={styles.providerMeta}>
                        <span>{p.circuitState.replace("CIRCUIT_STATE_", "")}</span>
                        <span>{isNaN(p.latencyMs) ? "--" : Math.round(p.latencyMs)}ms</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <TrackInspector />
          <IntelPanel />

          <div className={clsx("hud-panel", styles.alertPanel)}>
            <div className={styles.panelHeader}>
              <Bell size={14} />
              <span>ALERTS</span>
            </div>
            <div className={styles.alertContent}>
              <AlertStack />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: DVR Timeline */}
      <Timeline />

      {/* Entity Detail Overlay (shows detailed info when entity selected) */}
      <EntityDetailPanel />

      {/* Modals */}
      <GraphQuery />
      <CommandPalette />
      <ExportModal />
    </div>
  );
};

export default HUD;
