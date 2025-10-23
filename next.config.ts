import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages Router configuratie
  reactStrictMode: true,
  productionBrowserSourceMaps: false, // No eval-like sourcemaps in production
  
  // Optimize build for Docker
  experimental: {
    // @ts-ignore - workerThreads exists but not in types
    workerThreads: false,
    // @ts-ignore - cpus exists but not in types
    cpus: 1,
  },
  // Removed output: 'export' to enable API routes
  // Removed trailingSlash: true to avoid conflicts with API routes
  images: {
    unoptimized: false,
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Webpack config: no eval in dev (for CSP compliance)
  webpack(config, { dev }) {
    if (dev) {
      config.devtool = 'source-map'; // no eval-sourcemaps
    }
    return config;
  },

  // CSP is now handled by middleware.ts for better nonce support
  // No need to set headers here to avoid conflicts
};

export default nextConfig;