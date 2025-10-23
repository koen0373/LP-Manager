import type { NextApiRequest, NextApiResponse } from 'next';
import { backfillPositions } from '@/lib/backfill/worker';

/**
 * Admin endpoint to trigger backfill for specific position IDs
 * 
 * Usage: POST /api/admin/backfill
 * Body: { 
 *   "tokenIds": [22003, 22326, 20445, 21866], 
 *   "secret": "your-secret",
 *   "mode": "since" | "full",
 *   "sinceBlock": 1000000 (optional)
 * }
 * 
 * Auth: Requires ADMIN_SECRET env var (do NOT use default in production!)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const startTime = Date.now();

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security check
  const { tokenIds, secret, mode = 'since', sinceBlock } = req.body;
  const expectedSecret = process.env.ADMIN_SECRET;
  
  if (!expectedSecret || expectedSecret === 'change-me') {
    return res.status(500).json({ 
      error: 'Server misconfigured',
      message: 'ADMIN_SECRET not set or using default value'
    });
  }

  if (secret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate input
  if (!tokenIds || !Array.isArray(tokenIds)) {
    return res.status(400).json({ error: 'tokenIds array required' });
  }

  if (tokenIds.length === 0) {
    return res.status(400).json({ error: 'tokenIds array cannot be empty' });
  }

  if (tokenIds.length > 20) {
    return res.status(400).json({ 
      error: 'Too many tokenIds',
      message: 'Maximum 20 tokenIds per request. Use worker service for larger batches.'
    });
  }

  // Validate mode
  if (mode && mode !== 'since' && mode !== 'full') {
    return res.status(400).json({ 
      error: 'Invalid mode',
      message: 'mode must be "since" or "full"'
    });
  }

  try {
    console.log(`[BACKFILL API] Starting batch backfill for ${tokenIds.length} positions (mode: ${mode})`);

    const summary = await backfillPositions({
      tokenIds,
      mode: mode as 'since' | 'full',
      sinceBlock,
      concurrency: 5, // Lower concurrency for API calls
    });

    const elapsedMs = Date.now() - startTime;
    console.log(`[BACKFILL API] ✅ Completed in ${elapsedMs}ms`);

    return res.status(200).json({
      success: true,
      summary: {
        total: summary.total,
        successful: summary.successful,
        failed: summary.failed,
        totalInserted: summary.totalInserted,
        totalUpdated: summary.totalUpdated,
        totalSkipped: summary.totalSkipped,
        elapsedMs,
      },
      results: summary.results,
    });
  } catch (error: unknown) {
    const err = error as Error;
    const elapsedMs = Date.now() - startTime;
    console.error(`[BACKFILL API] ❌ Failed after ${elapsedMs}ms:`, error);
    
    return res.status(500).json({ 
      error: 'Backfill failed', 
      message: err.message,
      elapsedMs,
    });
  }
}

