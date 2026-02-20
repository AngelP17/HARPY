import { create } from "zustand";

export type VisionMode = "NORMAL" | "EO" | "CRT" | "NVG" | "FLIR";

export interface ProviderHealth {
  providerId: string;
  circuitState: string;
  freshness: string;
  latencyMs: number;
}

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: string;
  tsMs: number;
  evidenceLinkIds: string[];
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
  
  // DVR Defaults
  isLive: true,
  setIsLive: (isLive) => set({ isLive }),
  isPlaying: true,
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  playbackRate: 1,
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  currentTimeMs: Date.now(),
  setCurrentTimeMs: (time) => set({ currentTimeMs: time }),

  // Alert Defaults
  alerts: [],
  addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts].slice(0, 50) })),
  selectedAlertId: null,
  setSelectedAlertId: (id) => set({ selectedAlertId: id }),

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
}));
