type PositionRow = {
  isInRange?: boolean;
  status?: 'in' | 'near' | 'out';
  tvlUsd?: number;
  // Fees
  unclaimedFeesUsd?: number;
  dailyFeesUsd?: number;
  // Incentives (rFLR, APS, etc.)
  incentivesUsd?: number;
  rflrRewardsUsd?: number;
  rflrUsd?: number;
  // Total rewards (should be fees + incentives, but we calculate it ourselves)
  rewardsUsd?: number;
  providerSlug?: string;
  provider?: string;
  dexName?: string;
  [key: string]: unknown;
};

type PositionsSummary = {
  total: number;
  active: number;
  inactive: number;
  archived: number;
  byProvider: Record<string, number>;
};

export function summarizePositions(positions: PositionRow[]): PositionsSummary {
  if (!Array.isArray(positions) || positions.length === 0) {
    console.log('[summarizePositions] No positions to summarize');
    return {
      total: 0,
      active: 0,
      inactive: 0,
      archived: 0,
      byProvider: {},
    };
  }

  console.log('[summarizePositions] Processing', positions.length, 'positions');

  let active = 0;
  let inactive = 0;
  let archived = 0;
  const byProvider: Record<string, number> = {};

  for (const pos of positions) {
    const tvl = pos.tvlUsd || 0;
    
    // Calculate FEES from multiple possible field names
    const fees = pos.unclaimedFeesUsd || pos.dailyFeesUsd || 0;
    
    // Calculate INCENTIVES (rFLR, APS, etc.)
    const incentives = pos.incentivesUsd || pos.rflrRewardsUsd || pos.rflrUsd || 0;
    
    // REWARDS = FEES + INCENTIVES
    const rewards = fees + incentives;
    
    // Categorization (NEVER use range status)
    // Active: TVL > 0 (regardless of range)
    // Inactive: TVL = 0 AND Rewards > 0
    // Ended: TVL = 0 AND Rewards = 0
    
    if (tvl > 0) {
      active++;
    } else if (rewards > 0) {
      inactive++;
    } else {
      archived++;
    }

    // Provider slug (handle different field names)
    const providerKey = pos.providerSlug || pos.provider || pos.dexName || 'unknown';
    byProvider[providerKey] = (byProvider[providerKey] || 0) + 1;
  }

  console.log('[summarizePositions] Summary:', {
    total: positions.length,
    active,
    inactive,
    archived,
    byProvider,
  });

  return {
    total: positions.length,
    active,
    inactive,
    archived,
    byProvider,
  };
}

