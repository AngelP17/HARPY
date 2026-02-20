"use client";

import React, { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import "cesium/Source/Widgets/widgets.css";
import { useStore, VisionMode } from "@/store/useStore";
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
  const visionMode = useStore((state) => state.visionMode);
  const setConnectionStatus = useStore((state) => state.setConnectionStatus);
  const updateProviderStatus = useStore((state) => state.updateProviderStatus);
  const addAlert = useStore((state) => state.addAlert);
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

  const updatePrimitives = (payload: RenderPayloadMessage) => {
    const { positions, colors, count } = payload;
    const posArray = new Float64Array(positions);
    const colorArray = new Uint32Array(colors);
    
    const collection = trackPrimitives.current;
    if (!collection) return;

    collection.removeAll();
    for (let i = 0; i < count; i++) {
      const lat = posArray[i * 3];
      const lon = posArray[i * 3 + 1];
      const alt = posArray[i * 3 + 2];
      
      collection.add({
        position: Cesium.Cartesian3.fromDegrees(lon, lat, alt),
        pixelSize: 8,
        color: Cesium.Color.fromRgba(colorArray[i]),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 1
      });
    }
  };

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
      sceneModePicker: true,
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

    const connect = () => {
      setConnectionStatus("CONNECTING");
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;
      socket.binaryType = "arraybuffer";

      socket.onopen = () => {
        setConnectionStatus("CONNECTED");
        console.log("[WS] Connected to", wsUrl);
        // Initial subscription
        sendSubscription(socket, layersRef.current, isLiveRef.current, currentTimeRef.current);
      };

      socket.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          wsDecodeWorker.current?.postMessage(event.data, [event.data]);
        }
      };

      socket.onclose = () => {
        setConnectionStatus("DISCONNECTED");
        if (useWebSocket) {
          console.log("[WS] Disconnected. Reconnecting...");
          reconnectTimeout = setTimeout(connect, 3000);
        }
      };

      socket.onerror = (err) => {
        console.error("[WS] Error:", err);
        socket.close();
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

  const nvgStage = new Cesium.PostProcessStage({
    name: "NVG",
    fragmentShader: `
      uniform sampler2D colorTexture;
      varying vec2 v_textureCoordinates;
      void main() {
        vec4 color = texture2D(colorTexture, v_textureCoordinates);
        float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor = vec4(0.0, luminance * 1.5, 0.0, 1.0);
      }
    `
  });
  nvgStage.enabled = false;

  const flirStage = new Cesium.PostProcessStage({
    name: "FLIR",
    fragmentShader: `
      uniform sampler2D colorTexture;
      varying vec2 v_textureCoordinates;
      void main() {
        vec4 color = texture2D(colorTexture, v_textureCoordinates);
        float luminance = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor = vec4(vec3(luminance), 1.0);
      }
    `
  });
  flirStage.enabled = false;

  stages.add(nvgStage);
  stages.add(flirStage);
};

const updateVisionMode = (scene: Cesium.Scene, mode: VisionMode) => {
  const stages = scene.postProcessStages;
  let nvgStage: Cesium.PostProcessStage | Cesium.PostProcessStageComposite | undefined;
  let flirStage: Cesium.PostProcessStage | Cesium.PostProcessStageComposite | undefined;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages.get(i);
    stage.enabled = false;
    if (stage.name === "NVG") {
      nvgStage = stage;
    } else if (stage.name === "FLIR") {
      flirStage = stage;
    }
  }

  if (mode === "NVG") {
    if (nvgStage) nvgStage.enabled = true;
  } else if (mode === "FLIR") {
    if (flirStage) flirStage.enabled = true;
  }
};

export default CesiumViewer;
