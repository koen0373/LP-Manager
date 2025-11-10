import type { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, fallback, getAddress, http } from 'viem';

import { resolveRole } from '@/lib/entitlements/resolveRole';
import { flare } from '@/lib/chainFlare';
import { nftsByOwner } from '@/lib/providers/ankr';
import type { PositionsSummaryPayload } from '@/lib/positions/types';
import { roleFlags } from '@/lib/entitlements/resolveRole';
import { getPoolAddress, getPoolState } from '@/utils/poolHelpers';

type SummaryCacheEntry = {
  expires: number;
  payload: PositionsSummaryPayload;
};

type PositionSnapshot = {
  status: 'in' | 'near' | 'out' | 'unknown';
};

type NfpmConfig = {
  dex: 'enosys-v3' | 'sparkdex-v3';
  nfpm: `0x${string}`;
  factory: `0x${string}`;
};

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/i;
const CACHE_TTL_MS = 120_000;
const CACHE_HEADERS = 'public, max-age=60, s-maxage=60, stale-while-revalidate=120';

const nfpmConfigs: NfpmConfig[] = [
  process.env.ENOSYS_NFPM && process.env.ENOSYS_V3_FACTORY
    ? {
        dex: 'enosys-v3',
        nfpm: getAddress(process.env.ENOSYS_NFPM as `0x${string}`),
        factory: getAddress(process.env.ENOSYS_V3_FACTORY as `0x${string}`),
      }
    : null,
  process.env.SPARKDEX_NFPM && process.env.SPARKDEX_V3_FACTORY
    ? {
        dex: 'sparkdex-v3',
        nfpm: getAddress(process.env.SPARKDEX_NFPM as `0x${string}`),
        factory: getAddress(process.env.SPARKDEX_V3_FACTORY as `0x${string}`),
      }
    : null,
].filter((entry): entry is NfpmConfig => Boolean(entry));

const publicClient = createPublicClient({
  chain: flare,
  transport: fallback([
    http(process.env.FLARE_RPC_URL ?? flare.rpcUrls.default.http[0], { batch: true }),
    http('https://flare-api.flare.network/ext/C/rpc', { batch: true }),
  ]),
});

const POSITION_ABI = [
  {
    name: 'positions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      { name: 'nonce', type: 'uint96' },
      { name: 'operator', type: 'address' },
      { name: 'token0', type: 'address' },
      { name: 'token1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
      { name: 'tokensOwed0', type: 'uint128' },
      { name: 'tokensOwed1', type: 'uint128' },
    ],
  },
] as const;

const summaryCache = new Map<string, SummaryCacheEntry>();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const walletParam = typeof req.query.wallet === 'string' ? req.query.wallet : '';
  if (!ADDRESS_REGEX.test(walletParam)) {
    res.status(400).json({ error: 'Invalid wallet' });
    return;
  }

  const wallet = walletParam.toLowerCase();
  const resolution = resolveRole(req) as ReturnType<typeof resolveRole> & {
    // Optional flags support for future extensions
    flags?: {
      premium?: boolean;
      analytics?: boolean;
    };
  };

  const fallbackFlags = roleFlags(resolution?.role ?? 'VISITOR');
  const entitlements = {
    role: resolution?.role ?? 'VISITOR',
    flags: {
      premium: resolution?.flags?.premium ?? fallbackFlags.premium,
      analytics: resolution?.flags?.analytics ?? fallbackFlags.analytics,
    },
  };

  const cacheKey = `${wallet}:${Number(entitlements.flags.premium)}:${Number(entitlements.flags.analytics)}`;

  const cached = summaryCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    res.setHeader('Cache-Control', CACHE_HEADERS);
    res.status(200).json(cached.payload);
    return;
  }

  try {
    const summary = await buildSummary(wallet);
    const payload: PositionsSummaryPayload = {
      tvlTotalUsd: summary.tvlTotalUsd,
      fees24hUsd: entitlements.flags.premium ? summary.fees24hUsd : null,
      activeCount: summary.activeCount,
      entitlements,
    };

    summaryCache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, payload });
    res.setHeader('Cache-Control', CACHE_HEADERS);
    res.status(200).json(payload);
  } catch (error) {
    const warning = error instanceof Error ? error.message : 'summary_error';
    console.warn('[api/positions/summary] fallback', warning);
    const payload: PositionsSummaryPayload = {
      tvlTotalUsd: 0,
      fees24hUsd: null,
      activeCount: 0,
      entitlements,
      meta: { warnings: [warning] },
    };
    res.setHeader('Cache-Control', CACHE_HEADERS);
    res.status(200).json(payload);
  }
}

async function buildSummary(wallet: string): Promise<{ tvlTotalUsd: number; fees24hUsd: number | null; activeCount: number }> {
  if (nfpmConfigs.length === 0) {
    return { tvlTotalUsd: 0, fees24hUsd: null, activeCount: 0 };
  }

  const tokenIds = await nftsByOwner(wallet);
  if (!tokenIds.length) {
    return { tvlTotalUsd: 0, fees24hUsd: null, activeCount: 0 };
  }

  const snapshots = await Promise.all(tokenIds.map((tokenId) => fetchPositionSnapshot(tokenId)));
  const statuses = snapshots.filter(Boolean) as PositionSnapshot[];

  const activeCount = statuses.filter((snapshot) => snapshot.status === 'in' || snapshot.status === 'near').length;

  return {
    tvlTotalUsd: 0,
    fees24hUsd: null,
    activeCount,
  };
}

async function fetchPositionSnapshot(tokenId: bigint): Promise<PositionSnapshot | null> {
  for (const config of nfpmConfigs) {
    const position = await readPosition(config.nfpm, tokenId);
    if (!position) continue;

    const tokenA = getAddress(position.token0);
    const tokenB = getAddress(position.token1);
    const [sorted0, sorted1] = sortTokens(tokenA, tokenB);

    try {
      const poolAddress = await getPoolAddress(config.factory, sorted0, sorted1, position.fee);
      const state = await getPoolState(poolAddress);
      const status = determineStatus(state.tick, position.tickLower, position.tickUpper);
      return { status };
    } catch (error) {
      continue;
    }
  }

  return null;
}

async function readPosition(nfpm: `0x${string}`, tokenId: bigint) {
  try {
    const result = await publicClient.readContract({
      address: nfpm,
      abi: POSITION_ABI,
      functionName: 'positions',
      args: [tokenId],
    });

    const [, , token0, token1, fee, tickLower, tickUpper, liquidity] = result as [
      bigint,
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      number,
      number,
      number,
      bigint,
    ];

    if (liquidity === BigInt(0)) {
      return null;
    }

    return {
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
    };
  } catch {
    return null;
  }
}

function sortTokens(a: `0x${string}`, b: `0x${string}`): [`0x${string}`, `0x${string}`] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

function determineStatus(currentTick: number, tickLower: number, tickUpper: number): 'in' | 'near' | 'out' | 'unknown' {
  if (!Number.isFinite(currentTick) || !Number.isFinite(tickLower) || !Number.isFinite(tickUpper)) {
    return 'unknown';
  }

  if (tickLower <= currentTick && currentTick <= tickUpper) {
    return 'in';
  }

  const width = Math.max(1, Math.abs(tickUpper - tickLower));
  const tolerance = Math.ceil(width * 0.05);
  if (currentTick >= tickLower - tolerance && currentTick <= tickUpper + tolerance) {
    return 'near';
  }

  return 'out';
}
