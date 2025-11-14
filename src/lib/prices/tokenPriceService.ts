/**
 * Token Price Service
 * 
 * Fetches real-time USD prices for Flare Network tokens
 * Uses CoinGecko API with caching to avoid rate limits
 * 
 * @module lib/prices/tokenPriceService
 */

import NodeCache from 'node-cache';
import { readFileSync } from 'fs';
import { join } from 'path';

// Cache prices for 60 seconds (TTL for MVP)
const priceCache = new NodeCache({ stdTTL: 60 });

// Load alias and address configs
let ALIASES: Record<string, string> = {};
let ADDRESS_MAP: Record<string, Record<string, string>> = {};
let SYMBOL_TO_ADDRESS: Record<string, string> = {};

try {
  const aliasPath = join(process.cwd(), 'config', 'token-price.aliases.json');
  ALIASES = JSON.parse(readFileSync(aliasPath, 'utf-8'));
} catch (error) {
  console.warn('[tokenPriceService] Failed to load aliases config:', error);
}

try {
  const addressPath = join(process.cwd(), 'config', 'token-price.addresses.json');
  const addressData = JSON.parse(readFileSync(addressPath, 'utf-8'));
  ADDRESS_MAP = addressData;
  
  // Build reverse map: symbol → address (for known Flare tokens)
  if (addressData.flare) {
    const flareAddresses = addressData.flare;
    // Known mappings: USDT0 and FXRP have addresses
    SYMBOL_TO_ADDRESS['USDT0'] = '0x96b41289d90444b8add57e6f265db5ae8651df29';
    SYMBOL_TO_ADDRESS['FXRP'] = '0xad552a648c74d49e10027ab8a618a3ad4901c5be';
  }
} catch (error) {
  console.warn('[tokenPriceService] Failed to load address config:', error);
}

/**
 * Normalize symbol: uppercase A-Z0-9 only
 * Handles special characters: ₮→T, ₀→0, .→(removed)
 */
export function canonicalSymbol(symbol: string): string {
  return symbol
    .toUpperCase()
    .replace(/₮/g, 'T')
    .replace(/₀/g, '0')
    .replace(/\./g, '')
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Resolve symbol to CoinGecko ID via alias map and hardcoded mappings
 */
function resolveSymbolToCoinGeckoId(symbol: string): string | null {
  const canonical = canonicalSymbol(symbol);
  
  // Check alias map first
  const aliased = ALIASES[canonical] || canonical;
  
  // Hardcoded base mappings (CoinGecko IDs)
  const BASE_MAPPINGS: Record<string, string> = {
    // Native tokens
    'FLR': 'flare-networks',
    'WFLR': 'flare-networks',
    'SFLR': 'sflr',
    
    // Stablecoins
    'USDT': 'tether',
    'USDC': 'usd-coin',
    'DAI': 'dai',
    'USDX': 'usdx',
    
    // DEX tokens
    'SPRK': 'sparkdex',
    'XRP': 'ripple', // FXRP aliases to XRP
    'FXRP': 'ripple', // FXRP is wrapped XRP on Flare
    
    // Protocol tokens
    'HLN': 'helion',
    'APS': 'aps-token',
    'JOULE': 'joule-token',
    
    // Wrapped major assets
    'ETH': 'ethereum',
    'WETH': 'weth',
    'BTC': 'bitcoin',
    'WBTC': 'wrapped-bitcoin',
    'QNT': 'quant-network',
  };
  
  return BASE_MAPPINGS[aliased] || null;
}

/**
 * Resolve token address to CoinGecko ID via address map
 */
function resolveAddressToCoinGeckoId(address: string, chain = 'flare'): string | null {
  const normalized = address.toLowerCase();
  return ADDRESS_MAP[chain]?.[normalized] || null;
}

/**
 * Get address for a symbol if known on Flare
 */
function getAddressForSymbol(symbol: string): string | null {
  const canonical = canonicalSymbol(symbol);
  return SYMBOL_TO_ADDRESS[canonical] || null;
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
  const canonical = canonicalSymbol(symbol);
  
  // Check cache first (keyed by canonical symbol)
  const cached = priceCache.get<number>(canonical);
  if (cached !== undefined) {
    return cached;
  }
  
  // Try address-based lookup first if provided, or if symbol resolves to known address
  let coingeckoId: string | null = null;
  const resolvedAddress = address || getAddressForSymbol(symbol);
  if (resolvedAddress) {
    coingeckoId = resolveAddressToCoinGeckoId(resolvedAddress);
    if (coingeckoId) {
      console.log(`[PRICE] Resolved ${canonical} via address ${resolvedAddress} → ${coingeckoId}`);
    }
  }
  
  // Fallback to symbol-based lookup
  if (!coingeckoId) {
    coingeckoId = resolveSymbolToCoinGeckoId(symbol);
  }
  
  if (!coingeckoId) {
    console.warn(`[PRICE] No CoinGecko ID mapping for ${canonical}`);
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
    
    // Cache the result (keyed by canonical symbol, TTL 60s)
    priceCache.set(canonical, price);
    console.log(`[PRICE] Fetched ${canonical}: $${price} (CoinGecko ID: ${coingeckoId})`);
    
    return price;
  } catch (error) {
    console.error(`[PRICE] Error fetching price for ${canonical}:`, error);
    return null;
  }
}

/**
 * Fetch USD prices for multiple tokens in a single batch call
 * More efficient than calling getTokenPriceUsd() multiple times
 * 
 * @param symbols - Array of token symbols (e.g., ["WFLR", "USDT0", "FXRP"])
 * @returns Record of canonical symbol → USD price
 */
export async function getTokenPricesBatch(symbols: string[]): Promise<Record<string, number>> {
  const canonicalSymbols = symbols.map(canonicalSymbol);
  const uncachedSymbols: string[] = [];
  const result: Record<string, number> = {};
  
  // Check cache first
  for (const canonical of canonicalSymbols) {
    const cached = priceCache.get<number>(canonical);
    if (cached !== undefined) {
      result[canonical] = cached;
    } else {
      uncachedSymbols.push(canonical);
    }
  }
  
  if (uncachedSymbols.length === 0) {
    console.log(`[PRICE] Batch cache hit for all ${symbols.length} tokens`);
    return result;
  }
  
  // Resolve CoinGecko IDs for uncached symbols (try address map first, then symbol)
  const idMap = new Map<string, string>();
  for (const canonical of uncachedSymbols) {
    // Try address-based lookup first
    const address = getAddressForSymbol(canonical);
    let coingeckoId: string | null = null;
    
    if (address) {
      coingeckoId = resolveAddressToCoinGeckoId(address);
    }
    
    // Fallback to symbol-based lookup
    if (!coingeckoId) {
      coingeckoId = resolveSymbolToCoinGeckoId(canonical);
    }
    
    if (coingeckoId) {
      idMap.set(canonical, coingeckoId);
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
    for (const [canonical, coingeckoId] of idMap.entries()) {
      const price = data[coingeckoId]?.usd;
      
      if (typeof price === 'number') {
        result[canonical] = price;
        priceCache.set(canonical, price);
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
  const canonical = canonicalSymbol(symbol);
  const stablecoins = [
    'USDT', 'USDT0', 'USD0', 'EUSDT',
    'USDC', 'USDCE',
    'DAI', 'USDS', 'USDD', 'USDX', 'CUSDX'
  ];
  
  if (stablecoins.includes(canonical)) {
    console.log(`[PRICE] Using stablecoin assumption for ${canonical}: $1.00`);
    return { price: 1.00, source: 'stablecoin' };
  }
  
  // Fallback: Use pool ratio (NOT ACCURATE)
  console.warn(
    `[PRICE] ⚠️ WARNING: Using pool price ratio for ${canonical}: ${poolPriceRatio}. ` +
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

