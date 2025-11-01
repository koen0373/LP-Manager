/**
 * Position Utilities - Server Side
 * 
 * CANONICAL calculation logic for position data.
 * This is the SINGLE SOURCE OF TRUTH for:
 * - Reward calculations (fees + incentives)
 * - Position categorization (Active/Inactive/Ended)
 * - Position sorting
 * 
 * ⚠️ IMPORTANT: Never duplicate this logic in components!
 * Always import these functions instead of writing custom calculations.
 */

import type { PositionRow } from '@/types/positions';

/**
 * Calculate total rewards (unclaimed fees + incentives)
 * 
 * This is the CANONICAL rewards calculation used everywhere.
 * 
 * @param position - Position data from any provider
 * @returns Total rewards in USD (fees + all incentives)
 * 
 * @example
 * const rewards = calculateRewards(position);
 * console.log(`Total rewards: $${rewards.toFixed(2)}`);
 */
export function calculateRewards(position: PositionRow): number {
  // FEES: Unclaimed trading fees
  const fees = position.unclaimedFeesUsd || 
               position.dailyFeesUsd || 
               0;
  
  // INCENTIVES: rFLR, APS, and future reward tokens
  // Use incentivesUsd if available (canonical field)
  // Otherwise fall back to provider-specific fields
  const incentives = position.incentivesUsd || 
                    position.rflrRewardsUsd || 
                    position.rflrUsd || 
                    0;
  
  return fees + incentives;
}

/**
 * Categorize a single position based on CANONICAL rules
 * 
 * Rules (NEVER use range status for categorization):
 * - Active: TVL > 0 (regardless of in/out of range)
 * - Inactive: TVL = 0 AND Rewards > 0
 * - Ended: TVL = 0 AND Rewards = 0
 * 
 * @param position - Position data
 * @returns Category: 'Active' | 'Inactive' | 'Ended'
 * 
 * @example
 * const category = categorizePosition(position);
 * if (category === 'Active') {
 *   console.log('This pool has liquidity');
 * }
 */
export function categorizePosition(
  position: PositionRow
): 'Active' | 'Inactive' | 'Ended' {
  const tvl = position.tvlUsd || 0;
  const rewards = calculateRewards(position);
  
  // Rule 1: Any TVL = Active (even $0.01)
  if (tvl > 0) return 'Active';
  
  // Rule 2: No TVL but has rewards = Inactive
  if (rewards > 0) return 'Inactive';
  
  // Rule 3: No TVL and no rewards = Ended
  return 'Ended';
}

/**
 * Categorize all positions into buckets
 * 
 * @param positions - Array of positions
 * @returns Object with active, inactive, and ended arrays
 * 
 * @example
 * const { active, inactive, ended } = categorizePositions(positions);
 * console.log(`Found ${active.length} active pools`);
 */
export function categorizePositions(positions: PositionRow[]): {
  active: PositionRow[];
  inactive: PositionRow[];
  ended: PositionRow[];
} {
  const active: PositionRow[] = [];
  const inactive: PositionRow[] = [];
  const ended: PositionRow[] = [];
  
  positions.forEach(p => {
    const category = categorizePosition(p);
    if (category === 'Active') active.push(p);
    else if (category === 'Inactive') inactive.push(p);
    else ended.push(p);
  });
  
  return { active, inactive, ended };
}

/**
 * Sort positions by category and value
 * 
 * Sort order:
 * 1. Active pools (by TVL desc)
 * 2. Inactive pools (by rewards desc)
 * 3. Ended pools (by id)
 * 
 * @param positions - Array of positions to sort
 * @returns Sorted array (does not mutate original)
 * 
 * @example
 * const sorted = sortPositions(positions);
 * // Active pools first, sorted by TVL
 */
export function sortPositions(positions: PositionRow[]): PositionRow[] {
  return [...positions].sort((a, b) => {
    const catA = categorizePosition(a);
    const catB = categorizePosition(b);
    
    // First sort by category: Active > Inactive > Ended
    if (catA !== catB) {
      if (catA === 'Active') return -1;
      if (catB === 'Active') return 1;
      if (catA === 'Inactive') return -1;
      return 1;
    }
    
    // Within same category: sort by value
    if (catA === 'Active') {
      // Active: sort by TVL (highest first)
      return (b.tvlUsd || 0) - (a.tvlUsd || 0);
    } else if (catA === 'Inactive') {
      // Inactive: sort by rewards (highest first)
      return calculateRewards(b) - calculateRewards(a);
    }
    
    // Ended: sort by ID (stable sort)
    return (a.id || '').localeCompare(b.id || '');
  });
}

/**
 * Count positions by provider
 * 
 * @param positions - Array of positions
 * @returns Object with provider slugs as keys and counts as values
 * 
 * @example
 * const byProvider = countByProvider(positions);
 * // { 'enosys-v3': 18, 'sparkdex-v3': 4 }
 */
export function countByProvider(positions: PositionRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  positions.forEach(p => {
    const provider = p.providerSlug || p.provider || 'unknown';
    counts[provider] = (counts[provider] || 0) + 1;
  });
  
  return counts;
}

/**
 * Calculate summary totals for positions
 * 
 * @param positions - Array of positions
 * @returns Summary object with totals
 * 
 * @example
 * const summary = calculateSummary(positions);
 * console.log(`Total TVL: $${summary.totals.tvlUsd}`);
 */
export function calculateSummary(positions: PositionRow[]) {
  const categorized = categorizePositions(positions);
  
  const totals = {
    tvlUsd: 0,
    unclaimedFeesUsd: 0,
    incentivesUsd: 0,
    totalRewardsUsd: 0
  };
  
  positions.forEach(p => {
    totals.tvlUsd += p.tvlUsd || 0;
    totals.unclaimedFeesUsd += p.unclaimedFeesUsd || p.dailyFeesUsd || 0;
    
    const incentives = p.incentivesUsd || p.rflrRewardsUsd || p.rflrUsd || 0;
    totals.incentivesUsd += incentives;
    
    totals.totalRewardsUsd += calculateRewards(p);
  });
  
  return {
    total: positions.length,
    active: categorized.active.length,
    inactive: categorized.inactive.length,
    ended: categorized.ended.length,
    byProvider: countByProvider(positions),
    totals
  };
}

/**
 * Enrich a single position with calculated fields
 * 
 * Adds:
 * - rewardsUsd: total rewards (fees + incentives)
 * - category: 'Active' | 'Inactive' | 'Ended'
 * 
 * @param position - Position to enrich
 * @returns Position with calculated fields added
 * 
 * @example
 * const enriched = enrichPosition(position);
 * console.log(enriched.category); // 'Active'
 * console.log(enriched.rewardsUsd); // 123.45
 */
export function enrichPosition(position: PositionRow): PositionRow & {
  rewardsUsd: number;
  category: 'Active' | 'Inactive' | 'Ended';
} {
  return {
    ...position,
    rewardsUsd: calculateRewards(position),
    category: categorizePosition(position)
  };
}

/**
 * Enrich all positions with calculated fields
 * 
 * @param positions - Array of positions to enrich
 * @returns Array of enriched positions
 * 
 * @example
 * const enriched = enrichPositions(positions);
 * // All positions now have rewardsUsd and category fields
 */
export function enrichPositions(positions: PositionRow[]) {
  return positions.map(enrichPosition);
}






