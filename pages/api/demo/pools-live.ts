import type { NextApiRequest, NextApiResponse } from 'next';
import { isAddress } from 'viem';
import path from 'path';
import fs from 'fs';
import { 
  pickCandidateWallets, 
  selectDiversePools, 
  computeAPR24h, 
  TtlCache,
  type LivePool,
  type DiversityResult 
} from '@/lib/demoLiveSelector';
import { getRangeStatus } from '@/components/pools/PoolRangeIndicator';
import type { PositionRow } from '@/types/positions';

interface LivePoolsResponse {
  ok: boolean;
  diversitySatisfied?: boolean;
  items: LivePool[];
  generatedAt: string;
  placeholder?: boolean;
  error?: string;
  warnings?: string[];
}

// 60s TTL cache
const cache = new TtlCache<string, DiversityResult>(60_000);

/**
 * Load seed wallets from data/demo_wallets.json
 */
function loadSeedWallets(): string[] {
  try {
    const dataPath = path.join(process.cwd(), 'data', 'demo_wallets.json');
    const content = fs.readFileSync(dataPath, 'utf-8');
    const wallets = JSON.parse(content) as string[];
    
    // Validate and filter
    return wallets.filter((addr) => {
      if (typeof addr !== 'string') return false;
      try {
        return isAddress(addr);
      } catch {
        return false;
      }
    });
  } catch (error) {
    console.error('[API demo/pools-live] Failed to load seed wallets:', error);
    return [];
  }
}

/**
 * Fetch positions for a wallet address (internal API call)
 */
async function fetchWalletPositions(address: string): Promise<PositionRow[]> {
  try {
    const url = `http://localhost:${process.env.PORT || 3000}/api/positions?address=${address}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // 10s timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`[demo/pools-live] Positions API returned ${response.status} for ${address}`);
      return [];
    }

    const positions = await response.json() as PositionRow[];
    return Array.isArray(positions) ? positions : [];
  } catch (error) {
    console.error(`[demo/pools-live] Failed to fetch positions for ${address}:`, error);
    return [];
  }
}

/**
 * Map PositionRow to LivePool format
 */
function mapPositionToLivePool(position: PositionRow): LivePool | null {
  try {
    // Ensure we have required fields
    if (!position.poolAddress || !position.provider || !position.id) {
      return null;
    }

    // Compute current price from position data
    let currentPrice = 0;
    if (position.lowerPrice && position.upperPrice && !isNaN(position.lowerPrice) && !isNaN(position.upperPrice)) {
      // If we have tick data, derive price from that
      currentPrice = (position.lowerPrice + position.upperPrice) / 2;
    }

    // Extract range bounds
    const rangeMin = position.lowerPrice || 0;
    const rangeMax = position.upperPrice || 0;

    // Determine status
    const status = getRangeStatus(currentPrice, rangeMin, rangeMax);

    // Extract provider slug
    let providerSlug = 'enosys';
    if (position.providerSlug) {
      providerSlug = position.providerSlug.toLowerCase().replace(/[^a-z0-9-]/g, '');
    } else if (position.provider) {
      const provider = position.provider.toLowerCase();
      if (provider.includes('blaze')) providerSlug = 'blazeswap';
      else if (provider.includes('spark')) providerSlug = 'sparkdex';
      else if (provider.includes('enos')) providerSlug = 'enosys';
    }

    // Estimate 24h fees and incentives
    // For now, use accumulated fees divided by 14 days as proxy for daily rate
    const fees24hUsd = (position.unclaimedFeesUsd || 0) / 14;
    const incentives24hUsd = (position.rflrRewardsUsd || 0) / 14;

    // Compute APR
    const apr24h = computeAPR24h({
      fees24hUsd,
      incentives24hUsd,
      tvlUsd: position.tvlUsd,
    });

    return {
      provider: position.provider,
      providerSlug,
      poolId: position.id,
      pair: position.pairLabel || `${position.token0.symbol}/${position.token1.symbol}`,
      feeTierBps: position.feeTierBps || 0,
      tvlUsd: position.tvlUsd,
      fees24hUsd,
      incentives24hUsd,
      status,
      range: {
        min: rangeMin,
        max: rangeMax,
        current: currentPrice,
      },
      apr24h,
    };
  } catch (error) {
    console.error('[demo/pools-live] Failed to map position:', error);
    return null;
  }
}

export default async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<LivePoolsResponse>
) {
  const startTime = Date.now();
  const cacheKey = 'live-pools-v1';

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    const duration = Date.now() - startTime;
    console.log(`[API demo/pools-live] Cache hit - ${cached.pools.length} pools - ${duration}ms`);
    
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    res.status(200).json({
      ok: true,
      diversitySatisfied: cached.diversitySatisfied,
      items: cached.pools,
      generatedAt: new Date().toISOString(),
      warnings: cached.warnings,
    });
    return;
  }

  try {
    // Load seed wallets
    const seedWallets = loadSeedWallets();
    
    if (seedWallets.length === 0) {
      console.error('[API demo/pools-live] No seed wallets available');
      res.status(200).json({
        ok: true,
        items: [],
        generatedAt: new Date().toISOString(),
        placeholder: true,
        error: 'Seed wallet list is empty',
      });
      return;
    }

    console.log(`[API demo/pools-live] Loaded ${seedWallets.length} seed wallets`);

    // Pick 3-5 candidate wallets using stable shuffle
    const candidates = pickCandidateWallets(seedWallets, 5);
    console.log(`[API demo/pools-live] Selected ${candidates.length} candidate wallets`);

    // Fetch positions from all candidates in parallel
    const positionsByWallet = await Promise.all(
      candidates.map(async (wallet) => {
        const positions = await fetchWalletPositions(wallet);
        return { wallet, positions };
      })
    );

    // Collect all unique pools
    const allPools: LivePool[] = [];
    const seen = new Set<string>();

    for (const { wallet, positions } of positionsByWallet) {
      console.log(`[API demo/pools-live] Wallet ${wallet}: ${positions.length} positions`);
      
      for (const position of positions) {
        // Skip inactive positions
        if (position.tvlUsd < 10) continue;

        const pool = mapPositionToLivePool(position);
        if (!pool) continue;

        // Deduplicate by pool address
        const key = `${pool.providerSlug}:${pool.poolId}`;
        if (seen.has(key)) continue;
        
        seen.add(key);
        allPools.push(pool);
      }
    }

    console.log(`[API demo/pools-live] Collected ${allPools.length} unique pools`);

    // Apply diversity selection
    const result = selectDiversePools(allPools, 9);

    // Cache result
    cache.set(cacheKey, result);

    const duration = Date.now() - startTime;
    console.log(
      `[API demo/pools-live] Success - ${result.pools.length} pools - ` +
      `diversity: ${result.diversitySatisfied} - ${duration}ms`
    );

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    res.status(200).json({
      ok: true,
      diversitySatisfied: result.diversitySatisfied,
      items: result.pools,
      generatedAt: new Date().toISOString(),
      warnings: result.warnings,
    });
  } catch (error) {
    console.error('[API demo/pools-live] Error:', error);
    
    // Never return 500; always return valid JSON
    res.status(200).json({
      ok: true,
      items: [],
      generatedAt: new Date().toISOString(),
      placeholder: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


