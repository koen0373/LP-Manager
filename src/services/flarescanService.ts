import type { PositionRow } from '../types/positions';
// import { POSITION_MANAGER_ABI, ERC20_ABI } from '../abi/positionManager';

// FlareScan API endpoints - using local proxy to avoid CORS
const FLARESCAN_API = '/api/flarescan';
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
        throw new Error(`FlareScan API error: ${data.error}`);
      }

      console.log(`FlareScan API response for ${method}:`, data);
      return data;
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
  if (tokenCache.has(address)) {
    return tokenCache.get(address)!;
  }

  try {
    // Get symbol
    const symbolData = await callFlareScan('eth_call', [
      {
        to: address,
        data: SELECTORS.symbol,
      },
      'latest',
    ]);

    // Get name
    const nameData = await callFlareScan('eth_call', [
      {
        to: address,
        data: SELECTORS.name,
      },
      'latest',
    ]);

    // Get decimals
    const decimalsData = await callFlareScan('eth_call', [
      {
        to: address,
        data: SELECTORS.decimals,
      },
      'latest',
    ]);

    // Decode results
    const symbol = decodeString(symbolData);
    const name = decodeString(nameData);
    const decimals = parseInt(decimalsData, 16);

    const metadata = { symbol, name, decimals };
    tokenCache.set(address, metadata);
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

// Get wallet's LP positions with optimized batch processing
export async function getWalletPositions(walletAddress: string): Promise<PositionRow[]> {
  try {
    console.log(`Fetching positions for wallet: ${walletAddress}`);

    // Get balance of NFTs (number of positions)
    const balanceData = await callFlareScan('eth_call', [
      {
        to: ENOSYS_POSITION_MANAGER,
        data: `${SELECTORS.balanceOf}${walletAddress.slice(2).padStart(64, '0')}`,
      },
      'latest',
    ]);

    const balance = parseInt(balanceData as string, 16);
    console.log(`Found ${balance} positions`);

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
        batchPromises.push(processPosition(walletAddress, i));
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
    console.error('Failed to fetch wallet positions:', error);
    return [];
  }
}

// Helper function to process a single position
async function processPosition(walletAddress: string, index: number): Promise<PositionRow | null> {
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
    return await parsePositionData(tokenId, positionData as string);
  } catch (error) {
    console.error(`Failed to process position ${index}:`, error);
    return null;
  }
}

// Parse position data
async function parsePositionData(tokenId: number, positionData: string): Promise<PositionRow | null> {
  try {
    // Decode the position data
    // Position data structure: nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1
    const data = positionData.slice(2); // Remove 0x prefix
    
    // Extract addresses (each is 32 bytes = 64 hex chars)
    const token0Address = '0x' + data.slice(64, 128).slice(-40); // Last 20 bytes
    const token1Address = '0x' + data.slice(128, 192).slice(-40); // Last 20 bytes
    
    // Extract fee (24 bits = 6 hex chars)
    const feeHex = data.slice(192, 198);
    const fee = parseInt(feeHex, 16);
    
    // Extract tick values (24 bits each)
    const tickLowerHex = data.slice(198, 204);
    const tickUpperHex = data.slice(204, 210);
    const tickLower = parseInt(tickLowerHex, 16);
    const tickUpper = parseInt(tickUpperHex, 16);
    
    // Extract liquidity (128 bits = 32 hex chars)
    const liquidityHex = data.slice(210, 242);
    // const liquidity = BigInt('0x' + liquidityHex); // Temporarily disabled
    
    // Get token metadata
    const [token0Meta, token1Meta] = await Promise.all([
      getTokenMetadata(token0Address),
      getTokenMetadata(token1Address),
    ]);
    
    // Convert ticks to prices (simplified)
    const tickLowerPrice = tickToPrice(tickLower);
    const tickUpperPrice = tickToPrice(tickUpper);
    
    // Create position row
    return {
      id: tokenId.toString(),
      pairLabel: `${token0Meta.symbol} - ${token1Meta.symbol}`,
      feeTierBps: fee,
      tickLowerLabel: tickLowerPrice.toFixed(5),
      tickUpperLabel: tickUpperPrice.toFixed(5),
      tvlUsd: 0, // TODO: Calculate from liquidity and current prices
      rewardsUsd: 0, // TODO: Calculate unclaimed fees
      rflrAmount: 0,
      rflrUsd: 0,
      rflrPriceUsd: 0.01758,
      inRange: true, // TODO: Check if current price is within range
      status: 'Active' as const,
      token0: { 
        symbol: token0Meta.symbol, 
        address: token0Address, 
        name: token0Meta.name, 
        decimals: token0Meta.decimals 
      },
      token1: { 
        symbol: token1Meta.symbol, 
        address: token1Address, 
        name: token1Meta.name, 
        decimals: token1Meta.decimals 
      },
    };
  } catch (error) {
    console.error('Failed to parse position data:', error);
    return null;
  }
}

// Convert tick to price (simplified)
function tickToPrice(tick: number): number {
  // This is a simplified conversion - in reality you'd use the proper Uniswap V3 formula
  return Math.pow(1.0001, tick);
}
