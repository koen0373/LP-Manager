// Backfill data fetchers with retry logic

import { FlarescanTransfer, FlarescanLog } from './types';

const FLARESCAN_API_BASE = process.env.FLARESCAN_API_BASE || 'https://flare-explorer.flare.network/api';
const FLARESCAN_API_KEY = process.env.FLARESCAN_API_KEY || '';

interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number; // ms
}

/**
 * Exponential backoff retry wrapper
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { maxRetries = 3, baseDelay = 1000 } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const err = error as Error & { status?: number };
      lastError = err;
      
      // Don't retry on 4xx errors (except 429)
      if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
        throw err;
      }

      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`[BACKFILL] Retry ${attempt + 1}/${maxRetries} after ${delay}ms due to:`, err.message);
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

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastFetch = now - lastFetchTime;
  
  if (timeSinceLastFetch < MIN_FETCH_INTERVAL) {
    await new Promise(resolve => setTimeout(resolve, MIN_FETCH_INTERVAL - timeSinceLastFetch));
  }

  lastFetchTime = Date.now();
  
  const response = await fetch(url);
  
  if (!response.ok) {
    const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
    error.status = response.status;
    throw error;
  }

  return response;
}

/**
 * Fetch NFT transfers for a position from Flarescan
 */
export async function fetchPositionTransfers(
  tokenId: number,
  positionsAddress: string = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657',
  page: number = 1,
  pageSize: number = 100
): Promise<FlarescanTransfer[]> {
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
export async function fetchPositionEvents(
  poolAddress: string,
  fromBlock: number,
  toBlock: number,
  topics: string[]
): Promise<FlarescanLog[]> {
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
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
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
export async function getCurrentBlockNumber(): Promise<number> {
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

