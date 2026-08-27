import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Allows accessing the dev server from other devices on the local
  // network (e.g. testing on a phone/tablet at this machine's LAN IP)
  // without Next.js blocking the cross-origin request to HMR/static chunks.
  // Add any other LAN IPs/hostnames you dev from here.
  allowedDevOrigins: ["192.168.1.122", "192.168.0.80"],
};

export default nextConfig;
