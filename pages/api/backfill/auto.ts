import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/data/db';
import { backfillPositions } from '@/lib/backfill/worker';

/**
 * Auto-sync endpoint for wallet positions
 * Triggered when a user connects their wallet
 * 
 * Checks which positions need syncing and triggers background backfill
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenIds } = req.body;

  if (!tokenIds || !Array.isArray(tokenIds) || tokenIds.length === 0) {
    return res.status(400).json({ error: 'tokenIds array required' });
  }

  try {
    // Check which positions need syncing
    const cursors = await db.backfillCursor.findMany({
      where: { tokenId: { in: tokenIds.map(id => Number(id)) } },
    });

    const now = Date.now();
    const STALE_THRESHOLD = 60 * 60 * 1000; // 1 hour

    const needSync = tokenIds.filter(id => {
      const cursor = cursors.find(c => c.tokenId === Number(id));
      
      // Never synced
      if (!cursor) return true;
      
      // Stale (> 1 hour old)
      const age = now - cursor.lastFetchedAt.getTime();
      return age > STALE_THRESHOLD;
    });

    if (needSync.length === 0) {
      return res.json({ 
        syncing: false,
        message: 'All positions are fresh',
        fresh: tokenIds,
      });
    }

    console.log(`[AUTO-SYNC] Triggering sync for ${needSync.length} positions:`, needSync);

    // Trigger background sync (non-blocking)
    // Using setImmediate to not block the response
    setImmediate(() => {
      backfillPositions({ 
        tokenIds: needSync.map(id => Number(id)), 
        mode: 'since',
        concurrency: 4, // Lower concurrency for auto-sync
      })
        .then(summary => {
          console.log(`[AUTO-SYNC] ✅ Completed for ${needSync.length} positions:`, {
            successful: summary.successful,
            failed: summary.failed,
            elapsed: `${(summary.totalElapsedMs / 1000).toFixed(2)}s`,
          });
        })
        .catch(err => {
          console.error('[AUTO-SYNC] ❌ Failed:', err.message);
        });
    });

    // Return immediately (202 Accepted)
    return res.status(202).json({
      syncing: true,
      message: 'Sync triggered',
      syncing_ids: needSync,
      fresh_ids: tokenIds.filter(id => !needSync.includes(id)),
    });
  } catch (error: any) {
    console.error('[AUTO-SYNC] Error:', error);
    return res.status(500).json({ error: error.message });
  }
}

