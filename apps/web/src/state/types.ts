export type LayerId = "AIR" | "SAT" | "SEISMIC" | "WEATHER";

export type ProviderState = "OK" | "DEGRADED" | "DOWN";
export type Freshness = "FRESH" | "AGING" | "STALE" | "CRITICAL";
export type VisionMode = "EO" | "NVG" | "FLIR";
export type PresetId = "DC" | "SF" | "PTY";
export type TrackKind = "AIR" | "SAT";

export type Track = {
  id: string;
  kind: TrackKind;
  lat: number;
  lon: number;
  alt_m: number;
  heading_deg: number;
  speed_mps: number;
  updated_ms: number;
};

export type ProviderStatus = {
  provider_id: string;
  state: ProviderState;
  freshness: Freshness;
  last_update_ms: number;
  items: number;
  source_label: string;
};

export type ViewportBbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};
