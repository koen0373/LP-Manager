/**
 * Data Normalization
 * Transform EnrichedPosition to PositionRow (app's DTO)
 */

import type { EnrichedPosition } from './types';
import type { PositionRow } from '../../types/positions';

/**
 * Convert EnrichedPosition to PositionRow
 */
export function normalizePosition(enriched: EnrichedPosition): PositionRow {
  const {
    tokenId,
    poolAddress,
    token0,
    token1,
    fee,
    currentTick,
    tickLower,
    tickUpper,
    liquidity,
    amount0,
    amount1,
    tokensOwed0,
    tokensOwed1,
    inRange,
    lowerPrice,
    upperPrice,
    tvlUsd,
    feesUsd,
    rflrRewards,
    rflrUsd,
    owner,
  } = enriched;

  const normalized: PositionRow = {
    id: tokenId,
    pairLabel: `${token0.symbol}/${token1.symbol}`,
    poolAddress: poolAddress as `0x${string}`,
    walletAddress: owner,
    
    token0: {
      address: token0.address,
      symbol: token0.symbol,
      name: token0.name,
      decimals: token0.decimals,
    },
    token1: {
      address: token1.address,
      symbol: token1.symbol,
      name: token1.name,
      decimals: token1.decimals,
    },
    
    feeTierBps: fee,
    
    tickLower,
    tickLowerLabel: tickLower.toString(),
    tickUpper,
    tickUpperLabel: tickUpper.toString(),
    currentTick,
    
    amount0: Number(amount0) / Math.pow(10, token0.decimals),
    amount1: Number(amount1) / Math.pow(10, token1.decimals),
    
    fee0: Number(tokensOwed0) / Math.pow(10, token0.decimals),
    fee1: Number(tokensOwed1) / Math.pow(10, token1.decimals),
    
    lowerPrice,
    upperPrice,
    
    price0Usd: token0.priceUsd,
    price1Usd: token1.priceUsd,
    
    tvlUsd,
    rewardsUsd: feesUsd,
    
    rflrAmount: rflrRewards,
    rflrUsd,
    rflrPriceUsd: rflrRewards > 0 ? rflrUsd / rflrRewards : 0,
    
    // APS rewards (placeholder - Phase 3 will add real APS data)
    apsAmount: 0,
    apsUsd: 0,
    apsPriceUsd: 0,
    
    inRange,
    isInRange: inRange,
    
    status: tvlUsd > 1 ? 'Active' : 'Inactive',
  };

  return normalized;
}

/**
 * Normalize multiple positions
 */
export function normalizePositions(enrichedPositions: EnrichedPosition[]): PositionRow[] {
  return enrichedPositions.map(normalizePosition);
}

/**
 * Filter normalized positions by status
 */
export function filterByStatus(
  positions: PositionRow[],
  status: 'Active' | 'Inactive'
): PositionRow[] {
  return positions.filter((pos) => pos.status === status);
}

/**
 * Sort normalized positions
 */
export function sortPositions(
  positions: PositionRow[],
  sortBy: 'tvl' | 'rewards' | 'fees' | 'id' = 'tvl',
  order: 'asc' | 'desc' = 'desc'
): PositionRow[] {
  const sorted = [...positions];

  sorted.sort((a, b) => {
    let aValue: number;
    let bValue: number;

    switch (sortBy) {
      case 'tvl':
        aValue = a.tvlUsd;
        bValue = b.tvlUsd;
        break;
      case 'rewards':
        aValue = a.rewardsUsd + a.rflrUsd;
        bValue = b.rewardsUsd + b.rflrUsd;
        break;
      case 'fees':
        aValue = a.rewardsUsd;
        bValue = b.rewardsUsd;
        break;
      case 'id':
        aValue = parseInt(a.id, 10);
        bValue = parseInt(b.id, 10);
        break;
      default:
        aValue = a.tvlUsd;
        bValue = b.tvlUsd;
    }

    return order === 'desc' ? bValue - aValue : aValue - bValue;
  });

  return sorted;
}

