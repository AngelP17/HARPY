import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@harpy/shared-types"],
};

export default nextConfig;
