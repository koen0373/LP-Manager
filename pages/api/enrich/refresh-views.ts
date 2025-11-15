/**
 * Refresh Materialized Views API
 * 
 * Refreshes materialized views for range status and position stats.
 * Should be called periodically (every 5-10 minutes) or after bulk indexer updates.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * POST /api/enrich/refresh-views
 * Refresh all materialized views
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Verify cron secret for security
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const startTime = Date.now();
  const results: Record<string, { success: boolean; duration: number; error?: string }> = {};

  try {
    // Refresh in safe order (dependencies first)
    const refreshOrder = [
      { name: 'poolLatestState', mv: 'mv_pool_latest_state' },
      { name: 'poolFees24h', mv: 'mv_pool_fees_24h' },
      { name: 'rangeStatus', mv: 'mv_position_range_status' },
      { name: 'positionStats', mv: 'mv_pool_position_stats' },
      { name: 'latestEvent', mv: 'mv_position_latest_event' },
      { name: 'poolVolume7d', mv: 'mv_pool_volume_7d' },
      { name: 'poolFees7d', mv: 'mv_pool_fees_7d' },
      { name: 'positionsActive7d', mv: 'mv_positions_active_7d' },
      { name: 'walletLp7d', mv: 'mv_wallet_lp_7d' },
      { name: 'poolChanges7d', mv: 'mv_pool_changes_7d' },
    ];

    for (const { name, mv } of refreshOrder) {
      try {
        const start = Date.now();
        await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${mv}"`);
        results[name] = {
          success: true,
          duration: Date.now() - start,
        };
      } catch (error) {
        results[name] = {
          success: false,
          duration: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const totalDuration = Date.now() - startTime;
    const allSuccess = Object.values(results).every((r) => r.success);

    return res.status(allSuccess ? 200 : 207).json({
      success: allSuccess,
      duration: totalDuration,
      results,
    });
  } catch (error) {
    console.error('[refresh-views] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  } finally {
    await prisma.$disconnect();
  }
}

