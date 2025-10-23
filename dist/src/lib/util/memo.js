"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoize = memoize;
exports.memoizeSync = memoizeSync;
exports.clearCache = clearCache;
exports.getCacheStats = getCacheStats;
const cache = new Map();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
function memoize(key, fn, ttl = DEFAULT_TTL) {
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expires) {
        return Promise.resolve(cached.value);
    }
    const promise = fn();
    cache.set(key, { value: promise, expires: Date.now() + ttl });
    promise.then((value) => {
        cache.set(key, { value, expires: Date.now() + ttl });
    }, (error) => {
        cache.delete(key);
        throw error;
    });
    return promise;
}
function memoizeSync(key, fn, ttl = DEFAULT_TTL) {
    const cached = cache.get(key);
    if (cached && Date.now() < cached.expires) {
        return cached.value;
    }
    const value = fn();
    cache.set(key, { value, expires: Date.now() + ttl });
    return value;
}
function clearCache(key) {
    if (key) {
        cache.delete(key);
        console.log(`[CACHE] Cleared entry for ${key}`);
    }
    else {
        cache.clear();
        console.log('[CACHE] Cleared all entries');
    }
}
function getCacheStats() {
    return {
        size: cache.size,
        keys: Array.from(cache.keys()),
    };
}
