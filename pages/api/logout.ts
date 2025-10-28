import type { NextApiRequest, NextApiResponse } from 'next'
import { serialize } from 'cookie'

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const cookie = serialize('ll_preview', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  res.setHeader('Set-Cookie', cookie)
  res.status(200).json({ ok: true })
}
