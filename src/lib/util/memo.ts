// src/lib/util/memo.ts
type CacheEntry<T> = {
  value: T | Promise<T>;
  expires: number;
};

const cache = new Map<string, CacheEntry<unknown>>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

export function memoize<T>(key: string, fn: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && Date.now() < cached.expires) {
    return Promise.resolve(cached.value);
  }

  const promise = fn();
  cache.set(key, { value: promise, expires: Date.now() + ttl });

  promise.then(
    (value) => {
      cache.set(key, { value, expires: Date.now() + ttl });
    },
    (error) => {
      cache.delete(key);
      throw error;
    }
  );

  return promise;
}

export function memoizeSync<T>(key: string, fn: () => T, ttl: number = DEFAULT_TTL): T {
  const cached = cache.get(key) as CacheEntry<T> | undefined;
  if (cached && Date.now() < cached.expires) {
    return cached.value as T;
  }

  const value = fn();
  cache.set(key, { value, expires: Date.now() + ttl });
  return value;
}

export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
    console.log(`[CACHE] Cleared entry for ${key}`);
  } else {
    cache.clear();
    console.log('[CACHE] Cleared all entries');
  }
}

export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
