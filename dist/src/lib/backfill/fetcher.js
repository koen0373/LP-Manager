"use strict";
// Backfill data fetchers with retry logic
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPositionTransfers = fetchPositionTransfers;
exports.fetchPositionEvents = fetchPositionEvents;
exports.getCurrentBlockNumber = getCurrentBlockNumber;
const FLARESCAN_API_BASE = process.env.FLARESCAN_API_BASE || 'https://flare-explorer.flare.network/api';
const FLARESCAN_API_KEY = process.env.FLARESCAN_API_KEY || '';
/**
 * Exponential backoff retry wrapper
 */
async function withRetry(fn, options = {}) {
    const { maxRetries = 3, baseDelay = 1000 } = options;
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // Don't retry on 4xx errors (except 429)
            if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
                throw error;
            }
            if (attempt < maxRetries - 1) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.log(`[BACKFILL] Retry ${attempt + 1}/${maxRetries} after ${delay}ms due to:`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError || new Error('Max retries exceeded');
}
/**
 * Rate-limited fetch for Flarescan API
 */
let lastFetchTime = 0;
const MIN_FETCH_INTERVAL = 500; // 2 req/sec
async function rateLimitedFetch(url) {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_FETCH_INTERVAL - timeSinceLastFetch));
    }
    lastFetchTime = Date.now();
    const response = await fetch(url);
    if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
        error.status = response.status;
        throw error;
    }
    return response;
}
/**
 * Fetch NFT transfers for a position from Flarescan
 */
async function fetchPositionTransfers(tokenId, positionsAddress = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657', page = 1, pageSize = 100) {
    return withRetry(async () => {
        const url = `${FLARESCAN_API_BASE}/v2/tokens/${positionsAddress}/instances/${tokenId}/transfers?page=${page}&page_size=${pageSize}`;
        const response = await rateLimitedFetch(url);
        const data = await response.json();
        return data.items || [];
    });
}
/**
 * Fetch event logs for a pool/position from Flarescan
 */
async function fetchPositionEvents(poolAddress, fromBlock, toBlock, topics) {
    return withRetry(async () => {
        const url = `${FLARESCAN_API_BASE}/v2/logs`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                address: poolAddress,
                fromBlock: fromBlock.toString(),
                toBlock: toBlock.toString(),
                topics,
            }),
        });
        if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.status = response.status;
            throw error;
        }
        const data = await response.json();
        return data.items || [];
    });
}
/**
 * Get current block number from RPC
 */
async function getCurrentBlockNumber() {
    const rpcUrl = process.env.RPC_URL_FALLBACK || 'https://flare-api.flare.network/ext/C/rpc';
    return withRetry(async () => {
        const response = await fetch(rpcUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1,
            }),
        });
        if (!response.ok) {
            throw new Error(`RPC error: ${response.status}`);
        }
        const data = await response.json();
        return parseInt(data.result, 16);
    });
}
