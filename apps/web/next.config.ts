import type { NextConfig } from "next";

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const aipBase = process.env.NEXT_PUBLIC_AIP_URL
  ? stripTrailingSlash(process.env.NEXT_PUBLIC_AIP_URL)
  : "";
const relayHttpBase = stripTrailingSlash(process.env.NEXT_PUBLIC_RELAY_HTTP_URL || "http://localhost:8080");
const osmTileOrigin = stripTrailingSlash(process.env.NEXT_PUBLIC_OSM_TILE_ORIGIN || "https://tile.openstreetmap.org");

const nextConfig: NextConfig = {
  transpilePackages: ["@harpy/shared-types"],
  async rewrites() {
    const rules = [
      {
        source: "/api/relay/debug/snapshot",
        destination: `${relayHttpBase}/api/debug/snapshot`,
      },
      {
        source: "/api/tiles/osm/:z/:x/:y.png",
        destination: `${osmTileOrigin}/:z/:x/:y.png`,
      },
    ];
    if (aipBase) {
      rules.unshift(
        {
          source: "/api/intel/market",
          destination: `${aipBase}/intel/market`,
        },
        {
          source: "/api/intel/news",
          destination: `${aipBase}/intel/news`,
        },
      );
    }
    return rules;
  },
};

export default nextConfig;
