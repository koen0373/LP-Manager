/**
 * Top Pools Scanner
 * Scans Position Managers and V2 factories to find pools with highest TVL
 */

import { createPublicClient, http, fallback } from 'viem';
import { flare } from 'viem/chains';
import { getUsdPriceNow } from '@/services/tokenRegistry';
import { fetchTokenIconBySymbol } from '@/services/tokenIconService';
import { 
  getRangeStatus, 
  getRangeWidthPct, 
  getStrategy,
  type RangeStatus 
} from '@/components/pools/PoolRangeIndicator';

// Position Manager configs
const POSITION_MANAGERS = [
  {
    name: 'enosys',
    slug: 'enosys-v3',
    displayName: 'Enosys',
    address: '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657' as `0x${string}`,
    factory: '0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de' as `0x${string}`,
  },
  {
    name: 'sparkdex',
    slug: 'sparkdex-v3',
    displayName: 'SparkDEX',
    address: '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da' as `0x${string}`,
    factory: '0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652' as `0x${string}`,
  },
] as const;

// ABIs
const POSITION_MANAGER_ABI = [
  {
    name: 'totalSupply',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
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

const POOL_ABI = [
  {
    name: 'slot0',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'observationIndex', type: 'uint16' },
      { name: 'observationCardinality', type: 'uint16' },
      { name: 'observationCardinalityNext', type: 'uint16' },
      { name: 'feeProtocol', type: 'uint8' },
      { name: 'unlocked', type: 'bool' },
    ],
  },
] as const;

const ERC20_ABI = [
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

const FACTORY_ABI = [
  {
    name: 'getPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' },
    ],
    outputs: [{ name: 'pool', type: 'address' }],
  },
] as const;

// Client
const client = createPublicClient({
  chain: flare,
  transport: fallback([
    http('https://flare.flr.finance/ext/bc/C/rpc', { timeout: 15_000 }),
    http('https://flare.public-rpc.com', { timeout: 15_000 }),
    http('https://rpc-enosys.flare.network', { timeout: 15_000 }),
  ]),
});

export type PoolSnapshot = {
  provider: string;
  providerSlug: string;
  providerName: string;
  poolId: string;
  tokenId: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Icon: string | null;
  token1Icon: string | null;
  token0Address: string;
  token1Address: string;
  feeTierBps: number;
  tvlUsd: number;
  rangeMin: number;
  rangeMax: number;
  currentPrice: number;
  status: RangeStatus;
  strategy: string;
  strategyLabel: string;
  liquidity: string;
  dailyFeesUsd: number;
  dailyIncentivesUsd: number;
  apr24h: number;
  // Note: fee0/fee1 removed - LIVE mode gets real data from Position Manager
};

export type ScanConfig = {
  limit: number;
  minTvl: number;
  providers?: string[];
  sampleSize?: number; // How many recent positions to sample per provider
};

export type ScanResult = {
  pools: PoolSnapshot[];
  byProvider: {
    enosys: PoolSnapshot[];
    sparkdex: PoolSnapshot[];
    blazeswap: PoolSnapshot[];
  };
  meta: {
    totalScanned: number;
    totalFiltered: number;
    scannedPositions: {
      enosys: number;
      sparkdex: number;
      blazeswap: number;
    };
  };
};

// Token metadata cache
const tokenCache = new Map<string, { symbol: string; decimals: number }>();

async function getTokenMetadata(address: `0x${string}`): Promise<{ symbol: string; decimals: number }> {
  const key = address.toLowerCase();
  const cached = tokenCache.get(key);
  if (cached) return cached;

  try {
    const [symbol, decimals] = await Promise.all([
      client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'symbol',
      }) as Promise<string>,
      client.readContract({
        address,
        abi: ERC20_ABI,
        functionName: 'decimals',
      }) as Promise<number>,
    ]);

    const metadata = { symbol, decimals };
    tokenCache.set(key, metadata);
    return metadata;
  } catch (error) {
    console.error(`[TopPoolsScanner] Failed to get token metadata for ${address}:`, error);
    return { symbol: 'UNKNOWN', decimals: 18 };
  }
}

function tickToPrice(tick: number, decimals0: number, decimals1: number): number {
  const price = Math.pow(1.0001, tick);
  const adjusted = price * Math.pow(10, decimals0 - decimals1);
  return adjusted;
}

function sqrtPriceX96ToPrice(sqrtPriceX96: bigint, decimals0: number, decimals1: number): number {
  const Q96 = 2n ** 96n;
  const price = (Number(sqrtPriceX96) / Number(Q96)) ** 2;
  const adjusted = price * Math.pow(10, decimals0 - decimals1);
  return adjusted;
}

function calculateTVL(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  currentTick: number,
  price0Usd: number,
  price1Usd: number,
  decimals0: number,
  decimals1: number
): number {
  if (liquidity === 0n) return 0;

  const Q96 = 2n ** 96n;
  const sqrtPrice = sqrtPriceX96;
  const sqrtPriceLower = BigInt(Math.floor(Math.sqrt(Math.pow(1.0001, tickLower)) * Number(Q96)));
  const sqrtPriceUpper = BigInt(Math.floor(Math.sqrt(Math.pow(1.0001, tickUpper)) * Number(Q96)));

  let amount0 = 0n;
  let amount1 = 0n;

  if (currentTick < tickLower) {
    // All in token0
    amount0 = (liquidity * Q96 * (sqrtPriceUpper - sqrtPriceLower)) / (sqrtPriceUpper * sqrtPriceLower);
  } else if (currentTick >= tickUpper) {
    // All in token1
    amount1 = (liquidity * (sqrtPriceUpper - sqrtPriceLower)) / Q96;
  } else {
    // Both tokens
    amount0 = (liquidity * Q96 * (sqrtPriceUpper - sqrtPrice)) / (sqrtPriceUpper * sqrtPrice);
    amount1 = (liquidity * (sqrtPrice - sqrtPriceLower)) / Q96;
  }

  const amount0Float = Number(amount0) / Math.pow(10, decimals0);
  const amount1Float = Number(amount1) / Math.pow(10, decimals1);

  const tvlUsd = amount0Float * price0Usd + amount1Float * price1Usd;
  return tvlUsd;
}

async function scanV3Position(
  config: typeof POSITION_MANAGERS[number],
  tokenId: bigint
): Promise<PoolSnapshot | null> {
  try {
    // Get position data
    const position = await client.readContract({
      address: config.address,
      abi: POSITION_MANAGER_ABI,
      functionName: 'positions',
      args: [tokenId],
    });

    const [, , token0, token1, fee, tickLower, tickUpper, liquidity] = position;

    // Skip if no liquidity
    if (liquidity === 0n) return null;

    // Get token metadata
    const [token0Meta, token1Meta] = await Promise.all([
      getTokenMetadata(token0),
      getTokenMetadata(token1),
    ]);

    // Get pool address
    const poolAddress = await client.readContract({
      address: config.factory,
      abi: FACTORY_ABI,
      functionName: 'getPool',
      args: [token0, token1, fee],
    });

    if (!poolAddress || poolAddress === '0x0000000000000000000000000000000000000000') {
      return null;
    }

    // Get current price
    const slot0 = await client.readContract({
      address: poolAddress as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'slot0',
    });

    const [sqrtPriceX96, currentTick] = slot0;

    // Get token prices
    const [price0Usd, price1Usd] = await Promise.all([
      getUsdPriceNow(token0.toLowerCase() as `0x${string}`).catch(() => 0),
      getUsdPriceNow(token1.toLowerCase() as `0x${string}`).catch(() => 0),
    ]);

    // Calculate TVL
    const tvlUsd = calculateTVL(
      liquidity,
      sqrtPriceX96,
      tickLower,
      tickUpper,
      currentTick,
      price0Usd,
      price1Usd,
      token0Meta.decimals,
      token1Meta.decimals
    );

    // Calculate range prices
    const rangeMin = tickToPrice(tickLower, token0Meta.decimals, token1Meta.decimals);
    const rangeMax = tickToPrice(tickUpper, token0Meta.decimals, token1Meta.decimals);
    const currentPrice = sqrtPriceX96ToPrice(sqrtPriceX96, token0Meta.decimals, token1Meta.decimals);

    // Get range status
    const status = getRangeStatus(currentPrice, rangeMin, rangeMax);
    const rangeWidthPct = getRangeWidthPct(rangeMin, rangeMax);
    const strategyResult = getStrategy(rangeWidthPct);

    // Estimate daily fees (rough estimate: 0.3% of TVL per year = daily)
    const dailyFeesUsd = tvlUsd * (Number(fee) / 10000) * 0.01 / 365;
    const dailyIncentivesUsd = 0; // TODO: Calculate from incentive programs

    const apr24h = tvlUsd > 0 ? ((dailyFeesUsd + dailyIncentivesUsd) / tvlUsd) * 365 * 100 : 0;

    return {
      provider: config.name,
      providerSlug: config.slug,
      providerName: config.displayName,
      poolId: tokenId.toString(),
      tokenId: tokenId.toString(),
      token0Symbol: token0Meta.symbol,
      token1Symbol: token1Meta.symbol,
      token0Icon: null, // Will be enriched later
      token1Icon: null,
      token0Address: token0.toLowerCase(),
      token1Address: token1.toLowerCase(),
      feeTierBps: Number(fee),
      tvlUsd,
      rangeMin,
      rangeMax,
      currentPrice,
      status,
      strategy: strategyResult.tone,
      strategyLabel: strategyResult.tone.charAt(0).toUpperCase() + strategyResult.tone.slice(1),
      liquidity: liquidity.toString(),
      dailyFeesUsd,
      dailyIncentivesUsd,
      apr24h,
      // Note: fee0/fee1 removed - only use real data from Position Manager
    };
  } catch (error: any) {
    // Silently skip failed positions to avoid crashing the scan
    return null;
  }
}

async function scanV3Provider(
  config: typeof POSITION_MANAGERS[number],
  sampleSize: number
): Promise<{ pools: PoolSnapshot[]; scanned: number }> {
  console.log(`[TopPoolsScanner] Scanning ${config.displayName}...`);

  try {
    // Get total supply
    const totalSupply = await client.readContract({
      address: config.address,
      abi: POSITION_MANAGER_ABI,
      functionName: 'totalSupply',
    });

    const total = Number(totalSupply);
    console.log(`[TopPoolsScanner] ${config.displayName} total positions: ${total}`);

    // Sample positions from different ranges to find active ones
    // Strategy: Recent positions are most likely to be active
    const recentCount = Math.min(sampleSize, total);
    const middleCount = Math.min(50, total);
    const oldCount = Math.min(50, total);
    
    const sampleRanges = [
      { start: Math.max(1, total - recentCount + 1), end: total, label: 'recent' },
      { start: Math.max(1, Math.floor(total * 0.5)), end: Math.min(total, Math.floor(total * 0.5) + middleCount), label: 'middle' },
      { start: 1, end: oldCount, label: 'oldest' },
    ];

    const tokenIds: bigint[] = [];
    for (const range of sampleRanges) {
      for (let i = range.start; i <= range.end; i++) {
        tokenIds.push(BigInt(i));
      }
    }

    console.log(`[TopPoolsScanner] Sampling ${tokenIds.length} positions from ${config.displayName} (recent: ${recentCount}, middle: ${middleCount}, oldest: ${oldCount})...`);

    // Scan in batches to avoid rate limits
    const BATCH_SIZE = 20;
    const pools: PoolSnapshot[] = [];

    for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
      const batch = tokenIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map((tokenId) => scanV3Position(config, tokenId))
      );

      results.forEach((pool) => {
        if (pool && pool.tvlUsd > 0) {
          pools.push(pool);
        }
      });

      // Small delay to avoid rate limits
      if (i + BATCH_SIZE < tokenIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`[TopPoolsScanner] ${config.displayName} found ${pools.length} pools with TVL > 0`);

    return { pools, scanned: tokenIds.length };
  } catch (error) {
    console.error(`[TopPoolsScanner] Failed to scan ${config.displayName}:`, error);
    return { pools: [], scanned: 0 };
  }
}

async function enrichWithIcons(pools: PoolSnapshot[]): Promise<PoolSnapshot[]> {
  console.log(`[TopPoolsScanner] Enriching ${pools.length} pools with token icons...`);

  return Promise.all(
    pools.map(async (pool) => {
      const [token0Icon, token1Icon] = await Promise.all([
        fetchTokenIconBySymbol(pool.token0Symbol).catch(() => null),
        fetchTokenIconBySymbol(pool.token1Symbol).catch(() => null),
      ]);

      return {
        ...pool,
        token0Icon,
        token1Icon,
      };
    })
  );
}

/**
 * Scan top pools from all providers
 */
export async function getTopPoolsByTVL(config: ScanConfig): Promise<ScanResult> {
  console.log('[TopPoolsScanner] Starting top pools scan...');
  console.log('[TopPoolsScanner] Config:', config);

  const sampleSize = config.sampleSize ?? 500;
  const allPools: PoolSnapshot[] = [];
  const scannedCounts = {
    enosys: 0,
    sparkdex: 0,
    blazeswap: 0,
  };

  // Scan V3 providers in parallel
  const v3Results = await Promise.all(
    POSITION_MANAGERS.map((pm) => scanV3Provider(pm, sampleSize))
  );

  v3Results.forEach((result, index) => {
    const provider = POSITION_MANAGERS[index];
    allPools.push(...result.pools);
    scannedCounts[provider.name as keyof typeof scannedCounts] = result.scanned;
  });

  // TODO: Add BlazeSwap V2 scanning here

  console.log(`[TopPoolsScanner] Total pools found: ${allPools.length}`);

  // Filter by minTvl
  const filtered = allPools.filter((pool) => pool.tvlUsd >= config.minTvl);
  console.log(`[TopPoolsScanner] Pools after TVL filter (>=${config.minTvl}): ${filtered.length}`);

  // Sort by TVL descending
  const sorted = filtered.sort((a, b) => b.tvlUsd - a.tvlUsd);

  // Enrich with icons
  const enriched = await enrichWithIcons(sorted);

  // Group by provider and take TOP 3 per provider
  const byProvider = {
    enosys: enriched.filter((p) => p.provider === 'enosys').slice(0, 3),
    sparkdex: enriched.filter((p) => p.provider === 'sparkdex').slice(0, 3),
    blazeswap: enriched.filter((p) => p.provider === 'blazeswap').slice(0, 3),
  };

  // Combine top 3 from each provider (max 9 pools total)
  const top9 = [
    ...byProvider.enosys,
    ...byProvider.sparkdex,
    ...byProvider.blazeswap,
  ];

  console.log(`[TopPoolsScanner] Selected top 3 per provider: Enosys=${byProvider.enosys.length}, SparkDEX=${byProvider.sparkdex.length}, BlazeSwap=${byProvider.blazeswap.length}`);

  return {
    pools: top9,
    byProvider,
    meta: {
      totalScanned: allPools.length,
      totalFiltered: filtered.length,
      scannedPositions: scannedCounts,
    },
  };
}

