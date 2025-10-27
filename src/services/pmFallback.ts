import { createClientWithFallback } from '../lib/adapters/clientFactory';
import PositionManagerABI from '../abis/NonfungiblePositionManager.json';
import type { PositionRow } from '../types/positions';
import { getRflrRewardForPosition } from './rflrRewards';
import { getTokenPrice } from './tokenPrices';
import { mapWithConcurrency } from '../lib/util/concurrency';
import { memoize } from '../lib/util/memo';
import { withTimeout } from '../lib/util/withTimeout';
import {
  getFactoryAddress,
  getPoolAddress,
  getPoolState,
  calcAmountsForPosition,
  isInRange,
  formatPrice,
  calculatePositionValue,
  normalizeAddress,
  toSignedInt24,
  computePriceRange,
  calculateAccruedFees,
} from '../utils/poolHelpers';
import { readPoolLiquidity } from '../lib/onchain/readers';

interface PositionManagerConfig {
  provider: string;
  providerSlug: string;
  positionManager: `0x${string}`;
  factory: `0x${string}`;
  idPrefix?: string;
  displayPrefix?: string;
  supportsRflr?: boolean;
}

const POSITION_MANAGERS: readonly PositionManagerConfig[] = [
  {
    provider: 'Enosys v3',
    providerSlug: 'enosys-v3',
    positionManager: '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657',
    factory: '0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de',
    idPrefix: '',
    displayPrefix: '#',
    supportsRflr: true,
  },
  {
    provider: 'SparkDEX v3',
    providerSlug: 'sparkdex-v3',
    positionManager: '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da',
    factory: '0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652',
    idPrefix: 'sparkdex-v3:',
    displayPrefix: 'SPARK-',
    supportsRflr: false,
  },
] as const;

const publicClient = createClientWithFallback([
  'https://flare.flr.finance/ext/bc/C/rpc',
  'https://flare.public-rpc.com',
  'https://rpc-enosys.flare.network',
]);

// Token metadata cache
const tokenCache = new Map<string, { symbol: string; name: string; decimals: number }>();

function deriveRowIdentifiers(tokenId: bigint, config: PositionManagerConfig) {
  const rawId = tokenId.toString();
  const idPrefix = config.idPrefix ?? '';
  const displayPrefix = config.displayPrefix ?? '#';
  return {
    id: `${idPrefix}${rawId}`,
    displayId: `${displayPrefix}${rawId}`,
    onchainId: rawId,
  };
}

// Get token metadata using Viem
async function getTokenMetadata(address: `0x${string}`): Promise<{ symbol: string; name: string; decimals: number }> {
  const normalized = normalizeAddress(address);

  if (tokenCache.has(normalized)) {
    return tokenCache.get(normalized)!;
  }

  try {
    const [symbol, name, decimals] = await Promise.all([
      publicClient
        .readContract({
          address: normalized,
          abi: [
            {
              name: 'symbol',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'string' }],
            },
          ],
          functionName: 'symbol',
        })
        .catch(() => 'UNKNOWN'),

      publicClient
        .readContract({
          address,
          abi: [
            {
              name: 'name',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'string' }],
            },
          ],
          functionName: 'name',
        })
        .catch(() => 'Unknown Token'),

      publicClient
        .readContract({
          address: normalized,
          abi: [
            {
              name: 'decimals',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint8' }],
            },
          ],
          functionName: 'decimals',
        })
        .catch(() => 18),
    ]);

    const metadata = { symbol, name, decimals };
    tokenCache.set(normalized, metadata);
    return metadata;
  } catch (error) {
    console.error(`Failed to get token metadata for ${address}:`, error);
    return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 };
  }
}

// Parse position data from Viem result
type RawPositionTuple = [
  bigint,
  `0x${string}`,
  `0x${string}`,
  `0x${string}`,
  number | bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint
];

async function parsePositionData(
  tokenId: bigint,
  positionData: readonly unknown[] | Record<string, unknown>,
  config: PositionManagerConfig,
  walletAddress?: string
): Promise<PositionRow | null> {
  try {
    console.log(`[PMFALLBACK] Parsing position ${tokenId.toString()} for ${config.providerSlug}`);
    const values = Array.isArray(positionData) ? positionData : Object.values(positionData);
    const tuple = values as RawPositionTuple;
    const [
      ,
      ,
      token0Raw,
      token1Raw,
      feeRaw,
      tickLowerRaw,
      tickUpperRaw,
      liquidity,
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
      tokensOwed0,
      tokensOwed1,
    ] = tuple;

    // Normalize token addresses & ticks
    const token0 = normalizeAddress(token0Raw);
    const token1 = normalizeAddress(token1Raw);
    const fee = Number(feeRaw);
    const tickLower = toSignedInt24(tickLowerRaw);
    const tickUpper = toSignedInt24(tickUpperRaw);

    const identifiers = deriveRowIdentifiers(tokenId, config);
    console.log(`[PMFALLBACK] Viem tuple (${config.providerSlug}):`, {
      token0,
      token1,
      fee,
      tickLower,
      tickUpper,
      liquidity: liquidity.toString(),
    });

    const [token0Meta, token1Meta] = await Promise.all([
      getTokenMetadata(token0),
      getTokenMetadata(token1),
    ]);

    const { lowerPrice, upperPrice } = computePriceRange(
      tickLower,
      tickUpper,
      token0Meta.decimals,
      token1Meta.decimals
    );

    const factory = await getFactoryAddress(config.positionManager, config.factory);
    const poolAddress = await getPoolAddress(factory, token0, token1, fee);
    const { sqrtPriceX96, tick: currentTick } = await getPoolState(poolAddress);

    const { amount0Wei, amount1Wei } = calcAmountsForPosition(
      liquidity,
      sqrtPriceX96,
      tickLower,
      tickUpper,
      token0Meta.decimals,
      token1Meta.decimals
    );

    const inRange = isInRange(currentTick, tickLower, tickUpper);

    const { fee0Wei, fee1Wei } = await calculateAccruedFees({
      poolAddress,
      liquidity,
      tickLower,
      tickUpper,
      currentTick,
      feeGrowthInside0LastX128,
      feeGrowthInside1LastX128,
      tokensOwed0,
      tokensOwed1,
    });

    const {
      amount0,
      amount1,
      fee0,
      fee1,
      price0Usd,
      price1Usd,
      tvlUsd,
      rewardsUsd,
    } = await calculatePositionValue({
      token0Symbol: token0Meta.symbol,
      token1Symbol: token1Meta.symbol,
      token0Decimals: token0Meta.decimals,
      token1Decimals: token1Meta.decimals,
      amount0Wei,
      amount1Wei,
      fee0Wei,
      fee1Wei,
      sqrtPriceX96,
    });

    const poolLiquidityPromise = readPoolLiquidity(poolAddress);

    let rflrAmount = 0;
    let rflrUsd = 0;
    let rflrPriceUsd = 0;

    if (config.supportsRflr) {
      const [rflrAmountRaw, priceUsd] = await Promise.all([
        getRflrRewardForPosition(identifiers.onchainId),
        getTokenPrice('RFLR'),
      ]);
      rflrAmount = rflrAmountRaw ?? 0;
      rflrPriceUsd = priceUsd;
      rflrUsd = rflrAmount * rflrPriceUsd;
    }

    const poolLiquidity = await poolLiquidityPromise;

    let poolSharePct: number | undefined;
    if (poolLiquidity && poolLiquidity > 0n) {
      poolSharePct = (Number(liquidity) / Number(poolLiquidity)) * 100;
    }

    const unclaimedFeesUsd = inRange ? rewardsUsd : 0;
    const totalRewardsUsd = inRange ? unclaimedFeesUsd + rflrUsd : rflrUsd;

    return {
      id: identifiers.id,
      displayId: identifiers.displayId,
      onchainId: identifiers.onchainId,
      positionManager: config.positionManager,
      provider: config.provider,
      providerSlug: config.providerSlug,
      pairLabel: `${token0Meta.symbol} - ${token1Meta.symbol}`,
      feeTierBps: fee,
      tickLowerLabel: formatPrice(lowerPrice),
      tickUpperLabel: formatPrice(upperPrice),
      tvlUsd,
      rewardsUsd: totalRewardsUsd,
      unclaimedFeesUsd,
      rflrRewardsUsd: rflrUsd,
      rflrAmount,
      rflrUsd,
      rflrPriceUsd,
      inRange,
      status: 'Active',
      token0: {
        symbol: token0Meta.symbol,
        address: token0,
        name: token0Meta.name,
        decimals: token0Meta.decimals,
      },
      token1: {
        symbol: token1Meta.symbol,
        address: token1,
        name: token1Meta.name,
        decimals: token1Meta.decimals,
      },
      amount0,
      amount1,
      lowerPrice,
      upperPrice,
      tickLower,
      tickUpper,
      isInRange: inRange,
      poolAddress,
      price0Usd,
      price1Usd,
      fee0,
      fee1,
      walletAddress,
      currentTick,
      liquidity,
      poolLiquidity: poolLiquidity || undefined,
      poolSharePct,
    };
  } catch (error) {
    console.error(`Failed to parse position data (${config.providerSlug}):`, error);
    return null;
  }
}

function normalizeTokenIdForConfig(tokenId: string, config: PositionManagerConfig): string | null {
  const prefix = config.idPrefix ?? '';
  if (prefix && tokenId.startsWith(prefix)) {
    return tokenId.slice(prefix.length);
  }
  if (!prefix) {
    return tokenId;
  }
  return null;
}

async function fetchPositionsForManager(config: PositionManagerConfig, owner: `0x${string}`): Promise<PositionRow[]> {
  try {
    const balance = await withTimeout(
      publicClient.readContract({
        address: config.positionManager,
        abi: PositionManagerABI,
        functionName: 'balanceOf',
        args: [owner],
      }) as Promise<bigint>,
      15000,
      `Balance check for ${owner} (${config.providerSlug}) timed out`
    );

    const count = Number(balance);
    console.log(`[PMFALLBACK] ${config.providerSlug} balance for ${owner}: ${count}`);

    if (count === 0) {
      return [];
    }

    const indices = Array.from({ length: count }, (_, i) => i);
    const tokenIdResults = await mapWithConcurrency(indices, 20, async (i) => {
      const tokenId = (await publicClient.readContract({
        address: config.positionManager,
        abi: PositionManagerABI,
        functionName: 'tokenOfOwnerByIndex',
        args: [owner, BigInt(i)],
      })) as bigint;
      return tokenId;
    });

    const tokenIds = tokenIdResults.map((entry) => entry.value);

    const positionResults = await mapWithConcurrency(tokenIds, 12, async (tokenId) => {
      const positionData = (await publicClient.readContract({
        address: config.positionManager,
        abi: PositionManagerABI,
        functionName: 'positions',
        args: [tokenId],
      })) as Record<string, unknown>;

      return parsePositionData(tokenId, positionData, config, owner);
    });

    return positionResults
      .map((entry) => entry.value)
      .filter((position): position is PositionRow => position !== null);
  } catch (error) {
    console.error(`[PMFALLBACK] Failed to fetch positions for ${config.providerSlug}:`, error);
    return [];
  }
}

export async function getPositionById(tokenId: string): Promise<PositionRow | null> {
  return memoize(`position-${tokenId}`, async () => {
    for (const config of POSITION_MANAGERS) {
      const normalized = normalizeTokenIdForConfig(tokenId, config);
      if (normalized === null) {
        continue;
      }

      try {
        const tokenIdBigInt = BigInt(normalized);
        const positionData = await withTimeout(
          publicClient.readContract({
            address: config.positionManager,
            abi: PositionManagerABI,
            functionName: 'positions',
            args: [tokenIdBigInt],
          }) as Promise<Record<string, unknown>>,
          15000,
          `Position fetch for ${tokenId} (${config.providerSlug}) timed out`
        );

        const parsed = await parsePositionData(tokenIdBigInt, positionData, config);
        if (parsed) {
          return parsed;
        }
      } catch (error) {
        console.error(`Failed to fetch position ${tokenId} for ${config.providerSlug}:`, error);
      }
    }

    // Fallback: attempt raw token ID against all managers if nothing matched
    if (/^\d+$/.test(tokenId)) {
      for (const config of POSITION_MANAGERS) {
        try {
          const tokenIdBigInt = BigInt(tokenId);
          const positionData = await withTimeout(
            publicClient.readContract({
              address: config.positionManager,
              abi: PositionManagerABI,
              functionName: 'positions',
              args: [tokenIdBigInt],
            }) as Promise<Record<string, unknown>>,
            15000,
            `Position fetch for ${tokenId} (${config.providerSlug}) timed out`
          );

          const parsed = await parsePositionData(tokenIdBigInt, positionData, config);
          if (parsed) {
            return parsed;
          }
        } catch (error) {
          console.error(`Fallback fetch failed for ${tokenId} on ${config.providerSlug}:`, error);
        }
      }
    }

    return null;
  }, 5 * 60 * 1000);
}

export async function getLpPositionsOnChain(owner: `0x${string}`): Promise<PositionRow[]> {
  return memoize(`viem-positions-${owner}`, async () => {
    console.log(`Fetching positions for wallet using Viem: ${owner}`);

    const positionSets = await Promise.all(
      POSITION_MANAGERS.map((config) => fetchPositionsForManager(config, owner))
    );

    return positionSets.flat();
  }, 30 * 1000);
}
