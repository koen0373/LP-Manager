import type { PositionRow } from '../types/positions';
import { getRflrRewardForPosition } from './rflrRewards';
import { getTokenPrice } from './tokenPrices';
import {
  getFactoryAddress,
  getPoolAddress,
  getPoolState,
  decodePositionData,
  calcAmountsForPosition,
  isInRange,
  formatPrice,
  calculatePositionValue,
  normalizeAddress,
  toSignedInt24,
  computePriceRange,
  calculateAccruedFees,
} from '../utils/poolHelpers';
// FlareScan API endpoints - using local proxy to avoid CORS
const FLARESCAN_API = process.env.FLARESCAN_PROXY_URL || 'http://localhost:3000/api/flarescan';
const ENOSYS_POSITION_MANAGER = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657';

// Function selectors
const SELECTORS = {
  balanceOf: '0x70a08231',
  tokenOfOwnerByIndex: '0x2f745c59',
  positions: '0x99fbab88',
  symbol: '0x95d89b41',
  name: '0x06fdde03',
  decimals: '0x313ce567',
};

// Token metadata cache
const tokenCache = new Map<string, { symbol: string; name: string; decimals: number }>();
const positionsCache = new Map<string, { expires: number; data: PositionRow[] }>();
const CACHE_TTL_MS = 30_000; // 30 seconds cache to avoid spamming the API

function getCachedPositions(address: `0x${string}`): PositionRow[] | null {
  const cached = positionsCache.get(address);
  if (!cached) {
    return null;
  }

  if (Date.now() > cached.expires) {
    positionsCache.delete(address);
    return null;
  }

  return cached.data;
}

function setCachedPositions(address: `0x${string}`, data: PositionRow[]): void {
  positionsCache.set(address, {
    data,
    expires: Date.now() + CACHE_TTL_MS,
  });

  // Prevent unbounded growth
  if (positionsCache.size > 50) {
    const firstKey = positionsCache.keys().next().value;
    if (firstKey) {
      positionsCache.delete(firstKey);
    }
  }
}

// Helper function to call FlareScan API via local proxy with retry logic
async function callFlareScan(method: string, params: unknown[] = [], retries = 3): Promise<unknown> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Calling FlareScan API (attempt ${attempt}/${retries}): ${method}`, params);

      const response = await fetch(FLARESCAN_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method,
          params,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        if (response.status === 429 && attempt < retries) {
          // Rate limited, wait and retry
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Rate limited, waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        
        throw new Error(`FlareScan API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`FlareScan API error: ${JSON.stringify(data.error)}`);
      }

      if (data.result === undefined) {
        console.warn(`FlareScan API response missing result for ${method}`, data);
        return data;
      }

      console.log(`FlareScan API response for ${method}:`, data.result);
      return data.result;
    } catch (error) {
      console.error(`FlareScan API call failed (attempt ${attempt}/${retries}):`, error);
      
      if (attempt === retries) {
        throw error;
      }
      
      // Wait before retry
      const waitTime = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

// Get token metadata
async function getTokenMetadata(address: string): Promise<{ symbol: string; name: string; decimals: number }> {
  const normalized = normalizeAddress(address);

  if (tokenCache.has(normalized)) {
    return tokenCache.get(normalized)!;
  }

  try {
    // Get symbol
    const symbolData = await callFlareScan('eth_call', [
      {
        to: normalized,
        data: SELECTORS.symbol,
      },
      'latest',
    ]);

    // Get name
    const nameData = await callFlareScan('eth_call', [
      {
        to: normalized,
        data: SELECTORS.name,
      },
      'latest',
    ]);

    // Get decimals
    const decimalsData = await callFlareScan('eth_call', [
      {
        to: normalized,
        data: SELECTORS.decimals,
      },
      'latest',
    ]);

    // Decode results
    const symbol = decodeString(symbolData as string);
    const name = decodeString(nameData as string);
    const decimals = parseInt(decimalsData as string, 16);

    const metadata = { symbol, name, decimals };
    tokenCache.set(normalized, metadata);
    return metadata;
  } catch (error) {
    console.error(`Failed to get token metadata for ${address}:`, error);
    return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 18 };
  }
}

// Decode hex string to readable string
function decodeString(hex: string): string {
  if (!hex || hex === '0x') return '';
  
  try {
    // Remove 0x prefix and convert to bytes
    const bytes = hex.slice(2);
    const result = [];
    
    for (let i = 0; i < bytes.length; i += 2) {
      const byte = parseInt(bytes.substr(i, 2), 16);
      if (byte === 0) break; // Stop at null terminator
      result.push(byte);
    }
    
    return String.fromCharCode(...result);
  } catch (error) {
    console.error('Failed to decode string:', error);
    return 'UNKNOWN';
  }
}

// Get wallet's LP positions with Viem fallback
export async function getWalletPositions(walletAddress: string): Promise<PositionRow[]> {
  try {
    const normalizedAddress = normalizeAddress(walletAddress);
    const cached = getCachedPositions(normalizedAddress);
    if (cached) {
      return cached;
    }

    console.log(`Fetching positions for wallet: ${normalizedAddress}`);

    // Try server-side viem endpoint first to avoid hitting FlareScan unnecessarily
    try {
      const response = await fetch(`/api/positions?address=${normalizedAddress}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const positions = (await response.json()) as PositionRow[];
        setCachedPositions(normalizedAddress, positions);
        return positions;
      }

      const errorText = await response.text();
      console.warn(
        `Positions API response not OK (${response.status}). Falling back to Viem/FlareScan directly.`,
        errorText
      );
    } catch (apiError) {
      console.warn('Positions API call failed, falling back locally:', apiError);
    }

    // Final fallback executed locally so the UI remains functional even if the API route fails
    console.log('Falling back to FlareScan API...');
    const fallbackPositions = await getWalletPositionsViaFlareScan(normalizedAddress);
    setCachedPositions(normalizedAddress, fallbackPositions);
    return fallbackPositions;
  } catch (error) {
    console.error('Failed to fetch wallet positions:', error);
    return [];
  }
}

// FlareScan API implementation (fallback)
export async function getWalletPositionsViaFlareScan(walletAddress: string): Promise<PositionRow[]> {
  try {
    const normalised = normalizeAddress(walletAddress);
    const factory = await getFactoryAddress(ENOSYS_POSITION_MANAGER as `0x${string}`);
    // Get balance of NFTs (number of positions)
    const balanceData = await callFlareScan('eth_call', [
      {
        to: ENOSYS_POSITION_MANAGER,
        data: `${SELECTORS.balanceOf}${normalised.slice(2).padStart(64, '0')}`,
      },
      'latest',
    ]);

    const balance = parseInt(balanceData as string, 16);
    console.log(`Found ${balance} positions via FlareScan`);

    if (balance === 0) {
      return [];
    }

    const positions: PositionRow[] = [];

    // Process positions in smaller batches to avoid rate limiting
    const batchSize = 3; // Process 3 positions at a time
    for (let batchStart = 0; batchStart < balance; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, balance);
      console.log(`Processing batch ${batchStart + 1}-${batchEnd} of ${balance}`);

      // Process batch in parallel
      const batchPromises = [];
      for (let i = batchStart; i < batchEnd; i++) {
        batchPromises.push(processPosition(normalised, i, factory));
      }

      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            positions.push(result.value);
          }
        }
      } catch (error) {
        console.error(`Failed to process batch ${batchStart + 1}-${batchEnd}:`, error);
      }

      // Add delay between batches to respect rate limits
      if (batchEnd < balance) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return positions;
  } catch (error) {
    console.error('Failed to fetch wallet positions via FlareScan:', error);
    return [];
  }
}

// Helper function to process a single position
async function processPosition(walletAddress: `0x${string}`, index: number, factory: `0x${string}`): Promise<PositionRow | null> {
  try {
    // Get token ID at index i
    const tokenIdData = await callFlareScan('eth_call', [
      {
        to: ENOSYS_POSITION_MANAGER,
        data: `${SELECTORS.tokenOfOwnerByIndex}${walletAddress.slice(2).padStart(64, '0')}${index.toString(16).padStart(64, '0')}`,
      },
      'latest',
    ]);

    const tokenId = parseInt(tokenIdData as string, 16);
    console.log(`Processing position ${tokenId}`);

    // Get position data
    const positionData = await callFlareScan('eth_call', [
      {
        to: ENOSYS_POSITION_MANAGER,
        data: `${SELECTORS.positions}${tokenId.toString(16).padStart(64, '0')}`,
      },
      'latest',
    ]);

    // Parse position data
    return await parsePositionData(tokenId, positionData as string, factory);
  } catch (error) {
    console.error(`Failed to process position ${index}:`, error);
    return null;
  }
}

// Parse position data using shared helpers
async function parsePositionData(tokenId: number, positionData: string, factory: `0x${string}`): Promise<PositionRow | null> {
  try {
    console.log(`[DEBUG] Parsing position data for tokenId: ${tokenId}`);
    console.log(`[DEBUG] Position data length: ${positionData.length}`);
    
    // Use shared ABI decoding
    const decoded = decodePositionData(positionData);

    const token0 = normalizeAddress(decoded.token0);
    const token1 = normalizeAddress(decoded.token1);
    const fee = Number(decoded.fee);
    const tickLower = toSignedInt24(decoded.tickLower);
    const tickUpper = toSignedInt24(decoded.tickUpper);
    const liquidity = decoded.liquidity;
    const tokensOwed0 = decoded.tokensOwed0;
    const tokensOwed1 = decoded.tokensOwed1;
    
    console.log(`[DEBUG] Decoded position data:`);
    console.log(`[DEBUG] Token0: ${token0}, Token1: ${token1}`);
    console.log(`[DEBUG] Fee: ${fee}, TickLower: ${tickLower}, TickUpper: ${tickUpper}`);
    console.log(`[DEBUG] Liquidity: ${liquidity.toString()}`);
    
    // Normalize token addresses
    const [token0Meta, token1Meta] = await Promise.all([
      getTokenMetadata(token0),
      getTokenMetadata(token1),
    ]);
    console.log('[METADATA][flarescan]', {
      token0: token0Meta,
      token1: token1Meta,
    });
    
    const { lowerPrice, upperPrice } = computePriceRange(
      tickLower,
      tickUpper,
      token0Meta.decimals,
      token1Meta.decimals
    );
    
    const poolAddress = await getPoolAddress(factory, token0, token1, fee);
    
    // Get pool state
    const { sqrtPriceX96, tick: currentTick } = await getPoolState(poolAddress);
    
    // Calculate amounts using proper Uniswap V3 math
    const { amount0Wei, amount1Wei } = calcAmountsForPosition(
      liquidity,
      sqrtPriceX96,
      tickLower,
      tickUpper,
      token0Meta.decimals,
      token1Meta.decimals
    );
    
    const { fee0Wei, fee1Wei } = await calculateAccruedFees({
      poolAddress,
      liquidity,
      tickLower,
      tickUpper,
      currentTick,
      feeGrowthInside0LastX128: decoded.feeGrowthInside0LastX128,
      feeGrowthInside1LastX128: decoded.feeGrowthInside1LastX128,
      tokensOwed0,
      tokensOwed1,
    });
    
    // Check if in range
    const inRange = isInRange(currentTick, tickLower, tickUpper);
    
    // Calculate TVL and rewards
    const {
      amount0,
      amount1,
      fee0,
      fee1,
      price0Usd,
      price1Usd,
      tvlUsd,
      rewardsUsd,
    } = await calculatePositionValue({
      token0Symbol: token0Meta.symbol,
      token1Symbol: token1Meta.symbol,
      token0Decimals: token0Meta.decimals,
      token1Decimals: token1Meta.decimals,
      amount0Wei,
      amount1Wei,
      fee0Wei,
      fee1Wei,
      sqrtPriceX96,
    });
    
    console.log('[VALUE][flarescan]', {
      fee0Tokens: fee0,
      fee1Tokens: fee1,
      fee0Usd: fee0 * price0Usd,
      fee1Usd: fee1 * price1Usd,
    });

    const [rflrAmountRaw, rflrPriceUsd] = await Promise.all([
      getRflrRewardForPosition(tokenId.toString()),
      getTokenPrice('RFLR'),
    ]);

    const rflrAmount = rflrAmountRaw ?? 0;
    const rflrUsd = rflrAmount * rflrPriceUsd;
    
    // Create position row with real data
    return {
      id: tokenId.toString(),
      pairLabel: `${token0Meta.symbol} - ${token1Meta.symbol}`,
      feeTierBps: fee,
      tickLowerLabel: formatPrice(lowerPrice),
      tickUpperLabel: formatPrice(upperPrice),
      tvlUsd,
      rewardsUsd,
      rflrAmount,
      rflrUsd,
      rflrPriceUsd,
      inRange,
      status: 'Active' as const,
      token0: {
        symbol: token0Meta.symbol,
        address: token0,
        name: token0Meta.name,
        decimals: token0Meta.decimals
      },
      token1: {
        symbol: token1Meta.symbol,
        address: token1,
        name: token1Meta.name,
        decimals: token1Meta.decimals
      },
      // New fields with real calculated values
      amount0,
      amount1,
      lowerPrice,
      upperPrice,
      isInRange: inRange,
      poolAddress,
      price0Usd,
      price1Usd,
    };
  } catch (error) {
    console.error('Failed to parse position data:', error);
    return null;
  }
}
