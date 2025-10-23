"use strict";
/**
 * Utility for adding timeout to async operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.withTimeout = withTimeout;
exports.createTimeoutPromise = createTimeoutPromise;
exports.fetchWithTimeout = fetchWithTimeout;
function withTimeout(promise, timeoutMs = 15000, timeoutMessage) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => {
                reject(new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`));
            }, timeoutMs);
        }),
    ]);
}
function createTimeoutPromise(timeoutMs = 15000, timeoutMessage) {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(timeoutMessage || `Operation timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
}
async function fetchWithTimeout(url, options, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error(`Request to ${url} timed out after ${timeoutMs}ms`);
        }
        throw error;
    }
}
