/**
 * Enrichment Cache Utility
 * 
 * Provides caching for expensive enrichment operations:
 * - CoinGecko prices (1 hour cache)
 * - rFLR vesting (24 hour cache)
 * - APR calculations (1 hour cache)
 * 
 * Uses in-memory cache with optional Redis fallback
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class EnrichmentCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL: number;

  constructor(defaultTTLSeconds: number = 3600) {
    this.defaultTTL = defaultTTLSeconds * 1000; // Convert to milliseconds
  }

  /**
   * Get cached value or null if expired/missing
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value as T;
  }

  /**
   * Set cached value with TTL
   */
  set<T>(key: string, value: T, ttlSeconds?: number): void {
    const ttl = (ttlSeconds || this.defaultTTL / 1000) * 1000;
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
    });
  }

  /**
   * Delete cached value
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Singleton instances for different cache types
export const priceCache = new EnrichmentCache(3600); // 1 hour for prices
export const vestingCache = new EnrichmentCache(86400); // 24 hours for vesting
export const aprCache = new EnrichmentCache(3600); // 1 hour for APR

/**
 * Cache key generators
 */
export const cacheKeys = {
  price: (tokenSymbol: string) => `price:${tokenSymbol.toLowerCase()}`,
  vesting: (tokenId: string) => `vesting:${tokenId}`,
  apr: (poolAddress: string) => `apr:${poolAddress.toLowerCase()}`,
  rangeStatus: (tokenId: string) => `range:${tokenId}`,
};

/**
 * Cleanup expired entries periodically (every 5 minutes)
 */
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    priceCache.cleanup();
    vestingCache.cleanup();
    aprCache.cleanup();
  }, 5 * 60 * 1000);
}

