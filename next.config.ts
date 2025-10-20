import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Geen remotePatterns meer nodig - we gebruiken alleen lokale iconen
  trailingSlash: false,
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
