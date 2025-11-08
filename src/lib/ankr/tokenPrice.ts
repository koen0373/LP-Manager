/**
 * ANKR Advanced API - Token Price Service
 * 
 * Uses ANKR's Token API for real-time price data:
 * - ankr_getTokenPrice: Current USD price
 * - ankr_getTokenPriceHistory: Historical prices with custom intervals
 * 
 * Docs: https://www.ankr.com/docs/advanced-api/token-methods/
 */

interface AnkrTokenPriceRequest {
  jsonrpc: '2.0';
  method: 'ankr_getTokenPrice';
  params: {
    blockchain: string;
    contractAddress?: string; // Optional; if not provided, returns native coin price
    syncCheck?: boolean;
  };
  id: number;
}

interface AnkrTokenPriceHistoryRequest {
  jsonrpc: '2.0';
  method: 'ankr_getTokenPriceHistory';
  params: {
    blockchain: string;
    contractAddress?: string;
    fromTimestamp?: number;
    toTimestamp?: number;
    interval?: number; // Time interval in seconds
    limit?: number;
    syncCheck?: boolean;
  };
  id: number;
}

interface AnkrTokenPriceResponse {
  jsonrpc: '2.0';
  id: number;
  result: {
    usdPrice: string;
    blockchain: string;
    contractAddress: string;
    syncStatus?: {
      timestamp: number;
      lag: string;
      status: string;
    };
  };
}

interface AnkrTokenPriceHistoryResponse {
  jsonrpc: '2.0';
  id: number;
  result: {
    quotes: Array<{
      timestamp: number;
      blockHeight: number;
      usdPrice: string;
    }>;
    syncStatus?: {
      timestamp: number;
      lag: string;
      status: string;
    };
  };
}

const ANKR_MULTICHAIN_ENDPOINT = process.env.ANKR_ADVANCED_API_URL || 
  `https://flare-api.flare.network/ext/C/rpc || ''}`;

const FLARE_BLOCKCHAIN_ID = 'flare';

/**
 * Get current USD price for a token on Flare network.
 * 
 * @param contractAddress - Token contract address (optional; if not provided, returns FLR price)
 * @returns Current USD price as a number
 */
export async function getAnkrTokenPrice(
  contractAddress?: string
): Promise<number> {
  const request: AnkrTokenPriceRequest = {
    jsonrpc: '2.0',
    method: 'ankr_getTokenPrice',
    params: {
      blockchain: FLARE_BLOCKCHAIN_ID,
      contractAddress,
      syncCheck: true,
    },
    id: 1,
  };

  try {
    const response = await fetch(ANKR_MULTICHAIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`ANKR API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as AnkrTokenPriceResponse;

    if (!data.result?.usdPrice) {
      throw new Error(`No price data returned for ${contractAddress || 'FLR'}`);
    }

    const price = parseFloat(data.result.usdPrice);

    if (!Number.isFinite(price) || price < 0) {
      throw new Error(`Invalid price value: ${data.result.usdPrice}`);
    }

    return price;
  } catch (error) {
    console.error(`[ANKR-PRICE] Failed to fetch price for ${contractAddress || 'FLR'}:`, error);
    throw error;
  }
}

/**
 * Get historical USD prices for a token on Flare network.
 * 
 * @param contractAddress - Token contract address (optional; if not provided, returns FLR history)
 * @param options - Query options (time range, interval, limit)
 * @returns Array of historical price points
 */
export async function getAnkrTokenPriceHistory(
  contractAddress?: string,
  options: {
    fromTimestamp?: number;
    toTimestamp?: number;
    interval?: number; // seconds
    limit?: number;
  } = {}
): Promise<Array<{ timestamp: number; blockHeight: number; usdPrice: number }>> {
  const request: AnkrTokenPriceHistoryRequest = {
    jsonrpc: '2.0',
    method: 'ankr_getTokenPriceHistory',
    params: {
      blockchain: FLARE_BLOCKCHAIN_ID,
      contractAddress,
      fromTimestamp: options.fromTimestamp,
      toTimestamp: options.toTimestamp,
      interval: options.interval,
      limit: options.limit,
      syncCheck: true,
    },
    id: 1,
  };

  try {
    const response = await fetch(ANKR_MULTICHAIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`ANKR API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as AnkrTokenPriceHistoryResponse;

    if (!data.result?.quotes) {
      throw new Error(`No price history returned for ${contractAddress || 'FLR'}`);
    }

    return data.result.quotes.map((quote) => ({
      timestamp: quote.timestamp,
      blockHeight: quote.blockHeight,
      usdPrice: parseFloat(quote.usdPrice),
    }));
  } catch (error) {
    console.error(`[ANKR-PRICE-HISTORY] Failed to fetch history for ${contractAddress || 'FLR'}:`, error);
    throw error;
  }
}

/**
 * Token address map for Flare ecosystem.
 * Source: LiquiLab token registry.
 */
export const FLARE_TOKEN_ADDRESSES: Record<string, string> = {
  WFLR: '0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d',
  FXRP: '0xAd552A648C74D49E10027AB8a618A3ad4901c5bE',
  'USD₀': '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
  USDT0: '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
  EUSDT: '0x96B41289D90444B8adD57e6F265DB5aE8651DF29',
  APS: '0xfF56Eb5b1a7FAa972291117E5E9565dA29bc808d',
  SFLR: '0x12e605bc104e93B45e1aD99F9e555f659051c2BB',
};

/**
 * Get price by token symbol (convenience wrapper).
 */
export async function getAnkrTokenPriceBySymbol(symbol: string): Promise<number> {
  const address = FLARE_TOKEN_ADDRESSES[symbol.toUpperCase()];
  
  if (!address && symbol.toUpperCase() !== 'FLR') {
    throw new Error(`Unknown token symbol: ${symbol}`);
  }

  return getAnkrTokenPrice(address);
}

