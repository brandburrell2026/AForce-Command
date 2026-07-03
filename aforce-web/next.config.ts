import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone marketing site — isolated from the AForce-Command monorepo.
  // Pin the tracing root so Next doesn't climb to the pnpm workspace root.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
