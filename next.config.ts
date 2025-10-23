import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages Router configuratie
  reactStrictMode: true,
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

  // Content-Security-Policy: Allow unsafe-eval for Next.js runtime features
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data:",
      "connect-src 'self' https://flare-explorer.flare.network https://flarescan.com https://*.flare.network https://*.enosys.global https://coingecko.com https://*.coingecko.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default nextConfig;