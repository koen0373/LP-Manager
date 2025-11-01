import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Pages Router configuratie
  reactStrictMode: true,
  productionBrowserSourceMaps: false, // No eval-like sourcemaps in production
  
  // Optimize build for Docker
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  // Removed output: 'export' to enable API routes
  // Removed trailingSlash: true to avoid conflicts with API routes
  images: {
    unoptimized: false,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'www.bifrostwallet.com',
      },
      {
        protocol: 'https',
        hostname: 'cryptologos.cc',
      },
      {
        protocol: 'https',
        hostname: 'static.okx.com',
      },
      {
        protocol: 'https',
        hostname: 'rabby.io',
      },
      {
        protocol: 'https',
        hostname: 'brave.com',
      },
    ],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Webpack config: no eval in dev (for CSP compliance)
  webpack(config, { dev }) {
    if (dev) {
      config.devtool = 'source-map'; // no eval-sourcemaps
    }
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // Stub React-Native async storage the MetaMask SDK references in its browser bundle.
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'src/stubs/async-storage.ts'),
    };
    return config;
  },

  // CSP is now handled by middleware.ts for better nonce support
  // No need to set headers here to avoid conflicts
};

export default nextConfig;
