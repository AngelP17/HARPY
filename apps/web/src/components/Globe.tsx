"use client";

import { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { useApp, type GlobeStyle } from "@/lib/store";
import { useElementsAtCursor, useQuakesInWindow } from "@/lib/selectors";
import { orbitTrack, positionAt, satrecFor } from "@/lib/orbit";
import { magColor } from "@/lib/format";
import type { ElementSet } from "@/lib/types";
import css from "./app.module.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
if (typeof window !== "undefined") {
  (window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = `${BASE}/cesium/`;
}

type PickId = { kind: "earthquake"; id: string } | { kind: "satellite"; norad: number };

interface Scene {
  widget: Cesium.CesiumWidget;
  quakes: Cesium.PointPrimitiveCollection;
  sats: Cesium.PointPrimitiveCollection;
  labels: Cesium.LabelCollection;
  orbit: Cesium.PolylineCollection;
  satPoints: Map<number, Cesium.PointPrimitive>;
  base: Cesium.ImageryLayer | null;
}

const STYLE: Record<GlobeStyle, { brightness: number; contrast: number; saturation: number; hue: number; gamma: number }> = {
  standard: { brightness: 0.95, contrast: 1.05, saturation: 0.9, hue: 0, gamma: 1 },
  night: { brightness: 0.42, contrast: 1.25, saturation: 0.25, hue: 0, gamma: 1.2 },
  // A palette shift. It is NOT thermal sensor data, and the UI labels it as a visual style.
  "thermal-look": { brightness: 0.8, contrast: 1.6, saturation: 0, hue: 0, gamma: 0.8 },
};

function applyStyle(s: Scene, style: GlobeStyle) {
  if (!s.base) return;
  Object.assign(s.base, STYLE[style]);
  s.widget.scene.globe.baseColor =
    style === "thermal-look" ? Cesium.Color.fromCssColorString("#1a0f24") : Cesium.Color.fromCssColorString("#0b1220");
  s.widget.scene.requestRender();
}

export default function Globe() {
  const host = useRef<HTMLDivElement>(null);
  const credits = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const { quakes } = useQuakesInWindow();
  const { elements } = useElementsAtCursor();
  const elementsRef = useRef<ElementSet[]>([]);

  const selection = useApp((s) => s.selection);
  const showEq = useApp((s) => s.showEarthquakes);
  const showSat = useApp((s) => s.showSatellites);
  const showOrbit = useApp((s) => s.showOrbit);
  const style = useApp((s) => s.globeStyle);
  const focus = useApp((s) => s.focus);
  const cursor = useApp((s) => s.cursor);

  // Create the widget once.
  useEffect(() => {
    if (!host.current || sceneRef.current) return;
    Cesium.Ion.defaultAccessToken = "";
    const widget = new Cesium.CesiumWidget(host.current, {
      baseLayer: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      creditContainer: credits.current ?? undefined,
      requestRenderMode: true,
      maximumRenderTimeChange: Infinity,
      useBrowserRecommendedResolution: true,
      shouldAnimate: false,
    });
    const scene = widget.scene;
    scene.globe.enableLighting = true; // terminator from the real sun position at the cursor time
    scene.globe.showGroundAtmosphere = true;
    scene.fog.enabled = false;
    // Natural Earth II tops out at a regional scale; don't let the camera zoom into blur.
    scene.screenSpaceCameraController.minimumZoomDistance = 1_500_000;
    scene.screenSpaceCameraController.maximumZoomDistance = 60_000_000;
    scene.backgroundColor = Cesium.Color.fromCssColorString("#05060a");
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = true;
    widget.camera.setView({ destination: Cesium.Cartesian3.fromDegrees(-80, 12, 15_500_000) });

    const s: Scene = {
      widget,
      quakes: scene.primitives.add(new Cesium.PointPrimitiveCollection()),
      sats: scene.primitives.add(new Cesium.PointPrimitiveCollection()),
      labels: scene.primitives.add(new Cesium.LabelCollection()),
      orbit: scene.primitives.add(new Cesium.PolylineCollection()),
      satPoints: new Map(),
      base: null,
    };
    sceneRef.current = s;

    // Self-hosted Natural Earth II imagery shipped with Cesium: no tokens, no third-party tile terms.
    Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII"))
      .then((provider) => {
        if (widget.isDestroyed()) return;
        s.base = widget.imageryLayers.addImageryProvider(provider);
        applyStyle(s, useApp.getState().globeStyle);
      })
      .catch((e) => console.error("imagery failed to load", e));

    const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    handler.setInputAction((ev: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      const picked = scene.pick(ev.position);
      const id = picked?.id as PickId | undefined;
      useApp.getState().select(id && typeof id === "object" && "kind" in id ? id : null);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    handler.setInputAction((ev: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      const picked = scene.pick(ev.endPosition);
      scene.canvas.style.cursor = picked?.id && typeof picked.id === "object" ? "pointer" : "";
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    return () => {
      handler.destroy();
      widget.destroy();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (sceneRef.current) applyStyle(sceneRef.current, style);
  }, [style]);

  // Sun position follows the display time.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.widget.clock.currentTime = Cesium.JulianDate.fromDate(new Date(cursor));
    s.widget.scene.requestRender();
  }, [cursor]);

  // Earthquakes: rebuild when the window contents change.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.quakes.removeAll();
    s.quakes.show = showEq;
    const now = cursor;
    for (const q of quakes) {
      const c = q.geometry?.coordinates;
      if (!c) continue;
      const mag = q.attributes.mag;
      const selected = selection?.kind === "earthquake" && selection.id === q.observation_id;
      const ageFrac = Math.min(1, Math.max(0, (now - q.observed_at) / 86_400_000));
      const color = Cesium.Color.fromCssColorString(magColor(mag)).withAlpha(0.95 - ageFrac * 0.45);
      s.quakes.add({
        position: Cesium.Cartesian3.fromDegrees(c[0], c[1], 0),
        pixelSize: Math.min(26, Math.max(4, 3 + (mag ?? 1) * 2.6)) + (selected ? 6 : 0),
        color,
        outlineColor: selected ? Cesium.Color.WHITE : Cesium.Color.fromCssColorString("#140a06").withAlpha(0.8),
        outlineWidth: selected ? 2.5 : 1,
        id: { kind: "earthquake", id: q.observation_id } satisfies PickId,
        disableDepthTestDistance: 0,
      });
    }
    s.widget.scene.requestRender();
  }, [quakes, selection, showEq, cursor]);

  useEffect(() => {
    elementsRef.current = elements;
  }, [elements]);

  // Satellites: recompute positions from element sets (CALCULATED). Live: every 500 ms.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.sats.show = showSat;
    s.labels.show = showSat;

    const draw = () => {
      const st = useApp.getState();
      const at = st.mode === "live" ? Date.now() : st.cursor;
      const seen = new Set<number>();
      s.labels.removeAll();
      for (const el of elementsRef.current) {
        const norad = el.attributes.norad_id;
        const rec = satrecFor(el);
        const p = rec && positionAt(rec, at);
        if (!p) continue; // propagation failed: withhold rather than guess
        seen.add(norad);
        const pos = Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.altKm * 1000);
        const selected = st.selection?.kind === "satellite" && st.selection.norad === norad;
        let pt = s.satPoints.get(norad);
        if (!pt) {
          pt = s.sats.add({ id: { kind: "satellite", norad } satisfies PickId });
          s.satPoints.set(norad, pt);
        }
        pt.position = pos;
        pt.pixelSize = selected ? 10 : el.attributes.group === "stations" ? 6 : 4;
        pt.color = selected
          ? Cesium.Color.WHITE
          : Cesium.Color.fromCssColorString(el.attributes.group === "stations" ? "#7fe3ff" : "#4cc3ff").withAlpha(0.9);
        pt.outlineColor = Cesium.Color.fromCssColorString("#03141c");
        pt.outlineWidth = 1;
        if (selected || norad === 25544) {
          s.labels.add({
            position: pos,
            text: el.attributes.name ?? String(norad),
            font: "500 12px 'Inter Variable', system-ui, sans-serif",
            fillColor: Cesium.Color.fromCssColorString("#d9f6ff"),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(10, -10),
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
          });
        }
      }
      for (const [norad, pt] of s.satPoints) {
        if (!seen.has(norad)) {
          s.sats.remove(pt);
          s.satPoints.delete(norad);
        }
      }
      s.widget.scene.requestRender();
    };

    draw();
    const live = useApp.getState().mode === "live";
    const timer = live ? window.setInterval(draw, 500) : undefined;
    return () => window.clearInterval(timer);
  }, [elements, showSat, selection, cursor]);

  // Orbit track for the selected satellite (one period, centred on the display time).
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.orbit.removeAll();
    if (selection?.kind === "satellite" && showOrbit && showSat) {
      const el = elements.find((e) => e.attributes.norad_id === selection.norad);
      if (el) {
        const track = orbitTrack(el, useApp.getState().mode === "live" ? Date.now() : cursor);
        if (track.length > 1) {
          s.orbit.add({
            positions: track.map((p) => Cesium.Cartesian3.fromDegrees(p.lon, p.lat, p.altKm * 1000)),
            width: 1.5,
            material: Cesium.Material.fromType("Color", {
              color: Cesium.Color.fromCssColorString("#4cc3ff").withAlpha(0.55),
            }),
          });
        }
      }
    }
    s.widget.scene.requestRender();
    // Live mode: refresh the track every 30 s so it stays centred.
  }, [selection, showOrbit, showSat, elements, cursor]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !focus) return;
    s.widget.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(focus.lon, focus.lat, focus.altKm * 1000),
      duration: 1.4,
    });
  }, [focus]);

  return (
    <div className={css.globe}>
      <div ref={host} className={css.globeCanvas} data-testid="globe" />
      <div ref={credits} className={css.credits} />
    </div>
  );
}
