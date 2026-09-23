import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */

  // Allows accessing the dev server from other devices on the local
  // network (e.g. testing on a phone/tablet at this machine's LAN IP)
  // without Next.js blocking the cross-origin request to HMR/static chunks.
  // Add any other LAN IPs/hostnames you dev from here.
  allowedDevOrigins: ["192.168.1.122", "192.168.0.80"],

  // Document extraction pulls in pdf.js and tesseract.js, which load worker
  // and wasm files from disk at runtime. Bundling them breaks those paths in
  // Vercel functions, so require them from node_modules instead.
  serverExternalPackages: ["officeparser", "pdfjs-dist", "tesseract.js"],
};

export default nextConfig;
