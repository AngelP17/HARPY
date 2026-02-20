import type { NextConfig } from "next";

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const aipBase = stripTrailingSlash(process.env.NEXT_PUBLIC_AIP_URL || "http://localhost:8084");
const relayHttpBase = stripTrailingSlash(process.env.NEXT_PUBLIC_RELAY_HTTP_URL || "http://localhost:8080");
const osmTileOrigin = stripTrailingSlash(process.env.NEXT_PUBLIC_OSM_TILE_ORIGIN || "https://tile.openstreetmap.org");

const nextConfig: NextConfig = {
  transpilePackages: ["@harpy/shared-types"],
  async rewrites() {
    return [
      {
        source: "/api/intel/news",
        destination: `${aipBase}/intel/news`,
      },
      {
        source: "/api/intel/market",
        destination: `${aipBase}/intel/market`,
      },
      {
        source: "/api/relay/debug/snapshot",
        destination: `${relayHttpBase}/api/debug/snapshot`,
      },
      {
        source: "/api/tiles/osm/:z/:x/:y.png",
        destination: `${osmTileOrigin}/:z/:x/:y.png`,
      },
    ];
  },
};

export default nextConfig;
