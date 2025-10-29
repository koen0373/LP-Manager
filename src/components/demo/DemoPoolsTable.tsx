'use client';

import React from 'react';
import { PositionsTable, PositionData } from '@/components/PositionsTable';
import { getRangeStatus } from '@/components/pools/PoolRangeIndicator';
import { calcApr24h } from '@/lib/metrics';

interface LivePool {
  provider: string;
  providerSlug: string;
  poolId: string;
  pair: string;
  feeTierBps: number;
  tvlUsd: number;
  fees24hUsd: number;
  incentives24hUsd: number;
  status: 'in' | 'near' | 'out';
  range: {
    min: number;
    max: number;
    current: number;
  };
  apr24h: number;
}

interface LivePoolsResponse {
  ok: boolean;
  diversitySatisfied?: boolean;
  items: LivePool[];
  generatedAt: string;
  placeholder?: boolean;
  error?: string;
  warnings?: string[];
}

function mapLiveToPosition(pool: LivePool): PositionData {
  // Extract token symbols from pair (e.g., "WFLR / USDT0" -> ["WFLR", "USDT0"])
  const [token0Symbol, token1Symbol] = pool.pair.split('/').map((s) => s.trim());
  
  // Estimate accumulated fees (multiply daily by 14 days for display)
  const unclaimedFeesUsd = pool.fees24hUsd * 14;
  const incentivesUsd = pool.incentives24hUsd * 14;
  
  return {
    tokenId: `${pool.providerSlug}-${pool.poolId}`,
    dexName: pool.provider,
    poolId: pool.poolId,
    token0Symbol,
    token1Symbol,
    feeTier: `${(pool.feeTierBps / 100).toFixed(2)}%`,
    feeTierBps: pool.feeTierBps,
    rangeMin: pool.range.min,
    rangeMax: pool.range.max,
    liquidityUsd: pool.tvlUsd,
    liquidityShare: undefined,
    feesUsd: unclaimedFeesUsd,
    incentivesUsd: incentivesUsd,
    incentivesToken: incentivesUsd > 0 ? 'rFLR' : undefined,
    incentivesTokenAmount: incentivesUsd > 0 ? Math.round(incentivesUsd / 0.016) : undefined, // ~$0.016/rFLR
    currentPrice: pool.range.current,
    status: pool.status,
    apr24h: pool.apr24h,
    dailyFeesUsd: pool.fees24hUsd,
    dailyIncentivesUsd: pool.incentives24hUsd,
  };
}

export default function DemoPoolsTable() {
  const [positions, setPositions] = React.useState<PositionData[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [diversityWarning, setDiversityWarning] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/demo/pools-live');
        if (!res.ok) throw new Error('Failed to fetch live demo pools');
        
        const data: LivePoolsResponse = await res.json();
        
        if (!data.ok || data.placeholder) {
          throw new Error(data.error || 'Demo data unavailable');
        }
        
        // Map live pools to position format
        const mapped = data.items.map(mapLiveToPosition);
        setPositions(mapped);
        
        // Handle diversity warnings
        if (!data.diversitySatisfied && data.warnings && data.warnings.length > 0) {
          setDiversityWarning('Live data shown; diversity constraints partially met this minute.');
        } else {
          setDiversityWarning(null);
        }
        
        console.log('[DemoPoolsTable] Loaded', mapped.length, 'live pools');
      } catch (err) {
        console.error('[DemoPoolsTable] Error:', err);
        setError('Demo data is offline right now.');
      }
    }
    void load();
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center">
        <p className="font-ui text-sm text-red-300">{error}</p>
      </div>
    );
  }

  if (!positions) {
    return (
      <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg bg-white/[0.04]" />
        ))}
      </div>
    );
  }

  return (
    <div className="relative">
      {diversityWarning && (
        <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 font-ui text-xs text-amber-200">
          <span className="font-semibold">ℹ</span> {diversityWarning}
        </div>
      )}
      <PositionsTable positions={positions} hideClaimLink />
    </div>
  );
}
