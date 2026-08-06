import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: false,
  // Production: allow cross-origin previews.
  allowedDevOrigins: ["*.z.ai", "*.space-z.ai"],
};

export default nextConfig;
