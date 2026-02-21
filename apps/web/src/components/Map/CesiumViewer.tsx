"use client";

import React, { useCallback, useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Source/Widgets/widgets.css";
import { useStore, VisionMode, AltitudeBand, SpeedBand, type SelectedTrack } from "@/store/useStore";
import { MockStreamer } from "@/mocks/mock-streamer";
import { harpy } from "@harpy/shared-types";

// Set Cesium base URL
if (typeof window !== "undefined") {
  (window as typeof window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL = "/cesium";
}

interface CesiumViewerProps {
  ionToken?: string;
}

interface RenderPayloadMessage {
  type: "RENDER_PAYLOAD";
  positions: ArrayBuffer;
  headings: ArrayBuffer;
  speeds: ArrayBuffer;
  kinds: ArrayBuffer;
  colors: ArrayBuffer;
  clusterCounts: ArrayBuffer;
  ids: string[];
  providerIds: string[];
  labels: string[];
  count: number;
}

interface DecodedProviderStatusMessage {
  type: "PROVIDER_STATUS";
  status: {
    providerId: string;
    circuitState: string;
    freshness: string;
    latencyMs: number;
  };
}

interface DecodedAlertUpsertMessage {
  type: "ALERT_UPSERT";
  alert: {
    id: string;
    title: string;
    description: string;
    severity: string;
    tsMs: number;
    evidenceLinkIds: string[];
  };
}

interface DecodedTrackBatchStatsMessage {
  type: "TRACK_BATCH_STATS";
  count: number;
}

interface DecodedSubscriptionAckMessage {
  type: "SUBSCRIPTION_ACK";
}

interface DecodedLinkUpsertMessage {
  type: "LINK_UPSERT";
  link: {
    id: string;
    fromType: string;
    fromId: string;
    rel: string;
    toType: string;
    toId: string;
    tsMs: number;
  };
}

interface RelayDebugSnapshotResponse {
  relay?: {
    connected_clients?: number;
    playback_clients?: number;
    backpressure_totals?: {
      track_batches_dropped?: number;
      track_batches_sent?: number;
      high_priority_sent?: number;
    };
  };
  redis?: {
    providers?: Array<{
      freshness?: string;
    }>;
  };
}

type StreamMode = "online" | "offline" | "hybrid";

interface PositionSample {
  lat: number;
  lon: number;
  alt: number;
  tsMs: number;
}

const resolveStreamMode = (): StreamMode => {
  const raw = (process.env.NEXT_PUBLIC_STREAM_MODE || "hybrid").toLowerCase();
  if (raw === "online" || raw === "offline" || raw === "hybrid") {
    return raw;
  }
  return "hybrid";
};

const resolveRelayDebugSnapshotUrl = (): string => {
  const envUrl = process.env.NEXT_PUBLIC_RELAY_DEBUG_SNAPSHOT_URL;
  if (envUrl) {
    return envUrl;
  }
  return "/api/relay/debug/snapshot";
};

const isProviderStatusMessage = (data: unknown): data is DecodedProviderStatusMessage => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const message = data as { type?: string; status?: unknown };
  return message.type === "PROVIDER_STATUS" && typeof message.status === "object" && message.status !== null;
};

const isAlertUpsertMessage = (data: unknown): data is DecodedAlertUpsertMessage => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const message = data as { type?: string; alert?: unknown };
  return message.type === "ALERT_UPSERT" && typeof message.alert === "object" && message.alert !== null;
};

const isTrackBatchStatsMessage = (data: unknown): data is DecodedTrackBatchStatsMessage => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const message = data as { type?: string; count?: unknown };
  return message.type === "TRACK_BATCH_STATS" && typeof message.count === "number";
};

const isSubscriptionAckMessage = (data: unknown): data is DecodedSubscriptionAckMessage => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const message = data as { type?: string };
  return message.type === "SUBSCRIPTION_ACK";
};

const isLinkUpsertMessage = (data: unknown): data is DecodedLinkUpsertMessage => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const message = data as { type?: string; link?: unknown };
  return message.type === "LINK_UPSERT" && typeof message.link === "object" && message.link !== null;
};

const mapUiLayersToProto = (activeLayers: string[]): number[] => {
  const mapped = new Set<number>();
  for (const layer of activeLayers) {
    if (layer === "ADSB") {
      mapped.add(harpy.v1.LayerType.LAYER_TYPE_AIRCRAFT);
    } else if (layer === "TLE_SAT") {
      mapped.add(harpy.v1.LayerType.LAYER_TYPE_SATELLITE);
    } else if (layer === "SENS_CV") {
      mapped.add(harpy.v1.LayerType.LAYER_TYPE_DETECTION);
      mapped.add(harpy.v1.LayerType.LAYER_TYPE_CAMERA);
    } else if (layer === "WX_RADAR") {
      mapped.add(harpy.v1.LayerType.LAYER_TYPE_GROUND);
    }
  }
  if (mapped.size === 0) {
    mapped.add(harpy.v1.LayerType.LAYER_TYPE_AIRCRAFT);
    mapped.add(harpy.v1.LayerType.LAYER_TYPE_SATELLITE);
  }
  return Array.from(mapped);
};

const mapUiLayersToTrackKinds = (activeLayers: string[]): number[] => {
  const kinds = new Set<number>();
  for (const layer of activeLayers) {
    if (layer === "ADSB") {
      kinds.add(harpy.v1.TrackKind.TRACK_KIND_AIRCRAFT);
    } else if (layer === "TLE_SAT") {
      kinds.add(harpy.v1.TrackKind.TRACK_KIND_SATELLITE);
    } else if (layer === "SENS_CV" || layer === "WX_RADAR") {
      kinds.add(harpy.v1.TrackKind.TRACK_KIND_GROUND);
    }
  }
  if (kinds.size === 0) {
    kinds.add(harpy.v1.TrackKind.TRACK_KIND_AIRCRAFT);
    kinds.add(harpy.v1.TrackKind.TRACK_KIND_SATELLITE);
  }
  return Array.from(kinds);
};

const mapAltitudeBandToRange = (band: AltitudeBand): { minAltM: number; maxAltM: number } => {
  if (band === "LOW") {
    return { minAltM: -200, maxAltM: 3_500 };
  }
  if (band === "MID") {
    return { minAltM: 3_500, maxAltM: 16_000 };
  }
  if (band === "HIGH") {
    return { minAltM: 16_000, maxAltM: 120_000 };
  }
  if (band === "SPACE") {
    return { minAltM: 120_000, maxAltM: 2_000_000 };
  }
  return { minAltM: -200, maxAltM: 2_000_000 };
};

const mapSpeedBandToRange = (band: SpeedBand): { minSpeedMs: number; maxSpeedMs: number } => {
  if (band === "STATIC") {
    return { minSpeedMs: 0, maxSpeedMs: 2 };
  }
  if (band === "SLOW") {
    return { minSpeedMs: 2, maxSpeedMs: 90 };
  }
  if (band === "FAST") {
    return { minSpeedMs: 90, maxSpeedMs: 600 };
  }
  if (band === "HYPER") {
    return { minSpeedMs: 600, maxSpeedMs: 30_000 };
  }
  return { minSpeedMs: 0, maxSpeedMs: 30_000 };
};

const worldViewport = (): harpy.v1.IBoundingBox => ({
  minLat: -90,
  minLon: -180,
  maxLat: 90,
  maxLon: 180,
});

const CesiumViewer: React.FC<CesiumViewerProps> = ({ ionToken }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<Cesium.Viewer | null>(null);
  const trackPrimitives = useRef<Cesium.PointPrimitiveCollection | null>(null);
  const trackLabels = useRef<Cesium.LabelCollection | null>(null);
  const trackTrail = useRef<Cesium.PolylineCollection | null>(null);
  const headingVectors = useRef<Cesium.PolylineCollection | null>(null);
  const selectionReticle = useRef<Cesium.PolylineCollection | null>(null);
  const trackLookup = useRef<Map<string, SelectedTrack>>(new Map());
  const trackHistory = useRef<Map<string, PositionSample[]>>(new Map());
  const visionMode = useStore((state) => state.visionMode);
  const setConnectionStatus = useStore((state) => state.setConnectionStatus);
  const updateProviderStatus = useStore((state) => state.updateProviderStatus);
  const setWsRttMs = useStore((state) => state.setWsRttMs);
  const setThroughputStats = useStore((state) => state.setThroughputStats);
  const setAlertsPerSec = useStore((state) => state.setAlertsPerSec);
  const setLastMessageTsMs = useStore((state) => state.setLastMessageTsMs);
  const setRenderedTrackStats = useStore((state) => state.setRenderedTrackStats);
  const setRelayDebugStats = useStore((state) => state.setRelayDebugStats);
  const upsertLink = useStore((state) => state.upsertLink);
  const setCameraPose = useStore((state) => state.setCameraPose);
  const addAlert = useStore((state) => state.addAlert);
  const setSelectedTrack = useStore((state) => state.setSelectedTrack);
  const selectedTrack = useStore((state) => state.selectedTrack);
  const focusTrackId = useStore((state) => state.focusTrackId);
  const setFocusTrackId = useStore((state) => state.setFocusTrackId);
  const layers = useStore((state) => state.layers);
  const altitudeBand = useStore((state) => state.altitudeBand);
  const speedBand = useStore((state) => state.speedBand);
  const requestedCameraPose = useStore((state) => state.requestedCameraPose);
  const setRequestedCameraPose = useStore((state) => state.setRequestedCameraPose);
  const isLive = useStore((state) => state.isLive);
  const isPlaying = useStore((state) => state.isPlaying);
  const currentTimeMs = useStore((state) => state.currentTimeMs);
  const layersRef = useRef<string[]>(layers);
  const isLiveRef = useRef<boolean>(isLive);
  const currentTimeRef = useRef<number>(currentTimeMs);
  const isLivePlaybackAllowedRef = useRef<boolean>(isLive || isPlaying);
  const lastSubscriptionSentAtRef = useRef<number>(0);
  const throughputWindowRef = useRef<Array<{ ts: number; count: number }>>([]);
  const alertWindowRef = useRef<number[]>([]);
  
  // Workers
  const wsDecodeWorker = useRef<Worker | null>(null);
  const trackIndexWorker = useRef<Worker | null>(null);
  const clusterWorker = useRef<Worker | null>(null);
  const packWorker = useRef<Worker | null>(null);
  
  // WebSocket reference
  const socketRef = useRef<WebSocket | null>(null);
  const streamMode = resolveStreamMode();
  const useWebSocket = streamMode !== "offline";
  const useMockStreamer = streamMode !== "online";
  const mockOnlyMode = streamMode === "offline";
  const demoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  useEffect(() => {
    currentTimeRef.current = currentTimeMs;
  }, [currentTimeMs]);

  useEffect(() => {
    isLivePlaybackAllowedRef.current = isLive || isPlaying;
  }, [isLive, isPlaying]);

  const sendSubscription = (socket: WebSocket, activeLayers: string[], liveMode: boolean, endTsMs: number) => {
    const mappedLayers = mapUiLayersToProto(activeLayers);
    const viewer = viewerInstance.current;
    const viewport = (() => {
      if (!viewer) {
        return worldViewport();
      }
      try {
        const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
        if (!rect) {
          return worldViewport();
        }
        return {
          minLat: Cesium.Math.toDegrees(rect.south),
          minLon: Cesium.Math.toDegrees(rect.west),
          maxLat: Cesium.Math.toDegrees(rect.north),
          maxLon: Cesium.Math.toDegrees(rect.east),
        };
      } catch {
        return worldViewport();
      }
    })();

    const timeRange = liveMode
      ? harpy.v1.TimeRange.create({ live: {} })
      : harpy.v1.TimeRange.create({
          playback: {
            startTsMs: Math.max(0, endTsMs - 60 * 60 * 1000),
            endTsMs,
          },
        });

    const request = harpy.v1.SubscriptionRequest.create({
      layers: mappedLayers,
      mode: liveMode
        ? harpy.v1.SubscriptionMode.SUBSCRIPTION_MODE_LIVE
        : harpy.v1.SubscriptionMode.SUBSCRIPTION_MODE_PLAYBACK,
      timeRange,
      viewport,
    });
    const envelope = harpy.v1.Envelope.create({
      schemaVersion: "1.0.0",
      serverTsMs: Date.now(),
      subscriptionRequest: request
    });
    const buffer = harpy.v1.Envelope.encode(envelope).finish();
    lastSubscriptionSentAtRef.current = Date.now();
    socket.send(buffer);
    console.log(
      "[WS] Sent SubscriptionRequest:",
      liveMode ? "LIVE" : "PLAYBACK",
      "layers=",
      mappedLayers,
    );
  };

  const renderBulkTrails = useCallback(() => {
    const trailCollection = trackTrail.current;
    if (!trailCollection) return;
    trailCollection.removeAll();

    const { trailsEnabled, selectedTrack: selTrack, trailDurationSec } = useStore.getState();
    const selectedId = selTrack?.id ?? null;

    // Always render selected track trail (bright, wide)
    if (selectedId) {
      const samples = trackHistory.current.get(selectedId);
      if (samples && samples.length >= 2) {
        trailCollection.add({
          positions: samples.map((s) => Cesium.Cartesian3.fromDegrees(s.lon, s.lat, s.alt)),
          width: 3,
          material: Cesium.Material.fromType("Color", {
            color: new Cesium.Color(0.49, 0.89, 1.0, 0.95),
          }),
        });
      }
    }

    if (!trailsEnabled) return;

    const viewer = viewerInstance.current;
    if (!viewer) return;
    const cameraHeight = viewer.camera.positionCartographic.height;
    if (cameraHeight > 3_000_000) return; // No bulk trails at global zoom

    const maxTrails = cameraHeight > 700_000 ? 500 : 2000;
    const maxSamplesPerTrail = cameraHeight > 700_000 ? 5 : 15;
    const now = Date.now();
    const cutoffMs = now - trailDurationSec * 1000;
    let trailCount = 0;

    for (const [trackId, samples] of trackHistory.current) {
      if (trailCount >= maxTrails) break;
      if (trackId === selectedId) continue;
      if (samples.length < 2) continue;

      const recentSamples = samples.filter((s) => s.tsMs >= cutoffMs).slice(-maxSamplesPerTrail);
      if (recentSamples.length < 2) continue;

      const ageFraction = Math.max(0.15,
        1.0 - (now - recentSamples[recentSamples.length - 1].tsMs) / (trailDurationSec * 1000));

      trailCollection.add({
        positions: recentSamples.map((s) => Cesium.Cartesian3.fromDegrees(s.lon, s.lat, s.alt)),
        width: 1.5,
        material: Cesium.Material.fromType("Color", {
          color: new Cesium.Color(0.4, 0.75, 0.9, ageFraction * 0.45),
        }),
      });
      trailCount++;
    }
  }, []);

  const updatePrimitives = useCallback((payload: RenderPayloadMessage) => {
    const { positions, headings, speeds, kinds, colors, clusterCounts, ids, providerIds, labels, count } = payload;
    const posArray = new Float64Array(positions);
    const headingArray = new Float32Array(headings);
    const speedArray = new Float32Array(speeds);
    const kindArray = new Uint8Array(kinds);
    const colorArray = new Uint32Array(colors);
    const clusterCountArray = new Uint16Array(clusterCounts);

    const points = trackPrimitives.current;
    const labelsCollection = trackLabels.current;
    if (!points || !labelsCollection) {
      return;
    }

    const nextTrackLookup = new Map<string, SelectedTrack>();
    const kindCounts: Record<string, number> = {
      AIRCRAFT: 0,
      SATELLITE: 0,
      GROUND: 0,
      VESSEL: 0,
      UNKNOWN: 0,
    };

    points.removeAll();
    labelsCollection.removeAll();
    headingVectors.current?.removeAll();
    const now = Date.now();

    // Read store state once for the entire batch
    const storeState = useStore.getState();
    const staleProviders = storeState.staleProviderIds;
    const highlightedIds = storeState.highlightedTrackIds;
    const showHeadingVectors = storeState.headingVectorsEnabled;
    const trailDurationSec = storeState.trailDurationSec;
    const maxHistorySamples = Math.min(60, Math.ceil(trailDurationSec / 4));

    // LOD: determine camera height for heading vector gating
    const cameraHeight = viewerInstance.current?.camera.positionCartographic.height ?? 20_000_000;
    const renderHeadingVectors = showHeadingVectors && cameraHeight < 1_500_000;

    for (let i = 0; i < count; i += 1) {
      const lat = posArray[i * 3];
      const lon = posArray[i * 3 + 1];
      const alt = posArray[i * 3 + 2];
      const id = ids[i];
      if (!id) {
        continue;
      }
      const providerId = providerIds[i] ?? "unknown";
      const kind = kindArray[i] ?? 0;
      const heading = headingArray[i] ?? 0;
      const speed = speedArray[i] ?? 0;
      const clusterCount = Math.max(1, clusterCountArray[i] ?? 1);
      const isCluster = clusterCount > 1 || id.startsWith("cluster:");
      const pointPosition = Cesium.Cartesian3.fromDegrees(lon, lat, alt);

      if (kind === 1) {
        kindCounts.AIRCRAFT += clusterCount;
      } else if (kind === 2) {
        kindCounts.SATELLITE += clusterCount;
      } else if (kind === 3) {
        kindCounts.GROUND += clusterCount;
      } else if (kind === 4) {
        kindCounts.VESSEL += clusterCount;
      } else {
        kindCounts.UNKNOWN += clusterCount;
      }

      // Stale + highlight visual modifiers
      const isStale = !isCluster && staleProviders.has(providerId);
      const isHighlighted = !isCluster && highlightedIds.has(id);

      let pixelSize = isCluster ? Math.min(30, 10 + Math.log2(clusterCount + 1) * 4) : 8;
      if (isHighlighted) pixelSize = 14;

      const baseColor = Cesium.Color.fromRgba(colorArray[i]);
      const displayColor = isStale ? baseColor.withAlpha(0.35) : baseColor;

      let outlineColor: Cesium.Color;
      let outlineWidth: number;
      if (isHighlighted) {
        outlineColor = new Cesium.Color(1.0, 0.85, 0.3, 0.95);
        outlineWidth = 4;
      } else if (isStale) {
        outlineColor = new Cesium.Color(1.0, 0.7, 0.4, 0.6);
        outlineWidth = 2;
      } else if (isCluster) {
        outlineColor = Cesium.Color.WHITE.withAlpha(0.9);
        outlineWidth = 3;
      } else {
        outlineColor = Cesium.Color.BLACK.withAlpha(0.5);
        outlineWidth = 1;
      }

      const primitive = points.add({
        position: pointPosition,
        pixelSize,
        color: displayColor,
        outlineColor,
        outlineWidth,
        scaleByDistance: new Cesium.NearFarScalar(1.5e2, 2.2, 1.5e7, 0.35),
      });
      primitive.id = id;

      if (isCluster) {
        labelsCollection.add({
          position: pointPosition,
          text: labels[i] || `${clusterCount}`,
          font: "600 12px sans-serif",
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK.withAlpha(0.88),
          outlineWidth: 3,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new Cesium.Cartesian2(0, -20),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(200.0, 1.0, 30_000_000.0, 0.55),
          translucencyByDistance: new Cesium.NearFarScalar(200.0, 1.0, 20_000_000.0, 0.12),
        });
      }

      if (!isCluster) {
        nextTrackLookup.set(id, {
          id,
          providerId,
          kind,
          lat,
          lon,
          alt,
          heading,
          speed,
          tsMs: now,
        });

        // Expanded track history for bulk trails
        const existingHistory = trackHistory.current.get(id) ?? [];
        const previousSample = existingHistory[existingHistory.length - 1];
        const shouldAppend =
          !previousSample
          || Math.abs(previousSample.lat - lat) > 0.0001
          || Math.abs(previousSample.lon - lon) > 0.0001
          || (now - (previousSample.tsMs || 0)) > 4000;
        if (shouldAppend) {
          const nextHistory = [...existingHistory, { lat, lon, alt, tsMs: now }].slice(-maxHistorySamples);
          trackHistory.current.set(id, nextHistory);
        }

        // Heading vector: short polyline from track position in heading direction
        if (renderHeadingVectors && speed > 2) {
          const headingRad = (heading * Math.PI) / 180;
          const vectorLengthDeg = 0.015 + (speed / 300) * 0.035;
          const endLat = lat + Math.cos(headingRad) * vectorLengthDeg;
          const endLon = lon + Math.sin(headingRad) * vectorLengthDeg;
          headingVectors.current?.add({
            positions: [
              pointPosition,
              Cesium.Cartesian3.fromDegrees(endLon, endLat, alt),
            ],
            width: 1.5,
            material: Cesium.Material.fromType("Color", {
              color: displayColor.withAlpha(0.6),
            }),
          });
        }
      }
    }

    for (const id of Array.from(trackHistory.current.keys())) {
      if (!nextTrackLookup.has(id)) {
        trackHistory.current.delete(id);
      }
    }

    trackLookup.current = nextTrackLookup;
    setRenderedTrackStats(Object.values(kindCounts).reduce((sum, value) => sum + value, 0), kindCounts);
    const selected = useStore.getState().selectedTrack;
    if (selected && !nextTrackLookup.has(selected.id)) {
      setSelectedTrack(null);
    }
    renderBulkTrails();
  }, [renderBulkTrails, setRenderedTrackStats, setSelectedTrack]);

  useEffect(() => {
    if (!viewerRef.current || viewerInstance.current) return;

    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken;
    }

    const mapMode = (process.env.NEXT_PUBLIC_MAP_MODE || "").toLowerCase();
    const forceOfflineMap = mapMode === "offline" || mockOnlyMode;
    const osmTileUrl = process.env.NEXT_PUBLIC_OSM_TILE_URL || "/api/tiles/osm/";
    const parsedOsmMaxLevel = Number.parseInt(process.env.NEXT_PUBLIC_OSM_MAX_LEVEL || "19", 10);
    const osmMaximumLevel = Number.isFinite(parsedOsmMaxLevel) ? parsedOsmMaxLevel : 19;
    const viewerOptions: Cesium.Viewer.ConstructorOptions = {
      animation: false,
      baseLayerPicker: false,
      fullscreenButton: false,
      vrButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      navigationInstructionsInitiallyVisible: false,
      scene3DOnly: true,
      shouldAnimate: true,
      skyAtmosphere: new Cesium.SkyAtmosphere(),
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayer: forceOfflineMap
        ? false
        : new Cesium.ImageryLayer(
            new Cesium.OpenStreetMapImageryProvider({
              url: osmTileUrl,
              maximumLevel: osmMaximumLevel,
              credit: "© OpenStreetMap contributors",
            }),
          ),
    };

    // Initialize Viewer
    const viewer = new Cesium.Viewer(viewerRef.current, viewerOptions);
    viewerInstance.current = viewer;
    const initialPose = useStore.getState().cameraPose;
    if (initialPose) {
      viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(initialPose.lon, initialPose.lat, initialPose.alt),
        orientation: {
          heading: initialPose.heading,
          pitch: initialPose.pitch,
          roll: initialPose.roll,
        },
      });
    }

    let disposed = false;
    if (forceOfflineMap) {
      void Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
      )
        .then((provider) => {
          if (disposed || !viewerInstance.current) {
            return;
          }
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.add(new Cesium.ImageryLayer(provider));
        })
        .catch((error) => {
          console.warn("[Cesium] Failed to load offline NaturalEarth base map:", error);
          if (disposed || !viewerInstance.current) {
            return;
          }
          viewer.imageryLayers.removeAll();
          viewer.imageryLayers.add(new Cesium.ImageryLayer(new Cesium.GridImageryProvider({})));
        });
    }

    const scene = viewer.scene;
    const controller = scene.screenSpaceCameraController;
    controller.enableCollisionDetection = false;
    controller.enableLook = true;
    controller.enableRotate = true;
    controller.enableTranslate = true;
    controller.enableTilt = true;
    controller.enableZoom = true;
    controller.inertiaTranslate = 0.84;
    controller.inertiaSpin = 0.84;
    controller.inertiaZoom = 0.68;
    controller.minimumZoomDistance = 30;
    controller.maximumZoomDistance = 60_000_000;
    scene.backgroundColor = Cesium.Color.BLACK;
    scene.globe.baseColor = Cesium.Color.BLACK;

    // Initialize Primitives
    trackPrimitives.current = scene.primitives.add(new Cesium.PointPrimitiveCollection());
    trackLabels.current = scene.primitives.add(new Cesium.LabelCollection());
    trackTrail.current = scene.primitives.add(new Cesium.PolylineCollection());
    headingVectors.current = scene.primitives.add(new Cesium.PolylineCollection());
    selectionReticle.current = scene.primitives.add(new Cesium.PolylineCollection());
    const pickHandler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    pickHandler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position) as
        | { id?: unknown; primitive?: { id?: unknown } }
        | undefined;

      const pickedId =
        typeof picked?.id === "string"
          ? picked.id
          : typeof picked?.primitive?.id === "string"
            ? picked.primitive.id
            : null;

      if (!pickedId) {
        setSelectedTrack(null);
        useStore.getState().setCameraFollowTrackId(null);
        return;
      }

      const selected = trackLookup.current.get(pickedId) ?? null;
      setSelectedTrack(selected);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Initialize Workers
    wsDecodeWorker.current = new Worker(new URL("@/workers/ws-decode-worker.ts", import.meta.url));
    trackIndexWorker.current = new Worker(new URL("@/workers/track-index-worker.ts", import.meta.url));
    clusterWorker.current = new Worker(new URL("@/workers/cluster-worker.ts", import.meta.url));
    packWorker.current = new Worker(new URL("@/workers/pack-worker.ts", import.meta.url));

    // Connect Pipeline: wsDecode -> trackIndex -> cluster -> pack -> main
    wsDecodeWorker.current.onmessage = (e: MessageEvent<unknown>) => {
      setLastMessageTsMs(Date.now());
      if (isProviderStatusMessage(e.data)) {
        updateProviderStatus(e.data.status);
      } else if (isAlertUpsertMessage(e.data)) {
        addAlert(e.data.alert);
        const now = Date.now();
        alertWindowRef.current.push(now);
        alertWindowRef.current = alertWindowRef.current.filter((ts) => now - ts <= 5000);
        setAlertsPerSec(alertWindowRef.current.length / 5);
      } else if (isTrackBatchStatsMessage(e.data)) {
        if (!isLivePlaybackAllowedRef.current && mockOnlyMode) {
          return;
        }
        const now = Date.now();
        throughputWindowRef.current.push({ ts: now, count: e.data.count });
        throughputWindowRef.current = throughputWindowRef.current.filter((entry) => now - entry.ts <= 5000);
        const total = throughputWindowRef.current.reduce((sum, entry) => sum + entry.count, 0);
        setThroughputStats(total / 5, e.data.count);
      } else if (isSubscriptionAckMessage(e.data)) {
        if (lastSubscriptionSentAtRef.current > 0) {
          setWsRttMs(Date.now() - lastSubscriptionSentAtRef.current);
        }
      } else if (isLinkUpsertMessage(e.data)) {
        upsertLink(e.data.link);
      } else {
        if (!isLivePlaybackAllowedRef.current && mockOnlyMode) {
          return;
        }
        trackIndexWorker.current?.postMessage(e.data);
      }
    };
    trackIndexWorker.current.onmessage = (e: MessageEvent) => clusterWorker.current?.postMessage(e.data);
    clusterWorker.current.onmessage = (e: MessageEvent) => packWorker.current?.postMessage(e.data);
    packWorker.current.onmessage = (e: MessageEvent<RenderPayloadMessage>) => {
      if (e.data.type === "RENDER_PAYLOAD") {
        updatePrimitives(e.data);
      }
    };
    trackIndexWorker.current.postMessage({
      type: "SET_ACTIVE_KINDS",
      kinds: mapUiLayersToTrackKinds(layersRef.current),
    });
    const initialStore = useStore.getState();
    const initialAltitude = mapAltitudeBandToRange(initialStore.altitudeBand);
    const initialSpeed = mapSpeedBandToRange(initialStore.speedBand);
    trackIndexWorker.current.postMessage({
      type: "SET_FILTERS",
      filter: {
        minAltM: initialAltitude.minAltM,
        maxAltM: initialAltitude.maxAltM,
        minSpeedMs: initialSpeed.minSpeedMs,
        maxSpeedMs: initialSpeed.maxSpeedMs,
      },
    });

    let lastLodPush = 0;
    let lastCameraPosePush = 0;
    let lastTrailRefresh = 0;
    const postRenderListener = () => {
      const now = performance.now();
      if (now - lastLodPush >= 350) {
        lastLodPush = now;
        const height = viewer.camera.positionCartographic.height;
        clusterWorker.current?.postMessage({ type: "SET_CAMERA_LOD", cameraHeightM: height });
      }
      if (now - lastCameraPosePush >= 700) {
        lastCameraPosePush = now;
        const cartographic = viewer.camera.positionCartographic;
        setCameraPose({
          lat: Cesium.Math.toDegrees(cartographic.latitude),
          lon: Cesium.Math.toDegrees(cartographic.longitude),
          alt: cartographic.height,
          heading: viewer.camera.heading,
          pitch: viewer.camera.pitch,
          roll: viewer.camera.roll,
        });
      }

      // Selection reticle: pulsing ring around selected track
      const reticle = selectionReticle.current;
      if (reticle) {
        reticle.removeAll();
        const sel = useStore.getState().selectedTrack;
        if (sel) {
          const t = now / 1000;
          const pulseAlpha = 0.5 + 0.3 * Math.sin(t * 3.0);
          const pulseRadius = 0.006 + 0.002 * Math.sin(t * 2.5);
          const positions: Cesium.Cartesian3[] = [];
          const segments = 24;
          for (let j = 0; j <= segments; j++) {
            const angle = (j / segments) * 2 * Math.PI;
            positions.push(Cesium.Cartesian3.fromDegrees(
              sel.lon + Math.cos(angle) * pulseRadius,
              sel.lat + Math.sin(angle) * pulseRadius,
              sel.alt,
            ));
          }
          reticle.add({
            positions,
            width: 2.5,
            material: Cesium.Material.fromType("Color", {
              color: new Cesium.Color(0.37, 0.85, 1.0, pulseAlpha),
            }),
          });
        }
      }

      // Camera follow mode
      const followId = useStore.getState().cameraFollowTrackId;
      if (followId) {
        const followTrack = trackLookup.current.get(followId);
        if (followTrack) {
          const currentHeight = viewer.camera.positionCartographic.height;
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(
              followTrack.lon, followTrack.lat, Math.max(currentHeight, 25000)),
            orientation: {
              heading: viewer.camera.heading,
              pitch: viewer.camera.pitch,
              roll: 0,
            },
          });
        }
      }

      // Throttled bulk trail refresh (1Hz)
      if (now - lastTrailRefresh >= 1000) {
        lastTrailRefresh = now;
        // Trails are rebuilt in updatePrimitives on data tick,
        // but also refresh periodically for camera LOD changes
      }
    };
    scene.postRender.addEventListener(postRenderListener);

    // Setup Real WebSocket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws";
    const relayDebugSnapshotUrl = resolveRelayDebugSnapshotUrl();
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let connectAttempt = 0;

    const connect = () => {
      connectAttempt += 1;
      const attempt = connectAttempt;
      setConnectionStatus("CONNECTING");
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      socket.binaryType = "arraybuffer";

      socket.onopen = () => {
        if (disposed || socket !== socketRef.current) {
          return;
        }
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
          reconnectTimeout = null;
        }
        setConnectionStatus("CONNECTED");
        console.log(`[WS] Connected to ${wsUrl} (attempt ${attempt})`);
        // Initial subscription
        sendSubscription(socket, layersRef.current, isLiveRef.current, currentTimeRef.current);
      };

      socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          wsDecodeWorker.current?.postMessage(event.data, [event.data]);
        }
      };

      socket.onclose = (event) => {
        if (socket !== socketRef.current || disposed) {
          return;
        }
        setConnectionStatus("DISCONNECTED");
        if (useWebSocket) {
          console.warn(
            `[WS] Closed (code=${event.code}, reason=${event.reason || "none"}). Reconnecting...`,
          );
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      socket.onerror = () => {
        if (socket !== socketRef.current || disposed) {
          return;
        }
        // Browsers emit opaque ErrorEvent objects; avoid noisy console errors in dev.
        console.warn("[WS] Transport error signaled; waiting for close/reconnect.");
      };
    };

    if (useWebSocket) {
      connect();
    } else {
      setConnectionStatus("CONNECTED");
      console.log("[HARPY] Offline stream mode enabled. WebSocket disabled.");
    }

    // Setup Mock Streamer (optional fallback or for dev)
    const streamer = useMockStreamer
      ? new MockStreamer((buffer) => {
          if (mockOnlyMode) {
            wsDecodeWorker.current?.postMessage(buffer, [buffer]);
            return;
          }
          if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
            wsDecodeWorker.current?.postMessage(buffer, [buffer]);
          }
        })
      : null;
    if (demoMode && streamer) {
      const cartographic = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC);
      streamer.setCenter({
        lat: Cesium.Math.toDegrees(cartographic.latitude),
        lon: Cesium.Math.toDegrees(cartographic.longitude),
      });
    }
    streamer?.start();

    const cameraCenterListener = () => {
      if (!demoMode || !streamer) {
        return;
      }
      const cartographic = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC);
      streamer.setCenter({
        lat: Cesium.Math.toDegrees(cartographic.latitude),
        lon: Cesium.Math.toDegrees(cartographic.longitude),
      });
    };
    const cameraMoveEndListener = () => {
      if (!useWebSocket) {
        return;
      }
      const socket = socketRef.current;
      if (socket?.readyState === WebSocket.OPEN) {
        sendSubscription(socket, layersRef.current, isLiveRef.current, currentTimeRef.current);
      }
    };
    if (demoMode && streamer) {
      viewer.camera.changed.addEventListener(cameraCenterListener);
    }
    if (useWebSocket) {
      viewer.camera.moveEnd.addEventListener(cameraMoveEndListener);
    }

    let debugPollTimer: ReturnType<typeof setInterval> | null = null;
    let debugSnapshotUnavailable = false;
    if (useWebSocket) {
      debugPollTimer = setInterval(async () => {
        if (debugSnapshotUnavailable) {
          return;
        }
        try {
          const response = await fetch(relayDebugSnapshotUrl, {
            method: "GET",
            cache: "no-store",
          });
          if (response.status === 404 || response.status === 405) {
            debugSnapshotUnavailable = true;
            console.warn(
              `[DATA_PLANE] Debug snapshot endpoint unavailable (${response.status}); disabling snapshot polling.`,
            );
            return;
          }
          if (!response.ok) {
            return;
          }
          const body = (await response.json()) as RelayDebugSnapshotResponse;
          const providers = body.redis?.providers ?? [];
          const freshnessCounts = providers.reduce<Record<string, number>>((acc, provider) => {
            const key = provider.freshness ?? "UNKNOWN";
            acc[key] = (acc[key] ?? 0) + 1;
            return acc;
          }, {});
          setRelayDebugStats({
            dropped: body.relay?.backpressure_totals?.track_batches_dropped ?? 0,
            sent: body.relay?.backpressure_totals?.track_batches_sent ?? 0,
            highPriority: body.relay?.backpressure_totals?.high_priority_sent ?? 0,
            connectedClients: body.relay?.connected_clients ?? 0,
            playbackClients: body.relay?.playback_clients ?? 0,
            providerFreshnessCounts: freshnessCounts,
          });
        } catch {
          // Ignore debug polling errors.
        }
      }, 5000);
    }

    setupPostProcessing(scene);
    
    return () => {
      disposed = true;
      streamer?.stop();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (debugPollTimer) {
        clearInterval(debugPollTimer);
      }
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
      pickHandler.destroy();
      scene.postRender.removeEventListener(postRenderListener);
      if (demoMode && streamer) {
        viewer.camera.changed.removeEventListener(cameraCenterListener);
      }
      if (useWebSocket) {
        viewer.camera.moveEnd.removeEventListener(cameraMoveEndListener);
      }
      if (viewerInstance.current) {
        viewerInstance.current.destroy();
        viewerInstance.current = null;
      }
      wsDecodeWorker.current?.terminate();
      trackIndexWorker.current?.terminate();
      clusterWorker.current?.terminate();
      packWorker.current?.terminate();
    };
  }, [
    addAlert,
    ionToken,
    mockOnlyMode,
    setConnectionStatus,
    setAlertsPerSec,
    setCameraPose,
    setLastMessageTsMs,
    setRelayDebugStats,
    setRenderedTrackStats,
    setThroughputStats,
    setWsRttMs,
    renderBulkTrails,
    updatePrimitives,
    upsertLink,
    setSelectedTrack,
    updateProviderStatus,
    demoMode,
    useMockStreamer,
    useWebSocket,
  ]);

  // Handle layer subscriptions
  useEffect(() => {
    trackIndexWorker.current?.postMessage({
      type: "SET_ACTIVE_KINDS",
      kinds: mapUiLayersToTrackKinds(layers),
    });
    if (!useWebSocket) {
      return;
    }
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      sendSubscription(socketRef.current, layers, isLive, currentTimeRef.current);
    }
  }, [isLive, layers, useWebSocket]);

  useEffect(() => {
    const altitudeRange = mapAltitudeBandToRange(altitudeBand);
    const speedRange = mapSpeedBandToRange(speedBand);
    trackIndexWorker.current?.postMessage({
      type: "SET_FILTERS",
      filter: {
        minAltM: altitudeRange.minAltM,
        maxAltM: altitudeRange.maxAltM,
        minSpeedMs: speedRange.minSpeedMs,
        maxSpeedMs: speedRange.maxSpeedMs,
      },
    });
  }, [altitudeBand, speedBand]);

  // When paused in playback mode, push explicit seek updates.
  useEffect(() => {
    if (!useWebSocket) {
      return;
    }
    if (isLive || isPlaying) {
      return;
    }
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      sendSubscription(socketRef.current, layers, false, currentTimeMs);
    }
  }, [currentTimeMs, isLive, isPlaying, layers, useWebSocket]);

  useEffect(() => {
    if (!viewerInstance.current) return;
    updateVisionMode(viewerInstance.current.scene, visionMode);
  }, [visionMode]);

  useEffect(() => {
    renderBulkTrails();
  }, [renderBulkTrails, selectedTrack]);

  // Clear track history when switching to playback mode
  useEffect(() => {
    if (!isLive) {
      trackHistory.current.clear();
    }
  }, [isLive]);

  useEffect(() => {
    if (!focusTrackId || !viewerInstance.current) {
      return;
    }
    const track = trackLookup.current.get(focusTrackId);
    if (track) {
      viewerInstance.current.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(track.lon, track.lat, Math.max(track.alt + 25000, 40000)),
        duration: 1.1,
      });
    }
    setFocusTrackId(null);
  }, [focusTrackId, setFocusTrackId]);

  useEffect(() => {
    if (!requestedCameraPose || !viewerInstance.current) {
      return;
    }
    viewerInstance.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        requestedCameraPose.lon,
        requestedCameraPose.lat,
        requestedCameraPose.alt,
      ),
      orientation: {
        heading: requestedCameraPose.heading,
        pitch: requestedCameraPose.pitch,
        roll: requestedCameraPose.roll,
      },
      duration: 1.25,
    });
    setRequestedCameraPose(null);
  }, [requestedCameraPose, setRequestedCameraPose]);

  // Demo mode auto-init: fly to appealing angle on first render
  useEffect(() => {
    if (!demoMode || !viewerInstance.current) return;
    viewerInstance.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-122.4, 37.78, 250_000),
      orientation: { heading: 0.3, pitch: -0.8, roll: 0 },
      duration: 0,
    });
  }, [demoMode]);

  return <div ref={viewerRef} className="cesium-viewer" />;
};

const setupPostProcessing = (scene: Cesium.Scene) => {
  const stages = scene.postProcessStages;

  const eoStage = new Cesium.PostProcessStage({
    name: "EO",
    fragmentShader: `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      void main() {
        vec4 color = texture(colorTexture, v_textureCoordinates);
        // Crisp daylight EO look: slight contrast + saturation boost.
        vec3 contrasted = clamp((color.rgb - 0.5) * 1.12 + 0.5, 0.0, 1.0);
        float luma = dot(contrasted, vec3(0.299, 0.587, 0.114));
        vec3 saturated = mix(vec3(luma), contrasted, 1.18);
        out_FragColor = vec4(clamp(saturated, 0.0, 1.0), color.a);
      }
    `
  });
  eoStage.enabled = false;

  const crtStage = new Cesium.PostProcessStage({
    name: "CRT",
    fragmentShader: `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      void main() {
        vec2 uv = v_textureCoordinates;
        vec4 color = texture(colorTexture, uv);
        // Simple scanline + vignette effect for CRT mode.
        float scan = 0.94 + 0.06 * sin(uv.y * 1200.0);
        float vignette = smoothstep(0.92, 0.28, distance(uv, vec2(0.5)));
        vec3 crt = color.rgb * scan * vignette;
        out_FragColor = vec4(clamp(crt, 0.0, 1.0), color.a);
      }
    `
  });
  crtStage.enabled = false;

  const nvgStage = new Cesium.PostProcessStage({
    name: "NVG",
    fragmentShader: `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      void main() {
        vec4 color = texture(colorTexture, v_textureCoordinates);
        float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        out_FragColor = vec4(0.0, luminance * 1.5, 0.0, 1.0);
      }
    `
  });
  nvgStage.enabled = false;

  const flirStage = new Cesium.PostProcessStage({
    name: "FLIR",
    fragmentShader: `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      void main() {
        vec4 color = texture(colorTexture, v_textureCoordinates);
        float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        out_FragColor = vec4(vec3(luminance), 1.0);
      }
    `
  });
  flirStage.enabled = false;

  stages.add(eoStage);
  stages.add(crtStage);
  stages.add(nvgStage);
  stages.add(flirStage);
};

const updateVisionMode = (scene: Cesium.Scene, mode: VisionMode) => {
  const stages = scene.postProcessStages;
  let eoStage: Cesium.PostProcessStage | Cesium.PostProcessStageComposite | undefined;
  let crtStage: Cesium.PostProcessStage | Cesium.PostProcessStageComposite | undefined;
  let nvgStage: Cesium.PostProcessStage | Cesium.PostProcessStageComposite | undefined;
  let flirStage: Cesium.PostProcessStage | Cesium.PostProcessStageComposite | undefined;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages.get(i);
    stage.enabled = false;
    if (stage.name === "EO") {
      eoStage = stage;
    } else if (stage.name === "CRT") {
      crtStage = stage;
    } else if (stage.name === "NVG") {
      nvgStage = stage;
    } else if (stage.name === "FLIR") {
      flirStage = stage;
    }
  }

  if (mode === "EO") {
    if (eoStage) eoStage.enabled = true;
  } else if (mode === "CRT") {
    if (crtStage) crtStage.enabled = true;
  } else if (mode === "NVG") {
    if (nvgStage) nvgStage.enabled = true;
  } else if (mode === "FLIR") {
    if (flirStage) flirStage.enabled = true;
  }
};

export default CesiumViewer;
