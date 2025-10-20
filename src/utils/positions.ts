import { getAddress, keccak256 } from 'viem';

// Uniswap V3 Pool address calculation using CREATE2
export function getPoolAddress(
  factory: `0x${string}`,
  token0: `0x${string}`,
  token1: `0x${string}`,
  fee: number
): `0x${string}` {
  // Sort tokens for deterministic address
  const [tokenA, tokenB] = token0 < token1 ? [token0, token1] : [token1, token0];
  
  // Enosys V3 init code hash (this should be the actual hash from the deployed bytecode)
  const initCodeHash = '0xe34f199b19b2b4df1fadadee7d189f9a9b2d5280a30515ccec2e659a864a801f';
  
  // Create salt: fee (4 bytes) + tokenA (20 bytes) + tokenB (20 bytes)
  const feeHex = fee.toString(16).padStart(8, '0');
  const tokenAHex = tokenA.slice(2).toLowerCase();
  const tokenBHex = tokenB.slice(2).toLowerCase();
  const salt = `0x${feeHex}${tokenAHex}${tokenBHex}`;
  
  // CREATE2 formula: keccak256(0xff + factory + salt + initCodeHash)
  const factoryHex = factory.slice(2).toLowerCase();
  const saltHex = salt.slice(2);
  const initCodeHashHex = initCodeHash.slice(2);
  
  const create2Input = `0xff${factoryHex}${saltHex}${initCodeHashHex}`;
  const addressHash = keccak256(`0x${create2Input}`);
  
  // Take last 20 bytes (40 hex chars) as address
  const address = getAddress(`0x${addressHash.slice(-40)}`);
  
  return address;
}

// Convert tick to price
export function tickToPrice(tick: number, token0Decimals: number, token1Decimals: number): number {
  const price = Math.pow(1.0001, tick);
  const decimalAdjustment = Math.pow(10, token1Decimals - token0Decimals);
  return price * decimalAdjustment;
}

// Calculate amounts for a position given liquidity and current price
export function calcAmountsForPosition(
  liquidity: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  token0Decimals: number,
  token1Decimals: number
): { amount0: bigint; amount1: bigint } {
  if (liquidity === 0n) {
    return { amount0: 0n, amount1: 0n };
  }

  const sqrtPriceLower = Math.floor(Math.pow(1.0001, tickLower) * Math.pow(2, 96));
  const sqrtPriceUpper = Math.floor(Math.pow(1.0001, tickUpper) * Math.pow(2, 96));
  
  const sqrtPriceLowerBig = BigInt(sqrtPriceLower);
  const sqrtPriceUpperBig = BigInt(sqrtPriceUpper);
  
  let amount0 = 0n;
  let amount1 = 0n;
  
  if (sqrtPriceX96 < sqrtPriceLowerBig) {
    // Position is entirely in token0
    amount0 = liquidity * (sqrtPriceUpperBig - sqrtPriceLowerBig) / (sqrtPriceUpperBig * sqrtPriceLowerBig / BigInt(2 ** 96));
  } else if (sqrtPriceX96 >= sqrtPriceUpperBig) {
    // Position is entirely in token1
    amount1 = liquidity * (sqrtPriceUpperBig - sqrtPriceLowerBig) / BigInt(2 ** 96);
  } else {
    // Position spans current price
    amount0 = liquidity * (sqrtPriceUpperBig - sqrtPriceX96) / (sqrtPriceUpperBig * sqrtPriceX96 / BigInt(2 ** 96));
    amount1 = liquidity * (sqrtPriceX96 - sqrtPriceLowerBig) / BigInt(2 ** 96);
  }
  
  // Adjust for decimals
  const decimals0 = BigInt(10 ** token0Decimals);
  const decimals1 = BigInt(10 ** token1Decimals);
  
  return {
    amount0: amount0 / decimals0,
    amount1: amount1 / decimals1
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

// Format price for display
export function formatPrice(price: number, decimals: number = 5): string {
  if (price === 0) return '0.00000';
  if (price < 0.00001) return price.toExponential(2);
  return price.toFixed(decimals);
}

// Format amount for display
export function formatAmount(amount: bigint, decimals: number = 4): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  
  if (fraction === 0n) {
    return whole.toString();
  }
  
  const fractionStr = fraction.toString().padStart(decimals, '0');
  return `${whole}.${fractionStr}`;
}
