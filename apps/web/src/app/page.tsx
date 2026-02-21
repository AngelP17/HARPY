"use client";

import dynamic from "next/dynamic";
import { DataLinkBar } from "@/hud/DataLinkBar";
import { LayersPanel } from "@/hud/LayersPanel";
import { VisionPanel } from "@/hud/VisionPanel";
import { PresetsBar } from "@/hud/PresetsBar";
import { useHarpyRuntime } from "@/runtime/useHarpyRuntime";

const CesiumScene = dynamic(() => import("@/scene/CesiumScene"), {
  ssr: false,
});

export default function Page() {
  useHarpyRuntime();

  return (
    <main className="app">
      <div className="scene">
        <CesiumScene />
      </div>

      <div className="hud top">
        <DataLinkBar />
      </div>

      <div className="hud left">
        <LayersPanel />
      </div>

      <div className="hud right">
        <VisionPanel />
      </div>

      <div className="hud bottom">
        <PresetsBar />
      </div>
    </main>
  );
}
