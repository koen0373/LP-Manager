/**
 * TVL Service - Fetch Total Value Locked for Flare DEXes
 * 
 * Uses DefiLlama API for accurate TVL data across Flare DEXes.
 * Docs: https://defillama.com/docs/api
 */

interface TVLResponse {
  enosys: number;
  sparkdex: number;
  blazeswap: number;
  total: number;
}

interface DefiLlamaProtocol {
  id: string;
  name: string;
  symbol: string;
  tvl: number | Array<{ date: number; totalLiquidityUSD: number }>;
  chainTvls: {
    [chain: string]: number | Array<{ date: number; totalLiquidityUSD: number }>;
  };
}

// DefiLlama protocol slugs for Flare DEXes
const DEFILLAMA_PROTOCOLS = {
  enosys: 'enosys',
  sparkdex: 'sparkdex',
  blazeswap: 'blazeswap', // V2
} as const;

/**
 * Fetch TVL for a specific protocol from DefiLlama
 */
async function fetchProtocolTVL(slug: string): Promise<number> {
  try {
    const response = await fetch(`https://api.llama.fi/protocol/${slug}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[TVL] DefiLlama API error for ${slug}: ${response.status}`);
      return 0;
    }

    const data = await response.json() as DefiLlamaProtocol;
    
    // Get TVL specifically for Flare chain
    // chainTvls can have both numbers and arrays, we need the number
    let flareTVL = 0;
    if (data.chainTvls) {
      const flareValue = data.chainTvls.Flare || data.chainTvls.flare;
      if (typeof flareValue === 'number') {
        flareTVL = flareValue;
      }
    }
    
    // Fallback to total TVL if Flare-specific not available
    // Note: data.tvl can be either a number or an array of historical data
    let fallbackTVL = 0;
    if (typeof data.tvl === 'number') {
      fallbackTVL = data.tvl;
    } else if (Array.isArray(data.tvl) && data.tvl.length > 0) {
      // Use the most recent TVL from the array
      fallbackTVL = data.tvl[data.tvl.length - 1].totalLiquidityUSD;
    }
    
    const tvl = flareTVL > 0 ? flareTVL : fallbackTVL;
    
    console.log(`[TVL] ${slug}: $${tvl.toLocaleString()}`);
    
    return tvl;
  } catch (error) {
    console.error(`[TVL] Failed to fetch ${slug} from DefiLlama:`, error);
    return 0;
  }
}

/**
 * Get TVL for all Flare DEXes from DefiLlama
 */
export async function getAllDexTVLs(): Promise<TVLResponse> {
  console.log('[TVL] Fetching TVL data from DefiLlama...');
  
  // Fetch all protocols in parallel
  const [enosysTVL, sparkdexTVL, blazeswapTVL] = await Promise.all([
    fetchProtocolTVL(DEFILLAMA_PROTOCOLS.enosys),
    fetchProtocolTVL(DEFILLAMA_PROTOCOLS.sparkdex),
    fetchProtocolTVL(DEFILLAMA_PROTOCOLS.blazeswap),
  ]);

  const tvls: TVLResponse = {
    enosys: enosysTVL,
    sparkdex: sparkdexTVL,
    blazeswap: blazeswapTVL,
    total: enosysTVL + sparkdexTVL + blazeswapTVL,
  };

  console.log('[TVL] Total TVL:', {
    enosys: `$${tvls.enosys.toLocaleString()}`,
    sparkdex: `$${tvls.sparkdex.toLocaleString()}`,
    blazeswap: `$${tvls.blazeswap.toLocaleString()}`,
    total: `$${tvls.total.toLocaleString()}`,
  });

  return tvls;
}

/**
 * Fallback: Use mock data if DefiLlama is unavailable
 * 
 * This provides reasonable estimates based on typical Flare DEX sizes
 */
export function getMockTVLs(): TVLResponse {
  return {
    enosys: 2_450_000, // ~$2.5M
    sparkdex: 1_820_000, // ~$1.8M
    blazeswap: 850_000, // ~$850K
    total: 5_120_000,
  };
}

/**
 * Get TVL with automatic fallback to mock data
 */
export async function getTVLWithFallback(): Promise<TVLResponse> {
  try {
    const tvls = await getAllDexTVLs();
    
    // If all TVLs are 0, use mock data
    if (tvls.total === 0) {
      console.warn('[TVL] All TVLs are 0, using mock data');
      return getMockTVLs();
    }
    
    return tvls;
  } catch (error) {
    console.error('[TVL] Failed to fetch TVL data, using mock:', error);
    return getMockTVLs();
  }
}

