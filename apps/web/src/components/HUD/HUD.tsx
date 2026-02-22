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
  Route,
  Save,
  Shield,
  SlidersHorizontal,
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

interface LayerOption {
  id: string;
  label: string;
  short: string;
  kindKey?: string;
  sourceLabel: string;
  providerIds: string[];
}

const LAYER_OPTIONS: LayerOption[] = [
  {
    id: "ADSB",
    label: "ADS-B Aircraft",
    short: "AIR",
    kindKey: "AIRCRAFT",
    sourceLabel: "OpenSky",
    providerIds: ["mock-adsb", "opensky", "mock-streamer"],
  },
  {
    id: "TLE_SAT",
    label: "TLE Satellites",
    short: "SAT",
    kindKey: "SATELLITE",
    sourceLabel: "CelesTrak",
    providerIds: ["mock-tle", "celestrak-gp", "mock-streamer"],
  },
  {
    id: "SENS_CV",
    label: "Sensors / CV",
    short: "SEN",
    kindKey: "GROUND",
    sourceLabel: "Sensor Mesh",
    providerIds: ["mock-sensor", "mock-streamer", "usgs-seismic", "nws-weather"],
  },
  {
    id: "WX_RADAR",
    label: "Weather / Ground",
    short: "WX",
    kindKey: "GROUND",
    sourceLabel: "NWS / NEXRAD",
    providerIds: ["mock-weather", "mock-streamer", "nws-weather", "nexrad-radar"],
  },
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

const formatAge = (latencyMs: number): string => {
  if (!Number.isFinite(latencyMs) || latencyMs < 0) {
    return "unknown";
  }
  if (latencyMs < 5000) {
    return "just now";
  }
  if (latencyMs < 60_000) {
    return `${Math.floor(latencyMs / 1000)}s ago`;
  }
  if (latencyMs < 3_600_000) {
    return `${Math.floor(latencyMs / 60_000)}m ago`;
  }
  return `${Math.floor(latencyMs / 3_600_000)}h ago`;
};

const isProviderStale = (freshness: string): boolean =>
  freshness === "FRESHNESS_STALE" || freshness === "FRESHNESS_CRITICAL";

const layerFreshnessMicrocopy = (freshness: string, latencyMs: number): string => {
  const age = formatAge(latencyMs);
  if (isProviderStale(freshness)) {
    return `stale (${age})`;
  }
  if (freshness === "FRESHNESS_AGING") {
    return `aging (${age})`;
  }
  return age;
};

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
  const trailsEnabled = useStore((state) => state.trailsEnabled);
  const setTrailsEnabled = useStore((state) => state.setTrailsEnabled);
  const headingVectorsEnabled = useStore((state) => state.headingVectorsEnabled);
  const setHeadingVectorsEnabled = useStore((state) => state.setHeadingVectorsEnabled);

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
    <div className="hud-overlay" data-vision={visionMode}>
      <div className={clsx("hud-panel hud-panel-primary", styles.topBar)}>
        <div className={styles.logoWrap}>
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
          <div className={clsx(styles.statusChip, isLive ? styles.liveChip : styles.playbackChip)}>
            <span className={isLive ? styles.liveDot : styles.playbackDot} />
            <span>{isLive ? "LIVE" : "PLAYBACK"}</span>
          </div>
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
              {LAYER_OPTIONS.map((layer) => {
                const active = layers.includes(layer.id);
                const provider =
                  layer.providerIds
                    .map((providerId) => providerStatus[providerId])
                    .find((entry) => Boolean(entry)) ?? null;
                const source = provider?.providerId ?? layer.sourceLabel;
                const freshness = provider
                  ? layerFreshnessMicrocopy(provider.freshness, provider.latencyMs)
                  : "loading...";
                const stale = provider ? isProviderStale(provider.freshness) : false;
                const count = layer.kindKey ? dataPlaneStats.renderedByKind[layer.kindKey] ?? 0 : "--";
                return (
                  <button
                    key={layer.id}
                    className={clsx("hud-button", styles.layerButton, {
                      [styles.activeLayer]: active,
                      [styles.layerStale]: stale,
                    })}
                    onClick={() => toggleLayer(layer.id)}
                    data-testid={`layer-${layer.id}`}
                    aria-pressed={active}
                  >
                    <div className={styles.layerMetaWrap}>
                      <div className={styles.layerMainRow}>
                        <span>{layer.label}</span>
                        <span className={styles.layerCount}>{count}</span>
                      </div>
                      <span className={styles.layerSubline}>
                        {layer.short} · {source} · {freshness}
                      </span>
                    </div>
                    <span
                      className={clsx(styles.layerToggle, {
                        [styles.layerToggleOn]: active,
                        [styles.layerToggleOff]: !active,
                      })}
                    >
                      {active ? "ON" : "OFF"}
                    </span>
                  </button>
                );
              })}
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
              <Route size={14} />
              <span>Overlays</span>
            </div>
            <div className={styles.layerList}>
              <button
                className={clsx("hud-button", styles.layerButton, {
                  [styles.activeLayer]: trailsEnabled,
                })}
                onClick={() => setTrailsEnabled(!trailsEnabled)}
              >
                <span>Trails</span>
              </button>
              <button
                className={clsx("hud-button", styles.layerButton, {
                  [styles.activeLayer]: headingVectorsEnabled,
                })}
                onClick={() => setHeadingVectorsEnabled(!headingVectorsEnabled)}
              >
                <span>Heading Vectors</span>
              </button>
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
            <div className={styles.filterLabel}>Camera Presets</div>
            <div className={styles.pillRow}>
              {[
                { label: "DC", lat: 38.9072, lon: -77.0369, alt: 250_000 },
                { label: "SF", lat: 37.7749, lon: -122.4194, alt: 250_000 },
                { label: "PTY", lat: 8.9824, lon: -79.5199, alt: 250_000 },
                { label: "LON", lat: 51.5074, lon: -0.1278, alt: 250_000 },
                { label: "TYO", lat: 35.6762, lon: 139.6503, alt: 250_000 },
                { label: "GLB", lat: 20, lon: 0, alt: 18_000_000 },
              ].map((preset) => (
                <button
                  key={preset.label}
                  className={clsx("hud-button", styles.pillButton)}
                  onClick={() =>
                    setRequestedCameraPose({
                      lat: preset.lat,
                      lon: preset.lon,
                      alt: preset.alt,
                      heading: 0,
                      pitch: -Math.PI / 2,
                      roll: 0,
                    })
                  }
                >
                  {preset.label}
                </button>
              ))}
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
          <div className={clsx("hud-panel hud-panel-tertiary", styles.dataLinkPanel)}>
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
