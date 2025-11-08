/**
 * DefiLlama API Service
 * Free TVL data for DEX protocols
 */

// DefiLlama protocol slugs for Flare DEXes
const PROTOCOL_SLUGS = {
  blazeswap: 'blazeswap',
  enosys: 'enosys',
  sparkdex: 'sparkdex',
} as const;

const DEFILLAMA_BASE_URL = 'https://api.llama.fi';

// Cache TVL data for 5 minutes
const tvlCache = new Map<string, { tvl: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

type ProtocolTVL = {
  tvl?: number;
  chainTvls?: {
    Flare?: number;
    [key: string]: number | undefined;
  };
  currentChainTvls?: {
    Flare?: number;
    [key: string]: number | undefined;
  };
};

/**
 * Get TVL for a specific protocol from DefiLlama
 */
export async function getProtocolTVL(protocolSlug: string): Promise<number> {
  // Check cache first
  const cached = tvlCache.get(protocolSlug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[DefiLlama] Using cached TVL for ${protocolSlug}: $${cached.tvl.toFixed(0)}`);
    return cached.tvl;
  }

  try {
    const response = await fetch(`${DEFILLAMA_BASE_URL}/protocol/${protocolSlug}`, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[DefiLlama] Failed to fetch TVL for ${protocolSlug}: ${response.status}`);
      return 0;
    }

    const data = await response.json() as ProtocolTVL;
    
    // Try multiple locations for Flare TVL
    let tvl = 0;
    
    // 1. Try currentChainTvls.Flare (most recent)
    if (data.currentChainTvls?.Flare && data.currentChainTvls.Flare > 0) {
      tvl = data.currentChainTvls.Flare;
      console.log(`[DefiLlama] ${protocolSlug} currentChainTvls.Flare: $${tvl.toFixed(0)}`);
    }
    // 2. Fallback to chainTvls.Flare
    else if (data.chainTvls?.Flare && data.chainTvls.Flare > 0) {
      tvl = data.chainTvls.Flare;
      console.log(`[DefiLlama] ${protocolSlug} chainTvls.Flare: $${tvl.toFixed(0)}`);
    }
    // 3. Fallback to total TVL (all chains)
    else if (data.tvl && data.tvl > 0) {
      tvl = data.tvl;
      console.log(`[DefiLlama] ${protocolSlug} total TVL: $${tvl.toFixed(0)}`);
    } else {
      console.warn(`[DefiLlama] No TVL data found for ${protocolSlug}`);
    }

    // Cache the result
    tvlCache.set(protocolSlug, { tvl, timestamp: Date.now() });

    return tvl;
  } catch (error) {
    console.error(`[DefiLlama] Error fetching TVL for ${protocolSlug}:`, error);
    return 0;
  }
}

/**
 * Get TVL for all supported DEXes on Flare
 */
export async function getAllDexTVLs(): Promise<{
  blazeswap: number;
  enosys: number;
  sparkdex: number;
  total: number;
}> {
  const [blazeswap, enosys, sparkdex] = await Promise.all([
    getProtocolTVL(PROTOCOL_SLUGS.blazeswap),
    getProtocolTVL(PROTOCOL_SLUGS.enosys),
    getProtocolTVL(PROTOCOL_SLUGS.sparkdex),
  ]);

  return {
    blazeswap,
    enosys,
    sparkdex,
    total: blazeswap + enosys + sparkdex,
  };
}

/**
 * Clear TVL cache
 */
export function clearTVLCache(): void {
  tvlCache.clear();
}

