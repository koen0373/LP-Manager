import { NextResponse } from 'next/server';

const COOKIE_NAME = 'll_dev_access';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days to match previous behaviour

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({} as Record<string, unknown>));
  const password = typeof payload.password === 'string' ? payload.password.trim() : '';

  if (!password) {
    return NextResponse.json({ success: false, error: 'Missing preview password.' }, { status: 400 });
  }

  const expected = process.env.APP_PREVIEW_PASSWORD?.trim();
  if (!expected) {
    return NextResponse.json({ success: false, error: 'Preview password not configured.' }, { status: 500 });
  }

  if (password !== expected) {
    return NextResponse.json({ success: false, error: 'Incorrect password' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  const cookieParts = [
    `${COOKIE_NAME}=1`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];

  if (process.env.NODE_ENV !== 'development') {
    cookieParts.push('Secure');
  }

  response.headers.set('Set-Cookie', cookieParts.join('; '));
  return response;
}
