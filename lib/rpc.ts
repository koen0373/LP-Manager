/**
 * RPC client with rotation and health checks for 502 hardening
 * 
 * Provides RPC client rotation over FLARE_RPC_URLS with hard timeouts
 * and automatic failover.
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import { flare } from 'viem/chains';

let rpcUrls: string[] = [];
let currentIndex = 0;

/**
 * Get RPC URLs from environment
 */
function getRpcUrls(): string[] {
  if (rpcUrls.length > 0) {
    return rpcUrls;
  }

  const urlsEnv = process.env.FLARE_RPC_URLS || process.env.FLARE_RPC_URL;
  if (!urlsEnv) {
    throw new Error('FLARE_RPC_URLS or FLARE_RPC_URL environment variable is required');
  }

  rpcUrls = urlsEnv.split(',').map((url) => url.trim()).filter(Boolean);
  
  // Randomize start index for load distribution
  currentIndex = Math.floor(Math.random() * rpcUrls.length);

  return rpcUrls;
}

/**
 * Get RPC client with rotation
 */
export function getRpcClient(): PublicClient {
  const urls = getRpcUrls();
  const url = urls[currentIndex % urls.length];
  currentIndex++;

  return createPublicClient({
    chain: flare,
    transport: http(url, {
      timeout: 1200, // 1.2s hard timeout
    }),
  });
}

/**
 * RPC health check with rotation and timeout
 */
export async function rpcHealth(timeoutMs: number = 1200): Promise<boolean> {
  const urls = getRpcUrls();
  const startIndex = Math.floor(Math.random() * urls.length);

  // Try up to 2 URLs
  for (let i = 0; i < Math.min(2, urls.length); i++) {
    const urlIndex = (startIndex + i) % urls.length;
    const url = urls[urlIndex];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const client = createPublicClient({
        chain: flare,
        transport: http(url, {
          timeout: timeoutMs,
        }),
      });

      await client.getBlockNumber({ signal: controller.signal });
      clearTimeout(timeoutId);
      return true;
    } catch (error) {
      clearTimeout(timeoutId);
      if (i === Math.min(2, urls.length) - 1) {
        // Last attempt failed
        console.warn(`[rpc] Health check failed for all URLs (last: ${url})`);
        return false;
      }
      // Try next URL
      continue;
    }
  }

  return false;
}

