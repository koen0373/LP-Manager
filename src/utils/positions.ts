import { getAddress } from 'viem';

// Uniswap V3 Pool address calculation
export function getPoolAddress(
  factory: `0x${string}`,
  token0: `0x${string}`,
  token1: `0x${string}`,
  fee: number
): `0x${string}` {
  // Sort tokens for deterministic address
  const [tokenA, tokenB] = token0 < token1 ? [token0, token1] : [token1, token0];
  
  // Create init code hash (this is the standard Uniswap V3 init code hash)
  const initCodeHash = '0xe34f199b19b2b4df1fadadee7d189f9a9b2d5280a30515ccec2e659a864a801f';
  
  // Create salt
  const salt = `0x${fee.toString(16).padStart(8, '0')}${tokenA.slice(2)}${tokenB.slice(2)}`;
  
  // Calculate CREATE2 address (simplified for now)
  // In a real implementation, you'd use proper CREATE2 calculation
  const address = getAddress('0x0000000000000000000000000000000000000000');
  
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
