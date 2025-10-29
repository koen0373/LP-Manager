export function calcApr24h(opts: {
  tvlUsd: number | null | undefined;
  dailyFeesUsd?: number | null | undefined;
  dailyIncentivesUsd?: number | null | undefined;
}): number {
  const tvl = Number(opts.tvlUsd ?? 0);
  const fees = Number(opts.dailyFeesUsd ?? 0);
  const incentives = Number(opts.dailyIncentivesUsd ?? 0);

  if (!Number.isFinite(tvl) || tvl <= 0) {
    return 0;
  }

  const apr = ((fees + incentives) / tvl) * 365 * 100;

  if (!Number.isFinite(apr) || apr <= 0) {
    return 0;
  }

  return apr;
}

/**
 * Format fee tier from basis points to percentage string
 * @param feeTierBps - Fee tier in basis points (e.g., 3000 for 0.30%)
 * @returns Formatted fee percentage (e.g., "0.30%")
 */
export function formatFeeTier(feeTierBps: number | null | undefined): string {
  const bps = Number(feeTierBps ?? 0);
  if (!Number.isFinite(bps) || bps <= 0) return '—';
  const pct = bps / 10000;
  return `${pct.toFixed(2)}%`;
}

/**
 * Format number in compact notation with K/M suffixes
 * @param value - Number to format
 * @returns Compact string (e.g., "1.1k", "2.3M")
 */
export function formatCompactNumber(value: number | null | undefined): string {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num) || num === 0) return '—';
  
  const absNum = Math.abs(num);
  
  if (absNum >= 1e6) {
    return `${(num / 1e6).toFixed(1)}M`;
  }
  if (absNum >= 1e3) {
    return `${(num / 1e3).toFixed(1)}k`;
  }
  return num.toFixed(0);
}
