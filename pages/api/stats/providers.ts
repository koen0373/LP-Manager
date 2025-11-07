import type { NextApiRequest, NextApiResponse } from 'next';
import { getTVLWithFallback } from '@/services/tvlService';
import { addSnapshot, calculatePoolGrowth } from '@/services/poolCountHistory';

type ProviderStats = {
  name: string;
  v3Pools: number;
  poolsChange24h?: number;
  poolsChange7d?: number;
  poolsChange30d?: number;
  tvl: number;
  status: 'operational' | 'degraded' | 'offline';
};

type StatsResponse = {
  providers: ProviderStats[];
  totals: {
    v3Pools: number;
    totalTVL: number;
  };
  timestamp: string;
};

// Simple in-memory cache (5 minutes)
let cachedStats: { data: StatsResponse; expires: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchProviderStats(): Promise<StatsResponse> {
  // Check cache first
  if (cachedStats && Date.now() < cachedStats.expires) {
    return cachedStats.data;
  }

  const providers: ProviderStats[] = [];
  
  // Fetch V3 pool counts and TVL data in parallel
  const [healthResponse, tvlData] = await Promise.allSettled([
    fetch(`http://localhost:3000/api/health`),
    getTVLWithFallback(),
  ]);

  let health = null;
  if (healthResponse.status === 'fulfilled' && healthResponse.value.ok) {
    health = await healthResponse.value.json();
    console.log('[stats/providers] Health data:', health);
  }

  let tvls = { blazeswap: 0, enosys: 0, sparkdex: 0, total: 0 };
  if (tvlData.status === 'fulfilled') {
    tvls = tvlData.value;
    console.log('[stats/providers] TVL data from DefiLlama:', tvls);
  }

  // Build provider stats (V3 only - simplified, no wallet counts or growth %)
  try {
    if (health) {
      const enosysCount = health.providers?.enosys?.totalPositions || 0;
      const sparkdexCount = health.providers?.sparkdex?.totalPositions || 0;
      
      // Calculate pool count growth rates
      const poolGrowth = await calculatePoolGrowth(enosysCount, sparkdexCount);
      
      // Save current snapshot for future growth calculations
      if (enosysCount > 0 || sparkdexCount > 0) {
        await addSnapshot(enosysCount, sparkdexCount);
      }
      
      // Enosys (V3)
      if (health.providers?.enosys) {
        providers.push({
          name: 'Enosys',
          v3Pools: enosysCount,
          poolsChange24h: poolGrowth.enosys.change24h,
          poolsChange7d: poolGrowth.enosys.change7d,
          poolsChange30d: poolGrowth.enosys.change30d,
          tvl: tvls.enosys,
          status: health.providers.enosys.ready ? 'operational' : 'degraded',
        });
      }
      
      // SparkDEX (V3)
      if (health.providers?.sparkdex) {
        providers.push({
          name: 'SparkDEX',
          v3Pools: sparkdexCount,
          poolsChange24h: poolGrowth.sparkdex.change24h,
          poolsChange7d: poolGrowth.sparkdex.change7d,
          poolsChange30d: poolGrowth.sparkdex.change30d,
          tvl: tvls.sparkdex,
          status: health.providers.sparkdex.ready ? 'operational' : 'degraded',
        });
      }
    }
  } catch (error) {
    console.error('[stats/providers] Failed to build provider stats:', error);
  }

  // Fallback if no providers were added
  if (providers.length === 0) {
    providers.push(
      {
        name: 'Enosys',
        v3Pools: 0,
        poolsChange24h: null,
        poolsChange7d: null,
        poolsChange30d: null,
        tvl: tvls.enosys,
        status: 'degraded',
      },
      {
        name: 'SparkDEX',
        v3Pools: 0,
        poolsChange24h: null,
        poolsChange7d: null,
        poolsChange30d: null,
        tvl: tvls.sparkdex,
        status: 'degraded',
      }
    );
  }

  // Sort providers by TVL (highest first)
  providers.sort((a, b) => b.tvl - a.tvl);

  // Calculate totals
  const totals = providers.reduce(
    (acc, provider) => ({
      v3Pools: acc.v3Pools + provider.v3Pools,
      totalTVL: acc.totalTVL + provider.tvl,
    }),
    { v3Pools: 0, totalTVL: 0 }
  );

  const response: StatsResponse = {
    providers,
    totals,
    timestamp: new Date().toISOString(),
  };

  console.log('[stats/providers] Response:', JSON.stringify(response, null, 2));

  // Cache the result
  cachedStats = {
    data: response,
    expires: Date.now() + CACHE_TTL,
  };

  return response;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StatsResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const stats = await fetchProviderStats();
    
    // Set cache headers
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    
    return res.status(200).json(stats);
  } catch (error) {
    console.error('[stats/providers] Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
}
