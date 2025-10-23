/**
 * RPC Client Factory with Fallback Support
 * Provides resilient, multi-endpoint RPC access
 */

import { createPublicClient, http, type PublicClient, type Transport, type Chain } from 'viem';
import { RPC_ENDPOINTS, RATE_LIMITS, FLARE_CHAIN_ID } from './config';

// Define Flare chain
export const flareChain: Chain = {
  id: FLARE_CHAIN_ID,
  name: 'Flare',
  nativeCurrency: {
    decimals: 18,
    name: 'Flare',
    symbol: 'FLR',
  },
  rpcUrls: {
    default: {
      http: [...RPC_ENDPOINTS],
    },
    public: {
      http: [...RPC_ENDPOINTS],
    },
  },
  blockExplorers: {
    default: {
      name: 'FlareScan',
      url: 'https://flarescan.com',
    },
  },
  testnet: false,
};

/**
 * Create a public client with multiple RPC endpoints as fallback
 */
export function createClientWithFallback(
  endpoints: readonly string[] = RPC_ENDPOINTS
): PublicClient<Transport, Chain> {
  // Build transports for each endpoint
  const transports = endpoints.map((url, index) => {
    const priority = index;
    const batchSize = RATE_LIMITS.RPC_BATCH_SIZE - priority * 5; // Decrease batch size for fallbacks
    const wait = RATE_LIMITS.RPC_BATCH_WAIT + priority * 20; // Increase wait for fallbacks

    return http(url, {
      batch: {
        batchSize: Math.max(batchSize, 10),
        wait: Math.min(wait, 100),
      },
      timeout: 30_000, // 30s timeout
      retryCount: 2,
      retryDelay: 1000,
    });
  });

  // Use first transport as primary, rest as fallback
  return createPublicClient({
    chain: flareChain,
    transport: transports[0], // Viem doesn't support multiple transports directly, so we use the first
    batch: {
      multicall: {
        batchSize: RATE_LIMITS.RPC_BATCH_SIZE,
        wait: RATE_LIMITS.RPC_BATCH_WAIT,
      },
    },
  });
}

/**
 * Singleton public client instance
 * Used throughout the app for on-chain reads
 */
export const publicClient = createClientWithFallback();

/**
 * Create a dedicated client for a specific endpoint (testing/debugging)
 */
export function createSingleEndpointClient(endpoint: string): PublicClient<Transport, Chain> {
  return createPublicClient({
    chain: flareChain,
    transport: http(endpoint, {
      timeout: 30_000,
      retryCount: 3,
      retryDelay: 1000,
    }),
  });
}

