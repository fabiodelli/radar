import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produce un server Node autonomo in .next/standalone (impacchettato in Radar.exe).
  output: "standalone",
};

export default nextConfig;
