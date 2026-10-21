import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "HARPY Monitor",
  description:
    "Real-time geospatial monitor: USGS earthquakes and SGP4-propagated satellites with full provenance and recorded-history replay. No simulated data.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07080b",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href={`${BASE}/cesium/Widgets/widgets.css`} />
      </head>
      <body>{children}</body>
    </html>
  );
}
