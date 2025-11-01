import type { NextApiRequest, NextApiResponse } from 'next';

import { generateSimulatedPools } from '@/lib/demo/generator';
import type { GenerationResult } from '@/lib/demo/generator';
import { buildLiveDemoPools } from '@/services/demoPoolsLive';
import { fetchTokenIconBySymbol } from '@/services/tokenIconService';
import type { ProviderKey } from '@/lib/env';

const CACHE_TTL_MS = 60_000;

type DemoMode = 'sim' | 'live';

interface RequestParams {
  limit: number;
  minTvl: number;
  providers: string[] | undefined;
  mode: DemoMode;
}

interface ApiPool {
  providerSlug: string;
  providerName: string;
  poolId: string;
  pairLabel: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Icon: string | null;
  token1Icon: string | null;
  feeTierBps: number;
  rangeMin: number;
  rangeMax: number;
  currentPrice: number;
  rangeWidthPct: number;
  strategy: string;
  strategyLabel: string;
  status: string;
  tvlUsd: number;
  dailyFeesUsd: number;
  dailyIncentivesUsd: number;
  apr24hPct: number;
  domain?: string;
  isDemo: boolean;
  displayId: string;
}

type DiversitySnapshot = GenerationResult['diversity'];

interface DemoPoolsResponse {
  ok: boolean;
  mode: DemoMode;
  generatedAt: string;
  seed: string;
  badgeLabel: string;
  legal: {
    disclaimer: string;
  };
  diversity: DiversitySnapshot;
  items: ApiPool[];
  warnings?: string[];
  placeholder?: boolean;
  error?: string;
}

interface CacheEntry {
  key: string;
  expiresAt: number;
  payload: DemoPoolsResponse;
}

let cache: CacheEntry | null = null;

function parseNumberParam(value: string | string[] | undefined, fallback: number): number {
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

function parseProviders(value: string | string[] | undefined): string[] | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => item.trim().toLowerCase()).filter(Boolean);
  }

  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function toProviderKey(slug: string): ProviderKey | null {
  const lower = slug.toLowerCase();
  if (lower.startsWith('eno')) return 'enosys-v3';
  if (lower.startsWith('spark')) return 'sparkdex-v3';
  if (lower.startsWith('blaze')) return 'blazeswap-v3';
  return null;
}

function resolveMode(): DemoMode {
  const modeEnv = (process.env.DEMO_MODE ?? 'sim').toLowerCase();
  return modeEnv === 'live' ? 'live' : 'sim';
}

function buildCacheKey(params: RequestParams): string {
  const providers = params.providers ? [...params.providers].sort() : undefined;
  return JSON.stringify({
    limit: params.limit,
    minTvl: params.minTvl,
    providers,
    mode: params.mode,
  });
}

/**
 * Generate deterministic demo tag from seed and index.
 * Format: #demoXXXX where XXXX is a 4-digit number.
 */
function generateDemoTag(seed: string, idx: number): string {
  // Extract digits from seed, take last 4, convert to number
  const seedDigits = seed.replace(/\D/g, '').slice(-4) || '0';
  const base = (parseInt(seedDigits, 10) + idx) % 10000;
  return `#demo${base.toString().padStart(4, '0')}`;
}

/**
 * Simple seeded PRNG using mulberry32 algorithm
 */
function createSeededRng(seed: string): () => number {
  let state = 0;
  for (let i = 0; i < seed.length; i++) {
    state = (state + seed.charCodeAt(i)) | 0;
  }
  state = (state + 0x6d2b79f5) | 0;

  return function() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function rngBetween(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min);
}

function shuffleWith<T>(rng: () => number, array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/**
 * Enforce consistent RangeBand distribution for demo pools (SIM mode only).
 * 
 * Distribution rules:
 * - Exactly 2 outliers: 1 "near" band, 1 "out" of range
 * - All other items "in" range, clustered at center ±25% of width
 * 
 * Only modifies currentPrice and status; all other fields unchanged.
 */
function _enforceDemoRangeBandDistribution(items: ApiPool[], seed: string): ApiPool[] {
  if (!items || items.length < 3) {
    return items;
  }

  const rng = createSeededRng(seed);
  
  // Choose outlier indices deterministically
  const indices = Array.from(items.keys());
  shuffleWith(rng, indices);
  const nearIdx = indices[0];
  const outIdx = indices[1];

  items.forEach((item, i) => {
    const min = item.rangeMin;
    const max = item.rangeMax;
    const width = max - min;
    const center = (min + max) / 2;

    if (i === nearIdx) {
      // Near-band outlier: still in range but close to a boundary
      const side = rng() < 0.5 ? 'lower' : 'upper';
      const offset = rngBetween(rng, 0.02, 0.08) * width;
      item.currentPrice = side === 'lower' 
        ? min + offset 
        : max - offset;
    } else if (i === outIdx) {
      // Out-of-range outlier: slightly outside boundaries
      const side = rng() < 0.5 ? 'below' : 'above';
      const offset = rngBetween(rng, 0.02, 0.05) * width;
      item.currentPrice = side === 'below' 
        ? min - offset 
        : max + offset;
    } else {
      // In-range cluster: centered at ±25% of width from center
      const bandMin = center - 0.25 * width;
      const bandMax = center + 0.25 * width;
      item.currentPrice = clamp(rngBetween(rng, bandMin, bandMax), min, max);
    }

    // Recompute status based on adjusted currentPrice
    if (item.currentPrice < min || item.currentPrice > max) {
      item.status = 'out';
    } else {
      const distToLower = Math.abs(item.currentPrice - min);
      const distToUpper = Math.abs(max - item.currentPrice);
      const minDist = Math.min(distToLower, distToUpper);
      const isNear = minDist <= 0.1 * width;
      item.status = isNear ? 'near' : 'in';
    }
  });

  return items;
}

async function enrichWithIcons(
  pools: GenerationResult['pools'],
  seed: string
): Promise<ApiPool[]> {
  return Promise.all(
    pools.map(async (pool, idx) => {
      const [token0Icon, token1Icon] = await Promise.all([
        fetchTokenIconBySymbol(pool.token0Symbol).catch(() => null),
        fetchTokenIconBySymbol(pool.token1Symbol).catch(() => null),
      ]);

      return {
        ...pool,
        token0Icon,
        token1Icon,
        isDemo: true,
        displayId: generateDemoTag(seed, idx),
      };
    }),
  );
}

async function handleSimulatedResponse(params: RequestParams): Promise<DemoPoolsResponse> {
  const generation = generateSimulatedPools({
    limit: params.limit,
    minTvl: params.minTvl,
    providers: params.providers,
  });

  const items = await enrichWithIcons(generation.pools, generation.seed);

  // Note: No longer enforcing artificial RangeBand distribution
  // currentPrice now reflects real market prices from getPairMidPrice

  return {
    ok: true,
    mode: params.mode,
    generatedAt: generation.generatedAt,
    seed: generation.seed,
    badgeLabel: 'Demo · generated from live prices',
    legal: {
      disclaimer: 'Not financial advice.',
    },
    diversity: generation.diversity,
    items,
    warnings: generation.diversity.warnings,
  };
}

async function handleLiveResponse(params: RequestParams): Promise<DemoPoolsResponse> {
  const providerKeys = params.providers
    ?.map((slug) => toProviderKey(slug))
    .filter((value): value is ProviderKey => value !== null);
  const live = await buildLiveDemoPools({
    limit: params.limit,
    minTvl: params.minTvl,
    providers: providerKeys,
  });

  if (live.pools.length === 0) {
    return {
      ok: false,
      mode: 'live',
      generatedAt: new Date().toISOString(),
      seed: '',
      badgeLabel: 'Demo · generated from live prices',
      legal: { disclaimer: 'Not financial advice.' },
      diversity: {
        valid: false,
        strategies: [],
        statuses: [],
        providers: [],
        warnings: live.diversity.warnings,
        counts: {
          enosys: 0,
          sparkdex: 0,
          blazeswap: 0,
          flaroTagged: 0,
        },
      },
      items: [],
      warnings: ['Live sampling returned no pools'],
      placeholder: true,
      error: 'Live demo pools are temporarily unavailable.',
    };
  }

  const seed = live.walletSample.join(',');

  const mapped = await Promise.all(
    live.pools.map(async (pool, idx) => {
      const [token0Icon, token1Icon] = await Promise.all([
        fetchTokenIconBySymbol(pool.token0).catch(() => null),
        fetchTokenIconBySymbol(pool.token1).catch(() => null),
      ]);

      return {
        templateId: pool.id,
        providerSlug: pool.providerSlug,
        providerName: pool.providerName,
        poolId: pool.id,
        pairLabel: `${pool.token0} / ${pool.token1}`,
        token0Symbol: pool.token0,
        token1Symbol: pool.token1,
        token0Icon,
        token1Icon,
        feeTierBps: pool.feeBps,
        rangeMin: pool.rangeMin,
        rangeMax: pool.rangeMax,
        currentPrice: pool.currentPrice ?? (pool.rangeMin + pool.rangeMax) / 2,
        rangeWidthPct: pool.rangeWidthPct ?? 0,
        strategy: pool.strategy ?? 'balanced',
        strategyLabel:
          pool.strategy === 'aggressive'
            ? 'Aggressive'
            : pool.strategy === 'conservative'
            ? 'Conservative'
            : 'Balanced',
        status: pool.status,
        tvlUsd: pool.tvlUsd,
        dailyFeesUsd: pool.dailyFeesUsd,
        dailyIncentivesUsd: pool.dailyIncentivesUsd,
        apr24hPct:
          pool.tvlUsd > 0
            ? Number((((pool.dailyFeesUsd ?? 0) + (pool.dailyIncentivesUsd ?? 0)) / pool.tvlUsd) * 365 * 100)
            : 0,
        domain: /flaro\.org/i.test(`${pool.token0} ${pool.token1}`) ? 'flaro.org' : undefined,
        isDemo: true,
        displayId: generateDemoTag(seed, idx),
      };
    }),
  );

  return {
    ok: true,
    mode: 'live',
    generatedAt: new Date().toISOString(),
    seed,
    badgeLabel: 'Demo · generated from live prices',
    legal: {
      disclaimer: 'Not financial advice.',
    },
    diversity: {
      valid: live.diversity.valid,
      strategies: Array.from(live.diversity.strategies),
      statuses: Array.from(live.diversity.bands),
      providers: Array.from(live.diversity.providers),
      warnings: live.diversity.warnings,
      counts: {
        enosys: live.pools.filter((pool) => pool.providerSlug === 'enosys').length,
        sparkdex: live.pools.filter((pool) => pool.providerSlug === 'sparkdex').length,
        blazeswap: live.pools.filter((pool) => pool.providerSlug === 'blazeswap').length,
        flaroTagged: mapped.filter((pool) => pool.domain === 'flaro.org').length,
      },
    },
    items: mapped,
    warnings: live.diversity.warnings,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<DemoPoolsResponse>) {
  const mode = resolveMode();
  const limit = parseNumberParam(req.query.limit, 9);
  const minTvl = parseNumberParam(req.query.minTvl, 150);
  const providers = parseProviders(req.query.providers);

  const params: RequestParams = {
    limit,
    minTvl,
    providers,
    mode,
  };

  const cacheKey = buildCacheKey(params);
  const now = Date.now();

  if (cache && cache.key === cacheKey && cache.expiresAt > now) {
    res.status(200).json(cache.payload);
    return;
  }

  try {
    const responders: Record<DemoMode, () => Promise<DemoPoolsResponse>> = {
      sim: () => handleSimulatedResponse(params),
      live: () => handleLiveResponse(params),
    };

    const payload = await responders[mode]();

    // Always use the simulated dataset for now when live placeholder is returned.
    if (!payload.ok && payload.placeholder && mode === 'live') {
      const simulatedPayload = await handleSimulatedResponse({ ...params, mode: 'sim' });
      cache = {
        key: cacheKey,
        payload: simulatedPayload,
        expiresAt: now + CACHE_TTL_MS,
      };
      res.status(200).json(simulatedPayload);
      return;
    }

    cache = {
      key: cacheKey,
      payload,
      expiresAt: now + CACHE_TTL_MS,
    };

    res.status(200).json(payload);
  } catch (error) {
    console.error('[api/demo/pools] Failed to generate simulated pools:', error);
    const fallback: DemoPoolsResponse = {
      ok: false,
      mode,
      generatedAt: new Date().toISOString(),
      seed: '',
      badgeLabel: 'Demo · generated from live prices',
      legal: { disclaimer: 'Not financial advice.' },
      diversity: {
        valid: false,
        strategies: [],
        statuses: [],
        providers: [],
        warnings: ['Generator crashed — returning placeholder dataset'],
        counts: {
          enosys: 0,
          sparkdex: 0,
          blazeswap: 0,
          flaroTagged: 0,
        },
      },
      items: [],
      placeholder: true,
      error: 'Simulated demo pools are temporarily unavailable.',
    };
    res.status(200).json(fallback);
  }
}
