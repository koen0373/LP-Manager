import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/lib/data/db';

/**
 * Debug endpoint to clear cached ledger data for a tokenId
 * Usage: /api/debug/clear-cache?tokenId=22003
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenId } = req.query;

  if (!tokenId || typeof tokenId !== 'string') {
    return res.status(400).json({ error: 'tokenId required' });
  }

  try {
    console.log(`[DEBUG] Clearing cache for tokenId: ${tokenId}`);

    // Delete all position events for this tokenId
    const deletedEvents = await db.positionEvent.deleteMany({
      where: { tokenId },
    });

    // Delete all position transfers for this tokenId
    const deletedTransfers = await db.positionTransfer.deleteMany({
      where: { tokenId },
    });

    // Delete backfill cursor to force full resync
    const deletedCursor = await db.backfillCursor.deleteMany({
      where: { tokenId: parseInt(tokenId, 10) },
    });

    console.log(`[DEBUG] Deleted ${deletedEvents.count} events, ${deletedTransfers.count} transfers, ${deletedCursor.count} cursor`);

    return res.json({
      success: true,
      message: `Cache cleared for tokenId ${tokenId}`,
      deleted: {
        events: deletedEvents.count,
        transfers: deletedTransfers.count,
        cursor: deletedCursor.count,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error('[DEBUG] Error clearing cache:', error);
    return res.status(500).json({ 
      error: 'Failed to clear cache', 
      details: err.message 
    });
  }
}

