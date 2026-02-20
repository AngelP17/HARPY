import { create } from "zustand";

export type VisionMode = "NORMAL" | "EO" | "CRT" | "NVG" | "FLIR";

export interface ProviderHealth {
  providerId: string;
  circuitState: string;
  freshness: string;
  latencyMs: number;
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

interface AppState {
  visionMode: VisionMode;
  setVisionMode: (mode: VisionMode) => void;
  layers: string[];
  toggleLayer: (layer: string) => void;
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

  // Selected Track State
  selectedTrack: SelectedTrack | null;
  setSelectedTrack: (track: SelectedTrack | null) => void;
  focusTrackId: string | null;
  setFocusTrackId: (trackId: string | null) => void;

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
}

export const useStore = create<AppState>((set) => ({
  visionMode: "NORMAL",
  setVisionMode: (mode) => set({ visionMode: mode }),
  layers: ["ADSB"],
  toggleLayer: (layer) =>
    set((state) => ({
      layers: state.layers.includes(layer)
        ? state.layers.filter((l) => l !== layer)
        : [...state.layers, layer],
    })),
  connectionStatus: "DISCONNECTED",
  setConnectionStatus: (status) => set({ connectionStatus: status }),
  providerStatus: {},
  updateProviderStatus: (status) =>
    set((state) => ({
      providerStatus: {
        ...state.providerStatus,
        [status.providerId]: status,
      },
    })),
  dataPlaneStats: {
    wsRttMs: null,
    throughputTps: 0,
    lastBatchSize: 0,
    alertsPerSec: 0,
    lastMessageTsMs: null,
    renderedTrackCount: 0,
    renderedByKind: {},
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
  alerts: [],
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 50) })),
  selectedAlertId: null,
  setSelectedAlertId: (id) => set({ selectedAlertId: id }),
  linksById: {},
  upsertLink: (link) =>
    set((state) => ({
      linksById: {
        ...state.linksById,
        [link.id]: link,
      },
    })),
  selectedTrack: null,
  setSelectedTrack: (track) => set({ selectedTrack: track }),
  focusTrackId: null,
  setFocusTrackId: (trackId) => set({ focusTrackId: trackId }),

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
}));
