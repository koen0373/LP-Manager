import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString('base64');
}

export function middleware(req: NextRequest) {
  let response: NextResponse | null = null;

  if (process.env.PLACEHOLDER_ENABLED === 'true') {
    const { pathname } = req.nextUrl;
    const bypass =
      pathname.startsWith('/login') ||
      pathname.startsWith('/api') ||
      pathname.startsWith('/placeholder') ||
      pathname.startsWith('/_next') ||
      pathname.startsWith('/favicon') ||
      pathname.startsWith('/assets');

    if (!bypass) {
      const hasAccess = req.cookies.get('ll_dev_access')?.value === '1';
      if (!hasAccess) {
        const url = req.nextUrl.clone();
        url.pathname = '/placeholder';
        response = NextResponse.rewrite(url);
      }
    }
  }

  const accept = req.headers.get('accept') || '';
  if (!accept.includes('text/html')) {
    return response ?? NextResponse.next();
  }

  const res = response ?? NextResponse.next();
  const nonce = generateNonce();

  res.headers.set('x-nonce', nonce);

  const isDev = process.env.NODE_ENV !== 'production';

  const csp = isDev
    ? [
        "default-src 'self'",
        `script-src 'self' 'unsafe-eval' 'nonce-${nonce}'`,
        "connect-src 'self' ws: wss:",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "worker-src 'self' blob:",
      ].join('; ')
    : [
        "default-src 'self'",
        `script-src 'self' 'unsafe-eval' 'nonce-${nonce}'`,
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
  matcher: ['/:path*'],
};
