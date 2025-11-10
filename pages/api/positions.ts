import type { NextApiRequest, NextApiResponse } from 'next';
import { createPublicClient, fallback, getAddress, http } from 'viem';
import type { Prisma } from '@prisma/client';

import { resolveRole, roleFlags } from '@/lib/entitlements/resolveRole';
import type { PositionRow, PositionsResponse, PositionClaimToken } from '@/lib/positions/types';
import { flare } from '@/lib/chainFlare';
import { prisma } from '@/server/db';
import { nftsByOwner } from '@/lib/providers/ankr';
import { getPrices } from '@/lib/pricing/prices';
import { getPoolAddress, getPoolState } from '@/utils/poolHelpers';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/i;
const CACHE_TTL_MS = 120_000;
const CACHE_CONTROL = 'public, max-age=60, s-maxage=60, stale-while-revalidate=120';

const ERC20_ABI = [
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;

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

const publicClient = createPublicClient({
  chain: flare,
  transport: fallback([
    http(process.env.FLARE_RPC_URL ?? flare.rpcUrls.default.http[0], { batch: true }),
    http('https://flare-api.flare.network/ext/C/rpc', { batch: true }),
  ]),
});

const nfpmConfigs = [
  process.env.ENOSYS_NFPM && process.env.ENOSYS_V3_FACTORY
    ? {
        dex: 'enosys-v3' as const,
        nfpm: getAddress(process.env.ENOSYS_NFPM as `0x${string}`),
        factory: getAddress(process.env.ENOSYS_V3_FACTORY as `0x${string}`),
      }
    : null,
  process.env.SPARKDEX_NFPM && process.env.SPARKDEX_V3_FACTORY
    ? {
        dex: 'sparkdex-v3' as const,
        nfpm: getAddress(process.env.SPARKDEX_NFPM as `0x${string}`),
        factory: getAddress(process.env.SPARKDEX_V3_FACTORY as `0x${string}`),
      }
    : null,
].filter((cfg): cfg is { dex: 'enosys-v3' | 'sparkdex-v3'; nfpm: `0x${string}`; factory: `0x${string}` } => Boolean(cfg));

const cache = new Map<string, { expires: number; payload: PositionsResponse }>();
const tokenMetaCache = new Map<string, { symbol: string; decimals: number }>();
const incentivesCache = new Map<string, IncentiveInfo | null>();

interface RawPosition {
  tokenId: bigint;
  dex: 'enosys-v3' | 'sparkdex-v3';
  nfpm: `0x${string}`;
  poolAddress: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  tick?: number | null;
}

interface IncentiveInfo {
  usdPerDay: number | null;
  tokens: PositionRow['incentivesTokens'];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const wallet = typeof req.query.wallet === 'string' ? req.query.wallet.toLowerCase() : '';
  if (!ADDRESS_REGEX.test(wallet)) {
    res.status(400).json({ error: 'Invalid wallet' });
    return;
  }

  const resolution = resolveRole(req);
  const flags = roleFlags(resolution.role);
  const cacheKey = `${wallet}:${flags.premium ? 1 : 0}:${flags.analytics ? 1 : 0}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    res.setHeader('Cache-Control', CACHE_CONTROL);
    res.status(200).json(cached.payload);
    return;
  }

  const started = Date.now();
  try {
    const positions = await buildPositions(wallet, resolution.role, flags);
    const payload: PositionsResponse = {
      success: true,
      data: {
        positions,
        meta: {
          address: wallet,
          elapsedMs: Date.now() - started,
        },
      },
    };

    cache.set(cacheKey, { expires: Date.now() + CACHE_TTL_MS, payload });
    res.setHeader('Cache-Control', CACHE_CONTROL);
    res.status(200).json(payload);
  } catch (error) {
    console.error('[api/positions] failed', error);
    res.status(200).json({
      success: true,
      data: {
        positions: [],
        meta: {
          address: wallet,
          elapsedMs: Date.now() - started,
        },
      },
    });
  }
}

async function buildPositions(wallet: string, role: 'VISITOR' | 'PREMIUM' | 'PRO', flags: { premium: boolean; analytics: boolean }): Promise<PositionRow[]> {
  if (!nfpmConfigs.length) return [];
  const tokenIds = await nftsByOwner(wallet);
  if (!tokenIds.length) return [];

  const rawPositions: RawPosition[] = [];
  for (const tokenId of tokenIds) {
    const raw = await readPositionAcrossManagers(tokenId);
    if (raw) rawPositions.push(raw);
  }

  if (!rawPositions.length) return [];

  const priceAddresses = Array.from(
    rawPositions.reduce((set, pos) => {
      set.add(pos.token0.toLowerCase());
      set.add(pos.token1.toLowerCase());
      return set;
    }, new Set<string>())
  );

  const priceMap = await getPrices(priceAddresses);
  const positions = await Promise.all(
    rawPositions.map(async (raw) => mapRawPosition(raw, role, flags, priceMap))
  );

  return positions.filter(Boolean) as PositionRow[];
}

async function readPositionAcrossManagers(tokenId: bigint): Promise<RawPosition | null> {
  for (const config of nfpmConfigs) {
    const result = await readPosition(config.nfpm, tokenId);
    if (!result) continue;
    const token0 = getAddress(result.token0);
    const token1 = getAddress(result.token1);
    const [sorted0, sorted1] = sortAddresses(token0, token1);

    let poolAddress: `0x${string}`;
    try {
      poolAddress = await getPoolAddress(config.factory, sorted0, sorted1, result.fee);
    } catch {
      continue;
    }

    let tick: number | null = null;
    try {
      const state = await getPoolState(poolAddress);
      tick = state.tick;
    } catch {
      tick = null;
    }

    return {
      tokenId,
      dex: config.dex,
      nfpm: config.nfpm,
      poolAddress,
      token0,
      token1,
      fee: result.fee,
      tickLower: result.tickLower,
      tickUpper: result.tickUpper,
      liquidity: result.liquidity,
      tokensOwed0: result.tokensOwed0,
      tokensOwed1: result.tokensOwed1,
      tick,
    };
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

    const [, , token0, token1, fee, tickLower, tickUpper, liquidity, , , tokensOwed0, tokensOwed1] = result as [
      bigint,
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      number,
      number,
      number,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint,
    ];

    if (liquidity === BigInt(0)) return null;

    return {
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      liquidity,
      tokensOwed0,
      tokensOwed1,
    };
  } catch {
    return null;
  }
}

async function mapRawPosition(
  raw: RawPosition,
  role: 'VISITOR' | 'PREMIUM' | 'PRO',
  flags: { premium: boolean; analytics: boolean },
  priceMap: Record<string, number>
): Promise<PositionRow | null> {
  try {
    const [token0Meta, token1Meta] = await Promise.all([
      getTokenMetadata(raw.token0),
      getTokenMetadata(raw.token1),
    ]);

    const incentives = await getPoolIncentives(raw.poolAddress);
    const price0 = priceMap[raw.token0.toLowerCase()];
    const price1 = priceMap[raw.token1.toLowerCase()];
    const claim = buildClaim(raw, token0Meta, token1Meta, price0, price1);

    const row: PositionRow = {
      tokenId: raw.tokenId.toString(),
      dex: raw.dex,
      poolAddress: raw.poolAddress,
      pair: {
        symbol0: token0Meta.symbol,
        symbol1: token1Meta.symbol,
        feeBps: raw.fee,
      },
      liquidity: raw.liquidity.toString(),
      amountsUsd: { total: null, token0: null, token1: null },
      fees24hUsd: null,
      incentivesUsdPerDay: incentives?.usdPerDay ?? null,
      incentivesTokens: incentives?.tokens ?? [],
      status: determineStatus(raw.tick, raw.tickLower, raw.tickUpper),
      claim: claim,
      entitlements: {
        role,
        flags,
      },
    };

    if (!flags.premium) {
      row.fees24hUsd = null;
      row.incentivesUsdPerDay = null;
      row.incentivesTokens = [];
      row.claim = null;
    }

    return row;
  } catch (error) {
    console.warn('[api/positions] failed to map position', error);
    return null;
  }
}

async function getTokenMetadata(address: `0x${string}`): Promise<{ symbol: string; decimals: number }> {
  const key = address.toLowerCase();
  const cached = tokenMetaCache.get(key);
  if (cached) return cached;

  try {
    const [symbol, decimals] = await Promise.all([
      publicClient
        .readContract({ address, abi: ERC20_ABI, functionName: 'symbol' })
        .catch(() => 'TKN'),
      publicClient
        .readContract({ address, abi: ERC20_ABI, functionName: 'decimals' })
        .catch(() => 18),
    ]);

    const meta = {
      symbol: typeof symbol === 'string' && symbol.length ? symbol : 'TKN',
      decimals: typeof decimals === 'number' ? decimals : Number(decimals),
    };
    tokenMetaCache.set(key, meta);
    return meta;
  } catch {
    const fallback = { symbol: 'TKN', decimals: 18 };
    tokenMetaCache.set(key, fallback);
    return fallback;
  }
}

async function getPoolIncentives(poolAddress: `0x${string}`): Promise<IncentiveInfo | null> {
  const key = poolAddress.toLowerCase();
  if (incentivesCache.has(key)) {
    return incentivesCache.get(key) ?? null;
  }

  try {
    const record = await prisma.poolIncentiveSnapshot.findUnique({
      where: { poolAddress: key },
    });

    if (!record) {
      incentivesCache.set(key, null);
      return null;
    }

    const tokens = Array.isArray(record.tokens)
      ? (record.tokens as Prisma.JsonArray).map((entry) => {
          const token = entry as Record<string, unknown>;
          const symbol = typeof token.symbol === 'string' ? token.symbol : '';
          const amountPerDay = typeof token.amountPerDay === 'string' || typeof token.amountPerDay === 'number'
            ? String(token.amountPerDay)
            : '0';
          return {
            symbol,
            amountPerDay,
            tokenAddress: typeof token.tokenAddress === 'string' ? token.tokenAddress : undefined,
            decimals: typeof token.decimals === 'number' ? token.decimals : undefined,
          };
        })
      : [];

    const usdPerDay = record.usdPerDay === null ? null : Number(record.usdPerDay);
    const info: IncentiveInfo = {
      usdPerDay: Number.isFinite(usdPerDay ?? NaN) ? usdPerDay : null,
      tokens: tokens.filter((token) => token.symbol.length > 0),
    };

    incentivesCache.set(key, info);
    return info;
  } catch (error) {
    console.warn('[api/positions] incentives lookup failed', error);
    incentivesCache.set(key, null);
    return null;
  }
}

function determineStatus(tick: number | null | undefined, tickLower: number, tickUpper: number): 'in' | 'near' | 'out' | 'unknown' {
  if (tick === null || tick === undefined) return 'unknown';
  if (tickLower <= tick && tick <= tickUpper) return 'in';
  const width = Math.max(1, Math.abs(tickUpper - tickLower));
  const tolerance = Math.ceil(width * 0.05);
  if (tick >= tickLower - tolerance && tick <= tickUpper + tolerance) return 'near';
  return 'out';
}

function buildClaim(
  raw: RawPosition,
  token0: { symbol: string; decimals: number },
  token1: { symbol: string; decimals: number },
  price0?: number,
  price1?: number
): PositionRow['claim'] {
  if (raw.tokensOwed0 === BigInt(0) && raw.tokensOwed1 === BigInt(0)) {
    return { usd: 0, tokens: [] };
  }

  const owed0 = formatTokenAmount(raw.tokensOwed0, token0.decimals);
  const owed1 = formatTokenAmount(raw.tokensOwed1, token1.decimals);
  const tokens: PositionClaimToken[] = [];

  if (raw.tokensOwed0 > BigInt(0)) {
    tokens.push({ symbol: token0.symbol, amount: owed0 });
  }
  if (raw.tokensOwed1 > BigInt(0)) {
    tokens.push({ symbol: token1.symbol, amount: owed1 });
  }

  const usd0 = price0 && Number.isFinite(price0) ? Number(owed0) * price0 : 0;
  const usd1 = price1 && Number.isFinite(price1) ? Number(owed1) * price1 : 0;
  const total = usd0 + usd1;

  return {
    usd: Number.isFinite(total) ? total : null,
    tokens: tokens.length ? tokens : undefined,
  };
}

function formatTokenAmount(amount: bigint, decimals: number): string {
  if (amount === BigInt(0)) return '0';
  const divisor = BigInt(10) ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  if (fraction === BigInt(0)) return whole.toString();
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fractionStr}`;
}

function sortAddresses(a: `0x${string}`, b: `0x${string}`): [`0x${string}`, `0x${string}`] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}
