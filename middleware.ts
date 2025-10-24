// middleware.ts - Production-tested CSP for Next.js + Vercel
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge-compatible nonce generator (Web Crypto API)
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64');
}

export function middleware(req: NextRequest) {
  // Only apply CSP to HTML navigation requests (not API, not assets)
  const accept = req.headers.get('accept') || '';
  if (!accept.includes('text/html')) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const nonce = generateNonce();

  // Store nonce for _document to use with inline scripts
  res.headers.set('x-nonce', nonce);

  // Development mode: relaxed CSP for React Fast Refresh
  const isDev = process.env.NODE_ENV !== 'production';
  
  const csp = isDev
    ? [
        "default-src 'self'",
        // Dev mode: allow unsafe-eval for React Fast Refresh
        `script-src 'self' 'unsafe-eval' 'nonce-${nonce}'`,
        "connect-src 'self' ws: wss:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "worker-src 'self' blob:",
      ].join('; ')
    : [
        "default-src 'self'",
        // Production: strict CSP
        `script-src 'self' 'nonce-${nonce}'`,
        "connect-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "worker-src 'self' blob:",
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ');

  res.headers.set('Content-Security-Policy', csp);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');

  return res;
}

export const config = {
  matcher: ['/:path*'], // All routes, but we filter on Accept: text/html
};
