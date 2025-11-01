/* eslint-disable no-console */
import pLimit from 'p-limit';

import { pickDiverse, validateDiversity, type DemoPool } from '@/lib/demoSelection';
import type { RangeStatus } from '@/components/pools/PoolRangeIndicator';
import { getRangeStatus } from '@/components/pools/PoolRangeIndicator';
import { getLpPositionsOnChain } from '@/services/pmFallback';
import { getBlazeSwapPositions } from '@/services/blazeswapService';
import { getSparkdexPositions } from '@/services/sparkdexService';
import type { PositionRow } from '@/types/positions';
import { sampleWallets, discoverFromIncentives, discoverFromPositionManager } from '@/services/walletDiscoveryService';
import { env, type ProviderKey } from '@/lib/env';

const KEY_TOKENS = new Set(['FXRP', 'WFLR', 'SFLR', 'FLR']);

interface LiveDemoOptions {
  limit: number;
  minTvl: number;
  providers?: ProviderKey[];
}

interface LiveDemoResult {
  pools: DemoPool[];
  diversity: ReturnType<typeof validateDiversity>;
  walletsConsidered: number;
  walletSample: string[];
}

function inferProviderSlug(position: PositionRow): { slug: 'enosys' | 'sparkdex' | 'blazeswap'; label: string } | null {
  const raw = (position.providerSlug ?? position.provider ?? '').toLowerCase();
  if (raw.includes('spark')) {
    return { slug: 'sparkdex', label: 'SparkDEX v2' };
  }
  if (raw.includes('blaze')) {
    return { slug: 'blazeswap', label: 'BlazeSwap v3' };
  }
  if (raw.includes('enosys') || raw.includes('flrfi')) {
    return { slug: 'enosys', label: 'Enosys v3' };
  }
  return null;
}

function computeCurrentPrice(position: PositionRow): number | undefined {
  if (position.price0Usd && position.price1Usd && position.price1Usd > 0) {
    return position.price0Usd / position.price1Usd;
  }
  if (position.lowerPrice && position.upperPrice) {
    return (position.lowerPrice + position.upperPrice) / 2;
  }
  return undefined;
}

function toRangeStatus(position: PositionRow, currentPrice: number | undefined): RangeStatus {
  const lower = position.lowerPrice ?? 0;
  const upper = position.upperPrice ?? 0;
  if (!currentPrice || lower <= 0 || upper <= 0 || lower >= upper) {
    return 'out';
  }
  return getRangeStatus(currentPrice, lower, upper);
}

function toDemoPool(position: PositionRow, providerInfo: { slug: 'enosys' | 'sparkdex' | 'blazeswap'; label: string }): DemoPool | null {
  const token0 = position.token0?.symbol ?? '';
  const token1 = position.token1?.symbol ?? '';
  const lower = position.lowerPrice ?? 0;
  const upper = position.upperPrice ?? 0;

  if (lower <= 0 || upper <= 0 || lower >= upper) {
    return null;
  }

  const currentPrice = computeCurrentPrice(position);
  const status = toRangeStatus(position, currentPrice);

  const unclaimedFeesUsd = position.unclaimedFeesUsd ?? 0;
  const dailyFeesUsd = Math.max(unclaimedFeesUsd / 14, 0);
  const incentivesUsd = position.rflrRewardsUsd ?? position.rflrUsd ?? 0;
  const dailyIncentivesUsd = Math.max(incentivesUsd / 14, 0);

  return {
    providerSlug: providerInfo.slug,
    providerName: providerInfo.label,
    id: position.poolAddress ?? position.displayId ?? position.id,
    token0: token0 || '—',
    token1: token1 || '—',
    feeBps: position.feeTierBps ?? 0,
    rangeMin: lower,
    rangeMax: upper,
    currentPrice: currentPrice ?? undefined,
    tvlUsd: Math.max(position.tvlUsd ?? 0, 0),
    unclaimedFeesUsd: unclaimedFeesUsd ?? 0,
    dailyFeesUsd,
    dailyIncentivesUsd,
    incentivesUsd,
    incentivesTokenAmount: position.rflrAmount ?? undefined,
    status,
  };
}

async function fetchPositionsForWallet(address: string): Promise<PositionRow[]> {
  const limit = pLimit(3);

  const [viem, blaze, spark] = await Promise.all([
    limit(() => getLpPositionsOnChain(address as `0x${string}`)),
    limit(() => getBlazeSwapPositions(address as `0x${string}`)),
    limit(() => getSparkdexPositions(address as `0x${string}`)),
  ]);

  return [...viem, ...blaze, ...spark];
}

function hasKeyToken(pool: DemoPool): boolean {
  return KEY_TOKENS.has(pool.token0.toUpperCase()) || KEY_TOKENS.has(pool.token1.toUpperCase());
}

function limitFlaroDomain(pools: DemoPool[]): DemoPool[] {
  let flaroCount = 0;
  return pools.filter((pool) => {
    const isFlaro = /flaro\.org/i.test(`${pool.token0} ${pool.token1}`);
    if (isFlaro) {
      if (flaroCount >= 1) {
        return false;
      }
      flaroCount += 1;
    }
    return true;
  });
}

export async function buildLiveDemoPools(options: LiveDemoOptions): Promise<LiveDemoResult> {
  const providerKeys: ProviderKey[] =
    options.providers ?? (['enosys-v3', 'sparkdex-v3', 'blazeswap-v3'] as ProviderKey[]);

  let sample = await sampleWallets({
    limit: options.limit * 4,
    providers: providerKeys,
    minScore: env.discovery.minScore,
  });

  if (sample.wallets.length === 0) {
    await Promise.all(
      providerKeys.map(async (provider) => {
        await discoverFromIncentives(provider);
        await discoverFromPositionManager(provider);
      }),
    );
    sample = await sampleWallets({
      limit: options.limit * 4,
      providers: providerKeys,
      minScore: env.discovery.minScore,
    });
  }

  if (sample.wallets.length === 0) {
    return {
      pools: [],
      diversity: {
        valid: false,
        strategies: new Set(),
        bands: new Set(),
        providers: new Set(),
        warnings: ['No discovered wallets available'],
      },
      walletsConsidered: 0,
      walletSample: [],
    };
  }

  const walletAddresses = sample.wallets.map((wallet) => wallet.address);
  const positionsPerWallet = await Promise.all(
    walletAddresses.map(async (address) => {
      try {
        return await fetchPositionsForWallet(address);
      } catch (error) {
        console.warn('[demoLive] Failed to fetch positions for', address, error);
        return [];
      }
    }),
  );

  const allPositions = positionsPerWallet.flat();
  const deduped = new Map<string, DemoPool>();

  allPositions.forEach((position) => {
    const providerInfo = inferProviderSlug(position);
    if (!providerInfo) return;
    const pool = toDemoPool(position, providerInfo);
    if (!pool) return;
    if (pool.tvlUsd < options.minTvl) return;

    const key = `${providerInfo.slug}:${pool.id}`;
    const existing = deduped.get(key);
    if (!existing || existing.tvlUsd < pool.tvlUsd) {
      deduped.set(key, pool);
    }
  });

  const candidates = Array.from(deduped.values());
  if (candidates.length === 0) {
    return {
      pools: [],
      diversity: {
        valid: false,
        strategies: new Set(),
        bands: new Set(),
        providers: new Set(),
        warnings: ['No qualifying pools discovered'],
      },
      walletsConsidered: walletAddresses.length,
      walletSample: walletAddresses,
    };
  }

  const prioritized = [
    ...candidates.filter(hasKeyToken),
    ...candidates.filter((pool) => !hasKeyToken(pool)),
  ];

  const limitedFlaro = limitFlaroDomain(prioritized);
  const selected = pickDiverse(limitedFlaro, options.limit);
  const diversity = validateDiversity(selected);

  return {
    pools: selected,
    diversity,
    walletsConsidered: walletAddresses.length,
    walletSample: walletAddresses,
  };
}
