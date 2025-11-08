import { NextResponse, NextRequest } from 'next/server';

/**
 * Placeholder gate policy:
 * - Disabled when NODE_ENV !== 'production' OR PLACEHOLDER_OFF === '1'
 * - Enabled in production unless PLACEHOLDER_OFF === '1'
 */
const ALLOW = [
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/placeholder$/,
  /^\/api\/placeholder\/login$/,
  /^\/api\/health$/,
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
  /^\/admin\//,           // Allow all /admin/* routes
  /^\/api\/admin\//,      // Allow all /api/admin/* routes
];

export function middleware(req: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production';
  const off = process.env.PLACEHOLDER_OFF === '1';
  if (!isProd || off) return NextResponse.next(); // 👉 lokaal altijd doorlaten

  const pass = process.env.PLACEHOLDER_PASS;
  if (!pass) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (ALLOW.some((r) => r.test(pathname))) return NextResponse.next();

  const cookie = req.cookies.get('ll_pass')?.value;
  if (cookie && cookie === pass) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/placeholder';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
