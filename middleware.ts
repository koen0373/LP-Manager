import { NextResponse, NextRequest } from 'next/server';

const ALLOW = [
  /^\/_next\//,
  /^\/favicon\.ico$/,
  /^\/placeholder$/,
  /^\/api\/placeholder\/login$/,
  /^\/api\/health$/, // laat health toe
  /^\/robots\.txt$/,
  /^\/sitemap\.xml$/,
];

export function middleware(req: NextRequest) {
  const pass = process.env.PLACEHOLDER_PASS;
  if (!pass) return NextResponse.next(); // beveiliging alleen actief als env is gezet

  const { pathname } = req.nextUrl;
  if (ALLOW.some((r) => r.test(pathname))) return NextResponse.next();

  const cookie = req.cookies.get('ll_pass')?.value;
  if (cookie && cookie === pass) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = '/placeholder';
  url.search = ''; // schoon
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
