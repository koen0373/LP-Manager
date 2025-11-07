/** @type {import('next').NextConfig} */
const path = require('path');
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
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
