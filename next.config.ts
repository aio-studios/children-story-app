import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow phone/LAN devices to load dev resources (JS chunks, HMR) when hitting the dev server
  // by its network IP — Next 16 blocks cross-origin dev requests by default, which otherwise
  // serves the HTML but silently blocks hydration (buttons appear dead). Dev-only; no prod effect.
  allowedDevOrigins: ["192.168.2.86"],
};

export default nextConfig;
