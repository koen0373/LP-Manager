import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  res.setHeader('X-Mail-Stub', '1');
  return res.status(503).json({
    ok: false,
    reason: 'mail subsystem is temporarily disabled for demo build',
  });
}
