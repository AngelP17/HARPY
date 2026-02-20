"use client";

import React, { useCallback, useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Source/Widgets/widgets.css";
import { useStore, VisionMode, type SelectedTrack } from "@/store/useStore";
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
  ids: string[];
  providerIds: string[];
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

type StreamMode = "online" | "offline" | "hybrid";

const resolveStreamMode = (): StreamMode => {
  const raw = (process.env.NEXT_PUBLIC_STREAM_MODE || "hybrid").toLowerCase();
  if (raw === "online" || raw === "offline" || raw === "hybrid") {
    return raw;
  }
  return "hybrid";
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

const mapUiLayersToProto = (activeLayers: string[]): harpy.v1.LayerType[] => {
  const mapped = new Set<harpy.v1.LayerType>();
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

const CesiumViewer: React.FC<CesiumViewerProps> = ({ ionToken }) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<Cesium.Viewer | null>(null);
  const trackPrimitives = useRef<Cesium.PointPrimitiveCollection | null>(null);
  const trackLookup = useRef<Map<string, SelectedTrack>>(new Map());
  const visionMode = useStore((state) => state.visionMode);
  const setConnectionStatus = useStore((state) => state.setConnectionStatus);
  const updateProviderStatus = useStore((state) => state.updateProviderStatus);
  const addAlert = useStore((state) => state.addAlert);
  const setSelectedTrack = useStore((state) => state.setSelectedTrack);
  const layers = useStore((state) => state.layers);
  const isLive = useStore((state) => state.isLive);
  const isPlaying = useStore((state) => state.isPlaying);
  const currentTimeMs = useStore((state) => state.currentTimeMs);
  const layersRef = useRef<string[]>(layers);
  const isLiveRef = useRef<boolean>(isLive);
  const currentTimeRef = useRef<number>(currentTimeMs);
  
  // Workers
  const wsDecodeWorker = useRef<Worker | null>(null);
  const trackIndexWorker = useRef<Worker | null>(null);
  const packWorker = useRef<Worker | null>(null);
  
  // WebSocket reference
  const socketRef = useRef<WebSocket | null>(null);
  const streamMode = resolveStreamMode();
  const useWebSocket = streamMode !== "offline";
  const useMockStreamer = streamMode !== "online";
  const mockOnlyMode = streamMode === "offline";

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    isLiveRef.current = isLive;
  }, [isLive]);

  useEffect(() => {
    currentTimeRef.current = currentTimeMs;
  }, [currentTimeMs]);

  const sendSubscription = (socket: WebSocket, activeLayers: string[], liveMode: boolean, endTsMs: number) => {
    const mappedLayers = mapUiLayersToProto(activeLayers);
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
      viewport: { minLat: -90, minLon: -180, maxLat: 90, maxLon: 180 },
    });
    const envelope = harpy.v1.Envelope.create({
      schemaVersion: "1.0.0",
      serverTsMs: Date.now(),
      subscriptionRequest: request
    });
    const buffer = harpy.v1.Envelope.encode(envelope).finish();
    socket.send(buffer);
    console.log(
      "[WS] Sent SubscriptionRequest:",
      liveMode ? "LIVE" : "PLAYBACK",
      "layers=",
      mappedLayers,
    );
  };

  const updatePrimitives = useCallback((payload: RenderPayloadMessage) => {
    const { positions, headings, speeds, kinds, colors, ids, providerIds, count } = payload;
    const posArray = new Float64Array(positions);
    const headingArray = new Float32Array(headings);
    const speedArray = new Float32Array(speeds);
    const kindArray = new Uint8Array(kinds);
    const colorArray = new Uint32Array(colors);

    const collection = trackPrimitives.current;
    if (!collection) return;

    const nextTrackLookup = new Map<string, SelectedTrack>();
    collection.removeAll();
    for (let i = 0; i < count; i++) {
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

      const primitive = collection.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
        pixelSize: 12,
        color: Cesium.Color.fromRgba(colorArray[i]),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        scaleByDistance: new Cesium.NearFarScalar(1.5e2, 2.0, 1.5e7, 0.5),
      });
      primitive.id = id;

      nextTrackLookup.set(id, {
        id,
        providerId,
        kind,
        lat,
        lon,
        alt,
        heading,
        speed,
        tsMs: Date.now(),
      });
    }

    trackLookup.current = nextTrackLookup;
    const selectedTrack = useStore.getState().selectedTrack;
    if (selectedTrack && !nextTrackLookup.has(selectedTrack.id)) {
      setSelectedTrack(null);
    }
  }, [setSelectedTrack]);

  useEffect(() => {
    if (!viewerRef.current || viewerInstance.current) return;

    if (ionToken) {
      Cesium.Ion.defaultAccessToken = ionToken;
    }

    const mapMode = (process.env.NEXT_PUBLIC_MAP_MODE || "").toLowerCase();
    const forceOfflineMap = mapMode === "offline" || mockOnlyMode;
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
              url: process.env.NEXT_PUBLIC_OSM_TILE_URL || "https://tile.openstreetmap.org/",
              credit: "© OpenStreetMap contributors",
            }),
          ),
    };

    // Initialize Viewer
    const viewer = new Cesium.Viewer(viewerRef.current, viewerOptions);
    viewerInstance.current = viewer;

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
    scene.backgroundColor = Cesium.Color.BLACK;
    scene.globe.baseColor = Cesium.Color.BLACK;

    // Initialize Primitives
    trackPrimitives.current = scene.primitives.add(new Cesium.PointPrimitiveCollection());
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
        return;
      }

      const selectedTrack = trackLookup.current.get(pickedId) ?? null;
      setSelectedTrack(selectedTrack);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Initialize Workers
    wsDecodeWorker.current = new Worker(new URL("@/workers/ws-decode-worker.ts", import.meta.url));
    trackIndexWorker.current = new Worker(new URL("@/workers/track-index-worker.ts", import.meta.url));
    packWorker.current = new Worker(new URL("@/workers/pack-worker.ts", import.meta.url));

    // Connect Pipeline: wsDecode -> trackIndex -> pack -> main
    wsDecodeWorker.current.onmessage = (e: MessageEvent<unknown>) => {
      if (isProviderStatusMessage(e.data)) {
        updateProviderStatus(e.data.status);
      } else if (isAlertUpsertMessage(e.data)) {
        addAlert(e.data.alert);
      } else {
        trackIndexWorker.current?.postMessage(e.data);
      }
    };
    trackIndexWorker.current.onmessage = (e: MessageEvent) => packWorker.current?.postMessage(e.data);
    packWorker.current.onmessage = (e: MessageEvent<RenderPayloadMessage>) => {
      if (e.data.type === "RENDER_PAYLOAD") {
        updatePrimitives(e.data);
      }
    };

    // Setup Real WebSocket
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080/ws";
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
    streamer?.start();

    setupPostProcessing(scene);
    
    return () => {
      disposed = true;
      streamer?.stop();
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
      pickHandler.destroy();
      if (viewerInstance.current) {
        viewerInstance.current.destroy();
        viewerInstance.current = null;
      }
      wsDecodeWorker.current?.terminate();
      trackIndexWorker.current?.terminate();
      packWorker.current?.terminate();
    };
  }, [
    addAlert,
    ionToken,
    mockOnlyMode,
    setConnectionStatus,
    updatePrimitives,
    setSelectedTrack,
    updateProviderStatus,
    useMockStreamer,
    useWebSocket,
  ]);

  // Handle layer subscriptions
  useEffect(() => {
    if (!useWebSocket) {
      return;
    }
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      sendSubscription(socketRef.current, layers, isLive, currentTimeRef.current);
    }
  }, [isLive, layers, useWebSocket]);

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
