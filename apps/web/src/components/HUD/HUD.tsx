"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bell,
  Check,
  Compass,
  Database,
  Eye,
  Layers,
  Radio,
  Save,
  Shield,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import styles from "./HUD.module.css";
import { clsx } from "clsx";
import { useStore, AltitudeBand, SpeedBand, VisionMode } from "@/store/useStore";
import Timeline from "./Timeline";
import AlertStack from "./AlertStack";
import GraphQuery from "./GraphQuery";
import CommandPalette from "./CommandPalette";
import ExportModal from "./ExportModal";
import IntelPanel from "./IntelPanel";
import TrackInspector from "./TrackInspector";
import EntityDetailPanel from "./EntityDetailPanel";

interface SavedScene {
  id: string;
  name: string;
  createdAtMs: number;
  visionMode: VisionMode;
  layers: string[];
  altitudeBand: AltitudeBand;
  speedBand: SpeedBand;
  isLive: boolean;
  isPlaying: boolean;
  playbackRate: number;
  currentTimeMs: number;
  cameraPose: {
    lat: number;
    lon: number;
    alt: number;
    heading: number;
    pitch: number;
    roll: number;
  };
}

const SAVED_SCENES_KEY = "harpy.saved-scenes.v1";

const LAYER_OPTIONS: Array<{ id: string; label: string; short: string; kindKey?: string }> = [
  { id: "ADSB", label: "ADS-B Aircraft", short: "AIR", kindKey: "AIRCRAFT" },
  { id: "TLE_SAT", label: "TLE Satellites", short: "SAT", kindKey: "SATELLITE" },
  { id: "SENS_CV", label: "Sensors / CV", short: "SEN", kindKey: "GROUND" },
  { id: "WX_RADAR", label: "Weather / Ground", short: "WX", kindKey: "GROUND" },
];

const ALTITUDE_OPTIONS: AltitudeBand[] = ["ALL", "LOW", "MID", "HIGH", "SPACE"];
const SPEED_OPTIONS: SpeedBand[] = ["ALL", "STATIC", "SLOW", "FAST", "HYPER"];

const safeParseSavedScenes = (raw: string | null): SavedScene[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as SavedScene[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((scene) => Boolean(scene?.id && scene?.cameraPose && Array.isArray(scene?.layers)));
  } catch {
    return [];
  }
};

const formatClock = (tsMs: number): string => {
  if (!tsMs || Number.isNaN(tsMs)) {
    return "--:--:--";
  }
  return new Date(tsMs).toISOString().substring(11, 19);
};

const formatHeading = (headingRad: number): string => {
  const deg = (((headingRad * 180) / Math.PI) % 360 + 360) % 360;
  return `${Math.round(deg)}°`;
};

const toDms = (value: number, isLat: boolean): string => {
  if (Number.isNaN(value)) {
    return "--";
  }
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFloat = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = Math.round((minutesFloat - minutes) * 60);
  const hemisphere = isLat ? (value >= 0 ? "N" : "S") : value >= 0 ? "E" : "W";
  return `${degrees}°${minutes.toString().padStart(2, "0")}'${seconds.toString().padStart(2, "0")}" ${hemisphere}`;
};

const formatFreshness = (value: string): string => value.replace("FRESHNESS_", "").replace("CIRCUIT_STATE_", "");

const estimateScaleMeters = (cameraAlt: number): number => {
  if (!Number.isFinite(cameraAlt) || cameraAlt <= 0) {
    return 0;
  }
  return Math.max(250, Math.round(cameraAlt * 0.085));
};

const formatDistance = (meters: number): string => {
  if (meters <= 0) {
    return "--";
  }
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
};

const HUD: React.FC = () => {
  const visionMode = useStore((state) => state.visionMode);
  const setVisionMode = useStore((state) => state.setVisionMode);
  const layers = useStore((state) => state.layers);
  const toggleLayer = useStore((state) => state.toggleLayer);
  const setLayers = useStore((state) => state.setLayers);
  const altitudeBand = useStore((state) => state.altitudeBand);
  const setAltitudeBand = useStore((state) => state.setAltitudeBand);
  const speedBand = useStore((state) => state.speedBand);
  const setSpeedBand = useStore((state) => state.setSpeedBand);
  const connectionStatus = useStore((state) => state.connectionStatus);
  const providerStatus = useStore((state) => state.providerStatus);
  const dataPlaneStats = useStore((state) => state.dataPlaneStats);
  const setShowGraphQuery = useStore((state) => state.setShowGraphQuery);
  const setShowCommandPalette = useStore((state) => state.setShowCommandPalette);
  const setShowExport = useStore((state) => state.setShowExport);
  const userRole = useStore((state) => state.userRole);
  const setUserRole = useStore((state) => state.setUserRole);
  const commandFeedback = useStore((state) => state.commandFeedback);
  const setCommandFeedback = useStore((state) => state.setCommandFeedback);
  const cameraPose = useStore((state) => state.cameraPose);
  const setRequestedCameraPose = useStore((state) => state.setRequestedCameraPose);
  const isLive = useStore((state) => state.isLive);
  const setIsLive = useStore((state) => state.setIsLive);
  const isPlaying = useStore((state) => state.isPlaying);
  const setIsPlaying = useStore((state) => state.setIsPlaying);
  const playbackRate = useStore((state) => state.playbackRate);
  const setPlaybackRate = useStore((state) => state.setPlaybackRate);
  const currentTimeMs = useStore((state) => state.currentTimeMs);
  const setCurrentTimeMs = useStore((state) => state.setCurrentTimeMs);

  const lastMessageDisplay =
    dataPlaneStats.lastMessageTsMs === null ? "--" : new Date(dataPlaneStats.lastMessageTsMs).toISOString().substring(11, 19);
  const providerValues = Object.values(providerStatus);
  const renderedTotal = dataPlaneStats.renderedTrackCount;
  const heading = cameraPose ? formatHeading(cameraPose.heading) : "--";
  const locationDms = cameraPose ? `${toDms(cameraPose.lat, true)} · ${toDms(cameraPose.lon, false)}` : "--";
  const scaleMeters = estimateScaleMeters(cameraPose?.alt ?? 0);

  const [savedScenes, setSavedScenes] = useState<SavedScene[]>(() =>
    typeof window === "undefined" ? [] : safeParseSavedScenes(window.localStorage.getItem(SAVED_SCENES_KEY)),
  );

  const modes: VisionMode[] = ["NORMAL", "EO", "CRT", "NVG", "FLIR"];

  useEffect(() => {
    if (!commandFeedback) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCommandFeedback(null);
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [commandFeedback, setCommandFeedback]);

  const persistScenes = (nextScenes: SavedScene[]) => {
    setSavedScenes(nextScenes);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAVED_SCENES_KEY, JSON.stringify(nextScenes));
    }
  };

  const saveCurrentScene = () => {
    if (!cameraPose) {
      setCommandFeedback({
        id: Date.now(),
        title: "Scene Save Failed",
        detail: "Camera pose is not ready yet.",
        severity: "ERROR",
        atMs: Date.now(),
      });
      return;
    }

    const now = Date.now();
    const scene: SavedScene = {
      id: `scene-${now}`,
      name: `Scene ${new Date(now).toISOString().substring(11, 19)}`,
      createdAtMs: now,
      visionMode,
      layers: [...layers],
      altitudeBand,
      speedBand,
      isLive,
      isPlaying,
      playbackRate,
      currentTimeMs,
      cameraPose,
    };

    const next = [scene, ...savedScenes].slice(0, 8);
    persistScenes(next);
    setCommandFeedback({
      id: now,
      title: "Scene Saved",
      detail: `${scene.name} captured with pose + filters.`,
      severity: "SUCCESS",
      atMs: now,
    });
  };

  const applyScene = (scene: SavedScene) => {
    setVisionMode(scene.visionMode);
    setLayers(scene.layers);
    setAltitudeBand(scene.altitudeBand);
    setSpeedBand(scene.speedBand);
    setIsLive(scene.isLive);
    setIsPlaying(scene.isPlaying);
    setPlaybackRate(scene.playbackRate);
    setCurrentTimeMs(scene.currentTimeMs);
    setRequestedCameraPose(scene.cameraPose);
    const feedbackTs = scene.createdAtMs + 1;
    setCommandFeedback({
      id: feedbackTs,
      title: "Scene Restored",
      detail: `${scene.name} applied to map and timeline.`,
      severity: "INFO",
      atMs: feedbackTs,
    });
  };

  const removeScene = (sceneId: string) => {
    const next = savedScenes.filter((scene) => scene.id !== sceneId);
    persistScenes(next);
  };

  const freshnessRows = useMemo(
    () =>
      Object.entries(dataPlaneStats.providerFreshnessCounts)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, count]) => ({ key: formatFreshness(key), count })),
    [dataPlaneStats.providerFreshnessCounts],
  );

  return (
    <div className="hud-overlay">
      <div className={clsx("hud-panel", styles.topBar)}>
        <div className={styles.logoWrap}>
          <div className={styles.logoBadge}>
            <Sparkles size={13} />
          </div>
          <div className={styles.logoTextBlock}>
            <span className={styles.logoKicker}>Geospatial Intelligence Fusion</span>
            <span className={styles.logoTitle}>HARPY / Operator Console</span>
          </div>
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

        <div className={styles.topStats}>
          <div className={styles.statusChip}>
            <Activity
              size={12}
              className={clsx(styles.accentIcon, {
                [styles.statusDisconnected]: connectionStatus === "DISCONNECTED",
                [styles.statusConnecting]: connectionStatus === "CONNECTING",
              })}
            />
            <span>{connectionStatus}</span>
          </div>
          <div className={styles.statusChip}>
            <Layers size={12} className={styles.accentIcon} />
            <span>{renderedTotal.toLocaleString()} Tracks</span>
          </div>
          <div className={styles.statusChip}>
            <Radio size={12} className={styles.accentIcon} />
            <span>{Math.round(dataPlaneStats.throughputTps)}/s</span>
          </div>
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div className={clsx("hud-panel", styles.leftPanel)}>
          <div className={styles.panelSection}>
            <div className={styles.panelHeader}>
              <Layers size={14} />
              <span>Layers</span>
            </div>
            <div className={styles.layerList}>
              {LAYER_OPTIONS.map((layer) => (
                <button
                  key={layer.id}
                  className={clsx("hud-button", styles.layerButton, {
                    [styles.activeLayer]: layers.includes(layer.id),
                  })}
                  onClick={() => toggleLayer(layer.id)}
                  data-testid={`layer-${layer.id}`}
                  aria-pressed={layers.includes(layer.id)}
                >
                  <span>{layer.label}</span>
                  <span className={styles.layerCount}>
                    {layer.kindKey ? dataPlaneStats.renderedByKind[layer.kindKey] ?? 0 : "--"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.panelSection}>
            <div className={styles.panelHeader}>
              <SlidersHorizontal size={14} />
              <span>Declutter Filters</span>
            </div>

            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Altitude</div>
              <div className={styles.pillRow}>
                {ALTITUDE_OPTIONS.map((option) => (
                  <button
                    key={option}
                    className={clsx("hud-button", styles.pillButton, {
                      [styles.pillActive]: altitudeBand === option,
                    })}
                    onClick={() => setAltitudeBand(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.filterGroup}>
              <div className={styles.filterLabel}>Speed</div>
              <div className={styles.pillRow}>
                {SPEED_OPTIONS.map((option) => (
                  <button
                    key={option}
                    className={clsx("hud-button", styles.pillButton, {
                      [styles.pillActive]: speedBand === option,
                    })}
                    onClick={() => setSpeedBand(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.panelSection}>
            <div className={styles.panelHeader}>
              <Database size={14} />
              <span>Tools</span>
            </div>
            <div className={styles.layerList}>
              <button
                className="hud-button"
                onClick={() => setShowGraphQuery(true)}
                data-testid="open-graph-query"
              >
                GRAPH QUERY
              </button>
              <button
                className="hud-button"
                onClick={() => setShowCommandPalette(true)}
                data-testid="open-command-palette"
              >
                AI COMMAND (CMD+K)
              </button>
              {userRole === "ADMIN" ? (
                <button
                  className="hud-button"
                  onClick={() => setShowExport(true)}
                  data-testid="open-export"
                >
                  EXPORT
                </button>
              ) : null}
              <button className="hud-button" onClick={saveCurrentScene}>
                <Save size={12} />
                SAVE VIEW
              </button>
            </div>
          </div>

          <div className={styles.panelSection}>
            <div className={styles.panelHeader}>
              <Eye size={14} />
              <span>Saved Scenes</span>
            </div>
            <div className={styles.sceneList}>
              {savedScenes.length === 0 ? (
                <div className={styles.sceneEmpty}>No saved scenes yet.</div>
              ) : (
                savedScenes.map((scene) => (
                  <div key={scene.id} className={styles.sceneRow}>
                    <button className={clsx("hud-button", styles.sceneApply)} onClick={() => applyScene(scene)}>
                      <span>{scene.name}</span>
                      <span className={styles.sceneTime}>{formatClock(scene.createdAtMs)}</span>
                    </button>
                    <button className={clsx("hud-button", styles.sceneDelete)} onClick={() => removeScene(scene.id)}>
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.roleRow}>
            <Shield size={13} className={styles.accentIcon} />
            <span>{userRole}</span>
            <button
              className={clsx("hud-button", styles.roleToggle)}
              onClick={() => setUserRole(userRole === "ADMIN" ? "OPERATOR" : "ADMIN")}
            >
              SWITCH ROLE
            </button>
          </div>
        </div>

        <div className={styles.centerSpace} aria-hidden>
          <div className={styles.crosshair} />
          <div className={styles.compassRose}>
            <Compass size={14} />
            <span>{heading}</span>
          </div>
          <div className={styles.geoReadout}>
            <div className={styles.geoLabel}>Location (DMS)</div>
            <div className={styles.geoValue}>{locationDms}</div>
            <div className={styles.scaleBarWrap}>
              <div className={styles.scaleBar} />
              <span>{formatDistance(scaleMeters)}</span>
            </div>
          </div>
        </div>

        <div className={styles.rightPanelStack}>
          <div className={clsx("hud-panel", styles.dataLinkPanel)}>
            <div className={styles.panelHeader}>
              <Radio size={14} />
              <span>Data Plane</span>
            </div>
            <div className={styles.statusGrid}>
              <div className={styles.statusItem}>
                <span className={styles.label}>WS RTT</span>
                <span className={styles.value}>{dataPlaneStats.wsRttMs === null ? "--" : `${Math.round(dataPlaneStats.wsRttMs)} ms`}</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.label}>Throughput</span>
                <span className={styles.value}>{Math.round(dataPlaneStats.throughputTps)}/s</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.label}>Rendered</span>
                <span className={styles.value}>{dataPlaneStats.renderedTrackCount.toLocaleString()}</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.label}>Last Msg</span>
                <span className={styles.value}>{lastMessageDisplay}</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.label}>Relay Dropped</span>
                <span className={styles.value}>{dataPlaneStats.relayBackpressureDropped.toLocaleString()}</span>
              </div>
              <div className={styles.statusItem}>
                <span className={styles.label}>Relay Sent</span>
                <span className={styles.value}>{dataPlaneStats.relayBackpressureSent.toLocaleString()}</span>
              </div>
            </div>

            {freshnessRows.length > 0 ? (
              <div className={styles.freshnessGrid}>
                {freshnessRows.map((row) => (
                  <div key={row.key} className={styles.freshnessItem}>
                    <span>{row.key}</span>
                    <span>{row.count}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {providerValues.length > 0 ? (
              <div className={styles.providerGrid}>
                {providerValues.slice(0, 6).map((provider) => (
                  <div key={provider.providerId} className={styles.providerItem}>
                    <div className={styles.providerInfo}>
                      <span className={styles.providerIdLabel}>{provider.providerId}</span>
                      <span
                        className={clsx(styles.freshnessBadge, {
                          [styles.freshnessCritical]: provider.freshness === "FRESHNESS_CRITICAL",
                          [styles.freshnessStale]: provider.freshness === "FRESHNESS_STALE",
                          [styles.freshnessAging]: provider.freshness === "FRESHNESS_AGING",
                          [styles.freshnessFresh]: provider.freshness === "FRESHNESS_FRESH",
                        })}
                      >
                        {formatFreshness(provider.freshness)}
                      </span>
                    </div>
                    <div className={styles.providerMeta}>
                      <span>{formatFreshness(provider.circuitState)}</span>
                      <span>{Math.round(provider.latencyMs)}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <TrackInspector />
          <IntelPanel />

          <div className={clsx("hud-panel", styles.alertPanel)}>
            <div className={styles.panelHeader}>
              <Bell size={14} />
              <span>Alerts</span>
            </div>
            <div className={styles.alertContent}>
              <AlertStack />
            </div>
          </div>
        </div>
      </div>

      {commandFeedback ? (
        <div
          className={clsx(styles.commandToast, {
            [styles.toastSuccess]: commandFeedback.severity === "SUCCESS",
            [styles.toastError]: commandFeedback.severity === "ERROR",
            [styles.toastInfo]: commandFeedback.severity === "INFO",
          })}
        >
          <Check size={13} />
          <div>
            <div className={styles.toastTitle}>{commandFeedback.title}</div>
            <div className={styles.toastDetail}>{commandFeedback.detail}</div>
          </div>
        </div>
      ) : null}

      <Timeline />
      <EntityDetailPanel />
      <GraphQuery />
      <CommandPalette />
      <ExportModal />
    </div>
  );
};

export default HUD;
