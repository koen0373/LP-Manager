import { NextResponse, NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  // Alleen homepage afvangen
  if (req.nextUrl.pathname === '/') {
    const hasPreview = req.cookies.get('ll_preview')?.value === '1';
    if (!hasPreview) {
      return NextResponse.rewrite(new URL('/placeholder', req.url));
    }
  }
  return NextResponse.next();
}
export const config = { matcher: ['/', '/index'] };
