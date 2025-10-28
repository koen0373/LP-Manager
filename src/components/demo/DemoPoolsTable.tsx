'use client';

import React from 'react';
import { PositionsTable, PositionData } from '@/components/PositionsTable';
import { RangeStatus, getRangeStatus } from '@/components/pools/PoolRangeIndicator';

type DemoPoolRow = {
  providerSlug: string;
  providerName: string;
  id: string;
  token0: string;
  token1: string;
  token0Icon?: string | null;
  token1Icon?: string | null;
  feeBps: number;
  rangeMin: number;
  rangeMax: number;
  currentPrice?: number;
  tvlUsd: number;
  unclaimedFeesUsd: number;
  dailyFeesUsd?: number;
  incentivesUsd: number;
  status: 'in' | 'near' | 'out';
  apyPct?: number;
};

function calculateAPY24h(dailyFeesUsd: number, tvlUsd: number): number {
  // APY = (fees collected in 24h / TVL) × 365 × 100
  if (tvlUsd <= 0) return 0;
  const dailyYield = dailyFeesUsd / tvlUsd;
  const apy = dailyYield * 365 * 100;
  return Math.max(0, Math.min(999, apy)); // Cap between 0-999%
}

function mapDemoToPosition(row: DemoPoolRow): PositionData {
  // Use live current price from API, fallback to midpoint if missing
  const currentPrice = row.currentPrice ?? (row.rangeMin + row.rangeMax) / 2;
  
  // Calculate correct status based on actual live price position
  const calculatedStatus = getRangeStatus(currentPrice, row.rangeMin, row.rangeMax);
  
  // Calculate real APY based on DAILY fees (not total unclaimed) and TVL
  const calculatedAPY = calculateAPY24h(row.dailyFeesUsd ?? 0, row.tvlUsd);
  
  return {
    tokenId: `${row.providerSlug}-${row.id}`,
    dexName: row.providerName,
    poolId: row.id,
    token0Symbol: row.token0,
    token1Symbol: row.token1,
    token0Icon: row.token0Icon || undefined,
    token1Icon: row.token1Icon || undefined,
    feeTier: `${(row.feeBps / 100).toFixed(2)}%`,
    rangeMin: row.rangeMin,
    rangeMax: row.rangeMax,
    liquidityUsd: row.tvlUsd,
    liquidityShare: undefined,
    feesUsd: row.unclaimedFeesUsd,
    incentivesUsd: row.incentivesUsd,
    incentivesToken: row.incentivesUsd > 0 ? 'rFLR' : undefined,
    currentPrice: currentPrice,
    status: calculatedStatus, // Status matches live price position
    apy24h: calculatedAPY, // Real calculated APY
  };
}

export default function DemoPoolsTable() {
  const [positions, setPositions] = React.useState<PositionData[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/demo/pools');
        if (!res.ok) throw new Error('Failed to fetch demo pools');
        const data: DemoPoolRow[] = await res.json();
        const mapped = data.map(mapDemoToPosition);
        setPositions(mapped);
      } catch {
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

  return <PositionsTable positions={positions} />;
}

