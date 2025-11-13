/** @type {import('next').NextConfig} */
/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('path');
const TOKEN_ICON_REMOTE_PATTERNS = [
  {
    protocol: 'https',
    hostname: 'static.dexscreener.com',
    pathname: '/token-icons/**',
  },
];

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async rewrites() {
    return [
      {
        source: '/media/tokens/:path*',
        destination: '/icons/:path*',
      },
    ];
  },
  images: {
    remotePatterns: TOKEN_ICON_REMOTE_PATTERNS,
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@react-native-async-storage/async-storage': path.join(process.cwd(), 'src', 'stubs', 'async-storage.ts'),
    };
    return config;
  },
};
module.exports = nextConfig;
