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

  // Content-Security-Policy: 'unsafe-eval' only in dev for React Refresh
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';

    // In dev: 'unsafe-eval' for react-refresh; in prod: strict CSP
    const scriptSrc = isDev ? "script-src 'self' 'unsafe-eval'" : "script-src 'self'";

    const csp = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data:",
      "connect-src 'self' https://flare-explorer.flare.network https://flarescan.com https://*.flare.network https://*.enosys.global",
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