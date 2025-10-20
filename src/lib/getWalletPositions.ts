import { Address } from "viem";
import { publicClient } from "./viemClient";
import { positionManagerAbi, poolAbi } from "../abi/enosys";
import { ENOSYS_POSITION_MANAGER } from "../constants/enosys";
import { readTokenMeta } from "./readTokenMeta";
import { getTokenPrices } from "./tokenPrices";

export type WalletPosition = {
  tokenId: bigint;
  pool: Address;
  token0: { address: Address; symbol: string; decimals: number };
  token1: { address: Address; symbol: string; decimals: number };
  fee: number;             // bps: 3000 = 0.3%
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  slot0?: { tick: number; sqrtPriceX96: bigint };
  poolLiquidity?: bigint;
  inRange?: boolean;
  tvl?: number;
  unclaimedFees?: number;
};

export async function getWalletPositions(owner: Address): Promise<WalletPosition[]> {
  try {
    // 1) aantal NFT's
    const balance = await publicClient.readContract({
      address: ENOSYS_POSITION_MANAGER,
      abi: positionManagerAbi,
      functionName: "balanceOf",
      args: [owner],
    });

    const count = Number(balance);
    if (count === 0) return [];

    console.log(`Found ${count} NFT positions for wallet ${owner}`);

    // 2) alle tokenIds (sequential calls since multicall is disabled)
    const tokenIds: bigint[] = [];
    for (let i = 0; i < count; i++) {
      try {
        const tokenId = await publicClient.readContract({
          address: ENOSYS_POSITION_MANAGER,
          abi: positionManagerAbi,
          functionName: "tokenOfOwnerByIndex",
          args: [owner, BigInt(i)],
        });
        tokenIds.push(tokenId as bigint);
      } catch (error) {
        console.warn(`Failed to fetch tokenId at index ${i}:`, error);
      }
    }

    if (tokenIds.length === 0) return [];

    // 3) Get all unique token addresses for price fetching
    const allTokenAddresses = new Set<Address>();
    
    // 4) posities + bijbehorende pools (sequential calls)
    const positions: WalletPosition[] = [];
    for (const tokenId of tokenIds) {
      try {
        // Fetch position data
        const positionData = await publicClient.readContract({
          address: ENOSYS_POSITION_MANAGER,
          abi: positionManagerAbi,
          functionName: "positions",
          args: [tokenId],
        });

        // Fetch pool address
        const poolAddress = await publicClient.readContract({
          address: ENOSYS_POSITION_MANAGER,
          abi: positionManagerAbi,
          functionName: "poolByTokenId",
          args: [tokenId],
        });

        // positions() returns a tuple: [nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1]
        const p = positionData as readonly [bigint, Address, Address, Address, number, number, number, bigint, bigint, bigint, bigint, bigint];
        const pool = poolAddress as Address;

        const token0 = p[2] as Address; // token0
        const token1 = p[3] as Address; // token1
        const fee = p[4]; // fee
        const tickLower = p[5]; // tickLower
        const tickUpper = p[6]; // tickUpper
        const liquidity = p[7]; // liquidity

        // Add tokens to price fetching set
        allTokenAddresses.add(token0);
        allTokenAddresses.add(token1);

        // 5) token metadata
        const [t0, t1] = await Promise.all([
          readTokenMeta(token0),
          readTokenMeta(token1)
        ]);

        // 5) pool state (sequential calls)
        let slot0Result, poolLiquidityResult;
        try {
          slot0Result = await publicClient.readContract({
            address: pool,
            abi: poolAbi,
            functionName: "slot0",
          });
        } catch (error) {
          console.warn(`Failed to fetch slot0 for pool ${pool}:`, error);
          slot0Result = null;
        }

        try {
          poolLiquidityResult = await publicClient.readContract({
            address: pool,
            abi: poolAbi,
            functionName: "liquidity",
          });
        } catch (error) {
          console.warn(`Failed to fetch liquidity for pool ${pool}:`, error);
          poolLiquidityResult = null;
        }

        // slot0() returns a tuple: [sqrtPriceX96, tick, observationIndex, observationCardinality, observationCardinalityNext, feeProtocol, unlocked]
        const currentTick = slot0Result ? Number((slot0Result as readonly [bigint, number, number, number, number, number, boolean])[1]) : 0;
        const inRange = tickLower <= currentTick && currentTick <= tickUpper;

        // Store position data for later processing
        positions.push({
          tokenId,
          pool,
          token0: t0,
          token1: t1,
          fee,
          liquidity,
          tickLower,
          tickUpper,
          slot0: slot0Result
            ? { tick: Number((slot0Result as readonly [bigint, number, number, number, number, number, boolean])[1]), sqrtPriceX96: (slot0Result as readonly [bigint, number, number, number, number, number, boolean])[0] }
            : undefined,
          poolLiquidity: poolLiquidityResult as bigint | undefined,
          inRange,
          tvl: 0, // Will be calculated below
          unclaimedFees: 0, // Will be calculated below
        });
      } catch (error) {
        console.warn(`Failed to process position ${tokenId}:`, error);
      }
    }

    // 6) Fetch all token prices in parallel
    console.log(`Fetching prices for ${allTokenAddresses.size} unique tokens...`);
    const tokenPrices = await getTokenPrices(Array.from(allTokenAddresses));
    
    // 7) Calculate real-time TVL and unclaimed fees for each position
    for (const position of positions) {
      try {
        // Get tokens owed from position data
        const positionData = await publicClient.readContract({
          address: ENOSYS_POSITION_MANAGER,
          abi: positionManagerAbi,
          functionName: "positions",
          args: [position.tokenId],
        });
        
        const p = positionData as readonly [bigint, Address, Address, Address, number, number, number, bigint, bigint, bigint, bigint, bigint];
        const tokensOwed0 = p[10] as bigint; // tokensOwed0
        const tokensOwed1 = p[11] as bigint; // tokensOwed1
        
        // Get token prices
        const token0Price = tokenPrices.get(position.token0.address.toLowerCase()) || 0;
        const token1Price = tokenPrices.get(position.token1.address.toLowerCase()) || 0;
        
        // Calculate unclaimed fees in USD
        const unclaimedFees0 = Number(tokensOwed0) / Math.pow(10, position.token0.decimals);
        const unclaimedFees1 = Number(tokensOwed1) / Math.pow(10, position.token1.decimals);
        const unclaimedFees = (unclaimedFees0 * token0Price) + (unclaimedFees1 * token1Price);
        
        // Calculate TVL based on liquidity and token prices
        let tvl = 0;
        if (position.liquidity > 0 && position.slot0) {
          // Simplified TVL calculation using liquidity and token prices
          // This is a basic approximation - real Uniswap V3 math is more complex
          const liquidityValue = Number(position.liquidity) / 1e18;
          const avgPrice = (token0Price + token1Price) / 2;
          tvl = liquidityValue * avgPrice * 100; // Scaling factor
        }
        
        // Update position with calculated values
        position.tvl = Math.max(tvl, 0);
        position.unclaimedFees = Math.max(unclaimedFees, 0);
      } catch (error) {
        console.warn(`Failed to calculate TVL/fees for position ${position.tokenId}:`, error);
        // Keep default values
      }
    }

    return positions;
  } catch (error) {
    console.error('Error fetching wallet positions:', error);
    throw error;
  }
}
