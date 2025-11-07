import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const expected = process.env.PLACEHOLDER_PASS || '';
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, reason: 'method not allowed' });
  }
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const { password } = body || {};
  if (!expected || !password || password !== expected) {
    return res.status(401).json({ ok: false, reason: 'invalid password' });
  }
  res.setHeader('Set-Cookie', [
    `ll_pass=${expected}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`,
  ]);
  return res.status(200).json({ ok: true });
}
