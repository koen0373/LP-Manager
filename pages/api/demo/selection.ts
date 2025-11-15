import type { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs';
import type {
  DemoPool,
  DemoSeed,
  PoolSeed,
  ProviderSlug,
  Status,
  WalletSeed,
} from '@/lib/demo/types';
import { classifyStrategy } from '@/lib/demo/strategy';
import type { PositionRow } from '@/types/positions';
import { getRangeStatus } from '@/components/pools/PoolRangeIndicator';

interface SelectionResponse {
  ok: boolean;
  pools: DemoPool[];
  staleSeconds: number;
  diversityMet?: {
    providers: number;
    statuses: number;
    strategies: number;
  };
  error?: string;
}

// Simple in-memory cache with 60s TTL
let cachedSelection: { pools: DemoPool[]; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000;
const DEPRECATION_INTERVAL_MS = 60_000;
let lastDeprecationLog = 0;
const INTERNAL_BASE_URL =
  process.env.DEMO_INTERNAL_BASE_URL ?? `http://127.0.0.1:${process.env.PORT || 3000}`;
const INTERNAL_TIMEOUT_MS = Math.max(
  1500,
  Number.parseInt(process.env.DEMO_INTERNAL_TIMEOUT_MS ?? '4000', 10) || 4000,
);
const WALLET_BATCH_SIZE = 3;
const POOL_BATCH_SIZE = 4;

function logDeprecation() {
  const now = Date.now();
  if (now - lastDeprecationLog > DEPRECATION_INTERVAL_MS) {
    lastDeprecationLog = now;
    console.warn('[api/demo/selection] Deprecated endpoint – please migrate to /api/positions.');
  }
}

/**
 * Load demo seeds from JSON file
 */
function loadDemoSeeds(): DemoSeed[] {
  try {
    const seedsPath = path.join(process.cwd(), 'data', 'demo', 'demo_seeds.json');
    const content = fs.readFileSync(seedsPath, 'utf-8');
    return JSON.parse(content) as DemoSeed[];
  } catch (error) {
    console.error('[API demo/selection] Failed to load seeds:', error);
    return [];
  }
}

/**
 * Fetch positions for a wallet
 */
async function fetchWalletPositions(address: string): Promise<PositionRow[]> {
  try {
    const url = new URL('/api/positions', INTERNAL_BASE_URL);
    url.searchParams.set('address', address);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(INTERNAL_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.warn(`[demo/selection] Positions API returned ${response.status} for ${address}`);
      return [];
    }

    const positions = await response.json();
    return Array.isArray(positions) ? (positions as PositionRow[]) : [];
  } catch (error) {
    console.error(`[demo/selection] Failed to fetch positions for ${address}:`, error);
    return [];
  }
}

/**
 * Map PositionRow to DemoPool
 */
function mapPositionToPool(position: PositionRow, providerSlug: ProviderSlug): DemoPool | null {
  try {
    if (!position.id || position.tvlUsd < 10) return null;

    const rangeMin = position.lowerPrice || 0;
    const rangeMax = position.upperPrice || 0;
    const currentPrice = rangeMin > 0 && rangeMax > 0 ? (rangeMin + rangeMax) / 2 : 0;

    const dailyFeesUsd = (position.unclaimedFeesUsd || 0) / 14;
    const dailyIncentivesUsd = (position.rflrRewardsUsd || 0) / 14;

    const status = getRangeStatus(currentPrice, rangeMin, rangeMax);
    const strategy = classifyStrategy(rangeMin, rangeMax);

    const tvlUsd = position.tvlUsd;
    const apr24hPct = tvlUsd > 0 
      ? ((dailyFeesUsd + dailyIncentivesUsd) / tvlUsd) * 365 * 100
      : 0;

    return {
      providerSlug,
      marketId: position.id,
      pairLabel: position.pairLabel || `${position.token0.symbol}/${position.token1.symbol}`,
      feeTierBps: position.feeTierBps || 0,
      tvlUsd,
      dailyFeesUsd,
      incentivesUsd: dailyIncentivesUsd * 14,
      status,
      range: { min: rangeMin, max: rangeMax, current: currentPrice },
      apr24hPct,
      strategyLabel: strategy.label,
      strategyWidthPct: strategy.widthPct,
    };
  } catch (error) {
    console.error('[demo/selection] Failed to map position:', error);
    return null;
  }
}

function isWalletSeed(seed: DemoSeed): seed is WalletSeed {
  return seed.type === 'wallet';
}

function isPoolSeed(seed: DemoSeed): seed is PoolSeed {
  return seed.type === 'pool';
}

async function resolveWalletSeed(seed: WalletSeed): Promise<DemoPool[]> {
  const positions = await fetchWalletPositions(seed.address);
  const pools: DemoPool[] = [];
  for (const pos of positions) {
    const pool = mapPositionToPool(pos, seed.provider);
    if (pool) {
      pools.push(pool);
    }
  }
  return pools;
}

async function resolvePoolSeed(seed: PoolSeed): Promise<DemoPool[]> {
  const pool = await fetchPoolFromSeed(seed);
  return pool ? [pool] : [];
}

async function processSeeds<T extends DemoSeed>(
  seeds: readonly T[],
  batchSize: number,
  worker: (seed: T) => Promise<DemoPool[]>,
): Promise<Array<PromiseSettledResult<DemoPool[]>>> {
  if (!seeds.length) return [];
  const settledResults: Array<PromiseSettledResult<DemoPool[]>> = [];
  for (let i = 0; i < seeds.length; i += batchSize) {
    const batch = seeds.slice(i, i + batchSize);
    const settled = await Promise.allSettled(batch.map((seed) => worker(seed)));
    settledResults.push(...settled);
  }
  return settledResults;
}

/**
 * Fetch pool from pool seed
 */
async function fetchPoolFromSeed(seed: PoolSeed): Promise<DemoPool | null> {
  try {
    const url = new URL('/api/demo/pool-live', INTERNAL_BASE_URL);
    url.searchParams.set('provider', seed.provider);
    url.searchParams.set('marketId', seed.marketId);
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(INTERNAL_TIMEOUT_MS),
    });

    if (!response.ok) return null;

    const data = await response.json() as { ok: boolean; pool?: DemoPool };
    if (!data.ok || !data.pool || data.pool.unavailable) return null;

    return data.pool;
  } catch (error) {
    console.error(
      `[demo/selection] Failed to fetch pool ${seed.provider}/${seed.marketId}:`,
      error,
    );
    return null;
  }
}

/**
 * Select diverse pools from candidates
 */
function selectDiversePools(candidates: DemoPool[], target: number): DemoPool[] {
  if (candidates.length === 0) return [];

  // Group by provider, status, strategy
  const byProvider: Record<string, DemoPool[]> = {};
  const byStatus: Record<string, DemoPool[]> = {};
  const byStrategy: Record<string, DemoPool[]> = {};

  candidates.forEach((pool) => {
    if (!byProvider[pool.providerSlug]) byProvider[pool.providerSlug] = [];
    byProvider[pool.providerSlug].push(pool);

    if (!byStatus[pool.status]) byStatus[pool.status] = [];
    byStatus[pool.status].push(pool);

    const strat = pool.strategyLabel || 'Balanced';
    if (!byStrategy[strat]) byStrategy[strat] = [];
    byStrategy[strat].push(pool);
  });

  const result: DemoPool[] = [];
  const used = new Set<string>();

  const push = (p: DemoPool) => {
    const key = `${p.providerSlug}:${p.marketId}`;
    if (!used.has(key)) {
      result.push(p);
      used.add(key);
    }
  };

  // 1. Ensure provider coverage (all 3 if possible)
  ['enosys-v3', 'blazeswap-v3', 'sparkdex-v2'].forEach((prov) => {
    (byProvider[prov] || [])
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 2)
      .forEach(push);
  });

  // 2. Ensure status coverage
  (['in', 'near', 'out'] as Status[]).forEach((stat) => {
    (byStatus[stat] || [])
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 2)
      .forEach(push);
  });

  // 3. Ensure strategy coverage (prioritize Aggressive)
  ['Aggressive', 'Balanced', 'Conservative'].forEach((strat) => {
    const count = strat === 'Aggressive' ? 3 : 2;
    (byStrategy[strat] || [])
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, count)
      .forEach(push);
  });

  // 4. Fill remaining with highest TVL
  candidates
    .filter((p) => !used.has(`${p.providerSlug}:${p.marketId}`))
    .sort((a, b) => b.tvlUsd - a.tvlUsd || b.apr24hPct - a.apr24hPct)
    .forEach((p) => {
      if (result.length < target) push(p);
    });

  // Shuffle for variety
  return result.slice(0, target).sort(() => Math.random() - 0.5);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SelectionResponse>
) {
  logDeprecation();

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, pools: [], staleSeconds: 0, error: 'Method not allowed' });
  }

  const count = parseInt(req.query.count as string || '9', 10);

  // Check cache
  if (cachedSelection && Date.now() - cachedSelection.timestamp < CACHE_TTL_MS) {
    const staleSeconds = Math.floor((Date.now() - cachedSelection.timestamp) / 1000);
    console.log(`[API demo/selection] Cache hit - ${cachedSelection.pools.length} pools - ${staleSeconds}s old`);

    const providers = new Set(cachedSelection.pools.map((p) => p.providerSlug));
    const statuses = new Set(cachedSelection.pools.map((p) => p.status));
    const strategies = new Set(cachedSelection.pools.map((p) => p.strategyLabel));

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    return res.status(200).json({
      ok: true,
      pools: cachedSelection.pools.slice(0, count),
      staleSeconds,
      diversityMet: {
        providers: providers.size,
        statuses: statuses.size,
        strategies: strategies.size,
      },
    });
  }

  try {
    const seeds = loadDemoSeeds();
    if (seeds.length === 0) {
      return res.status(200).json({
        ok: true,
        pools: [],
        staleSeconds: 0,
        error: 'No seeds available',
      });
    }

    console.log(`[API demo/selection] Processing ${seeds.length} seeds`);

    const walletSeeds = seeds.filter(isWalletSeed);
    const poolSeeds = seeds.filter(isPoolSeed);

    const [walletResults, poolResults] = await Promise.all([
      processSeeds(walletSeeds, WALLET_BATCH_SIZE, resolveWalletSeed),
      processSeeds(poolSeeds, POOL_BATCH_SIZE, resolvePoolSeed),
    ]);

    const candidates: DemoPool[] = [];
    const seen = new Set<string>();
    let walletFailures = 0;
    let poolFailures = 0;

    const pushCandidate = (pool: DemoPool) => {
      const key = `${pool.providerSlug}:${pool.marketId}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push(pool);
    };

    walletResults.forEach((result) => {
      if (result.status !== 'fulfilled') {
        walletFailures += 1;
        return;
      }
      result.value.forEach(pushCandidate);
    });

    poolResults.forEach((result) => {
      if (result.status !== 'fulfilled') {
        poolFailures += 1;
        return;
      }
      result.value.forEach(pushCandidate);
    });

    if (walletFailures) {
      warnings.push('wallet_seed_error');
    }
    if (poolFailures) {
      warnings.push('pool_seed_error');
    }

    console.log(`[API demo/selection] Collected ${candidates.length} candidate pools`);

    // Apply diversity selection
    const selected = selectDiversePools(candidates, count);

    // Cache result
    cachedSelection = { pools: selected, timestamp: Date.now() };

    const providers = new Set(selected.map((p) => p.providerSlug));
    const statuses = new Set(selected.map((p) => p.status));
    const strategies = new Set(selected.map((p) => p.strategyLabel));

    console.log(
      `[API demo/selection] Selected ${selected.length} pools - ` +
      `providers: ${providers.size}, statuses: ${statuses.size}, strategies: ${strategies.size}`
    );

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    res.status(200).json({
      ok: true,
      pools: selected,
      staleSeconds: 0,
      diversityMet: {
        providers: providers.size,
        statuses: statuses.size,
        strategies: strategies.size,
      },
    });
  } catch (error) {
    console.error('[API demo/selection] Error:', error);
    res.status(200).json({
      ok: true,
      pools: [],
      staleSeconds: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
