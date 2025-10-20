import { createPublicClient, fallback, http } from 'viem';
import { flare } from '../lib/chainFlare';
import PositionManagerABI from '../abis/NonfungiblePositionManager.json';
import type { PositionRow } from '../types/positions';
import { getPoolAddress, tickToPrice, calcAmountsForPosition, isInRange, formatPrice } from '../utils/positions';
import { getTokenPrice, calculateUsdValue } from './tokenPrices';

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

// Pool state cache
const poolCache = new Map<string, { 
  sqrtPriceX96: bigint; 
  tick: number; 
  timestamp: number 
}>();
const POOL_CACHE_TTL = 30000; // 30 seconds

// Uniswap V3 Factory address (standard address)
const UNISWAP_V3_FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984' as `0x${string}`;

// Get token metadata using Viem
async function getTokenMetadata(address: `0x${string}`): Promise<{ symbol: string; name: string; decimals: number }> {
  if (tokenCache.has(address)) {
    return tokenCache.get(address)!;
  }

  try {
    const [symbol, name, decimals] = await Promise.all([
      publicClient.readContract({
        address,
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
        address,
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
    tokenCache.set(address, metadata);
    return metadata;
  } catch (error) {
    console.error(`Failed to get token metadata for ${address}:`, error);
    return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 };
  }
}

// Get pool state (slot0)
async function getPoolState(poolAddress: `0x${string}`): Promise<{ sqrtPriceX96: bigint; tick: number }> {
  const cacheKey = poolAddress.toLowerCase();
  const cached = poolCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < POOL_CACHE_TTL) {
    return { sqrtPriceX96: cached.sqrtPriceX96, tick: cached.tick };
  }
  
  try {
    const slot0 = await publicClient.readContract({
      address: poolAddress,
      abi: [
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
            { name: 'unlocked', type: 'bool' }
          ]
        }
      ],
      functionName: 'slot0',
    });
    
    const [sqrtPriceX96, tick] = slot0 as [bigint, number, number, number, number, number, boolean];
    
    // Cache the result
    poolCache.set(cacheKey, {
      sqrtPriceX96,
      tick,
      timestamp: Date.now()
    });
    
    return { sqrtPriceX96, tick };
  } catch (error) {
    console.error(`Failed to get pool state for ${poolAddress}:`, error);
    // Return default values
    return { sqrtPriceX96: 0n, tick: 0 };
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
    const values = Array.isArray(positionData) ? positionData : Object.values(positionData);
    const tuple = values as RawPositionTuple;
    const [, , token0, token1, feeRaw, tickLowerRaw, tickUpperRaw, liquidity, , , tokensOwed0, tokensOwed1] = tuple;

    // Get token metadata
    const [token0Meta, token1Meta] = await Promise.all([
      getTokenMetadata(token0),
      getTokenMetadata(token1),
    ]);

    // Calculate prices from ticks (simplified for now)
    const lowerPrice = tickToPrice(Number(tickLowerRaw), token0Meta.decimals, token1Meta.decimals);
    const upperPrice = tickToPrice(Number(tickUpperRaw), token0Meta.decimals, token1Meta.decimals);
    
    // Calculate pool address
    const poolAddress = getPoolAddress(UNISWAP_V3_FACTORY, token0, token1, Number(feeRaw));
    
    // Get pool state
    const { sqrtPriceX96, tick: currentTick } = await getPoolState(poolAddress);
    
    // Calculate amounts
    const { amount0, amount1 } = calcAmountsForPosition(
      liquidity,
      sqrtPriceX96,
      Number(tickLowerRaw),
      Number(tickUpperRaw),
      token0Meta.decimals,
      token1Meta.decimals
    );
    
    // Check if in range
    const inRange = isInRange(currentTick, Number(tickLowerRaw), Number(tickUpperRaw));
    
    // Get token prices
    const [token0Price, token1Price] = await Promise.all([
      getTokenPrice(token0Meta.symbol),
      getTokenPrice(token1Meta.symbol),
    ]);
    
    // Calculate TVL
    const tvlUsd = calculateUsdValue(amount0, token0Meta.decimals, token0Price) + 
                   calculateUsdValue(amount1, token1Meta.decimals, token1Price);
    
    // Calculate rewards (unclaimed fees)
    const rewardsUsd = calculateUsdValue(tokensOwed0, token0Meta.decimals, token0Price) + 
                       calculateUsdValue(tokensOwed1, token1Meta.decimals, token1Price);

    // Create position row
    return {
      id: tokenId.toString(),
      pairLabel: `${token0Meta.symbol} - ${token1Meta.symbol}`,
      feeTierBps: Number(feeRaw),
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
      amount0: amount0.toString(),
      amount1: amount1.toString(),
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
    const bal: bigint = await publicClient.readContract({
      address: pm,
      abi: PositionManagerABI,
      functionName: 'balanceOf',
      args: [owner],
    });

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
        });
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
        });

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
