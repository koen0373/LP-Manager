/**
 * Live Demo Pool Selection Logic
 * 
 * Provides utilities for selecting diverse pools from real wallet positions:
 * - Stable wallet shuffling with seeded randomness
 * - Diversity enforcement (≥3 strategies, ≥3 statuses, multi-provider)
 * - APR calculation (fees + incentives)
 * - Simple TTL cache for performance
 */

import { getRangeWidthPct, getStrategy, getRangeStatus, STRATEGY_THRESHOLDS } from '@/components/pools/PoolRangeIndicator';
import type { RangeStatus } from '@/components/pools/PoolRangeIndicator';

export type Strategy = 'aggressive' | 'balanced' | 'conservative';
export type Band = RangeStatus;

export interface LivePool {
  provider: string;
  providerSlug: string;
  poolId: string;
  pair: string;
  feeTierBps: number;
  tvlUsd: number;
  fees24hUsd: number;
  incentives24hUsd: number;
  status: Band;
  range: {
    min: number;
    max: number;
    current: number;
  };
  apr24h: number;
  // Computed fields
  strategy?: Strategy;
  rangeWidthPct?: number;
}

export interface DiversityResult {
  pools: LivePool[];
  diversitySatisfied: boolean;
  warnings?: string[];
}

const MIN_STRATEGIES = 3;
const MIN_BANDS = 3;
const REQUIRED_PROVIDERS = new Set(['enosys', 'sparkdex', 'blazeswap']);

/**
 * Simple seeded shuffle using a numeric seed
 */
function seededShuffle<T>(array: T[], seed: number): T[] {
  const arr = [...array];
  let currentSeed = seed;
  
  // Simple LCG (Linear Congruential Generator)
  const random = () => {
    currentSeed = (currentSeed * 1103515245 + 12345) % 2147483648;
    return currentSeed / 2147483648;
  };

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

/**
 * Pick candidate wallets using stable seeded shuffle
 * Seed = current minute + fixed salt for variation per minute
 */
export function pickCandidateWallets(wallets: string[], count: number): string[] {
  if (wallets.length === 0) return [];
  
  // Seed based on current minute (changes every 60s)
  const now = new Date();
  const seed = now.getUTCFullYear() * 10000 + 
               (now.getUTCMonth() + 1) * 100 + 
               now.getUTCDate() * 24 + 
               now.getUTCHours() * 60 + 
               now.getUTCMinutes();
  
  const shuffled = seededShuffle(wallets, seed);
  return shuffled.slice(0, Math.min(count, wallets.length));
}

/**
 * Compute 24h APR including fees AND incentives
 */
export function computeAPR24h({
  fees24hUsd,
  incentives24hUsd,
  tvlUsd,
}: {
  fees24hUsd: number;
  incentives24hUsd: number;
  tvlUsd: number;
}): number {
  if (!tvlUsd || tvlUsd <= 0) return 0;
  
  const dailyReturn = fees24hUsd + incentives24hUsd;
  const apr = (dailyReturn / tvlUsd) * 365 * 100;
  
  return Number.isFinite(apr) ? apr : 0;
}

/**
 * Enrich pool with computed strategy
 */
function enrichPool(pool: LivePool): LivePool {
  const rangeWidthPct = getRangeWidthPct(pool.range.min, pool.range.max);
  const strategyResult = getStrategy(rangeWidthPct);
  
  return {
    ...pool,
    strategy: strategyResult.tone,
    rangeWidthPct,
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
 * Select diverse pools ensuring:
 * - ≥3 distinct strategies
 * - ≥3 distinct bands (in/near/out)
 * - ≥1 pool per required provider (if available)
 * - Graceful degradation if constraints cannot be fully met
 */
export function selectDiversePools(pools: LivePool[], target: number = 9): DiversityResult {
  if (pools.length === 0) {
    return {
      pools: [],
      diversitySatisfied: false,
      warnings: ['No pools available'],
    };
  }

  // Enrich all pools first
  const enriched = pools.map(enrichPool);

  // Shuffle to avoid determinism
  const shuffled = [...enriched].sort(() => Math.random() - 0.5);

  // Group by strategy, band, and provider
  const byStrategy = groupBy(shuffled, (p) => p.strategy || 'unknown');
  const byBand = groupBy(shuffled, (p) => p.status);
  const byProvider = groupBy(shuffled, (p) => p.providerSlug);

  // Track selected pools and their unique keys
  const result: LivePool[] = [];
  const used = new Set<string>();
  const warnings: string[] = [];

  // Helper: add pool if not duplicate
  const push = (p: LivePool) => {
    const key = `${p.providerSlug}:${p.poolId}`;
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
    
    if (providerPools.length === 0) {
      warnings.push(`Missing provider: ${slug}`);
    }
    
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
    .filter((p) => !used.has(`${p.providerSlug}:${p.poolId}`))
    .sort((a, b) => b.tvlUsd - a.tvlUsd || b.apr24h - a.apr24h);

  remaining.forEach((p) => {
    if (result.length < target) push(p);
  });

  // 5. Final shuffle for visual variety
  const final = result.slice(0, target).sort(() => Math.random() - 0.5);

  // Validate diversity
  const strategies = new Set(final.map((p) => p.strategy).filter(Boolean));
  const bands = new Set(final.map((p) => p.status));
  const providers = new Set(final.map((p) => p.providerSlug));

  if (strategies.size < MIN_STRATEGIES) {
    warnings.push(`Only ${strategies.size}/3 strategies present`);
  }

  if (bands.size < MIN_BANDS) {
    warnings.push(`Only ${bands.size}/3 range statuses present`);
  }

  REQUIRED_PROVIDERS.forEach((prov) => {
    if (!providers.has(prov)) {
      warnings.push(`Missing provider: ${prov}`);
    }
  });

  const diversitySatisfied = 
    strategies.size >= MIN_STRATEGIES && 
    bands.size >= MIN_BANDS && 
    warnings.length === 0;

  return {
    pools: final,
    diversitySatisfied,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Simple TTL cache for performance
 */
export class TtlCache<K, V> {
  private cache = new Map<K, { value: V; expires: number }>();
  private ttl: number;

  constructor(ttlMs: number = 60_000) {
    this.ttl = ttlMs;
  }

  get(key: K): V | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key: K, value: V): void {
    this.cache.set(key, {
      value,
      expires: Date.now() + this.ttl,
    });

    // Simple size limit
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

