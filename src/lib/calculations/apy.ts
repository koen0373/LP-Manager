/**
 * Calculate APY (Annual Percentage Yield) for a liquidity pool
 * 
 * APY = (Fees Earned / Average TVL) × (365 / Days Active) × 100
 */

export interface ApyInput {
  feesEarned: number;        // Total fees earned in USD
  averageTvl: number;        // Average TVL over the period in USD
  daysActive: number;        // Number of days the position has been active
}

export interface ApyResult {
  apy24h: number;           // APY extrapolated from last 24h
  apy7d: number;            // APY extrapolated from last 7d
  apy1m: number;            // APY extrapolated from last 30d
  apy1y: number;            // Actual APY over 1 year (if enough data)
  apyAllTime: number;       // APY since pool creation
}

/**
 * Calculate APY for different time windows
 */
export function calculateApy(
  totalFeesEarned: number,
  currentTvl: number,
  createdAt: Date,
  feesLast24h?: number,
  feesLast7d?: number,
  feesLast30d?: number,
  feesLast365d?: number
): ApyResult {
  const now = new Date();
  const daysActive = Math.max(1, (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  
  // All-time APY
  const apyAllTime = currentTvl > 0 
    ? (totalFeesEarned / currentTvl) * (365 / daysActive) * 100
    : 0;

  // 24h APY (extrapolated)
  const apy24h = (feesLast24h !== undefined && currentTvl > 0)
    ? (feesLast24h / currentTvl) * 365 * 100
    : 0;

  // 7d APY (extrapolated)
  const apy7d = (feesLast7d !== undefined && currentTvl > 0)
    ? (feesLast7d / currentTvl) * (365 / 7) * 100
    : 0;

  // 1M APY (extrapolated)
  const apy1m = (feesLast30d !== undefined && currentTvl > 0)
    ? (feesLast30d / currentTvl) * (365 / 30) * 100
    : 0;

  // 1Y APY (actual if enough data, otherwise all-time)
  const apy1y = daysActive >= 365 && feesLast365d !== undefined && currentTvl > 0
    ? (feesLast365d / currentTvl) * 100
    : apyAllTime;

  return {
    apy24h: isFinite(apy24h) ? apy24h : 0,
    apy7d: isFinite(apy7d) ? apy7d : 0,
    apy1m: isFinite(apy1m) ? apy1m : 0,
    apy1y: isFinite(apy1y) ? apy1y : 0,
    apyAllTime: isFinite(apyAllTime) ? apyAllTime : 0,
  };
}

/**
 * Format APY for display
 */
export function formatApy(apy: number): string {
  if (!isFinite(apy) || apy === 0) return '--%';
  if (Math.abs(apy) < 0.01) return '<0.01%';
  if (Math.abs(apy) > 10000) return '>10,000%';
  return `${apy.toFixed(2)}%`;
}

