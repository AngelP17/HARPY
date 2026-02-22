import { create } from "zustand";

export type VisionMode = "NORMAL" | "EO" | "CRT" | "NVG" | "FLIR";
export type AltitudeBand = "ALL" | "LOW" | "MID" | "HIGH" | "SPACE";
export type SpeedBand = "ALL" | "STATIC" | "SLOW" | "FAST" | "HYPER";

export interface ProviderHealth {
  providerId: string;
  circuitState: string;
  freshness: string;
  latencyMs: number;
  lastSuccessTsMs?: number;
  failureCount?: number;
}

export interface DataPlaneStats {
  wsRttMs: number | null;
  throughputTps: number;
  lastBatchSize: number;
  alertsPerSec: number;
  lastMessageTsMs: number | null;
  renderedTrackCount: number;
  renderedByKind: Record<string, number>;
  relayBackpressureDropped: number;
  relayBackpressureSent: number;
  relayBackpressureHighPriority: number;
  relayConnectedClients: number;
  relayPlaybackClients: number;
  providerFreshnessCounts: Record<string, number>;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: string;
  tsMs: number;
  evidenceLinkIds: string[];
}

export interface EvidenceLink {
  id: string;
  fromType: string;
  fromId: string;
  rel: string;
  toType: string;
  toId: string;
  tsMs: number;
}

export interface SelectedTrack {
  id: string;
  providerId: string;
  kind: number;
  lat: number;
  lon: number;
  alt: number;
  heading: number;
  speed: number;
  tsMs: number;
}

export interface SeekMeta {
  loading: boolean;
  estimatedDeltas: number;
  snapshotId: string | null;
  error: string | null;
  updatedAtMs: number | null;
}

export interface CameraPose {
  lat: number;
  lon: number;
  alt: number;
  heading: number;
  pitch: number;
  roll: number;
}

export interface CommandFeedback {
  id: number;
  title: string;
  detail: string;
  severity: "INFO" | "SUCCESS" | "ERROR";
  atMs: number;
}

const E2E_SEED_ENABLED = process.env.NEXT_PUBLIC_E2E_SEED === "true";
const DEMO_MODE_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
const E2E_SEED_TS_MS = 1_771_625_797_000;

const SEEDED_ALERT: Alert = {
  id: "e2e-alert-1",
  title: "E2E Alert: Converging Tracks",
  description: "Synthetic alert for evidence-chain interaction testing.",
  severity: "ALERT_SEVERITY_WARNING",
  tsMs: E2E_SEED_TS_MS,
  evidenceLinkIds: ["e2e-link-1"],
};

const SEEDED_LINK: EvidenceLink = {
  id: "e2e-link-1",
  fromType: "NODE_TYPE_TRACK",
  fromId: "e2e-track-1",
  rel: "observed_by",
  toType: "NODE_TYPE_SENSOR",
  toId: "e2e-sensor-1",
  tsMs: E2E_SEED_TS_MS,
};

interface AppState {
  visionMode: VisionMode;
  setVisionMode: (mode: VisionMode) => void;
  layers: string[];
  toggleLayer: (layer: string) => void;
  setLayers: (layers: string[]) => void;
  altitudeBand: AltitudeBand;
  setAltitudeBand: (band: AltitudeBand) => void;
  speedBand: SpeedBand;
  setSpeedBand: (band: SpeedBand) => void;
  connectionStatus: "CONNECTED" | "DISCONNECTED" | "CONNECTING";
  setConnectionStatus: (status: "CONNECTED" | "DISCONNECTED" | "CONNECTING") => void;
  providerStatus: Record<string, ProviderHealth>;
  updateProviderStatus: (status: ProviderHealth) => void;
  dataPlaneStats: DataPlaneStats;
  setWsRttMs: (rttMs: number | null) => void;
  setThroughputStats: (throughputTps: number, lastBatchSize: number) => void;
  setAlertsPerSec: (alertsPerSec: number) => void;
  setLastMessageTsMs: (tsMs: number | null) => void;
  setRenderedTrackStats: (renderedTrackCount: number, renderedByKind: Record<string, number>) => void;
  setRelayDebugStats: (stats: {
    dropped: number;
    sent: number;
    highPriority: number;
    connectedClients: number;
    playbackClients: number;
    providerFreshnessCounts: Record<string, number>;
  }) => void;
  
  // DVR State
  isLive: boolean;
  setIsLive: (isLive: boolean) => void;
  isPlaying: boolean;
  setIsPlaying: (isPlaying: boolean) => void;
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
  currentTimeMs: number;
  setCurrentTimeMs: (time: number) => void;

  // Alert State
  alerts: Alert[];
  addAlert: (alert: Alert) => void;
  selectedAlertId: string | null;
  setSelectedAlertId: (id: string | null) => void;
  linksById: Record<string, EvidenceLink>;
  upsertLink: (link: EvidenceLink) => void;

  // Overlay State
  trailsEnabled: boolean;
  setTrailsEnabled: (enabled: boolean) => void;
  headingVectorsEnabled: boolean;
  setHeadingVectorsEnabled: (enabled: boolean) => void;
  trailDurationSec: number;
  setTrailDurationSec: (sec: number) => void;

  // Selected Track State
  selectedTrack: SelectedTrack | null;
  setSelectedTrack: (track: SelectedTrack | null) => void;
  focusTrackId: string | null;
  setFocusTrackId: (trackId: string | null) => void;
  cameraFollowTrackId: string | null;
  setCameraFollowTrackId: (id: string | null) => void;

  // Highlight State (graph query / alert evidence multi-highlight)
  highlightedTrackIds: Set<string>;
  setHighlightedTrackIds: (ids: Set<string>) => void;

  // Stale Provider State
  staleProviderIds: Set<string>;
  setStaleProviderIds: (ids: Set<string>) => void;

  // Graph Query State
  showGraphQuery: boolean;
  setShowGraphQuery: (show: boolean) => void;

  // Command Palette State
  showCommandPalette: boolean;
  setShowCommandPalette: (show: boolean) => void;

  // Export State
  showExport: boolean;
  setShowExport: (show: boolean) => void;

  // Auth/Role State (Mock)
  userRole: "OPERATOR" | "ADMIN" | "VIEWER";
  setUserRole: (role: "OPERATOR" | "ADMIN" | "VIEWER") => void;
  seekMeta: SeekMeta;
  setSeekMeta: (seekMeta: SeekMeta) => void;
  cameraPose: CameraPose | null;
  setCameraPose: (pose: CameraPose | null) => void;
  requestedCameraPose: CameraPose | null;
  setRequestedCameraPose: (pose: CameraPose | null) => void;
  commandFeedback: CommandFeedback | null;
  setCommandFeedback: (feedback: CommandFeedback | null) => void;
}

export const useStore = create<AppState>((set) => ({
  visionMode: "NORMAL",
  setVisionMode: (mode) => set({ visionMode: mode }),
  layers: ["ADSB", "TLE_SAT", "SENS_CV", "WX_RADAR"],
  toggleLayer: (layer) =>
    set((state) => ({
      layers: state.layers.includes(layer)
        ? state.layers.filter((l) => l !== layer)
        : [...state.layers, layer],
    })),
  setLayers: (layers) => set({ layers }),
  altitudeBand: "ALL",
  setAltitudeBand: (altitudeBand) => set({ altitudeBand }),
  speedBand: "ALL",
  setSpeedBand: (speedBand) => set({ speedBand }),
  connectionStatus: "DISCONNECTED",
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  providerStatus: {},
  updateProviderStatus: (status) =>
    set((state) => {
      const nextStale = new Set(state.staleProviderIds);
      if (status.freshness === "FRESHNESS_CRITICAL" || status.freshness === "FRESHNESS_STALE") {
        nextStale.add(status.providerId);
      } else {
        nextStale.delete(status.providerId);
      }
      return {
        providerStatus: { ...state.providerStatus, [status.providerId]: status },
        staleProviderIds: nextStale,
      };
    }),
  dataPlaneStats: {
    wsRttMs: null,
    throughputTps: E2E_SEED_ENABLED ? 84 : 0,
    lastBatchSize: 0,
    alertsPerSec: 0,
    lastMessageTsMs: E2E_SEED_ENABLED ? E2E_SEED_TS_MS : null,
    renderedTrackCount: E2E_SEED_ENABLED ? 6123 : 0,
    renderedByKind: E2E_SEED_ENABLED
      ? {
          AIRCRAFT: 6000,
          SATELLITE: 180,
          GROUND: 54,
        }
      : ({} as Record<string, number>),
    relayBackpressureDropped: 0,
    relayBackpressureSent: 0,
    relayBackpressureHighPriority: 0,
    relayConnectedClients: 0,
    relayPlaybackClients: 0,
    providerFreshnessCounts: {},
  },
  setWsRttMs: (rttMs) =>
    set((state) => ({
      dataPlaneStats: {
        ...state.dataPlaneStats,
        wsRttMs: rttMs,
      },
    })),
  setThroughputStats: (throughputTps, lastBatchSize) =>
    set((state) => ({
      dataPlaneStats: {
        ...state.dataPlaneStats,
        throughputTps,
        lastBatchSize,
      },
    })),
  setAlertsPerSec: (alertsPerSec) =>
    set((state) => ({
      dataPlaneStats: {
        ...state.dataPlaneStats,
        alertsPerSec,
      },
    })),
  setLastMessageTsMs: (tsMs) =>
    set((state) => ({
      dataPlaneStats: {
        ...state.dataPlaneStats,
        lastMessageTsMs: tsMs,
      },
    })),
  setRenderedTrackStats: (renderedTrackCount, renderedByKind) =>
    set((state) => ({
      dataPlaneStats: {
        ...state.dataPlaneStats,
        renderedTrackCount,
        renderedByKind,
      },
    })),
  setRelayDebugStats: (stats) =>
    set((state) => ({
      dataPlaneStats: {
        ...state.dataPlaneStats,
        relayBackpressureDropped: stats.dropped,
        relayBackpressureSent: stats.sent,
        relayBackpressureHighPriority: stats.highPriority,
        relayConnectedClients: stats.connectedClients,
        relayPlaybackClients: stats.playbackClients,
        providerFreshnessCounts: stats.providerFreshnessCounts,
      },
    })),
  
  // DVR Defaults
  isLive: true,
  setIsLive: (isLive) => set({ isLive }),
  isPlaying: true,
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  playbackRate: 1,
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  // Keep SSR/CSR deterministic; initialize on client after mount.
  currentTimeMs: 0,
  setCurrentTimeMs: (time) => set({ currentTimeMs: time }),

  // Alert Defaults
  alerts: E2E_SEED_ENABLED ? [SEEDED_ALERT] : [],
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 50) })),
  selectedAlertId: null,
  setSelectedAlertId: (id) => set({ selectedAlertId: id }),
  linksById: E2E_SEED_ENABLED ? { [SEEDED_LINK.id]: SEEDED_LINK } : {},
  upsertLink: (link) =>
    set((state) => ({
      linksById: {
        ...state.linksById,
        [link.id]: link,
      },
    })),
  // Overlay defaults
  trailsEnabled: DEMO_MODE_ENABLED,
  setTrailsEnabled: (enabled) => set({ trailsEnabled: enabled }),
  headingVectorsEnabled: DEMO_MODE_ENABLED,
  setHeadingVectorsEnabled: (enabled) => set({ headingVectorsEnabled: enabled }),
  trailDurationSec: DEMO_MODE_ENABLED ? 90 : 120,
  setTrailDurationSec: (sec) => set({ trailDurationSec: sec }),

  selectedTrack: null,
  setSelectedTrack: (track) => set({ selectedTrack: track }),
  focusTrackId: null,
  setFocusTrackId: (trackId) => set({ focusTrackId: trackId }),
  cameraFollowTrackId: null,
  setCameraFollowTrackId: (id) => set({ cameraFollowTrackId: id }),

  // Highlight defaults
  highlightedTrackIds: new Set<string>(),
  setHighlightedTrackIds: (ids) => set({ highlightedTrackIds: ids }),

  // Stale provider defaults
  staleProviderIds: new Set<string>(),
  setStaleProviderIds: (ids) => set({ staleProviderIds: ids }),

  // Graph Defaults
  showGraphQuery: false,
  setShowGraphQuery: (show) => set({ showGraphQuery: show }),

  // Command Palette Defaults
  showCommandPalette: false,
  setShowCommandPalette: (show) => set({ showCommandPalette: show }),

  // Export Defaults
  showExport: false,
  setShowExport: (show) => set({ showExport: show }),

  // Auth Defaults
  userRole: "OPERATOR",
  setUserRole: (role) => set({ userRole: role }),

  seekMeta: {
    loading: false,
    estimatedDeltas: 0,
    snapshotId: null,
    error: null,
    updatedAtMs: null,
  },
  setSeekMeta: (seekMeta) => set({ seekMeta }),
  cameraPose: null,
  setCameraPose: (pose) => set({ cameraPose: pose }),
  requestedCameraPose: null,
  setRequestedCameraPose: (pose) => set({ requestedCameraPose: pose }),
  commandFeedback: null,
  setCommandFeedback: (feedback) => set({ commandFeedback: feedback }),
}));
