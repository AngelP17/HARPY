// Mirrors services/harpy-core/src/model.rs and export.rs (contract harpy.observation/1).

export type ObservationType = "measured" | "calculated" | "inferred" | "asserted";

export interface RevisionSummary {
  revision: number;
  ingested_at: number;
  source_updated_at: number | null;
  raw_payload_digest: string;
}

export interface Observation<A = Record<string, unknown>> {
  observation_id: string;
  revision: number;
  observation_type: ObservationType;
  kind: string;
  source_id: string;
  upstream_id: string | null;
  observed_at: number;
  source_updated_at: number | null;
  ingested_at: number;
  geometry: { type: "Point"; coordinates: number[] } | null;
  uncertainty: unknown;
  evidence_refs: string[];
  model_version: string | null;
  license_class: string;
  source_url: string | null;
  raw_payload_digest: string;
  attributes: A;
  history?: RevisionSummary[];
}

export interface EarthquakeAttrs {
  mag: number | null;
  mag_type: string | null;
  place: string | null;
  title: string | null;
  event_type: string | null;
  review_status: string | null;
  tsunami_flag: number | null;
  significance: number | null;
  pager_alert: string | null;
  felt_reports: number | null;
  network: string | null;
  depth_km: number | null;
  station_count: number | null;
  azimuthal_gap_deg: number | null;
  rms_s: number | null;
}

export interface OmmRecord {
  OBJECT_NAME?: string;
  OBJECT_ID?: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  NORAD_CAT_ID: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
  [k: string]: unknown;
}

export interface ElementAttrs {
  name: string | null;
  intl_designator: string | null;
  norad_id: number;
  group: string;
  data_product: string;
  period_min: number;
  inclination_deg: number;
  eccentricity: number;
  apogee_km: number;
  perigee_km: number;
  omm: OmmRecord;
}

export type Earthquake = Observation<EarthquakeAttrs>;
export type ElementSet = Observation<ElementAttrs>;

export type ProviderState = "HEALTHY" | "DEGRADED" | "UNAVAILABLE" | "NEVER_RUN";

export interface EndpointStatus {
  endpoint: string;
  ok: boolean;
  last_attempt_at: number;
  last_success_at: number | null;
  consecutive_failures: number;
  last_error: string | null;
  records_seen: number;
  records_invalid: number;
}

export interface ProviderStatus {
  source_id: string;
  display_name: string;
  layer: "earthquakes" | "satellites";
  license_class: string;
  attribution: string;
  terms_url: string;
  state: ProviderState;
  last_attempt_at: number | null;
  last_success_at: number | null;
  consecutive_failures: number;
  last_error: string | null;
  endpoints: EndpointStatus[];
}

interface Range {
  from: number;
  to: number;
}

export interface Meta {
  contract_version: string;
  schema_version: string;
  generated_at: number;
  commit: string | null;
  deployment: {
    mode: "static-archive" | "live-server";
    refresh_interval_s: number;
    stale_after_s: number;
    retention_days: number;
  };
  rules: { elements_max_offset_s: number; live_requires_fresh_archive: boolean };
  history: {
    earthquakes_observed: Range | null;
    earthquakes_recorded: Range | null;
    elements_epochs: Range | null;
    elements_recorded: Range | null;
  };
  counts: { earthquakes: number; earthquake_revisions: number; satellites: number; element_revisions: number };
}

export interface ProvidersDoc {
  generated_at: number;
  providers: ProviderStatus[];
}

export interface EarthquakeIndex {
  generated_at: number;
  days: { date: string; count: number; path: string }[];
  hourly: { hour_start: number; count: number; max_mag: number }[];
}

export interface DayDoc<T> {
  generated_at: number;
  date: string;
  observations: T[];
}

export interface SatelliteIndex {
  generated_at: number;
  days: { date: string; path: string }[];
}

export interface FetchLogEntry {
  source_id: string;
  endpoint: string;
  started_at: number;
  finished_at: number;
  http_status: number | null;
  ok: boolean;
  records_seen: number;
  records_new: number;
  records_revised: number;
  records_unchanged: number;
  records_invalid: number;
  error: string | null;
}
