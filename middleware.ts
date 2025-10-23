// middleware.ts - Robust CSP with nonce for Vercel production
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge-compatible nonce generator (crypto module not available in Edge Runtime)
function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString('base64');
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Generate per-request nonce for CSP
  const nonce = generateNonce();

  // Store nonce for use in _document (if needed for inline scripts)
  res.headers.set('x-nonce', nonce);

  // Strict CSP with nonce + strict-dynamic (no unsafe-eval needed)
  // strict-dynamic allows Next.js dynamic chunks without unsafe-inline
  // Note: https: fallback for older browsers that don't support strict-dynamic
  const csp = [
    "default-src 'self'",
    // Scripts: self + nonce for inline init, strict-dynamic for dynamic chunks, https: fallback
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https:`,
    // Connect: own API + external backends (server-side only)
    "connect-src 'self' https://flare-explorer.flare.network https://flarescan.com https://flare-api.flare.network https://api.coingecko.com wss://relay.walletconnect.com https://rpc.walletconnect.com",
    // Styles: self + unsafe-inline for Tailwind, Google Fonts
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  res.headers.set('Content-Security-Policy', csp);
  
  // Additional security headers
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-XSS-Protection', '1; mode=block');

  return res;
}

export const config = {
  matcher: ['/:path*'], // Apply to all routes
};

