import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/data/db';

/**
 * Check sync status for positions
 * Returns which positions are fresh vs stale
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenIds } = req.query;

  if (!tokenIds) {
    return res.status(400).json({ error: 'tokenIds query parameter required' });
  }

  const ids = Array.isArray(tokenIds) 
    ? tokenIds.map(id => Number(id))
    : tokenIds.split(',').map(id => Number(id));

  try {
    const cursors = await db.backfillCursor.findMany({
      where: { tokenId: { in: ids } },
    });

    const now = Date.now();
    const FRESH_THRESHOLD = 60 * 60 * 1000; // 1 hour

    const status = ids.map(tokenId => {
      const cursor = cursors.find(c => c.tokenId === tokenId);
      
      if (!cursor) {
        return {
          tokenId,
          status: 'never_synced',
          isFresh: false,
          lastSync: null,
        };
      }

      const age = now - cursor.lastFetchedAt.getTime();
      const isFresh = age < FRESH_THRESHOLD;

      return {
        tokenId,
        status: isFresh ? 'fresh' : 'stale',
        isFresh,
        lastSync: cursor.lastFetchedAt.toISOString(),
        ageMinutes: Math.floor(age / (60 * 1000)),
        lastBlock: cursor.lastBlock,
      };
    });

    const allFresh = status.every(s => s.isFresh);

    return res.json({
      allFresh,
      positions: status,
      summary: {
        total: ids.length,
        fresh: status.filter(s => s.isFresh).length,
        stale: status.filter(s => !s.isFresh).length,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[STATUS] Error:', error);
    return res.status(500).json({ error: err.message });
  }
}

