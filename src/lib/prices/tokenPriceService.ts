/**
 * Token Price Service
 * 
 * Fetches real-time USD prices for Flare Network tokens
 * Uses CoinGecko API with caching to avoid rate limits
 * 
 * @module lib/prices/tokenPriceService
 */

import NodeCache from 'node-cache';
import aliases from '@/config/token-price.aliases';
import addressMap from '@/config/token-price.addresses';

// Cache prices for 60 seconds (TTL for MVP)
const priceCache = new NodeCache({ stdTTL: 60 });

/**
 * Normalise symbol: uppercase A-Z0-9 only
 * Handles special characters: ₮→T, ₀→0, .→(removed)
 */
export function normalise(symbol: string): string {
  const normalized = symbol
    .toUpperCase()
    .replace(/₮/g, 'T')
    .replace(/₀/g, '0')
    .replace(/\./g, '')
    .replace(/[^A-Z0-9]/g, '');
  
  // Apply alias map
  return (aliases as Record<string, string>)[normalized] || normalized;
}

/**
 * Resolve CoinGecko ID from symbol or address
 */
function resolveCoinGeckoId(symbol: string, address?: string, chain = 'flare'): string | null {
  // Try address-based lookup first if provided
  if (address) {
    const normalizedAddr = address.toLowerCase();
    const addrId = (addressMap as Record<string, Record<string, string>>)[chain]?.[normalizedAddr];
    if (addrId) {
      return addrId;
    }
  }
  
  // Normalise symbol and check alias map
  const normalised = normalise(symbol);
  
  // If normalised symbol is in aliases, use that CoinGecko ID
  if ((aliases as Record<string, string>)[normalised]) {
    return (aliases as Record<string, string>)[normalised];
  }
  
  // Fallback: use normalised symbol as CoinGecko ID (may not exist)
  return normalised;
}

/**
 * Fetch USD price for a single token from CoinGecko
 * 
 * @param symbol - Token symbol (e.g., "WFLR", "USDT0", "FXRP")
 * @param address - Optional contract address for address-based lookup
 * @returns USD price or null if not found
 */
export async function getTokenPriceUsd(
  symbol: string,
  address?: string
): Promise<number | null> {
  const normalised = normalise(symbol);
  
  // Check cache first (keyed by normalised symbol)
  const cached = priceCache.get<number>(normalised);
  if (cached !== undefined) {
    return cached;
  }
  
  // Resolve CoinGecko ID
  const coingeckoId = resolveCoinGeckoId(symbol, address);
  if (!coingeckoId) {
    console.warn(`[PRICE] No CoinGecko ID mapping for ${normalised}`);
    return null;
  }
  
  try {
    // Call CoinGecko API
    const apiKey = process.env.COINGECKO_API_KEY;
    const baseUrl = apiKey 
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
    
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
    
    // Cache the result (keyed by normalised symbol, TTL 60s)
    priceCache.set(normalised, price);
    console.log(`[PRICE] Fetched ${normalised}: $${price} (CoinGecko ID: ${coingeckoId})`);
    
    return price;
  } catch (error) {
    console.error(`[PRICE] Error fetching price for ${normalised}:`, error);
    return null;
  }
}

/**
 * Fetch USD prices for multiple tokens in a single batch call
 * More efficient than calling getTokenPriceUsd() multiple times
 * 
 * @param symbols - Array of token symbols (e.g., ["WFLR", "USDT0", "FXRP"])
 * @returns Record of normalised symbol → USD price
 */
export async function getTokenPricesBatch(symbols: string[]): Promise<Record<string, number>> {
  const normalisedSymbols = symbols.map(normalise);
  const uncachedSymbols: string[] = [];
  const result: Record<string, number> = {};
  
  // Check cache first
  for (const normalised of normalisedSymbols) {
    const cached = priceCache.get<number>(normalised);
    if (cached !== undefined) {
      result[normalised] = cached;
    } else {
      uncachedSymbols.push(normalised);
    }
  }
  
  if (uncachedSymbols.length === 0) {
    console.log(`[PRICE] Batch cache hit for all ${symbols.length} tokens`);
    return result;
  }
  
  // Resolve CoinGecko IDs for uncached symbols
  const idMap = new Map<string, string>();
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const normalised = normalisedSymbols[i];
    const coingeckoId = resolveCoinGeckoId(symbol);
    
    if (coingeckoId) {
      idMap.set(normalised, coingeckoId);
    }
  }
  
  if (idMap.size === 0) {
    console.warn(`[PRICE] No CoinGecko IDs found for uncached symbols: ${uncachedSymbols.join(', ')}`);
    return result;
  }
  
  try {
    // Call CoinGecko API (batch)
    const apiKey = process.env.COINGECKO_API_KEY;
    const baseUrl = apiKey 
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
    
    const coingeckoIds = Array.from(new Set(idMap.values()));
    const idsParam = coingeckoIds.join(',');
    const url = `${baseUrl}/simple/price?ids=${idsParam}&vs_currencies=usd`;
    const headers = apiKey ? { 'x-cg-pro-api-key': apiKey } : {};
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Map CoinGecko IDs back to symbols
    for (const [normalised, coingeckoId] of idMap.entries()) {
      const price = data[coingeckoId]?.usd;
      
      if (typeof price === 'number') {
        result[normalised] = price;
        priceCache.set(normalised, price);
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
 * 1. CoinGecko API (via address or symbol)
 * 2. Stablecoin assumption ($1.00 for USDT/USDC/DAI variants)
 * 3. Pool price ratio (with warning - NOT ACCURATE)
 * 
 * @param symbol - Token symbol (e.g., "WFLR", "USDC.e", "FXRP")
 * @param poolPriceRatio - Pool price ratio (token1/token0) for fallback
 * @param address - Optional contract address
 * @returns Price and source information
 */
export async function getTokenPriceWithFallback(
  symbol: string,
  poolPriceRatio: number,
  address?: string
): Promise<{ price: number; source: 'coingecko' | 'stablecoin' | 'pool_ratio' | 'unknown' }> {
  // Try CoinGecko first
  const coingeckoPrice = await getTokenPriceUsd(symbol, address);
  if (coingeckoPrice !== null) {
    return { price: coingeckoPrice, source: 'coingecko' };
  }
  
  // Fallback: Stablecoin assumption
  const normalised = normalise(symbol);
  const stablecoins = [
    'USDT', 'USDT0', 'USD0', 'EUSDT',
    'USDC', 'USDCE',
    'DAI', 'USDS', 'USDD', 'USDX', 'CUSDX'
  ];
  
  if (stablecoins.includes(normalised)) {
    console.log(`[PRICE] Using stablecoin assumption for ${normalised}: $1.00`);
    return { price: 1.00, source: 'stablecoin' };
  }
  
  // Fallback: Use pool ratio (NOT ACCURATE)
  console.warn(
    `[PRICE] ⚠️ WARNING: Using pool price ratio for ${normalised}: ${poolPriceRatio}. ` +
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
