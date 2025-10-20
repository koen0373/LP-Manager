import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages Router configuratie
  reactStrictMode: true,
  // Removed output: 'export' to enable API routes
  // Removed trailingSlash: true to avoid conflicts with API routes
  images: {
    unoptimized: true,
  },
};

export default nextConfig;