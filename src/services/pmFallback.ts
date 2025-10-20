import { createPublicClient, http } from 'viem';
import { flare } from '../lib/chainFlare';
import PositionManagerABI from '../abis/NonfungiblePositionManager.json';
import type { PositionRow } from '../types/positions';

const pm = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657' as `0x${string}`;

const publicClient = createPublicClient({
  chain: flare,
  transport: http(flare.rpcUrls.default.http[0], { batch: true }),
});

// Token metadata cache
const tokenCache = new Map<string, { symbol: string; name: string; decimals: number }>();

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

// Convert tick to price (simplified)
function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick);
}

// Parse position data from Viem result
async function parsePositionData(tokenId: bigint, positionData: any): Promise<PositionRow | null> {
  try {
    const [nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1] = positionData;

    // Get token metadata
    const [token0Meta, token1Meta] = await Promise.all([
      getTokenMetadata(token0),
      getTokenMetadata(token1),
    ]);

    // Convert ticks to prices
    const tickLowerPrice = tickToPrice(Number(tickLower));
    const tickUpperPrice = tickToPrice(Number(tickUpper));

    // Create position row
    return {
      id: tokenId.toString(),
      pairLabel: `${token0Meta.symbol} - ${token1Meta.symbol}`,
      feeTierBps: Number(fee),
      tickLowerLabel: tickLowerPrice.toFixed(5),
      tickUpperLabel: tickUpperPrice.toFixed(5),
      tvlUsd: 0, // TODO: Calculate from liquidity and current prices
      rewardsUsd: 0, // TODO: Calculate unclaimed fees
      rflrAmount: 0,
      rflrUsd: 0,
      rflrPriceUsd: 0.01758,
      inRange: true, // TODO: Check if current price is within range
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

    // Get all token IDs
    const tokenIds = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        publicClient.readContract({
          address: pm,
          abi: PositionManagerABI,
          functionName: 'tokenOfOwnerByIndex',
          args: [owner, BigInt(i)],
        })
      )
    );

    // Get all position data
    const positions = await Promise.all(
      tokenIds.map(tokenId =>
        publicClient.readContract({
          address: pm,
          abi: PositionManagerABI,
          functionName: 'positions',
          args: [tokenId],
        }).then((pos) => ({ tokenId, ...pos }))
      )
    );

    // Parse position data
    const parsedPositions: PositionRow[] = [];
    for (const { tokenId, ...positionData } of positions) {
      const parsed = await parsePositionData(tokenId, Object.values(positionData));
      if (parsed) {
        parsedPositions.push(parsed);
      }
    }

    return parsedPositions;
  } catch (error) {
    console.error('Failed to fetch wallet positions using Viem:', error);
    return [];
  }
}
