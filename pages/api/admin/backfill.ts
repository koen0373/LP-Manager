import type { NextApiRequest, NextApiResponse } from 'next';
import { syncPositionLedger } from '@/lib/sync/syncPositionLedger';

/**
 * Admin endpoint to trigger backfill for specific position IDs
 * Usage: POST /api/admin/backfill
 * Body: { "tokenIds": [22003, 22326, 20445, 21866], "secret": "your-secret" }
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Simple secret check (set BACKFILL_SECRET in Railway env vars)
  const { tokenIds, secret } = req.body;
  const expectedSecret = process.env.BACKFILL_SECRET || 'change-me-in-production';
  
  if (secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!tokenIds || !Array.isArray(tokenIds)) {
    return res.status(400).json({ error: 'tokenIds array required' });
  }

  try {
    const results = [];
    
    for (const tokenId of tokenIds) {
      try {
        console.log(`[BACKFILL API] Starting sync for position ${tokenId}...`);
        await syncPositionLedger(tokenId);
        results.push({ tokenId, status: 'success' });
        console.log(`[BACKFILL API] ✅ Position ${tokenId} synced successfully`);
      } catch (error: any) {
        console.error(`[BACKFILL API] ❌ Position ${tokenId} failed:`, error.message);
        results.push({ tokenId, status: 'failed', error: error.message });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;

    return res.status(200).json({
      success: true,
      summary: {
        total: tokenIds.length,
        successful: successCount,
        failed: failedCount
      },
      results
    });
  } catch (error: any) {
    console.error('[BACKFILL API] Fatal error:', error);
    return res.status(500).json({ 
      error: 'Backfill failed', 
      message: error.message 
    });
  }
}

