import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["pdf-parse"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } }
};

export default nextConfig;