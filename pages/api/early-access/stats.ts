import type { NextApiRequest, NextApiResponse } from 'next';

import { getEarlyAccessStats } from '@/server/services/access';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stats = await getEarlyAccessStats();
    return res.status(200).json(stats);
  } catch (error) {
    console.error('[EARLY_ACCESS_STATS] Failed to load stats', error);
    return res.status(500).json({ error: 'Failed to load early access stats' });
  }
}
