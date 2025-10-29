import type { NextApiRequest, NextApiResponse } from 'next';
import { getPositionById } from '@/services/pmFallback';
import { getRangeStatus } from '@/components/pools/PoolRangeIndicator';
import type { DemoPool, ProviderSlug } from '@/lib/demo/types';
import { classifyStrategy } from '@/lib/demo/strategy';

interface PoolLiveResponse {
  ok: boolean;
  pool?: DemoPool;
  error?: string;
}

/**
 * Fetch live pool details by provider + marketId
 * 
 * Query params:
 * - provider: enosys-v3 | blazeswap-v3 | sparkdex-v2
 * - marketId: pool identifier (e.g., "22003")
 * 
 * Returns normalized DemoPool with live metrics
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PoolLiveResponse>
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const { provider, marketId } = req.query;

  if (!provider || typeof provider !== 'string') {
    return res.status(400).json({ ok: false, error: 'Provider is required' });
  }

  if (!marketId || typeof marketId !== 'string') {
    return res.status(400).json({ ok: false, error: 'Market ID is required' });
  }

  const providerSlug = provider as ProviderSlug;

  try {
    // Fetch position by ID (marketId is the token ID for Enosys positions)
    const position = await getPositionById(marketId);

    if (!position) {
      return res.status(200).json({
        ok: true,
        pool: {
          providerSlug,
          marketId,
          pairLabel: 'Unknown',
          feeTierBps: 0,
          tvlUsd: 0,
          dailyFeesUsd: 0,
          incentivesUsd: 0,
          status: 'out',
          range: { min: 0, max: 0, current: 0 },
          apr24hPct: 0,
          unavailable: true,
        },
      });
    }

    // Extract metrics
    const tvlUsd = position.tvlUsd || 0;
    const unclaimedFeesUsd = position.unclaimedFeesUsd || 0;
    const rflrRewardsUsd = position.rflrRewardsUsd || 0;

    // Estimate daily rates (divide accumulated by 14 days as proxy)
    const dailyFeesUsd = unclaimedFeesUsd / 14;
    const dailyIncentivesUsd = rflrRewardsUsd / 14;

    // Calculate APR (24h)
    const apr24hPct = tvlUsd > 0 
      ? ((dailyFeesUsd + dailyIncentivesUsd) / tvlUsd) * 365 * 100
      : 0;

    // Extract range
    const rangeMin = position.lowerPrice || 0;
    const rangeMax = position.upperPrice || 0;
    
    // Compute current price (midpoint for now; can be improved)
    let currentPrice = 0;
    if (rangeMin > 0 && rangeMax > 0) {
      currentPrice = (rangeMin + rangeMax) / 2;
      // TODO: Fetch actual current price from pool state
    }

    // Determine status
    const status = getRangeStatus(currentPrice, rangeMin, rangeMax);

    // Classify strategy
    const strategy = classifyStrategy(rangeMin, rangeMax);

    const pool: DemoPool = {
      providerSlug,
      marketId,
      pairLabel: position.pairLabel || `${position.token0.symbol}/${position.token1.symbol}`,
      feeTierBps: position.feeTierBps || 0,
      tvlUsd,
      dailyFeesUsd,
      incentivesUsd: dailyIncentivesUsd * 14, // Show accumulated
      status,
      range: {
        min: rangeMin,
        max: rangeMax,
        current: currentPrice,
      },
      apr24hPct,
      strategyLabel: strategy.label,
      strategyWidthPct: strategy.widthPct,
    };

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    res.status(200).json({ ok: true, pool });
  } catch (error) {
    console.error(`[API demo/pool-live] Error fetching ${provider}/${marketId}:`, error);
    res.status(200).json({
      ok: true,
      pool: {
        providerSlug,
        marketId,
        pairLabel: 'Error',
        feeTierBps: 0,
        tvlUsd: 0,
        dailyFeesUsd: 0,
        incentivesUsd: 0,
        status: 'out',
        range: { min: 0, max: 0, current: 0 },
        apr24hPct: 0,
        unavailable: true,
      },
    });
  }
}

