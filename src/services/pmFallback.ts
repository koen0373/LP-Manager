import { createPublicClient, fallback, http } from 'viem';
import { flare } from '../lib/chainFlare';
import PositionManagerABI from '../abis/NonfungiblePositionManager.json';
import type { PositionRow } from '../types/positions';
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

const pm = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657' as `0x${string}`;

const rpcTransports = fallback([
  http(flare.rpcUrls.default.http[0], {
    batch: { batchSize: 15, wait: 50 },
    retryCount: 2,
    retryDelay: 250,
  }),
  http(flare.rpcUrls.default.http[1] ?? 'https://flare.public-rpc.com', {
    batch: { batchSize: 15, wait: 75 },
    retryCount: 2,
    retryDelay: 350,
  }),
  http('https://1rpc.io/flare', {
    batch: { batchSize: 10, wait: 100 },
    retryCount: 2,
    retryDelay: 350,
  }),
]);

const publicClient = createPublicClient({
  chain: flare,
  transport: rpcTransports,
  pollingInterval: 6_000,
});

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
  positionData: readonly unknown[] | Record<string, unknown>
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

    // Create position row
    return {
      id: tokenId.toString(),
      pairLabel: `${token0Meta.symbol} - ${token1Meta.symbol}`,
      feeTierBps: fee,
      tickLowerLabel: formatPrice(lowerPrice),
      tickUpperLabel: formatPrice(upperPrice),
      tvlUsd,
      rewardsUsd,
      rflrAmount: 0,
      rflrUsd: 0,
      rflrPriceUsd: 0.01758,
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
      isInRange: inRange,
      poolAddress,
    };
  } catch (error) {
    console.error('Failed to parse position data:', error);
    return null;
  }
}

export async function getLpPositionsOnChain(owner: `0x${string}`): Promise<PositionRow[]> {
  try {
    console.log(`Fetching positions for wallet using Viem: ${owner}`);

    // Get balance of NFTs (number of positions)
    const bal = await publicClient.readContract({
      address: pm,
      abi: PositionManagerABI,
      functionName: 'balanceOf',
      args: [owner],
    }) as bigint;

    const count = Number(bal);
    console.log(`Found ${count} positions using Viem`);

    if (count === 0) {
      return [];
    }

    const tokenIds: bigint[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const tokenId = await publicClient.readContract({
          address: pm,
          abi: PositionManagerABI,
          functionName: 'tokenOfOwnerByIndex',
          args: [owner, BigInt(i)],
        }) as bigint;
        tokenIds.push(tokenId);
      } catch (tokenErr) {
        console.error(`Failed to fetch tokenOfOwnerByIndex(${i})`, tokenErr);
      }

      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, 120));
      }
    }

    const parsedPositions: PositionRow[] = [];
    for (let index = 0; index < tokenIds.length; index++) {
      const tokenId = tokenIds[index];
      try {
        const positionData = await publicClient.readContract({
          address: pm,
          abi: PositionManagerABI,
          functionName: 'positions',
          args: [tokenId],
        }) as Record<string, unknown>;

        const parsed = await parsePositionData(tokenId, positionData);
        if (parsed) {
          parsedPositions.push(parsed);
        }
      } catch (positionErr) {
        console.error(`Failed to fetch position details for token ${tokenId}`, positionErr);
      }

      if (index < tokenIds.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    }

    return parsedPositions;
  } catch (error) {
    console.error('Failed to fetch wallet positions using Viem:', error);
    return [];
  }
}
