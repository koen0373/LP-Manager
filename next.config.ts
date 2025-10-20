import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages Router configuratie
  reactStrictMode: true,
  // Removed output: 'export' to enable API routes
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;