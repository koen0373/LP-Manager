/**
 * Demo Pool Selection Logic
 * 
 * Ensures homepage demo always shows diversity:
 * - ≥3 different strategies (Aggressive / Balanced / Conservative)
 * - ≥3 different range statuses (In Range / Near Band / Out of Range)
 * - Coverage across all 3 providers (Enosys, SparkDEX, BlazeSwap)
 */

import { getRangeWidthPct, getStrategy, getRangeStatus as _getRangeStatus } from '@/components/pools/PoolRangeIndicator';
import type { RangeStatus } from '@/components/pools/PoolRangeIndicator';

export type Strategy = 'aggressive' | 'balanced' | 'conservative';
export type Band = RangeStatus;

export interface DemoPool {
  providerSlug: string;
  providerName: string;
  id: string;
  token0: string;
  token1: string;
  token0Icon?: string | null;
  token1Icon?: string | null;
  feeBps: number;
  rangeMin: number;
  rangeMax: number;
  currentPrice?: number;
  tvlUsd: number;
  unclaimedFeesUsd: number;
  dailyFeesUsd: number;
  dailyIncentivesUsd: number;
  incentivesUsd: number;
  incentivesTokenAmount?: number;
  status: Band;
  // Computed fields added by enricher
  strategy?: Strategy;
  rangeWidthPct?: number;
  apr24h?: number;
}

const TARGET_COUNT = 9;
const MIN_STRATEGIES = 3;
const MIN_BANDS = 3;
const REQUIRED_PROVIDERS = new Set(['enosys', 'sparkdex', 'blazeswap']);

/**
 * Enrich pool with computed strategy and APR
 */
function enrichPool(pool: DemoPool): DemoPool {
  const rangeWidthPct = getRangeWidthPct(pool.rangeMin, pool.rangeMax);
  const strategyResult = getStrategy(rangeWidthPct);
  const apr24h =
    pool.tvlUsd > 0
      ? ((pool.dailyFeesUsd + pool.dailyIncentivesUsd) / pool.tvlUsd) * 365 * 100
      : 0;

  return {
    ...pool,
    strategy: strategyResult.tone,
    rangeWidthPct,
    apr24h,
  };
}

/**
 * Group array by key function
 */
function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce(
    (acc, item) => {
      const key = keyFn(item);
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, T[]>,
  );
}

/**
 * Pick diverse set of pools ensuring:
 * - ≥3 distinct strategies
 * - ≥3 distinct bands (in/near/out)
 * - ≥1 pool per required provider (if available)
 * - Graceful degradation if constraints cannot be fully met
 */
export function pickDiverse(pools: DemoPool[], count = TARGET_COUNT): DemoPool[] {
  // Enrich all pools first
  const enriched = pools.map(enrichPool);

  // Shuffle to avoid determinism
  const shuffled = [...enriched].sort(() => Math.random() - 0.5);

  // Group by strategy, band, and provider
  const byStrategy = groupBy(shuffled, (p) => p.strategy || 'unknown');
  const byBand = groupBy(shuffled, (p) => p.status);
  const byProvider = groupBy(shuffled, (p) => p.providerSlug);

  // Track selected pools and their unique keys
  const result: DemoPool[] = [];
  const used = new Set<string>();

  // Helper: add pool if not duplicate
  const push = (p: DemoPool) => {
    const key = `${p.providerSlug}:${p.id}`;
    if (!used.has(key)) {
      result.push(p);
      used.add(key);
    }
  };

  // 1. Ensure each required provider is present (take top 2 by TVL per provider)
  REQUIRED_PROVIDERS.forEach((slug) => {
    const providerPools = (byProvider[slug] || [])
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 2);
    providerPools.forEach(push);
  });

  // 2. Ensure each strategy is present (take top 2 by TVL per strategy)
  (['aggressive', 'balanced', 'conservative'] as Strategy[]).forEach((strategy) => {
    const strategyPools = (byStrategy[strategy] || [])
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 2);
    strategyPools.forEach(push);
  });

  // 3. Ensure each band is present (take top 2 by TVL per band)
  (['in', 'near', 'out'] as Band[]).forEach((band) => {
    const bandPools = (byBand[band] || [])
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 2);
    bandPools.forEach(push);
  });

  // 4. Fill remaining slots with highest quality pools (TVL desc, then APR desc)
  const remaining = shuffled
    .filter((p) => !used.has(`${p.providerSlug}:${p.id}`))
    .sort((a, b) => b.tvlUsd - a.tvlUsd || (b.apr24h || 0) - (a.apr24h || 0));

  remaining.forEach((p) => {
    if (result.length < count) push(p);
  });

  // 5. Final shuffle for visual variety while keeping diversity
  const final = result.slice(0, count).sort(() => Math.random() - 0.5);

  return final;
}

/**
 * Validate that selection meets diversity requirements
 */
export function validateDiversity(pools: DemoPool[]): {
  valid: boolean;
  strategies: Set<Strategy>;
  bands: Set<Band>;
  providers: Set<string>;
  warnings: string[];
} {
  const enriched = pools.map((p) => (p.strategy ? p : enrichPool(p)));

  const strategies = new Set(enriched.map((p) => p.strategy).filter(Boolean)) as Set<Strategy>;
  const bands = new Set(enriched.map((p) => p.status)) as Set<Band>;
  const providers = new Set(enriched.map((p) => p.providerSlug));

  const warnings: string[] = [];

  if (strategies.size < MIN_STRATEGIES) {
    warnings.push(`Only ${strategies.size}/3 strategies present: ${Array.from(strategies).join(', ')}`);
  }

  if (bands.size < MIN_BANDS) {
    warnings.push(`Only ${bands.size}/3 range statuses present: ${Array.from(bands).join(', ')}`);
  }

  REQUIRED_PROVIDERS.forEach((prov) => {
    if (!providers.has(prov)) {
      warnings.push(`Missing provider: ${prov}`);
    }
  });

  const valid = strategies.size >= MIN_STRATEGIES && bands.size >= MIN_BANDS && warnings.length === 0;

  return {
    valid,
    strategies,
    bands,
    providers,
    warnings,
  };
}


