import { getUsdPriceNow, clearPriceCache as clearRegistryCache } from './tokenRegistry';
import { memoize } from '../lib/util/memo';
import { withTimeout } from '../lib/util/withTimeout';

// Legacy function for backward compatibility - now uses token registry
export async function getTokenPrice(symbol: string): Promise<number> {
  return memoize(`token-price-${symbol}`, async () => {
    // Map legacy symbols to addresses for the registry
    const symbolToAddress: Record<string, string> = {
      'RFLR': '0x0000000000000000000000000000000000000000', // Placeholder for RFLR rewards
      'WFLR': '0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d',
      'USD0': '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
      'USDTO': '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
      'USDT0': '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
      'EUSDT': '0x96B41289D90444B8adD57e6F265DB5aE8651DF29',
      'FXRP': '0xAd552A648C74D49E10027AB8a618A3ad4901c5bE',
      'APS': '0xfF56Eb5b1a7FAa972291117E5E9565dA29bc808d',
    };
    
    const normalizedSymbol = symbol
      .normalize("NFKD")
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();
    
    console.log(`[PRICE] Getting price for symbol: "${symbol}" -> normalized: "${normalizedSymbol}"`);
    
    const address = symbolToAddress[normalizedSymbol];
    if (!address) {
      console.warn(`[PRICE] No address mapping found for symbol: ${symbol}`);
      return 0;
    }
    
    try {
      const price = await withTimeout(
        getUsdPriceNow(address as `0x${string}`),
        10000,
        `Price fetch for ${symbol} timed out`
      );
      console.log(`[PRICE] Price for ${symbol}: $${price}`);
      return price;
    } catch (error) {
      console.warn(`[PRICE] Failed to get price for ${symbol}:`, error);
      return 0;
    }
  }, 60 * 1000); // 1 minute cache for token prices
}

// New function for getting prices by address (recommended)
export async function getTokenPriceByAddress(address: `0x${string}`): Promise<number> {
  try {
    return await getUsdPriceNow(address);
  } catch (error) {
    console.warn(`[PRICE] Failed to get price for address ${address}:`, error);
    return 0;
  }
}

// Rewards-specific function with shorter cache TTL
export async function getTokenPriceForRewards(symbol: string): Promise<number> {
  return memoize(`rewards-price-${symbol}`, async () => {
    // Use the same logic as getTokenPrice but with more aggressive caching
    return getTokenPrice(symbol);
  }, 30 * 1000); // 30 second cache for rewards prices
}

// Batch price fetching
export async function getTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  return memoize(`batch-prices-${symbols.sort().join(',')}`, async () => {
    const prices: Record<string, number> = {};
    
    // Fetch all prices in parallel
    const pricePromises = symbols.map(async (symbol) => {
      const price = await getTokenPrice(symbol);
      return { symbol: symbol.toUpperCase(), price };
    });
    
    const results = await Promise.all(pricePromises);
    
    for (const { symbol, price } of results) {
      prices[symbol] = price;
    }
    
    return prices;
  }, 60 * 1000); // 1 minute cache for batch prices
}

// Helper to calculate USD value
export function calculateUsdValue(amount: bigint, decimals: number, price: number): number {
  const divisor = BigInt(10 ** decimals);
  const amountFloat = Number(amount) / Number(divisor);
  return amountFloat * price;
}

// Clear cache function for testing
export function clearPriceCache(): void {
  clearRegistryCache();
}