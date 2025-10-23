/**
 * Positions API v2 - Using new discovery module
 * GET /api/positions-v2?address=0x...&refresh=1
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { discoverWalletPositions } from '../../src/lib/discovery/discoverWallet';
import { normalizePositions, sortPositions, filterByStatus } from '../../src/lib/discovery/normalize';
import type { PositionRow } from '../../src/types/positions';

type PositionsResponse = {
  success: boolean;
  data?: {
    positions: PositionRow[];
    summary: {
      totalCount: number;
      activeCount: number;
      inactiveCount: number;
      totalTvlUsd: number;
      totalFeesUsd: number;
      totalRewardsUsd: number;
    };
    fetchedAt: string;
  };
  error?: string;
  duration?: number;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PositionsResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const { address, refresh, status } = req.query;

  if (!address || typeof address !== 'string') {
    return res.status(400).json({ success: false, error: 'Address parameter is required' });
  }

  try {
    console.log(`[API-V2] Fetching positions for address: ${address}`);

    // Discover all positions for this wallet
    const discovery = await discoverWalletPositions(address as `0x${string}`, {
      refresh: refresh === '1' || refresh === 'true',
      includeInactive: true, // Always fetch all, filter later
    });

    // Normalize to PositionRow format
    let positions = normalizePositions(discovery.positions);

    // Filter by status if requested
    if (status === 'active' || status === 'inactive') {
      const statusFilter = status === 'active' ? 'Active' : 'Inactive';
      positions = filterByStatus(positions, statusFilter);
    }

    // Sort active by TVL desc, inactive by rewards desc
    const activePositions = sortPositions(
      filterByStatus(positions, 'Active'),
      'tvl',
      'desc'
    );
    const inactivePositions = sortPositions(
      filterByStatus(positions, 'Inactive'),
      'rewards',
      'desc'
    );

    // Combine: active first, then inactive
    const sortedPositions = [...activePositions, ...inactivePositions];

    const duration = Date.now() - startTime;
    console.log(
      `[API-V2] Positions fetch complete for ${address} - ${sortedPositions.length} positions - ${duration}ms`
    );

    return res.status(200).json({
      success: true,
      data: {
        positions: sortedPositions,
        summary: {
          totalCount: discovery.totalCount,
          activeCount: discovery.activeCount,
          inactiveCount: discovery.inactiveCount,
          totalTvlUsd: discovery.totalTvlUsd,
          totalFeesUsd: discovery.totalFeesUsd,
          totalRewardsUsd: discovery.totalRewardsUsd,
        },
        fetchedAt: discovery.fetchedAt.toISOString(),
      },
      duration,
    });
  } catch (error) {
    console.error('[API-V2] Error fetching positions:', error);
    const duration = Date.now() - startTime;
    
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch positions',
      duration,
    });
  }
}

