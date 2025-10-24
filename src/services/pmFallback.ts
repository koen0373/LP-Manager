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

const pm = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657' as `0x${string}`;

const publicClient = createClientWithFallback([
  'https://flare.flr.finance/ext/bc/C/rpc',
  'https://flare.public-rpc.com',
  'https://rpc-enosys.flare.network'
]);

// Token metadata cache
const tokenCache = new Map<string, { symbol: string; name: string; decimals: number }>();



// Get token metadata using Viem
async function getTokenMetadata(address: `0x${string}`): Promise<{ symbol: string; name: string; decimals: number }> {
  const normalized = normalizeAddress(address);

  if (tokenCache.has(normalized)) {
    return tokenCache.get(normalized)!;
  }

  try {
    const [symbol, name, decimals] = await Promise.all([
      publicClient.readContract({
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
      }).catch(() => 'UNKNOWN'),
      
      publicClient.readContract({
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
      }).catch(() => 'Unknown Token'),
      
      publicClient.readContract({
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
      }).catch(() => 18),
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
  walletAddress?: string
): Promise<PositionRow | null> {
  try {
    console.log(`[DEBUG] Parsing Viem position data for tokenId: ${tokenId.toString()}`);
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
    
    console.log(`[DEBUG] Viem position tuple:`);
    console.log(`[DEBUG] Token0: ${token0}, Token1: ${token1}`);
    console.log(`[DEBUG] Fee: ${fee}, TickLower: ${tickLower}, TickUpper: ${tickUpper}`);
    console.log(`[DEBUG] Liquidity: ${liquidity.toString()}`);

    // Get token metadata
    const [token0Meta, token1Meta] = await Promise.all([
      getTokenMetadata(token0),
      getTokenMetadata(token1),
    ]);
    console.log('[METADATA][viem]', {
      token0: token0Meta,
      token1: token1Meta,
    });

    const { lowerPrice, upperPrice } = computePriceRange(
      tickLower,
      tickUpper,
      token0Meta.decimals,
      token1Meta.decimals
    );
    
    // Get factory address and pool address
    const factory = await getFactoryAddress(pm);
    const poolAddress = await getPoolAddress(factory, token0, token1, fee);
    
    // Get pool state
    const { sqrtPriceX96, tick: currentTick } = await getPoolState(poolAddress);
    
    // Calculate amounts using proper Uniswap V3 math
    console.log(`[PMFALLBACK] Calculating amounts for tokenId ${tokenId}, liquidity: ${liquidity.toString()}`);
    const { amount0Wei, amount1Wei } = calcAmountsForPosition(
      liquidity,
      sqrtPriceX96,
      tickLower,
      tickUpper,
      token0Meta.decimals,
      token1Meta.decimals
    );
    console.log(`[PMFALLBACK] Calculated amounts: amount0Wei=${amount0Wei.toString()}, amount1Wei=${amount1Wei.toString()}`);
    
    // Check if in range
    const inRange = isInRange(currentTick, tickLower, tickUpper);
    console.log(`[PMFALLBACK] Position in range: ${inRange} (currentTick: ${currentTick}, range: ${tickLower}-${tickUpper})`);
    
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
    
    // Calculate TVL and rewards
    console.log(`[PMFALLBACK] Calculating TVL and rewards for ${token0Meta.symbol}/${token1Meta.symbol}`);
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
    console.log(`[PMFALLBACK] Final TVL: $${tvlUsd}, Rewards: $${rewardsUsd}`);
    console.log('[PMFALLBACK][VALUE]', {
      amount0,
      amount1,
      fee0,
      fee1,
      price0Usd,
      price1Usd,
    });

    const [rflrAmountRaw, rflrPriceUsd, poolLiquidity] = await Promise.all([
      getRflrRewardForPosition(tokenId.toString()),
      getTokenPrice('RFLR'),
      readPoolLiquidity(poolAddress),
    ]);

    const rflrAmount = rflrAmountRaw ?? 0;
    const rflrUsd = rflrAmount * rflrPriceUsd;
    
    // Calculate pool share percentage
    let poolSharePct: number | undefined;
    if (poolLiquidity && poolLiquidity > 0n) {
      poolSharePct = (Number(liquidity) / Number(poolLiquidity)) * 100;
    }
    
    // Unclaimed fees are separate from RFLR rewards
    // For inactive pools, fees should be 0 as they don't generate swap fees
    const unclaimedFeesUsd = inRange ? rewardsUsd : 0;
    
    // Total rewards = unclaimed fees + RFLR (for active) or just RFLR (for inactive)
    const totalRewardsUsd = inRange ? (unclaimedFeesUsd + rflrUsd) : rflrUsd;

    // Create position row
    return {
      id: tokenId.toString(),
      pairLabel: `${token0Meta.symbol} - ${token1Meta.symbol}`,
      feeTierBps: fee,
      tickLowerLabel: formatPrice(lowerPrice),
      tickUpperLabel: formatPrice(upperPrice),
      tvlUsd,
      rewardsUsd: totalRewardsUsd,
      unclaimedFeesUsd: unclaimedFeesUsd,
      rflrRewardsUsd: rflrUsd,
      rflrAmount,
      rflrUsd,
      rflrPriceUsd,
      // APS removed for Phase 3
      inRange,
      status: 'Active' as const,
      token0: {
        symbol: token0Meta.symbol,
        address: token0,
        name: token0Meta.name,
        decimals: token0Meta.decimals
      },
      token1: {
        symbol: token1Meta.symbol,
        address: token1,
        name: token1Meta.name,
        decimals: token1Meta.decimals
      },
      // New fields
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
    console.error('Failed to parse position data:', error);
    return null;
  }
}

// Get a specific position by token ID
export async function getPositionById(tokenId: string): Promise<PositionRow | null> {
  return memoize(`position-${tokenId}`, async () => {
    try {
      console.log(`[PMFALLBACK] Fetching position by ID: ${tokenId}`);
      
      const tokenIdBigInt = BigInt(tokenId);
      
      // Get position data directly
      const positionData = await withTimeout(
        publicClient.readContract({
          address: pm,
          abi: PositionManagerABI,
          functionName: 'positions',
          args: [tokenIdBigInt],
        }) as Promise<Record<string, unknown>>,
        15000,
        `Position fetch for ${tokenId} timed out`
      );

    const parsed = await parsePositionData(tokenIdBigInt, positionData);
    return parsed;
  } catch (error) {
    console.error(`Failed to fetch position ${tokenId}:`, error);
    return null;
  }
  }, 5 * 60 * 1000); // 5 minute cache for individual positions
}

export async function getLpPositionsOnChain(owner: `0x${string}`): Promise<PositionRow[]> {
  return memoize(`viem-positions-${owner}`, async () => {
    try {
      console.log(`Fetching positions for wallet using Viem: ${owner}`);

      // Get balance of NFTs (number of positions)
      const bal = await withTimeout(
        publicClient.readContract({
          address: pm,
          abi: PositionManagerABI,
          functionName: 'balanceOf',
          args: [owner],
        }) as Promise<bigint>,
        15000,
        `Balance check for ${owner} timed out`
      );

    const count = Number(bal);
    console.log(`Found ${count} positions using Viem`);

    if (count === 0) {
      return [];
    }

    const indices = Array.from({ length: count }, (_, i) => i);
    const tokenIdResults = await mapWithConcurrency(indices, 20, async (i) => {
      const tokenId = (await publicClient.readContract({
        address: pm,
        abi: PositionManagerABI,
        functionName: 'tokenOfOwnerByIndex',
        args: [owner, BigInt(i)],
      })) as bigint;
      return tokenId;
    });

    const tokenIds = tokenIdResults
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.value);

    const positionResults = await mapWithConcurrency(tokenIds, 12, async (tokenId) => {
      const positionData = (await publicClient.readContract({
        address: pm,
        abi: PositionManagerABI,
        functionName: 'positions',
        args: [tokenId],
      })) as Record<string, unknown>;

      return parsePositionData(tokenId, positionData, owner);
    });

    return positionResults
      .sort((a, b) => a.index - b.index)
      .map((entry) => entry.value)
      .filter((position): position is PositionRow => position !== null);
  } catch (error) {
    console.error('Failed to fetch wallet positions using Viem:', error);
    return [];
  }
  }, 30 * 1000); // 30 second cache for wallet positions
}
