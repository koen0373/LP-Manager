import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages Router configuratie
  reactStrictMode: true,
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;