"use client";

import { useEffect, useMemo, useRef } from "react";
import { useHarpyStore } from "@/state/store";
import type { Track } from "@/state/types";
import * as Cesium from "cesium";
import "cesium/Source/Widgets/widgets.css";

if (typeof window !== "undefined") {
  (window as typeof window & { CESIUM_BASE_URL?: string }).CESIUM_BASE_URL =
    "/cesium";
}

function presetCamera(p: "DC" | "SF" | "PTY") {
  if (p === "DC") return { lat: 38.8895, lon: -77.0353, height: 450000 };
  if (p === "SF") return { lat: 37.7749, lon: -122.4194, height: 520000 };
  return { lat: 9.0, lon: -79.5, height: 650000 };
}

function toCartesian(t: Track) {
  return Cesium.Cartesian3.fromDegrees(t.lon, t.lat, t.alt_m);
}

function rectToBbox(rect: Cesium.Rectangle) {
  return {
    west: Cesium.Math.toDegrees(rect.west),
    south: Cesium.Math.toDegrees(rect.south),
    east: Cesium.Math.toDegrees(rect.east),
    north: Cesium.Math.toDegrees(rect.north),
  };
}

export default function CesiumScene() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);

  const tracks = useHarpyStore((s) => s.tracks);
  const layers = useHarpyStore((s) => s.layers);
  const preset = useHarpyStore((s) => s.preset);
  const vision = useHarpyStore((s) => s.vision);
  const setViewport = useHarpyStore((s) => s.setViewport);

  const trackList = useMemo(() => Object.values(tracks), [tracks]);

  useEffect(() => {
    if (!containerRef.current) return;

    const mapMode = (
      process.env.NEXT_PUBLIC_MAP_MODE || ""
    ).toLowerCase();
    const forceOfflineMap = mapMode === "offline";

    const viewerOptions: Cesium.Viewer.ConstructorOptions = {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      selectionIndicator: false,
      infoBox: false,
      shouldAnimate: true,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayer: forceOfflineMap ? false : undefined,
    };

    const v = new Cesium.Viewer(containerRef.current, viewerOptions);

    v.scene.globe.enableLighting = false;
    v.scene.globe.depthTestAgainstTerrain = true;
    v.scene.backgroundColor = Cesium.Color.BLACK;
    v.scene.globe.baseColor = Cesium.Color.BLACK;

    let disposed = false;
    if (forceOfflineMap) {
      void Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"),
      )
        .then((provider) => {
          if (disposed || !v) return;
          v.imageryLayers.removeAll();
          v.imageryLayers.add(new Cesium.ImageryLayer(provider));
        })
        .catch(() => {
          if (disposed || !v) return;
          v.imageryLayers.removeAll();
          v.imageryLayers.add(
            new Cesium.ImageryLayer(new Cesium.GridImageryProvider({})),
          );
        });
    }

    const onMoveEnd = () => {
      try {
        const rect = v.camera.computeViewRectangle(
          v.scene.globe.ellipsoid,
        );
        if (!rect) return;
        setViewport(rectToBbox(rect));
      } catch {
        // ignore
      }
    };

    v.camera.moveEnd.addEventListener(onMoveEnd);
    viewerRef.current = v;

    setTimeout(onMoveEnd, 250);

    return () => {
      disposed = true;
      try {
        v.camera.moveEnd.removeEventListener(onMoveEnd);
      } catch {
        /* noop */
      }
      try {
        v.destroy();
      } catch {
        /* noop */
      }
      viewerRef.current = null;
    };
  }, [setViewport]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;
    const cam = presetCamera(preset);
    v.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        cam.lon,
        cam.lat,
        cam.height,
      ),
      duration: 0.8,
    });
  }, [preset]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    const bloom = v.scene.postProcessStages.bloom;
    if (bloom) {
      bloom.enabled = true;
      bloom.uniforms.glowOnly = false;
      bloom.uniforms.contrast = 128;
      bloom.uniforms.brightness = -0.05;
      bloom.uniforms.delta = 1.0;
      bloom.uniforms.sigma = 2.0;
      bloom.uniforms.stepSize = 1.0;
    }

    const stages = v.scene.postProcessStages;

    const modeShader = `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      void main() {
        vec4 c = texture(colorTexture, v_textureCoordinates);
        vec3 col = c.rgb;
        float mode = ${vision.mode === "EO" ? "0.0" : vision.mode === "NVG" ? "1.0" : "2.0"};
        if (mode > 0.5 && mode < 1.5) {
          float g = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = vec3(g*0.08, g*1.25, g*0.08);
        } else if (mode >= 1.5) {
          float g = dot(col, vec3(0.2126, 0.7152, 0.0722));
          col = vec3(g*1.2, g*0.55, g*0.15);
        }
        out_FragColor = vec4(col, c.a);
      }
    `;
    const modeStage = new Cesium.PostProcessStage({
      name: "harpy_mode_stage",
      fragmentShader: modeShader,
    });

    const sharpenShader = `
      uniform sampler2D colorTexture;
      in vec2 v_textureCoordinates;
      uniform float amount;
      void main() {
        vec2 px = vec2(1.0/1920.0, 1.0/1080.0);
        vec4 c = texture(colorTexture, v_textureCoordinates);
        vec4 n = texture(colorTexture, v_textureCoordinates + vec2(0.0, px.y));
        vec4 s = texture(colorTexture, v_textureCoordinates - vec2(0.0, px.y));
        vec4 e = texture(colorTexture, v_textureCoordinates + vec2(px.x, 0.0));
        vec4 w = texture(colorTexture, v_textureCoordinates - vec2(px.x, 0.0));
        vec4 edge = (n + s + e + w - 4.0*c);
        out_FragColor = vec4((c - edge * amount).rgb, c.a);
      }
    `;
    const sharpStage = new Cesium.PostProcessStage({
      name: "harpy_sharpen_stage",
      fragmentShader: sharpenShader,
      uniforms: { amount: vision.sharpen },
    });

    for (let i = stages.length - 1; i >= 0; i--) {
      const st = stages.get(i);
      if (
        st &&
        (st.name === "harpy_mode_stage" ||
          st.name === "harpy_sharpen_stage")
      ) {
        stages.remove(st);
      }
    }

    stages.add(modeStage);
    stages.add(sharpStage);

    if (bloom) bloom.uniforms.brightness = -0.2 + vision.bloom * 0.4;

    return () => {
      try {
        stages.remove(modeStage);
      } catch {
        /* noop */
      }
      try {
        stages.remove(sharpStage);
      } catch {
        /* noop */
      }
    };
  }, [vision.mode, vision.bloom, vision.sharpen]);

  useEffect(() => {
    const v = viewerRef.current;
    if (!v) return;

    const existing = new Map<string, Cesium.Entity>();
    for (const e of v.entities.values) {
      if (typeof e.id === "string") existing.set(e.id, e);
    }

    const airEnabled = layers.AIR.enabled;
    const satEnabled = layers.SAT.enabled;

    for (const t of trackList) {
      if (t.kind === "AIR" && !airEnabled) continue;
      if (t.kind === "SAT" && !satEnabled) continue;

      const pos = toCartesian(t);
      const id = t.id;

      const ent = existing.get(id);
      if (!ent) {
        v.entities.add({
          id,
          position: pos as unknown as Cesium.PositionProperty,
          point: new Cesium.PointGraphics({
            pixelSize: t.kind === "AIR" ? 6 : 5,
            color:
              t.kind === "AIR" ? Cesium.Color.CYAN : Cesium.Color.YELLOW,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
          }),
        });
      } else {
        (ent as unknown as { position: unknown }).position = pos;
        if (ent.point) ent.show = true;
      }
      existing.delete(id);
    }

    for (const [id, ent] of existing.entries()) {
      if (id.startsWith("MOCK-AC") && !airEnabled) {
        ent.show = false;
        continue;
      }
      if (id.startsWith("MOCK-SAT") && !satEnabled) {
        ent.show = false;
        continue;
      }
      v.entities.remove(ent);
    }
  }, [trackList, layers.AIR.enabled, layers.SAT.enabled]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }} />
  );
}
