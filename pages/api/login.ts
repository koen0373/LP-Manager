import type { NextApiRequest, NextApiResponse } from 'next';

const COOKIE_NAME = 'll_dev_access';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

  if (!password) {
    return res.status(400).json({ success: false, error: 'Missing preview password.' });
  }

  const expected = process.env.APP_PREVIEW_PASSWORD?.trim();
  if (!expected) {
    return res.status(500).json({ success: false, error: 'Preview password not configured.' });
  }

  if (password !== expected) {
    return res.status(401).json({ success: false, error: 'Incorrect password' });
  }

  // Set cookie
  const cookieValue = [
    `${COOKIE_NAME}=1`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${MAX_AGE_SECONDS}`,
  ];

  if (process.env.NODE_ENV !== 'development') {
    cookieValue.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieValue.join('; '));
  return res.status(200).json({ success: true });
}

