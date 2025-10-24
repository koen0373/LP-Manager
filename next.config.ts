import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages Router configuratie
  reactStrictMode: true,
  productionBrowserSourceMaps: false, // No eval-like sourcemaps in production
  
  // API Routes configuration
  api: {
    responseLimit: false, // Allow large responses for pool data
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
  
  // Optimize build for Docker
  experimental: {
    workerThreads: false,
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