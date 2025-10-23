/**
 * FlareScan API Client
 * Rate-limited, typed client for Flarescan/Blockscout API
 */

import { RATE_LIMITS } from '../../onchain/config';
import { timedFetch } from '../../util/timedFetch';
import { withTimeout } from '../../util/withTimeout';
import type {
  FlarescanResponse,
  BlockscoutContractInfo,
  BlockscoutTransaction,
  BlockscoutNFTTransfer,
  BlockscoutLog,
} from './types';

// API endpoints
const FLARESCAN_API_V1 = 'https://flare-explorer.flare.network/api';
const FLARESCAN_API_V2 = 'https://flare-explorer.flare.network/api/v2';

// Rate limiter: simple token bucket
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per millisecond

  constructor(requestsPerSecond: number) {
    this.maxTokens = requestsPerSecond;
    this.tokens = requestsPerSecond;
    this.lastRefill = Date.now();
    this.refillRate = requestsPerSecond / 1000; // Convert to tokens per ms
  }

  private refill() {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Wait until we have a token
    const waitMs = Math.ceil((1 - this.tokens) / this.refillRate);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    this.tokens = 0; // We'll use the token we just waited for
  }
}

// Global rate limiter
const rateLimiter = new RateLimiter(RATE_LIMITS.FLARESCAN_RPS);

/**
 * Rate-limited fetch wrapper for Flarescan
 */
async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  await rateLimiter.acquire();
  return withTimeout(
    timedFetch(url, options),
    30000,
    `Flarescan request to ${url} timed out`
  );
}

/**
 * Fetch from Flarescan V1 API (Etherscan-compatible)
 */
export async function fetchFlarescanV1<T = unknown>(
  params: Record<string, string | number>
): Promise<FlarescanResponse<T>> {
  const query = new URLSearchParams(
    Object.entries(params).map(([key, value]) => [key, String(value)])
  );
  const url = `${FLARESCAN_API_V1}?${query}`;

  const response = await rateLimitedFetch(url);

  if (!response.ok) {
    throw new Error(`[Flarescan V1] Request failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();

  if (json.status === '0' && json.message !== 'No transactions found') {
    console.warn(`[Flarescan V1] API returned error: ${json.message}`, { params });
  }

  return json as FlarescanResponse<T>;
}

/**
 * Fetch from Flarescan V2 API (Blockscout REST)
 */
export async function fetchFlarescanV2<T = unknown>(
  path: string,
  params?: Record<string, string | number>
): Promise<T> {
  const query = params
    ? `?${new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      )}`
    : '';
  const url = `${FLARESCAN_API_V2}${path}${query}`;

  const response = await rateLimitedFetch(url);

  if (!response.ok) {
    throw new Error(`[Flarescan V2] Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * POST request to Flarescan V2 (for logs)
 */
export async function postFlarescanV2<T = unknown>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const url = `${FLARESCAN_API_V2}${path}`;

  const response = await rateLimitedFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`[Flarescan V2 POST] Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Get contract creation info (V1 API)
 */
export async function getContractCreation(contractAddress: string) {
  return fetchFlarescanV1({
    module: 'contract',
    action: 'getcontractcreation',
    contractaddresses: contractAddress,
  });
}

/**
 * Get transaction info (V1 API)
 */
export async function getTransactionInfo(txHash: string) {
  return fetchFlarescanV1({
    module: 'transaction',
    action: 'gettxinfo',
    txhash: txHash,
  });
}

/**
 * Get NFT transfers (V1 API)
 */
export async function getNFTTransfers(
  contractAddress: string,
  address?: string,
  startBlock?: number,
  endBlock?: number
) {
  const params: Record<string, string | number> = {
    module: 'account',
    action: 'tokennfttx',
    contractaddress: contractAddress,
  };

  if (address) params.address = address;
  if (startBlock !== undefined) params.startblock = startBlock;
  if (endBlock !== undefined) params.endblock = endBlock;

  return fetchFlarescanV1(params);
}

/**
 * Get event logs (V1 API)
 */
export async function getEventLogs(
  address: string,
  fromBlock: number,
  toBlock: number | 'latest',
  topics?: string[]
) {
  const params: Record<string, string | number> = {
    module: 'logs',
    action: 'getLogs',
    address,
    fromBlock,
    toBlock: String(toBlock),
  };

  if (topics && topics.length > 0) {
    topics.forEach((topic, index) => {
      if (topic) params[`topic${index}`] = topic;
    });
  }

  return fetchFlarescanV1(params);
}

/**
 * Get contract info (V2 API)
 */
export async function getContractInfo(contractAddress: string): Promise<BlockscoutContractInfo> {
  return fetchFlarescanV2<BlockscoutContractInfo>(`/smart-contracts/${contractAddress}`);
}

/**
 * Get transaction (V2 API)
 */
export async function getTransaction(txHash: string): Promise<BlockscoutTransaction> {
  return fetchFlarescanV2<BlockscoutTransaction>(`/transactions/${txHash}`);
}

/**
 * Get NFT instance transfers (V2 API)
 */
export async function getNFTInstanceTransfers(
  contractAddress: string,
  tokenId: string,
  page = 1,
  pageSize = 100
): Promise<{ items: BlockscoutNFTTransfer[]; next_page_params: unknown }> {
  return fetchFlarescanV2(`/tokens/${contractAddress}/instances/${tokenId}/transfers`, {
    page,
    page_size: pageSize,
  });
}

/**
 * Get logs via POST (V2 API)
 */
export async function getLogsPOST(
  address: string,
  fromBlock: number,
  toBlock: number | 'latest',
  topics: string[]
): Promise<{ items: BlockscoutLog[] }> {
  return postFlarescanV2<{ items: BlockscoutLog[] }>('/logs', {
    address: [address],
    from_block: fromBlock,
    to_block: toBlock === 'latest' ? null : toBlock,
    topics: topics.reduce((acc, topic, index) => {
      if (topic) acc[`topic${index}`] = topic;
      return acc;
    }, {} as Record<string, string>),
  });
}

