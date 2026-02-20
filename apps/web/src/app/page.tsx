"use client";

import dynamic from "next/dynamic";
import HUD from "@/components/HUD/HUD";
import URLManager from "@/components/Logic/URLManager";

// CesiumViewer needs to be dynamic (client-side only)
const CesiumViewer = dynamic(() => import("@/components/Map/CesiumViewer"), {
  ssr: false,
  loading: () => <div className="cesium-viewer" style={{ backgroundColor: "#000" }} />,
});

export default function Home() {
  const ionToken = process.env.NEXT_PUBLIC_CESIUM_ION_TOKEN;
  const disableCesium =
    process.env.NEXT_PUBLIC_DISABLE_CESIUM === "true"
    || process.env.NEXT_PUBLIC_E2E_SEED === "true";

  return (
    <main style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <URLManager />
      {disableCesium ? (
        <div
          className="cesium-viewer"
          data-testid="cesium-disabled"
          style={{ backgroundColor: "#05080d" }}
        />
      ) : (
        <CesiumViewer ionToken={ionToken} />
      )}
      <HUD />
    </main>
  );
}
