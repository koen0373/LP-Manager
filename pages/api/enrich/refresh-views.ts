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
    // Refresh range status view
    try {
      const rangeStart = Date.now();
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_position_range_status"`;
      results.rangeStatus = {
        success: true,
        duration: Date.now() - rangeStart,
      };
    } catch (error) {
      results.rangeStatus = {
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Refresh position stats view
    try {
      const statsStart = Date.now();
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_pool_position_stats"`;
      results.positionStats = {
        success: true,
        duration: Date.now() - statsStart,
      };
    } catch (error) {
      results.positionStats = {
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }

    // Refresh latest event view
    try {
      const latestStart = Date.now();
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY "mv_position_latest_event"`;
      results.latestEvent = {
        success: true,
        duration: Date.now() - latestStart,
      };
    } catch (error) {
      results.latestEvent = {
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : String(error),
      };
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

