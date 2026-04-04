import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {}, // Turbopack is default in Next.js 16; WASM + Web Workers supported natively
};

export default nextConfig;
