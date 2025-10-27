'use client';

import React from 'react';
import { useRouter } from 'next/router';

import type { PositionRow } from '@/types/positions';
import PositionsTable, { PositionData } from '@/components/PositionsTable';
import { getRangeStatus, RangeStatus } from '@/components/pools/PoolRangeIndicator';

interface PoolsOverviewProps {
  positions: PositionRow[];
  title?: string;
  headerNote?: string;
  emptyMessage?: string;
}

const percentFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatFeeTier(feeTierBps: number): string {
  const percent = feeTierBps / 100;
  return `${percentFormatter.format(percent)}%`;
}

function toCurrency(value: number | undefined | null): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 0;
  }
  return value;
}

function buildPositionData(position: PositionRow): PositionData {
  const routeId = position.onchainId ?? position.id;
  const providerName = (position.provider ?? position.providerSlug ?? 'Enosys v3').toUpperCase();
  const poolDisplayId = position.displayId ?? (position.onchainId ? `#${position.onchainId}` : `#${position.id}`);

  const currentPrice = typeof position.price0Usd === 'number' ? position.price0Usd : null;
  const lowerPrice = typeof position.lowerPrice === 'number' ? position.lowerPrice : null;
  const upperPrice = typeof position.upperPrice === 'number' ? position.upperPrice : null;

  const status: RangeStatus = getRangeStatus(currentPrice, lowerPrice, upperPrice);

  const incentivesUsd = position.rflrRewardsUsd || position.rewardsUsd || 0;
  const incentivesToken = position.rflrAmount
    ? `${position.rflrAmount.toLocaleString('en-US', { maximumFractionDigits: 2 })} RFLR`
    : undefined;

  return {
    tokenId: routeId,
    dexName: providerName,
    poolId: poolDisplayId,
    token0Symbol: position.token0.symbol,
    token1Symbol: position.token1.symbol,
    token0Icon: undefined,
    token1Icon: undefined,
    feeTier: formatFeeTier(position.feeTierBps),
    rangeMin: lowerPrice ?? undefined,
    rangeMax: upperPrice ?? undefined,
    liquidityUsd: toCurrency(position.tvlUsd),
    liquidityShare: position.poolSharePct,
    feesUsd: toCurrency(position.unclaimedFeesUsd),
    incentivesUsd: toCurrency(incentivesUsd),
    incentivesToken,
    currentPrice: currentPrice ?? undefined,
    status,
  };
}

export default function PoolsOverview({ positions, title, headerNote, emptyMessage }: PoolsOverviewProps) {
  const router = useRouter();

  const tableData = React.useMemo(() => positions.map(buildPositionData), [positions]);

  const handleRowClick = React.useCallback(
    (tokenId: string) => {
      router.push(`/pool/${tokenId}`);
    },
    [router],
  );

  if (!positions.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[rgba(10,15,26,0.6)] p-6 text-sm text-white/70">
        {emptyMessage ?? 'No pools available yet.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {(title || headerNote) && (
        <div className="flex flex-col gap-2">
          {title && <h3 className="font-brand text-xl font-semibold text-white">{title}</h3>}
          {headerNote && <p className="font-ui text-sm text-white/60">{headerNote}</p>}
        </div>
      )}

      <PositionsTable positions={tableData} onRowClick={handleRowClick} />
    </div>
  );
}
