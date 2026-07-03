import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emit a self-contained server build (.next/standalone) for the Docker
  // production image — ships only the traced runtime deps, no full node_modules.
  output: "standalone",
};

export default nextConfig;
