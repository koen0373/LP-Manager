import { createPublicClient, fallback, http, decodeFunctionResult, getAddress } from 'viem';
import { flare } from '../lib/chainFlare';
import { getTokenPrice } from '../services/tokenPrices';

export function normalizeAddress(address: string): `0x${string}` {
  if (!address) {
    throw new Error('Address is required');
  }

  let normalized = address.trim();
  if (!normalized.startsWith('0x')) {
    normalized = `0x${normalized}`;
  }

  normalized = normalized.toLowerCase();

  if (normalized.length > 42) {
    normalized = `0x${normalized.slice(normalized.length - 40)}`;
  }

  if (normalized.length !== 42) {
    throw new Error(`Invalid address length: ${address}`);
  }

  return getAddress(normalized as `0x${string}`);
}

// Shared pool data cache
const poolCache = new Map<string, {
  poolAddress: `0x${string}`;
  sqrtPriceX96: bigint;
  tick: number;
  timestamp: number;
}>();
const POOL_CACHE_TTL = 0; // No cache for testing
const FACTORY_CACHE_TTL = 0; // No cache for testing
const FEE_GROWTH_CACHE_TTL = 0; // No cache for testing
const TICK_CACHE_TTL = 0; // No cache for testing

const factoryCache = new Map<string, {
  factory: `0x${string}`;
  timestamp: number;
}>();
const feeGrowthCache = new Map<string, {
  feeGrowthGlobal0X128: bigint;
  feeGrowthGlobal1X128: bigint;
  timestamp: number;
}>();
const tickCache = new Map<string, {
  feeGrowthOutside0X128: bigint;
  feeGrowthOutside1X128: bigint;
  timestamp: number;
}>();

// Clear all caches
export function clearCaches(): void {
  console.log(`[DEBUG] [CACHE CLEAR] Clearing all caches`);
  poolCache.clear();
  factoryCache.clear();
  feeGrowthCache.clear();
  tickCache.clear();
}

// Invalidate specific cache entries
export function invalidateCache(poolAddress?: `0x${string}`, factoryAddress?: `0x${string}`): void {
  if (poolAddress) {
    const poolKey = poolAddress.toLowerCase();
    const existed = poolCache.delete(poolKey);
    console.log(`[DEBUG] [CACHE INVALIDATE] Pool cache for ${poolAddress}: ${existed ? 'removed' : 'not found'}`);
    const feeExisted = feeGrowthCache.delete(poolKey);
    console.log(`[DEBUG] [CACHE INVALIDATE] Fee cache for ${poolAddress}: ${feeExisted ? 'removed' : 'not found'}`);
    let removedTicks = 0;
    for (const key of tickCache.keys()) {
      if (key.startsWith(`${poolKey}:`)) {
        tickCache.delete(key);
        removedTicks++;
      }
    }
    if (removedTicks > 0) {
      console.log(`[DEBUG] [CACHE INVALIDATE] Cleared ${removedTicks} tick cache entries for ${poolAddress}`);
    }
  }
  
  if (factoryAddress) {
    const factoryKey = factoryAddress.toLowerCase();
    const existed = factoryCache.delete(factoryKey);
    console.log(`[DEBUG] [CACHE INVALIDATE] Factory cache for ${factoryAddress}: ${existed ? 'removed' : 'not found'}`);
  }
}

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
  },
  {
    name: 'feeGrowthGlobal0X128',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'feeGrowthGlobal1X128',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'ticks',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tick', type: 'int24' }],
    outputs: [
      { name: 'liquidityGross', type: 'uint128' },
      { name: 'liquidityNet', type: 'int128' },
      { name: 'feeGrowthOutside0X128', type: 'uint256' },
      { name: 'feeGrowthOutside1X128', type: 'uint256' },
      { name: 'tickCumulativeOutside', type: 'int56' },
      { name: 'secondsPerLiquidityOutsideX128', type: 'uint160' },
      { name: 'secondsOutside', type: 'uint32' },
      { name: 'initialized', type: 'bool' }
    ]
  }
] as const;

const Q96 = BigInt(1) << BigInt(96);
const Q128 = BigInt(1) << BigInt(128);
const UINT256_MOD = BigInt(1) << BigInt(256);

function mulDiv(a: bigint, b: bigint, denominator: bigint): bigint {
  return (a * b) / denominator;
}

export function toSignedInt24(value: bigint | number): number {
  const big = typeof value === 'number' ? BigInt(value) : value;
  const mod = BigInt(1) << BigInt(24);
  let signed = big % mod;
  if (signed >= (BigInt(1) << BigInt(23))) {
    signed -= mod;
  }
  return Number(signed);
}

function getAmount0Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint
): bigint {
  let sqrtA = sqrtRatioAX96;
  let sqrtB = sqrtRatioBX96;
  if (sqrtA > sqrtB) {
    [sqrtA, sqrtB] = [sqrtB, sqrtA];
  }

  const numerator1 = liquidity << BigInt(96);
  const numerator2 = sqrtB - sqrtA;
  const denominator = sqrtB * sqrtA;
  return mulDiv(numerator1, numerator2, denominator);
}

function getAmount1Delta(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint
): bigint {
  let sqrtA = sqrtRatioAX96;
  let sqrtB = sqrtRatioBX96;
  if (sqrtA > sqrtB) {
    [sqrtA, sqrtB] = [sqrtB, sqrtA];
  }

  return mulDiv(liquidity, sqrtB - sqrtA, Q96);
}

export function bigIntToDecimal(amount: bigint, decimals: number): number {
  if (amount === 0n) return 0;
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const fraction = abs % divisor;
  const fractionStr = fraction
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  const decimalStr = fractionStr.length
    ? `${whole.toString()}.${fractionStr}`
    : whole.toString();
  const value = Number(decimalStr);
  return negative ? -value : value;
}

// Get factory address from PositionManager
export async function getFactoryAddress(positionManager: `0x${string}`): Promise<`0x${string}`> {
  const cacheKey = positionManager.toLowerCase();
  const cached = factoryCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < FACTORY_CACHE_TTL) {
    console.log(`[DEBUG] [CACHE HIT] Using cached factory address: ${cached.factory}`);
    return cached.factory;
  }
  
  try {
    console.log(`[DEBUG] [CACHE MISS] Fetching factory address from PositionManager: ${positionManager}`);
    const factory = await publicClient.readContract({
      address: positionManager,
      abi: POSITION_MANAGER_ABI,
      functionName: 'factory',
    });
    
    const factoryAddress = factory as `0x${string}`;
    console.log(`[DEBUG] Factory address returned: ${factoryAddress}`);
    
    if (!factoryAddress || factoryAddress === '0x0000000000000000000000000000000000000000') {
      console.error(`[ERROR] Invalid factory address: ${factoryAddress}`);
      // Remove any existing cache entry for this key
      factoryCache.delete(cacheKey);
      throw new Error(`Invalid factory address: ${factoryAddress}`);
    }
    
    // Only cache valid factory addresses
    factoryCache.set(cacheKey, { factory: factoryAddress, timestamp: Date.now() });
    return factoryAddress;
  } catch (error) {
    console.error('Failed to get factory address:', error);
    // Remove any existing cache entry for this key
    factoryCache.delete(cacheKey);
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
    console.log(`[DEBUG] [CACHE HIT] Using cached pool state for ${poolAddress}: tick=${cached.tick}`);
    return { sqrtPriceX96: cached.sqrtPriceX96, tick: cached.tick };
  }
  
  try {
    console.log(`[DEBUG] [CACHE MISS] Fetching slot0 for pool: ${poolAddress}`);
    const slot0 = await publicClient.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'slot0',
    });
    
    const [sqrtPriceX96, tickRaw] = slot0 as [bigint, number | bigint, number, number, number, number, boolean];
    const tick = toSignedInt24(tickRaw);
    console.log(`[DEBUG] Slot0 result: sqrtPriceX96=${sqrtPriceX96.toString()}, tick=${tick}`);
    
    // Only cache valid results
    if (sqrtPriceX96 && sqrtPriceX96 > 0n) {
      poolCache.set(cacheKey, {
        poolAddress,
        sqrtPriceX96,
        tick,
        timestamp: Date.now()
      });
    } else {
      console.error(`[ERROR] Invalid slot0 result: sqrtPriceX96=${sqrtPriceX96}, tick=${tick}`);
      // Remove any existing cache entry for this key
      poolCache.delete(cacheKey);
    }
    
    return { sqrtPriceX96, tick };
  } catch (error) {
    console.error(`[ERROR] Failed to get pool state for ${poolAddress}:`, error);
    console.log(`[DEBUG] This could mean:`);
    console.log(`[DEBUG] 1. Pool address is invalid (0x0000...)`);
    console.log(`[DEBUG] 2. Pool contract doesn't exist`);
    console.log(`[DEBUG] 3. Pool doesn't have slot0 function`);
    console.log(`[DEBUG] 4. RPC connection issue`);
    // Remove any existing cache entry for this key
    poolCache.delete(cacheKey);
    throw error;
  }
}

type FeeGrowthGlobals = {
  feeGrowthGlobal0X128: bigint;
  feeGrowthGlobal1X128: bigint;
};

type TickFeeGrowth = {
  feeGrowthOutside0X128: bigint;
  feeGrowthOutside1X128: bigint;
};

type TickContractResult = [
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  bigint,
  boolean
];

function toUint256(value: bigint): bigint {
  const mod = value % UINT256_MOD;
  return mod >= 0n ? mod : mod + UINT256_MOD;
}

function subtractUint256(a: bigint, b: bigint): bigint {
  if (a >= b) {
    return a - b;
  }
  return UINT256_MOD - (b - a);
}

async function getFeeGrowthGlobals(poolAddress: `0x${string}`): Promise<FeeGrowthGlobals> {
  const cacheKey = poolAddress.toLowerCase();
  const cached = feeGrowthCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FEE_GROWTH_CACHE_TTL) {
    console.log(`[DEBUG] [CACHE HIT] Using cached fee growth globals for ${poolAddress}`);
    return {
      feeGrowthGlobal0X128: cached.feeGrowthGlobal0X128,
      feeGrowthGlobal1X128: cached.feeGrowthGlobal1X128,
    };
  }

  console.log(`[DEBUG] [CACHE MISS] Fetching fee growth globals for pool: ${poolAddress}`);
  const [fee0, fee1] = await Promise.all([
    publicClient.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'feeGrowthGlobal0X128',
    }),
    publicClient.readContract({
      address: poolAddress,
      abi: POOL_ABI,
      functionName: 'feeGrowthGlobal1X128',
    }),
  ]);

  const result = {
    feeGrowthGlobal0X128: fee0 as bigint,
    feeGrowthGlobal1X128: fee1 as bigint,
  };

  feeGrowthCache.set(cacheKey, { ...result, timestamp: Date.now() });
  return result;
}

async function getTickData(poolAddress: `0x${string}`, tick: number): Promise<TickFeeGrowth> {
  const cacheKey = `${poolAddress.toLowerCase()}:${tick}`;
  const cached = tickCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TICK_CACHE_TTL) {
    console.log(`[DEBUG] [CACHE HIT] Using cached tick data for ${poolAddress} @ ${tick}`);
    return {
      feeGrowthOutside0X128: cached.feeGrowthOutside0X128,
      feeGrowthOutside1X128: cached.feeGrowthOutside1X128,
    };
  }

  console.log(`[DEBUG] [CACHE MISS] Fetching tick data for pool: ${poolAddress}, tick: ${tick}`);
  const tickData = await publicClient.readContract({
    address: poolAddress,
    abi: POOL_ABI,
    functionName: 'ticks',
    args: [BigInt(tick)],
  }) as TickContractResult;

  const [, , feeGrowthOutside0X128, feeGrowthOutside1X128] = tickData;
  const result = {
    feeGrowthOutside0X128: feeGrowthOutside0X128,
    feeGrowthOutside1X128: feeGrowthOutside1X128,
  };

  tickCache.set(cacheKey, { ...result, timestamp: Date.now() });
  return result;
}

async function getFeeGrowthInside(
  poolAddress: `0x${string}`,
  tickLower: number,
  tickUpper: number,
  currentTick: number
): Promise<{ feeGrowthInside0X128: bigint; feeGrowthInside1X128: bigint }> {
  const [globals, lowerTick, upperTick] = await Promise.all([
    getFeeGrowthGlobals(poolAddress),
    getTickData(poolAddress, tickLower),
    getTickData(poolAddress, tickUpper),
  ]);

  const feeGrowthBelow0 = currentTick >= tickLower
    ? lowerTick.feeGrowthOutside0X128
    : subtractUint256(globals.feeGrowthGlobal0X128, lowerTick.feeGrowthOutside0X128);
  const feeGrowthBelow1 = currentTick >= tickLower
    ? lowerTick.feeGrowthOutside1X128
    : subtractUint256(globals.feeGrowthGlobal1X128, lowerTick.feeGrowthOutside1X128);

  const feeGrowthAbove0 = currentTick < tickUpper
    ? upperTick.feeGrowthOutside0X128
    : subtractUint256(globals.feeGrowthGlobal0X128, upperTick.feeGrowthOutside0X128);
  const feeGrowthAbove1 = currentTick < tickUpper
    ? upperTick.feeGrowthOutside1X128
    : subtractUint256(globals.feeGrowthGlobal1X128, upperTick.feeGrowthOutside1X128);

  const feeGrowthInside0X128 = subtractUint256(
    subtractUint256(globals.feeGrowthGlobal0X128, feeGrowthBelow0),
    feeGrowthAbove0
  );
  const feeGrowthInside1X128 = subtractUint256(
    subtractUint256(globals.feeGrowthGlobal1X128, feeGrowthBelow1),
    feeGrowthAbove1
  );

  return {
    feeGrowthInside0X128: toUint256(feeGrowthInside0X128),
    feeGrowthInside1X128: toUint256(feeGrowthInside1X128),
  };
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
  
  const [nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1] =
    decoded as [
      bigint,
      `0x${string}`,
      `0x${string}`,
      `0x${string}`,
      number,
      bigint | number,
      bigint | number,
      bigint,
      bigint,
      bigint,
      bigint,
      bigint
    ];
  
  return {
    nonce,
    operator,
    token0: normalizeAddress(token0),
    token1: normalizeAddress(token1),
    fee,
    tickLower: toSignedInt24(tickLower),
    tickUpper: toSignedInt24(tickUpper),
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
  let ratio =
    absTick & 0x1
      ? BigInt('0xfffcb933bd6fad37aa2d162d1a594001')
      : BigInt('0x100000000000000000000000000000000');

  if (absTick & 0x2) ratio = (ratio * BigInt('0xfff97272373d413259a46990580e213a')) >> 128n;
  if (absTick & 0x4) ratio = (ratio * BigInt('0xfff2e50f5f656932ef12357cf3c7fdcc')) >> 128n;
  if (absTick & 0x8) ratio = (ratio * BigInt('0xffe5caca7e10e4e61c3624eaa0941cd0')) >> 128n;
  if (absTick & 0x10) ratio = (ratio * BigInt('0xffcb9843d60f6159c9db58835c926644')) >> 128n;
  if (absTick & 0x20) ratio = (ratio * BigInt('0xff973b41fa98c081472e6896dfb254c0')) >> 128n;
  if (absTick & 0x40) ratio = (ratio * BigInt('0xff2ea16466c96a3843ec78b326b52861')) >> 128n;
  if (absTick & 0x80) ratio = (ratio * BigInt('0xfe5dee046a99a2a811c461f1969c3053')) >> 128n;
  if (absTick & 0x100) ratio = (ratio * BigInt('0xfcbe86c7900a88aedcffc83b479aa3a4')) >> 128n;
  if (absTick & 0x200) ratio = (ratio * BigInt('0xf987a7253ac413176f2b074cf7815e54')) >> 128n;
  if (absTick & 0x400) ratio = (ratio * BigInt('0xf3392b0822b70005940c7a398e4b70f3')) >> 128n;
  if (absTick & 0x800) ratio = (ratio * BigInt('0xe7159475a2c29b7443b29c7fa6e889d9')) >> 128n;
  if (absTick & 0x1000) ratio = (ratio * BigInt('0xd097f3bdfd2022b8845ad8f792aa5825')) >> 128n;
  if (absTick & 0x2000) ratio = (ratio * BigInt('0xa9f746462d870fdf8a65dc1f90e061e5')) >> 128n;
  if (absTick & 0x4000) ratio = (ratio * BigInt('0x70d869a156d2a1b890bb3df62baf32f7')) >> 128n;
  if (absTick & 0x8000) ratio = (ratio * BigInt('0x31be135f97d08fd981231505542fcfa6')) >> 128n;
  if (absTick & 0x10000) ratio = (ratio * BigInt('0x9aa508b5b7a84e1c677de54f3e99bc9')) >> 128n;
  if (absTick & 0x20000) ratio = (ratio * BigInt('0x5d6af8dedb81196699c329225ee604')) >> 128n;
  if (absTick & 0x40000) ratio = (ratio * BigInt('0x2216e584f5fa1ea926041bedfe98')) >> 128n;
  if (absTick & 0x80000) ratio = (ratio * BigInt('0x48a170391f7dc42444e8fa2')) >> 128n;

  if (tick > 0) {
    const MAX_UINT256 = (1n << 256n) - 1n;
    ratio = MAX_UINT256 / ratio;
  }

  const Q32 = 1n << 32n;
  let sqrtRatioX96 = ratio >> 32n;
  if (ratio % Q32 !== 0n) {
    sqrtRatioX96 += 1n;
  }

  return sqrtRatioX96;
}

// Convert sqrt ratio to price (Uniswap V3 math)
export function sqrtRatioToPrice(
  sqrtRatioX96: bigint,
  token0Decimals: number,
  token1Decimals: number
): number {
  const ratio = Number(sqrtRatioX96) / Number(Q96);
  const price = ratio * ratio;
  const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
  return price * decimalAdjustment;
}

export function tickToPrice(
  tick: number,
  token0Decimals: number,
  token1Decimals: number
): number {
  const priceWithoutDecimals = Math.exp(tick * Math.log(1.0001));
  const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
  return priceWithoutDecimals * decimalAdjustment;
}

// Get price range using simple mapping (much more reliable!)
// Calculate amounts for position (Uniswap V3 math)
export function calcAmountsForPosition(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  token0Decimals?: number,
  token1Decimals?: number
): { amount0Wei: bigint; amount1Wei: bigint } {
  console.log(`[AMOUNTS] Calculating amounts for liquidity: ${liquidity.toString()}, sqrtPriceX96: ${sqrtPriceX96.toString()}`);
  console.log(`[AMOUNTS] Tick range: ${tickLower} to ${tickUpper}`);
  
  if (liquidity === 0n) {
    console.log(`[AMOUNTS] Liquidity is 0, returning 0 amounts`);
    return { amount0Wei: 0n, amount1Wei: 0n };
  }

  const sqrtPriceLower = tickToSqrtRatio(tickLower);
  const sqrtPriceUpper = tickToSqrtRatio(tickUpper);
  console.log(`[AMOUNTS] Sqrt prices - Lower: ${sqrtPriceLower.toString()}, Upper: ${sqrtPriceUpper.toString()}`);

  let amount0Wei = 0n;
  let amount1Wei = 0n;

  if (sqrtPriceX96 <= sqrtPriceLower) {
    console.log(`[AMOUNTS] Price below range - calculating amount0 only`);
    amount0Wei = getAmount0Delta(sqrtPriceLower, sqrtPriceUpper, liquidity);
    amount1Wei = 0n;
  } else if (sqrtPriceX96 >= sqrtPriceUpper) {
    console.log(`[AMOUNTS] Price above range - calculating amount1 only`);
    amount0Wei = 0n;
    amount1Wei = getAmount1Delta(sqrtPriceLower, sqrtPriceUpper, liquidity);
  } else {
    console.log(`[AMOUNTS] Price in range - calculating both amounts`);
    amount0Wei = getAmount0Delta(sqrtPriceX96, sqrtPriceUpper, liquidity);
    amount1Wei = getAmount1Delta(sqrtPriceLower, sqrtPriceX96, liquidity);
  }

  console.log(`[AMOUNTS] Raw amounts - amount0Wei: ${amount0Wei.toString()}, amount1Wei: ${amount1Wei.toString()}`);
  
  // Convert to decimal for logging
  if (typeof token0Decimals === 'number') {
    const amount0 = bigIntToDecimal(amount0Wei, token0Decimals);
    console.log(`[AMOUNTS] amount0 (${token0Decimals} decimals): ${amount0}`);
  }
  if (typeof token1Decimals === 'number') {
    const amount1 = bigIntToDecimal(amount1Wei, token1Decimals);
    console.log(`[AMOUNTS] amount1 (${token1Decimals} decimals): ${amount1}`);
  }

  return { amount0Wei, amount1Wei };
}

// Check if current price is within range
export function isInRange(
  currentTick: number,
  tickLower: number,
  tickUpper: number
): boolean {
  return currentTick >= tickLower && currentTick <= tickUpper;
}

export async function calculateAccruedFees(params: {
  poolAddress: `0x${string}`;
  liquidity: bigint;
  tickLower: number;
  tickUpper: number;
  currentTick: number;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}): Promise<{
  feeGrowthInside0X128: bigint;
  feeGrowthInside1X128: bigint;
  fee0Wei: bigint;
  fee1Wei: bigint;
}> {
  const {
    poolAddress,
    liquidity,
    tickLower,
    tickUpper,
    currentTick,
    feeGrowthInside0LastX128,
    feeGrowthInside1LastX128,
    tokensOwed0,
    tokensOwed1,
  } = params;

  const { feeGrowthInside0X128, feeGrowthInside1X128 } = await getFeeGrowthInside(
    poolAddress,
    tickLower,
    tickUpper,
    currentTick
  );

  const feeGrowthDelta0 = subtractUint256(feeGrowthInside0X128, toUint256(feeGrowthInside0LastX128));
  const feeGrowthDelta1 = subtractUint256(feeGrowthInside1X128, toUint256(feeGrowthInside1LastX128));

  const earned0 = mulDiv(liquidity, feeGrowthDelta0, Q128);
  const earned1 = mulDiv(liquidity, feeGrowthDelta1, Q128);

  const fee0Wei = tokensOwed0 + earned0;
  const fee1Wei = tokensOwed1 + earned1;

  console.log('[FEES]', {
    poolAddress,
    liquidity: liquidity.toString(),
    feeGrowthInside0X128: feeGrowthInside0X128.toString(),
    feeGrowthInside1X128: feeGrowthInside1X128.toString(),
    feeGrowthDelta0: feeGrowthDelta0.toString(),
    feeGrowthDelta1: feeGrowthDelta1.toString(),
    earned0: earned0.toString(),
    earned1: earned1.toString(),
    fee0Wei: fee0Wei.toString(),
    fee1Wei: fee1Wei.toString(),
  });

  return {
    feeGrowthInside0X128,
    feeGrowthInside1X128,
    fee0Wei,
    fee1Wei,
  };
}

// Calculate TVL and rewards
export async function calculatePositionValue(params: {
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
  amount0Wei: bigint;
  amount1Wei: bigint;
  fee0Wei: bigint;
  fee1Wei: bigint;
}): Promise<{
  amount0: number;
  amount1: number;
  fee0: number;
  fee1: number;
  price0Usd: number;
  price1Usd: number;
  tvlUsd: number;
  rewardsUsd: number;
}> {
  const {
    token0Symbol,
    token1Symbol,
    token0Decimals,
    token1Decimals,
    amount0Wei,
    amount1Wei,
    fee0Wei,
    fee1Wei,
  } = params;

  console.log(`[VALUE] Calculating position value for ${token0Symbol}/${token1Symbol}`);

  const [price0Usd, price1Usd] = await Promise.all([
    getTokenPrice(token0Symbol),
    getTokenPrice(token1Symbol),
  ]);

  const amount0 = bigIntToDecimal(amount0Wei, token0Decimals);
  const amount1 = bigIntToDecimal(amount1Wei, token1Decimals);
  const fee0 = bigIntToDecimal(fee0Wei, token0Decimals);
  const fee1 = bigIntToDecimal(fee1Wei, token1Decimals);

  console.log(`[VALUE] Amounts: ${amount0} ${token0Symbol}, ${amount1} ${token1Symbol}`);
  console.log(`[VALUE] TokensOwed: ${fee0} ${token0Symbol}, ${fee1} ${token1Symbol}`);
  console.log(`[VALUE] Prices: ${token0Symbol}=$${price0Usd}, ${token1Symbol}=$${price1Usd}`);

  const tvlUsd = amount0 * price0Usd + amount1 * price1Usd;
  const rewardsUsd = fee0 * price0Usd + fee1 * price1Usd;

  console.log(`[VALUE] TVL: $${tvlUsd}, Rewards: $${rewardsUsd}`);

  return { amount0, amount1, fee0, fee1, price0Usd, price1Usd, tvlUsd, rewardsUsd };
}

// Format price for display
export function formatPrice(price: number, decimals: number = 5): string {
  if (price === 0) return '0.00000';
  // Always show 5 decimal places, no scientific notation
  return price.toFixed(decimals);
}


export function computePriceRange(
  tickLower: number,
  tickUpper: number,
  token0Decimals: number,
  token1Decimals: number
): { lowerPrice: number; upperPrice: number } {
  // Use the new tickToPrice function with proper Uniswap V3 math
  const lower = tickToPrice(tickLower, token0Decimals, token1Decimals);
  const upper = tickToPrice(tickUpper, token0Decimals, token1Decimals);
  
  // Ensure lower <= upper
  return lower <= upper
    ? { lowerPrice: lower, upperPrice: upper }
    : { lowerPrice: upper, upperPrice: lower };
}
