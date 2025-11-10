/**
 * Token Price Service
 * 
 * Fetches real-time USD prices for Flare Network tokens
 * Uses CoinGecko API with caching to avoid rate limits
 * 
 * @module services/tokenPriceService
 */

import NodeCache from 'node-cache';

// Cache prices for 5 minutes (300 seconds)
const priceCache = new NodeCache({ stdTTL: 300 });

/**
 * Map token symbols to CoinGecko IDs
 * Source: https://www.coingecko.com/en/coins/flare-network
 * 
 * IMPORTANT: These mappings are based on actual tokens in LiquiLab database
 * Total pools: 238 | Top 20 token pairs verified
 */
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  // Native tokens (46 pools with WFLR, 35 with sFLR)
  'FLR': 'flare-networks',
  'WFLR': 'flare-networks',
  'SFLR': 'sflr', // TODO: Verify on CoinGecko
  'CYFLR': 'cyflr', // TODO: Verify on CoinGecko
  'CYSFLR': 'cysflr', // TODO: Verify on CoinGecko
  
  // Stablecoins (32 pools with USDC.e, 28 with USDT)
  'USDT': 'tether',
  'EUSDT': 'tether', // Wrapped USDT
  'USD0': 'tether', // Alternative USDT symbol (from USD₮0)
  'USDC': 'usd-coin',
  'USDCE': 'usd-coin', // Bridged USDC (from USDC.e)
  'DAI': 'dai',
  'USDX': 'usdx', // TODO: Verify on CoinGecko
  'CUSDX': 'cusdx', // TODO: Verify on CoinGecko
  
  // DEX tokens (8 pools with SPRK, 12 with FXRP)
  'SPRK': 'sparkdex', // TODO: Verify on CoinGecko (SparkDEX native)
  'SPX': 'sparkdex', // Alternative symbol
  'FXRP': 'fxrp', // TODO: Verify on CoinGecko
  'EFXRP': 'fxrp', // Wrapped FXRP
  
  // Protocol tokens (15 pools with HLN)
  'HLN': 'hln', // TODO: Verify on CoinGecko
  'APS': 'aps', // TODO: Verify on CoinGecko (7 pools)
  'JOULE': 'joule', // TODO: Verify on CoinGecko (4 pools)
  
  // Wrapped ETH/BTC (18 pools with WETH)
  'WETH': 'weth',
  'EETH': 'weth', // Wrapped ETH variant
  'WBTC': 'wrapped-bitcoin',
  
  // Exotic/Wrapped tokens (5+ pools each)
  'EQNT': 'quant-network', // Wrapped QNT
  'QNT': 'quant-network',
  
  // === FALLBACK STRATEGY ===
  // If token not found above, service will:
  // 1. Try CoinGecko API anyway (in case symbol matches ID)
  // 2. Use stablecoin assumption ($1.00) for USDT/USDC variants
  // 3. Fallback to pool price ratio (with warning)
};

/**
 * Fetch USD price for a single token from CoinGecko
 * 
 * @param symbol - Token symbol (e.g., "WFLR", "USDT")
 * @returns USD price or null if not found
 */
export async function getTokenPriceUsd(symbol: string): Promise<number | null> {
  // Normalize symbol (uppercase, remove leading 0x if present)
  const normalizedSymbol = symbol.toUpperCase().replace(/^0X/, '');
  
  // Check cache first
  const cached = priceCache.get<number>(normalizedSymbol);
  if (cached !== undefined) {
    console.log(`[PRICE] Cache hit for ${normalizedSymbol}: $${cached}`);
    return cached;
  }
  
  // Get CoinGecko ID
  const coingeckoId = SYMBOL_TO_COINGECKO_ID[normalizedSymbol];
  if (!coingeckoId) {
    console.warn(`[PRICE] No CoinGecko ID mapping for ${normalizedSymbol}`);
    return null;
  }
  
  try {
    // Call CoinGecko API
    const apiKey = process.env.COINGECKO_API_KEY;
    const baseUrl = apiKey 
      ? 'https://pro-api.coingecko.com/api/v3'  // Pro tier (300 calls/min)
      : 'https://api.coingecko.com/api/v3';     // Free tier (50 calls/min)
    
    const url = `${baseUrl}/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
    const headers = apiKey ? { 'x-cg-pro-api-key': apiKey } : {};
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const price = data[coingeckoId]?.usd;
    
    if (typeof price !== 'number') {
      throw new Error(`Invalid price data for ${coingeckoId}`);
    }
    
    // Cache the result
    priceCache.set(normalizedSymbol, price);
    console.log(`[PRICE] Fetched ${normalizedSymbol}: $${price} (CoinGecko ID: ${coingeckoId})`);
    
    return price;
  } catch (error) {
    console.error(`[PRICE] Error fetching price for ${normalizedSymbol}:`, error);
    return null;
  }
}

/**
 * Fetch USD prices for multiple tokens in a single batch call
 * More efficient than calling getTokenPriceUsd() multiple times
 * 
 * @param symbols - Array of token symbols (e.g., ["WFLR", "USDT"])
 * @returns Record of symbol → USD price
 */
export async function getTokenPricesBatch(symbols: string[]): Promise<Record<string, number>> {
  const normalizedSymbols = symbols.map(s => s.toUpperCase().replace(/^0X/, ''));
  const uncachedSymbols: string[] = [];
  const result: Record<string, number> = {};
  
  // Check cache first
  for (const symbol of normalizedSymbols) {
    const cached = priceCache.get<number>(symbol);
    if (cached !== undefined) {
      result[symbol] = cached;
    } else {
      uncachedSymbols.push(symbol);
    }
  }
  
  if (uncachedSymbols.length === 0) {
    console.log(`[PRICE] Batch cache hit for all ${symbols.length} tokens`);
    return result;
  }
  
  // Get CoinGecko IDs for uncached symbols
  const coingeckoIds = uncachedSymbols
    .map(s => SYMBOL_TO_COINGECKO_ID[s])
    .filter(id => id !== undefined);
  
  if (coingeckoIds.length === 0) {
    console.warn(`[PRICE] No CoinGecko IDs found for uncached symbols: ${uncachedSymbols.join(', ')}`);
    return result;
  }
  
  try {
    // Call CoinGecko API (batch)
    const apiKey = process.env.COINGECKO_API_KEY;
    const baseUrl = apiKey 
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
    
    const idsParam = coingeckoIds.join(',');
    const url = `${baseUrl}/simple/price?ids=${idsParam}&vs_currencies=usd`;
    const headers = apiKey ? { 'x-cg-pro-api-key': apiKey } : {};
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Map CoinGecko IDs back to symbols
    for (const symbol of uncachedSymbols) {
      const coingeckoId = SYMBOL_TO_COINGECKO_ID[symbol];
      const price = data[coingeckoId]?.usd;
      
      if (typeof price === 'number') {
        result[symbol] = price;
        priceCache.set(symbol, price);
      }
    }
    
    console.log(`[PRICE] Batch fetched ${Object.keys(result).length}/${symbols.length} prices`);
    return result;
  } catch (error) {
    console.error(`[PRICE] Error fetching batch prices:`, error);
    return result;
  }
}

/**
 * Get token price with fallback strategies
 * 
 * Fallback order:
 * 1. CoinGecko API
 * 2. Stablecoin assumption ($1.00 for USDT/USDC/DAI variants)
 * 3. Pool price ratio (with warning - NOT ACCURATE)
 * 
 * @param symbol - Token symbol (e.g., "WFLR", "USDC.e")
 * @param poolPriceRatio - Pool price ratio (token1/token0) for fallback
 * @returns Price and source information
 */
export async function getTokenPriceWithFallback(
  symbol: string,
  poolPriceRatio: number
): Promise<{ price: number; source: 'coingecko' | 'stablecoin' | 'pool_ratio' | 'unknown' }> {
  // Try CoinGecko first
  const coingeckoPrice = await getTokenPriceUsd(symbol);
  if (coingeckoPrice !== null) {
    return { price: coingeckoPrice, source: 'coingecko' };
  }
  
  // Fallback: Stablecoin assumption
  // Remove special characters for matching (USDC.e → USDCE, USD₮0 → USD0)
  const normalizedSymbol = symbol.toUpperCase().replace(/[^\w]/g, '');
  const stablecoins = [
    'USDT', 'EUSDT', 'USD0', // USDT variants
    'USDC', 'USDCE', // USDC variants (USDC.e = bridged USDC)
    'DAI', 'USDS', 'USDD', 'USDX', 'CUSDX' // Other stablecoins
  ];
  
  if (stablecoins.includes(normalizedSymbol)) {
    console.log(`[PRICE] Using stablecoin assumption for ${symbol}: $1.00`);
    return { price: 1.00, source: 'stablecoin' };
  }
  
  // Fallback: Use pool ratio (NOT ACCURATE, but better than nothing)
  console.warn(
    `[PRICE] ⚠️ WARNING: Using pool price ratio for ${symbol}: ${poolPriceRatio}. ` +
    `This is NOT a real USD price and may be inaccurate!`
  );
  return { price: poolPriceRatio, source: 'pool_ratio' };
}

/**
 * Clear the price cache
 * Useful for testing or forcing a refresh
 */
export function clearPriceCache(): void {
  priceCache.flushAll();
  console.log('[PRICE] Cache cleared');
}

/**
 * Get cache statistics
 * Useful for monitoring cache performance
 */
export function getCacheStats(): { keys: number; hits: number; misses: number } {
  const stats = priceCache.getStats();
  return {
    keys: priceCache.keys().length,
    hits: stats.hits,
    misses: stats.misses
  };
}

