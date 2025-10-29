/**
 * Strategy classification for demo pools
 * 
 * Based on range width percentage:
 * - Aggressive: < 12% (narrow range, higher risk/reward)
 * - Balanced: 12-35% (moderate range)
 * - Conservative: > 35% (wide range, lower risk)
 * 
 * Width calculation: ((max - min) / midpoint) * 100
 * where midpoint = (min + max) / 2
 */

export const AGGRESSIVE_THRESHOLD = 12; // < 12% → Aggressive
export const BALANCED_UPPER = 35; // > 35% → Conservative, between is Balanced

export interface StrategyResult {
  label: 'Aggressive' | 'Balanced' | 'Conservative';
  widthPct: number;
}

/**
 * Classify pool strategy based on range width
 */
export function classifyStrategy(rangeMin: number, rangeMax: number): StrategyResult {
  if (!Number.isFinite(rangeMin) || !Number.isFinite(rangeMax) || rangeMin >= rangeMax) {
    return { label: 'Balanced', widthPct: 0 };
  }

  const midpoint = (rangeMin + rangeMax) / 2;
  if (midpoint === 0) {
    return { label: 'Balanced', widthPct: 0 };
  }

  const widthPct = Math.abs(((rangeMax - rangeMin) / midpoint) * 100);

  if (widthPct < AGGRESSIVE_THRESHOLD) {
    return { label: 'Aggressive', widthPct };
  }

  if (widthPct <= BALANCED_UPPER) {
    return { label: 'Balanced', widthPct };
  }

  return { label: 'Conservative', widthPct };
}

