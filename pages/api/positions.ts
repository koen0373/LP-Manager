import type { NextApiRequest, NextApiResponse } from 'next';

import type { PositionRow as CanonicalPositionRow, PositionsResponse } from '@/lib/positions/types';
import type { PositionRow as LegacyPositionRow } from '@/types/positions';
import { getLpPositionsOnChain } from '@/services/pmFallback';
import { getBlazeSwapPositions } from '@/services/blazeswapService';
import { getSparkdexPositions } from '@/services/sparkdexService';
import { getWalletPositionsViaFlareScan } from '@/services/flarescanService';
import { clearCaches } from '@/utils/poolHelpers';
import { clearRflrRewardCache } from '@/services/rflrRewards';
import { clearCache } from '@/lib/util/memo';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;
const TIMEOUT_MS = 30_000;
const CACHE_TTL_MS = 60_000;

type CachedEntry = {
  expires: number;
  data: NonNullable<PositionsResponse['data']>;
};

const cache = new Map<string, CachedEntry>();

type ProviderErrorRecord = {
  provider: string;
  error: string;
};

function ensureNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function normaliseProvider(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim().toLowerCase();
  }
  return 'unknown';
}

function extractAddress(value: unknown): string {
  if (typeof value === 'string' && value.startsWith('0x')) {
    return value;
  }
  return '0x0000000000000000000000000000000000000000';
}

function optionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parseFeeTier(value: unknown): number {
  const num = ensureNumber(value);
  if (num > 0) return num;

  if (typeof value === 'string') {
    const match = value.match(/([\d.]+)/);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed)) {
        return Math.round(parsed * 100);
      }
    }
  }

  return 0;
}

function mapStatus(raw: LegacyPositionRow, isInRange: boolean): 'in' | 'near' | 'out' {
  if (isInRange) {
    return 'in';
  }

  const rangeStatus = (raw as unknown as Record<string, unknown>).rangeStatus;
  if (typeof rangeStatus === 'string') {
    const lowered = rangeStatus.toLowerCase();
    if (lowered.includes('near')) return 'near';
    if (lowered.includes('in')) return 'in';
    if (lowered.includes('out')) return 'out';
  }

  const statusField = (raw as unknown as Record<string, unknown>).status;
  if (typeof statusField === 'string' && statusField.toLowerCase().includes('near')) {
    return 'near';
  }

  return 'out';
}

function toCanonical(position: LegacyPositionRow): CanonicalPositionRow {
  const provider = normaliseProvider(position.providerSlug ?? position.provider ?? position.dexName);
  const marketId =
    position.marketId ??
    position.poolId ??
    position.displayId ??
    position.id ??
    position.poolAddress ??
    '';

  const lowerPrice = optionalNumber((position as unknown as Record<string, unknown>).lowerPrice);
  const upperPrice = optionalNumber((position as unknown as Record<string, unknown>).upperPrice);
  const currentPrice = optionalNumber((position as unknown as Record<string, unknown>).currentPrice);
  const dailyFeesUsd = optionalNumber((position as unknown as Record<string, unknown>).dailyFeesUsd);
  const dailyIncentivesUsd = optionalNumber((position as unknown as Record<string, unknown>).dailyIncentivesUsd);
  const incentivesTokenAmount = optionalNumber((position as unknown as Record<string, unknown>).incentivesTokenAmount);
  const liquidityShare = optionalNumber((position as unknown as Record<string, unknown>).liquidityShare);

  const tvlUsd = ensureNumber(position.tvlUsd);
  const unclaimedFeesUsd = ensureNumber(position.unclaimedFeesUsd ?? position.dailyFeesUsd);
  const incentivesUsd = ensureNumber(position.incentivesUsd ?? position.rflrRewardsUsd ?? position.rflrUsd);
  const rewardsUsd = ensureNumber(position.rewardsUsd, unclaimedFeesUsd + incentivesUsd);

  const isInRange = Boolean(position.inRange ?? position.isInRange);
  const status = mapStatus(position, isInRange);

  const token0 = position.token0 ?? {
    symbol: position.token0Symbol ?? 'TOKEN0',
    name: position.token0Symbol ?? 'TOKEN0',
    decimals: undefined,
    address: extractAddress((position as unknown as Record<string, unknown>).token0Address),
  };

  const token1 = position.token1 ?? {
    symbol: position.token1Symbol ?? 'TOKEN1',
    name: position.token1Symbol ?? 'TOKEN1',
    decimals: undefined,
    address: extractAddress((position as unknown as Record<string, unknown>).token1Address),
  };

  const category =
    position.category ??
    (tvlUsd > 0 ? 'Active' : rewardsUsd > 0 ? 'Inactive' : 'Ended');

  return {
    provider,
    marketId: String(marketId),
    poolFeeBps: parseFeeTier(position.feeTierBps ?? (position as unknown as Record<string, unknown>).feeTier),
    tvlUsd,
    unclaimedFeesUsd,
    incentivesUsd,
    rewardsUsd,
    isInRange,
    status,
    token0: {
      symbol: token0.symbol,
      address: extractAddress(token0.address ?? (position as unknown as Record<string, unknown>).token0Address),
      name: token0.name ?? token0.symbol,
      decimals: token0.decimals,
    },
    token1: {
      symbol: token1.symbol,
      address: extractAddress(token1.address ?? (position as unknown as Record<string, unknown>).token1Address),
      name: token1.name ?? token1.symbol,
      decimals: token1.decimals,
    },
    apr24h:
      typeof (position as unknown as Record<string, unknown>).apr24h === 'number'
        ? ((position as unknown as Record<string, unknown>).apr24h as number)
        : undefined,
    apy24h:
      typeof (position as unknown as Record<string, unknown>).apy24h === 'number'
        ? ((position as unknown as Record<string, unknown>).apy24h as number)
        : undefined,
    category,
    dexName: typeof position.dexName === 'string' ? position.dexName : undefined,
    displayId: typeof (position as unknown as Record<string, unknown>).displayId === 'string'
      ? ((position as unknown as Record<string, unknown>).displayId as string)
      : undefined,
    rangeMin: lowerPrice,
    rangeMax: upperPrice,
    currentPrice,
    token0Icon: typeof (position as unknown as Record<string, unknown>).token0Icon === 'string'
      ? ((position as unknown as Record<string, unknown>).token0Icon as string)
      : undefined,
    token1Icon: typeof (position as unknown as Record<string, unknown>).token1Icon === 'string'
      ? ((position as unknown as Record<string, unknown>).token1Icon as string)
      : undefined,
    incentivesToken: typeof (position as unknown as Record<string, unknown>).incentivesToken === 'string'
      ? ((position as unknown as Record<string, unknown>).incentivesToken as string)
      : undefined,
    incentivesTokenAmount,
    liquidityShare,
    dailyFeesUsd,
    dailyIncentivesUsd,
    isDemo: Boolean((position as unknown as Record<string, unknown>).isDemo),
    poolId: typeof position.poolId === 'string' ? position.poolId : undefined,
    tokenId: typeof position.id === 'string' ? position.id : undefined,
  };
}

function buildSummary(rows: CanonicalPositionRow[]) {
  return rows.reduce(
    (acc, row) => {
      acc.tvlUsd += ensureNumber(row.tvlUsd);
      acc.fees24hUsd += ensureNumber(row.unclaimedFeesUsd);
      acc.incentivesUsd += ensureNumber(row.incentivesUsd);
      acc.rewardsUsd += ensureNumber(row.rewardsUsd || row.unclaimedFeesUsd + row.incentivesUsd);

      switch (row.category) {
        case 'Active':
          acc.active += 1;
          break;
        case 'Inactive':
          acc.inactive += 1;
          break;
        case 'Ended':
          acc.ended += 1;
          break;
        default:
          break;
      }

      return acc;
    },
    {
      tvlUsd: 0,
      fees24hUsd: 0,
      incentivesUsd: 0,
      rewardsUsd: 0,
      count: rows.length,
      active: 0,
      inactive: 0,
      ended: 0,
    },
  );
}

async function runWithTimeout<T>(
  label: string,
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs = TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const abortPromise = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        'abort',
        () => reject(new Error(`${label} timed out after ${timeoutMs}ms`)),
        { once: true },
      );
    });

    const taskPromise = task(controller.signal);
    return await Promise.race([taskPromise, abortPromise]);
  } finally {
    clearTimeout(timeout);
  }
}

async function gatherPositions(
  address: `0x${string}`,
  providerErrors: ProviderErrorRecord[],
) {
  const providers = [
    {
      key: 'enosys-pm',
      loader: () => getLpPositionsOnChain(address),
    },
    {
      key: 'blazeswap-v2',
      loader: () => getBlazeSwapPositions(address),
    },
    {
      key: 'sparkdex',
      loader: () => getSparkdexPositions(address),
    },
  ] as const;

  const settled = await Promise.allSettled(
    providers.map((provider) => runWithTimeout(provider.key, provider.loader)),
  );

  const collected: LegacyPositionRow[] = [];

  settled.forEach((result, index) => {
    const provider = providers[index].key;
    if (result.status === 'fulfilled') {
      collected.push(...result.value);
    } else {
      const message =
        result.reason instanceof Error ? result.reason.message : String(result.reason);
      providerErrors.push({ provider, error: message });
      console.error('[api/positions] Provider error', {
        provider,
        msg: message,
      });
    }
  });

  if (collected.length > 0) {
    return collected;
  }

  try {
    const fallback = await runWithTimeout('flarescan', () => getWalletPositionsViaFlareScan(address));
    if (fallback.length > 0) {
      return fallback;
    }
  } catch (error) {
    console.error('[api/positions] FlareScan fallback failed', {
      address,
      msg: error instanceof Error ? error.message : String(error),
    });
  }

  return [];
}

export async function fetchCanonicalPositionData(address: `0x${string}`) {
  const providerErrors: ProviderErrorRecord[] = [];
  const legacyPositions = await gatherPositions(address, providerErrors);
  const canonicalPositions = legacyPositions.map(toCanonical);
  const summary = buildSummary(canonicalPositions);

  if (providerErrors.length > 0) {
    console.warn('[api/positions] Provider failures encountered', providerErrors);
  }

  return {
    positions: canonicalPositions,
    summary,
  };
}

function getCached(address: string) {
  const cached = cache.get(address);
  if (!cached) return null;

  if (Date.now() > cached.expires) {
    cache.delete(address);
    return null;
  }

  return cached.data;
}

function setCached(address: string, data: NonNullable<PositionsResponse['data']>) {
  cache.set(address, {
    data,
    expires: Date.now() + CACHE_TTL_MS,
  });

  if (cache.size > 256) {
    const [firstKey] = cache.keys();
    if (firstKey) {
      cache.delete(firstKey);
    }
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PositionsResponse>,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const addressParam = typeof req.query.address === 'string' ? req.query.address : '';
  if (!ADDRESS_REGEX.test(addressParam)) {
    res.status(400).json({ success: false, error: 'Invalid address' });
    return;
  }

  const normalizedAddress = addressParam.toLowerCase();
  const startTime = Date.now();

  const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
  if (refresh) {
    cache.delete(normalizedAddress);
    clearCache(`wallet-positions-${normalizedAddress}`);
    clearCache(`viem-positions-${normalizedAddress}`);
    clearRflrRewardCache();
    clearCaches();
  }

  const cached = refresh ? null : getCached(normalizedAddress);
  if (cached) {
    res.status(200).json({
      success: true,
      data: {
        ...cached,
        meta: {
          ...cached.meta,
          address: normalizedAddress,
        },
      },
    });
    return;
  }

  try {
    const { positions: canonicalPositions, summary } = await fetchCanonicalPositionData(
      normalizedAddress as `0x${string}`,
    );
    const elapsedMs = Date.now() - startTime;

    const data: NonNullable<PositionsResponse['data']> = {
      positions: canonicalPositions,
      summary,
      meta: {
        address: normalizedAddress,
        elapsedMs,
      },
    };

    setCached(normalizedAddress, data);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    const message = error instanceof Error ? error.message : String(error);
    console.error('[api/positions] Failed to serve positions', {
      address: normalizedAddress,
      msg: message,
      stack: error instanceof Error ? error.stack : undefined,
      elapsedMs,
    });

    // Return empty result instead of 500 error when no positions found
    // This allows wallet connect flow to continue gracefully
    const data: NonNullable<PositionsResponse['data']> = {
      positions: [],
      summary: {
        tvlUsd: 0,
        fees24hUsd: 0,
        incentivesUsd: 0,
        rewardsUsd: 0,
        count: 0,
        active: 0,
        inactive: 0,
        ended: 0,
      },
      meta: {
        address: normalizedAddress,
        elapsedMs,
      },
    };

    res.status(200).json({
      success: true,
      data,
    });
  }
}
