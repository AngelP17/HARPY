"use client";

import dynamic from "next/dynamic";

// Cesium needs the browser; the whole console is client-rendered into the static export.
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => (
    <main style={{ display: "grid", placeItems: "center", height: "100dvh", color: "#8b93a1" }}>Loading HARPY…</main>
  ),
});

export default function Page() {
  return <App />;
}
