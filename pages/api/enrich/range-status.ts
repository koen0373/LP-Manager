/**
 * On-Demand Enrichment API
 * 
 * Provides enrichment endpoints that calculate values on-demand with caching.
 * Replaces bulk enrichment scripts for better performance and reliability.
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * GET /api/enrich/range-status/:tokenId
 * Get range status for a position (uses materialized view)
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { tokenId, poolAddress } = req.query;

  if (!tokenId && !poolAddress) {
    return res.status(400).json({ error: 'tokenId or poolAddress required' });
  }

  try {
    // Use materialized view for fast lookup
    if (tokenId) {
      const rangeStatus = await prisma.$queryRaw<Array<{
        tokenId: string;
        pool: string;
        tickLower: number | null;
        tickUpper: number | null;
        current_tick: number | null;
        range_status: 'IN_RANGE' | 'OUT_OF_RANGE' | null;
      }>>`
        SELECT * FROM "mv_position_range_status"
        WHERE "tokenId" = ${tokenId}
        LIMIT 1
      `;

      if (rangeStatus.length === 0) {
        return res.status(404).json({ error: 'Position not found' });
      }

      return res.status(200).json(rangeStatus[0]);
    }

    // Get all positions for a pool
    if (poolAddress) {
      const rangeStatuses = await prisma.$queryRaw<Array<{
        tokenId: string;
        pool: string;
        tickLower: number | null;
        tickUpper: number | null;
        current_tick: number | null;
        range_status: 'IN_RANGE' | 'OUT_OF_RANGE' | null;
      }>>`
        SELECT * FROM "mv_position_range_status"
        WHERE "pool" = ${poolAddress}
      `;

      return res.status(200).json({ positions: rangeStatuses });
    }
  } catch (error) {
    console.error('[enrich-api] Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    await prisma.$disconnect();
  }
}

