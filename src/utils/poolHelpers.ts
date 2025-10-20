import { createPublicClient, fallback, http, decodeFunctionResult } from 'viem';
import { flare } from '../lib/chainFlare';
import { getTokenPrice } from '../services/tokenPrices';

// Shared pool data cache
const poolCache = new Map<string, { 
  poolAddress: `0x${string}`;
  sqrtPriceX96: bigint; 
  tick: number; 
  timestamp: number 
}>();
const POOL_CACHE_TTL = 30000; // 30 seconds

const factoryCache = new Map<string, { 
  factory: `0x${string}`; 
  timestamp: number 
}>();
const FACTORY_CACHE_TTL = 300000; // 5 minutes

// Viem client for shared operations
const publicClient = createPublicClient({
  chain: flare,
  transport: fallback([
    http(flare.rpcUrls.default.http[0], { batch: true }),
    http('https://flare-api.flare.network/ext/bc/C/rpc', { batch: true }),
  ]),
  pollingInterval: 6_000,
});

// PositionManager ABI
const POSITION_MANAGER_ABI = [
  {
    name: 'factory',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }]
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
      { name: 'tokensOwed1', type: 'uint128' }
    ]
  }
] as const;

// Factory ABI
const FACTORY_ABI = [
  {
    name: 'getPool',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenA', type: 'address' },
      { name: 'tokenB', type: 'address' },
      { name: 'fee', type: 'uint24' }
    ],
    outputs: [{ name: '', type: 'address' }]
  }
] as const;

// Pool ABI
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
      { name: 'unlocked', type: 'bool' }
    ]
  }
] as const;

// Get factory address from PositionManager
export async function getFactoryAddress(positionManager: `0x${string}`): Promise<`0x${string}`> {
  const cacheKey = positionManager.toLowerCase();
  const cached = factoryCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < FACTORY_CACHE_TTL) {
    console.log(`[DEBUG] Using cached factory address: ${cached.factory}`);
    return cached.factory;
  }
  
  try {
    console.log(`[DEBUG] Fetching factory address from PositionManager: ${positionManager}`);
    const factory = await publicClient.readContract({
      address: positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: 'factory',
    });
    
    const factoryAddress = factory as `0x${string}`;
    console.log(`[DEBUG] Factory address returned: ${factoryAddress}`);
    
    if (!factoryAddress || factoryAddress === '0x0000000000000000000000000000000000000000') {
      console.error(`[ERROR] Invalid factory address: ${factoryAddress}`);
      throw new Error(`Invalid factory address: ${factoryAddress}`);
    }
    
    factoryCache.set(cacheKey, { factory: factoryAddress, timestamp: Date.now() });
    return factoryAddress;
  } catch (error) {
    console.error('Failed to get factory address:', error);
    throw error;
  }
}

// Get pool address from factory
export async function getPoolAddress(
  factory: `0x${string}`,
  token0: `0x${string}`,
  token1: `0x${string}`,
  fee: number
): Promise<`0x${string}`> {
  try {
    console.log(`[DEBUG] Getting pool address from factory: ${factory}`);
    console.log(`[DEBUG] Token0: ${token0}, Token1: ${token1}, Fee: ${fee}`);
    
    const poolAddress = await publicClient.readContract({
      address: factory,
      abi: FACTORY_ABI,
      functionName: 'getPool',
      args: [token0, token1, fee],
    });
    
    const poolAddr = poolAddress as `0x${string}`;
    console.log(`[DEBUG] Pool address returned: ${poolAddr}`);
    
    if (!poolAddr || poolAddr === '0x0000000000000000000000000000000000000000') {
      console.error(`[ERROR] Invalid pool address: ${poolAddr}`);
      console.log(`[DEBUG] This means the pool doesn't exist for this token pair and fee`);
      throw new Error(`Pool does not exist: ${poolAddr}`);
    }
    
    return poolAddr;
  } catch (error) {
    console.error('Failed to get pool address from factory:', error);
    throw error;
  }
}

// Get pool state (slot0)
export async function getPoolState(poolAddress: `0x${string}`): Promise<{ sqrtPriceX96: bigint; tick: number }> {
  const cacheKey = poolAddress.toLowerCase();
  const cached = poolCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < POOL_CACHE_TTL) {
    console.log(`[DEBUG] Using cached pool state for ${poolAddress}: tick=${cached.tick}`);
    return { sqrtPriceX96: cached.sqrtPriceX96, tick: cached.tick };
  }
  
  try {
    console.log(`[DEBUG] Fetching slot0 for pool: ${poolAddress}`);
    const slot0 = await publicClient.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'slot0',
    });
    
    const [sqrtPriceX96, tick] = slot0 as [bigint, number, number, number, number, number, boolean];
    console.log(`[DEBUG] Slot0 result: sqrtPriceX96=${sqrtPriceX96.toString()}, tick=${tick}`);
    
    // Cache the result
    poolCache.set(cacheKey, {
      poolAddress,
      sqrtPriceX96,
      tick,
      timestamp: Date.now()
    });
    
    return { sqrtPriceX96, tick };
  } catch (error) {
    console.error(`[ERROR] Failed to get pool state for ${poolAddress}:`, error);
    console.log(`[DEBUG] This could mean:`);
    console.log(`[DEBUG] 1. Pool address is invalid (0x0000...)`);
    console.log(`[DEBUG] 2. Pool contract doesn't exist`);
    console.log(`[DEBUG] 3. Pool doesn't have slot0 function`);
    console.log(`[DEBUG] 4. RPC connection issue`);
    throw error;
  }
}

// Decode position data using proper ABI
export function decodePositionData(positionData: string): {
  nonce: bigint;
  operator: `0x${string}`;
  token0: `0x${string}`;
  token1: `0x${string}`;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
} {
  const decoded = decodeFunctionResult({
    abi: POSITION_MANAGER_ABI,
    functionName: 'positions',
    data: positionData as `0x${string}`,
  });
  
  const [nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1] = decoded as [bigint, `0x${string}`, `0x${string}`, `0x${string}`, number, number, number, bigint, bigint, bigint, bigint, bigint];
  
  return {
    nonce,
    operator,
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    liquidity,
    feeGrowthInside0LastX128,
    feeGrowthInside1LastX128,
    tokensOwed0,
    tokensOwed1,
  };
}

// Convert tick to sqrt ratio (Uniswap V3 math)
export function tickToSqrtRatio(tick: number): bigint {
  const absTick = Math.abs(tick);
  let ratio = absTick & 0x1 ? BigInt('0xfffcb933bd6fad37aa2d162d1a594001') : BigInt('0x100000000000000000000000000000000');
  
  if (absTick & 0x2) ratio = (ratio * BigInt('0xfff97272373d413259a46990580e213a')) >> BigInt(128);
  if (absTick & 0x4) ratio = (ratio * BigInt('0xfff2e50f5f656932ef12357cf3c7fdcc')) >> BigInt(128);
  if (absTick & 0x8) ratio = (ratio * BigInt('0xffe5caca7e10e4e61c3624eaa0941cd0')) >> BigInt(128);
  if (absTick & 0x10) ratio = (ratio * BigInt('0xffcb9843d60f6159c9db58835c926644')) >> BigInt(128);
  if (absTick & 0x20) ratio = (ratio * BigInt('0xff973b41fa98c081472e6896dfb254c0')) >> BigInt(128);
  if (absTick & 0x40) ratio = (ratio * BigInt('0xff2ea16466c96a3843ec78b326b52861')) >> BigInt(128);
  if (absTick & 0x80) ratio = (ratio * BigInt('0xfe5dee046a99a2a811c461f1969c3053')) >> BigInt(128);
  if (absTick & 0x100) ratio = (ratio * BigInt('0xfcbe86c7900a88aedcffc83b479aa3a4')) >> BigInt(128);
  if (absTick & 0x200) ratio = (ratio * BigInt('0xf987a7253ac413176f2b074cf7815e54')) >> BigInt(128);
  if (absTick & 0x400) ratio = (ratio * BigInt('0xf3392b0822b70005940c7a398e4b70f3')) >> BigInt(128);
  if (absTick & 0x800) ratio = (ratio * BigInt('0xe7159475a2c29b7443b29c7fa6e889d9')) >> BigInt(128);
  if (absTick & 0x1000) ratio = (ratio * BigInt('0xd097f3bdfd2022b8845ad8f792aa5825')) >> BigInt(128);
  if (absTick & 0x2000) ratio = (ratio * BigInt('0xa9f746462d870fdf8a65dc1f90e061e5')) >> BigInt(128);
  if (absTick & 0x4000) ratio = (ratio * BigInt('0x70d869a156d2a1b890bb3df62baf32f7')) >> BigInt(128);
  if (absTick & 0x8000) ratio = (ratio * BigInt('0x31be135f97d08fd981231505542fcfa6')) >> BigInt(128);
  if (absTick & 0x10000) ratio = (ratio * BigInt('0x9aa508b5b7a84e1c677de54f3e99bc9')) >> BigInt(128);
  if (absTick & 0x20000) ratio = (ratio * BigInt('0x5d6af8dedb81196699c329225ee604')) >> BigInt(128);
  if (absTick & 0x40000) ratio = (ratio * BigInt('0x2216e584f5fa1ea926041bedfe98')) >> BigInt(128);
  if (absTick & 0x80000) ratio = (ratio * BigInt('0x48a170391f7dc42444e8fa2')) >> BigInt(128);
  
  if (tick > 0) ratio = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') / ratio;
  
  // Add 1/2 to round up
  if (ratio % BigInt(2) === BigInt(1)) ratio = ratio + BigInt(1);
  
  return ratio >> BigInt(1);
}

// Convert sqrt ratio to price (Uniswap V3 math)
export function sqrtRatioToPrice(sqrtRatioX96: bigint, token0Decimals: number, token1Decimals: number): number {
  const Q96 = BigInt(2) ** BigInt(96);
  const ratio = Number(sqrtRatioX96) / Number(Q96);
  const price = ratio * ratio;
  const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
  return price * decimalAdjustment;
}

// Convert tick to price
export function tickToPrice(tick: number, token0Decimals: number, token1Decimals: number): number {
  const sqrtRatio = tickToSqrtRatio(tick);
  return sqrtRatioToPrice(sqrtRatio, token0Decimals, token1Decimals);
}

// Calculate amounts for position (Uniswap V3 math)
export function calcAmountsForPosition(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  token0Decimals: number,
  token1Decimals: number
): { amount0: number; amount1: number } {
  if (liquidity === 0n) {
    return { amount0: 0, amount1: 0 };
  }

  const sqrtPriceLower = tickToSqrtRatio(tickLower);
  const sqrtPriceUpper = tickToSqrtRatio(tickUpper);
  
  let amount0 = 0n;
  let amount1 = 0n;
  
  if (sqrtPriceX96 < sqrtPriceLower) {
    // Position is entirely in token0
    amount0 = (liquidity * (sqrtPriceUpper - sqrtPriceLower)) / (sqrtPriceUpper * sqrtPriceLower >> BigInt(96));
  } else if (sqrtPriceX96 >= sqrtPriceUpper) {
    // Position is entirely in token1
    amount1 = (liquidity * (sqrtPriceUpper - sqrtPriceLower)) >> BigInt(96);
  } else {
    // Position spans current price
    amount0 = (liquidity * (sqrtPriceUpper - sqrtPriceX96)) / (sqrtPriceUpper * sqrtPriceX96 >> BigInt(96));
    amount1 = (liquidity * (sqrtPriceX96 - sqrtPriceLower)) >> BigInt(96);
  }
  
  // Convert to decimal amounts
  const amount0Decimal = Number(amount0) / Math.pow(10, token0Decimals);
  const amount1Decimal = Number(amount1) / Math.pow(10, token1Decimals);
  
  return {
    amount0: amount0Decimal,
    amount1: amount1Decimal
  };
}

// Check if current price is within range
export function isInRange(
  currentTick: number,
  tickLower: number,
  tickUpper: number
): boolean {
  return currentTick >= tickLower && currentTick <= tickUpper;
}

// Calculate TVL and rewards
export async function calculatePositionValue(
  amount0: number,
  amount1: number,
  tokensOwed0: bigint,
  tokensOwed1: bigint,
  token0Symbol: string,
  token1Symbol: string,
  token0Decimals: number,
  token1Decimals: number
): Promise<{ tvlUsd: number; rewardsUsd: number }> {
  // Get token prices
  const [token0Price, token1Price] = await Promise.all([
    getTokenPrice(token0Symbol),
    getTokenPrice(token1Symbol),
  ]);
  
  // Calculate TVL
  const tvlUsd = (amount0 * token0Price) + (amount1 * token1Price);
  
  // Calculate rewards (unclaimed fees)
  const rewards0 = Number(tokensOwed0) / Math.pow(10, token0Decimals);
  const rewards1 = Number(tokensOwed1) / Math.pow(10, token1Decimals);
  const rewardsUsd = (rewards0 * token0Price) + (rewards1 * token1Price);
  
  return { tvlUsd, rewardsUsd };
}

// Format price for display
export function formatPrice(price: number, decimals: number = 5): string {
  if (price === 0) return '0.00000';
  if (price < 0.00001) return price.toExponential(2);
  return price.toFixed(decimals);
}
