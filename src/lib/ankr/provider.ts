/**
 * ANKR Provider - Official Ankr.js SDK Integration
 * 
 * Uses @ankr.com/ankr.js for easy access to:
 * - Token balances with USD prices
 * - Token prices and history
 * - Token transfers
 * - Multi-chain queries
 * 
 * Docs: https://www.ankr.com/docs/advanced-api/javascript-sdk/
 */

import { AnkrProvider } from '@ankr.com/ankr.js';

// Initialize with your multichain endpoint
const ANKR_MULTICHAIN_URL = 
  process.env.ANKR_ADVANCED_API_URL || 
  `https://rpc.ankr.com/multichain/${process.env.ANKR_API_KEY || 'cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01'}`;

let cachedProvider: AnkrProvider | null = null;

/**
 * Get singleton AnkrProvider instance
 */
export function getAnkrProvider(): AnkrProvider {
  if (!cachedProvider) {
    cachedProvider = new AnkrProvider(ANKR_MULTICHAIN_URL);
  }
  return cachedProvider;
}

/**
 * Get token balances for a wallet with USD values
 * 
 * @param walletAddress - Wallet address to query
 * @param blockchains - Optional array of chains (defaults to ['flare'])
 */
export async function getWalletBalances(
  walletAddress: string,
  blockchains: string[] = ['flare']
) {
  const provider = getAnkrProvider();
  
  try {
    const balances = await provider.getAccountBalance({
      blockchain: blockchains,
      walletAddress,
    });
    
    return balances;
  } catch (error) {
    console.error('[ANKR-PROVIDER] Failed to fetch balances:', error);
    throw error;
  }
}

/**
 * Get current token price in USD
 * 
 * @param blockchain - Chain name (e.g., 'flare')
 * @param contractAddress - Token contract address (optional for native coin)
 */
export async function getTokenPrice(
  blockchain: string = 'flare',
  contractAddress?: string
) {
  const provider = getAnkrProvider();
  
  try {
    const result = await provider.getTokenPrice({
      blockchain,
      contractAddress,
    });
    
    return result;
  } catch (error) {
    console.error('[ANKR-PROVIDER] Failed to fetch token price:', error);
    throw error;
  }
}

/**
 * Get historical token prices
 * 
 * @param blockchain - Chain name
 * @param contractAddress - Token contract address
 * @param options - Time range and interval options
 */
export async function getTokenPriceHistory(
  blockchain: string = 'flare',
  contractAddress?: string,
  options?: {
    fromTimestamp?: number;
    toTimestamp?: number;
    interval?: number;
    limit?: number;
  }
) {
  const provider = getAnkrProvider();
  
  try {
    const result = await provider.getTokenPriceHistory({
      blockchain,
      contractAddress,
      ...options,
    });
    
    return result;
  } catch (error) {
    console.error('[ANKR-PROVIDER] Failed to fetch price history:', error);
    throw error;
  }
}

/**
 * Get token transfers for a wallet
 * 
 * @param address - Wallet or contract address
 * @param blockchain - Chain(s) to query
 * @param options - Pagination and time range options
 */
export async function getTokenTransfers(
  address: string,
  blockchain: string | string[] = 'flare',
  options?: {
    fromTimestamp?: number;
    toTimestamp?: number;
    pageSize?: number;
    pageToken?: string;
  }
) {
  const provider = getAnkrProvider();
  
  try {
    const result = await provider.getTokenTransfers({
      address,
      blockchain: Array.isArray(blockchain) ? blockchain : [blockchain],
      ...options,
    });
    
    return result;
  } catch (error) {
    console.error('[ANKR-PROVIDER] Failed to fetch token transfers:', error);
    throw error;
  }
}

/**
 * Get token holders for a specific token
 * 
 * @param blockchain - Chain name
 * @param contractAddress - Token contract address
 * @param options - Pagination options
 */
export async function getTokenHolders(
  blockchain: string = 'flare',
  contractAddress: string,
  options?: {
    pageSize?: number;
    pageToken?: string;
  }
) {
  const provider = getAnkrProvider();
  
  try {
    const result = await provider.getTokenHolders({
      blockchain,
      contractAddress,
      ...options,
    });
    
    return result;
  } catch (error) {
    console.error('[ANKR-PROVIDER] Failed to fetch token holders:', error);
    throw error;
  }
}

/**
 * Flare token addresses for convenience
 */
export const FLARE_TOKENS = {
  WFLR: '0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d',
  FXRP: '0xAd552A648C74D49E10027AB8a618A3ad4901c5bE',
  USD0: '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
  EUSDT: '0x96B41289D90444B8adD57e6F265DB5aE8651DF29',
  APS: '0xfF56Eb5b1a7FAa972291117E5E9565dA29bc808d',
  SFLR: '0x12e605bc104e93B45e1aD99F9e555f659051c2BB',
} as const;

