'use client';

import React from 'react';
import Image from 'next/image';

import { TokenIcon } from './TokenIcon';
import RangeBand from '@/components/pools/PoolRangeIndicator';
import type { RangeStatus } from '@/components/pools/PoolRangeIndicator';
import { formatUsd } from '@/utils/format';
import { buildClaimLink } from '@/lib/poolDeepLinks';
import { calcApr24h, formatFeeTier, formatCompactNumber } from '@/lib/metrics';
import type { PositionRow as CanonicalPositionRow } from '@/lib/positions/types';

export type PositionData = CanonicalPositionRow & {
  tokenId?: string;
  poolId?: string;
  dexName?: string;
  rangeMin?: number;
  rangeMax?: number;
  currentPrice?: number;
  token0Icon?: string;
  token1Icon?: string;
  incentivesToken?: string;
  incentivesTokenAmount?: number;
  liquidityShare?: number;
  apr24h?: number;
  dailyFeesUsd?: number;
  dailyIncentivesUsd?: number;
  isDemo?: boolean;
  displayId?: string;
};

interface PositionsTableProps {
  positions: PositionData[];
  onRowClick?: (tokenId: string) => void;
  hideClaimLink?: boolean;
}

function poolKeyFromPosition(position: PositionData, index: number): string {
  return (
    position.tokenId ??
    position.poolId ??
    position.marketId ??
    `${position.provider}-${index}`
  );
}

function providerLabel(position: PositionData): string {
  if (position.dexName) return position.dexName;
  if (position.provider) return position.provider.toUpperCase();
  return 'UNKNOWN';
}

function feeTierLabel(position: PositionData): string {
  if (typeof position.poolFeeBps === 'number' && Number.isFinite(position.poolFeeBps)) {
    return formatFeeTier(position.poolFeeBps);
  }
  if (position.displayId && position.displayId.includes('%')) {
    return position.displayId;
  }
  return '—';
}

function getSymbol(side: PositionData['token0'] | PositionData['token1']): string {
  if (!side) return 'TOKEN';
  return side.symbol ?? 'TOKEN';
}

function liquidityUsd(position: PositionData): number {
  return typeof position.tvlUsd === 'number' ? position.tvlUsd : 0;
}

function feesUsd(position: PositionData): number {
  return typeof position.unclaimedFeesUsd === 'number' ? position.unclaimedFeesUsd : 0;
}

function incentivesUsd(position: PositionData): number {
  return typeof position.incentivesUsd === 'number' ? position.incentivesUsd : 0;
}

function computeApr(position: PositionData, tvl: number, fees: number, incentives: number): number {
  if (typeof position.apr24h === 'number' && Number.isFinite(position.apr24h)) {
    return position.apr24h;
  }

  const dailyFees = position.dailyFeesUsd ?? (fees > 0 ? fees / 14 : 0);
  const dailyIncentives = position.dailyIncentivesUsd ?? (incentives > 0 ? incentives / 14 : 0);

  return calcApr24h({
    tvlUsd: tvl,
    dailyFeesUsd: dailyFees,
    dailyIncentivesUsd: dailyIncentives,
  });
}

function statusToRangeStatus(status: PositionData['status']): RangeStatus {
  if (status === 'in' || status === 'near' || status === 'out') {
    return status;
  }
  return 'out';
}

function maybeNumber(value: number | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function shouldRenderClaimLink(position: PositionData): boolean {
  return Boolean(position.provider && (position.poolId ?? position.marketId));
}

export function PositionsTable({ positions, onRowClick, hideClaimLink = false }: PositionsTableProps) {
  React.useEffect(() => {
    const handleMouseEnter = (event: MouseEvent) => {
      const target = event.currentTarget as HTMLElement;
      const poolId = target.getAttribute('data-pool-id');
      if (!poolId) return;
      document.querySelectorAll(`[data-pool-id="${poolId}"]`).forEach((node) => {
        node.classList.add('pool-hover');
      });
    };

    const handleMouseLeave = (event: MouseEvent) => {
      const target = event.currentTarget as HTMLElement;
      const poolId = target.getAttribute('data-pool-id');
      if (!poolId) return;
      document.querySelectorAll(`[data-pool-id="${poolId}"]`).forEach((node) => {
        node.classList.remove('pool-hover');
      });
    };

    const rows = document.querySelectorAll('[data-pool-id]');
    rows.forEach((row) => {
      row.addEventListener('mouseenter', handleMouseEnter as EventListener);
      row.addEventListener('mouseleave', handleMouseLeave as EventListener);
    });

    return () => {
      rows.forEach((row) => {
        row.removeEventListener('mouseenter', handleMouseEnter as EventListener);
        row.removeEventListener('mouseleave', handleMouseLeave as EventListener);
      });
    };
  }, [positions]);

  if (positions.length === 0) {
    return (
      <div className="rounded-lg bg-[#0A0F1A] p-8 text-center">
        <p className="font-ui text-[#9CA3AF]">No positions found</p>
      </div>
    );
  }

  return (
    <section
      className="pool-table PoolTableRoot w-full overflow-x-auto rounded-lg"
      data-ll-ui="v2025-10"
      style={{
        background: 'linear-gradient(180deg, rgba(10, 15, 26, 0.75) 0%, rgba(10, 15, 26, 0.92) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div role="table" className="hidden font-ui text-white lg:block">
        <div
          role="row"
          className="ll-row ll-grid items-end pb-4 uppercase tracking-[0.18em] text-[10px] text-[#9CA3AF]/50"
        >
          <div role="columnheader" className="px-6">Pool</div>
          <div role="columnheader" className="px-6">Liquidity</div>
          <div role="columnheader" className="px-6">Unclaimed fees</div>
          <div role="columnheader" className="px-6">Incentives</div>
          <div role="columnheader" className="px-6 text-right">24h APR</div>
        </div>

        <div role="rowgroup">
          {positions.map((position, index) => {
            const poolKey = poolKeyFromPosition(position, index);
            const dex = providerLabel(position);
            const tvl = liquidityUsd(position);
            const fees = feesUsd(position);
            const incentives = incentivesUsd(position);
            const apr = computeApr(position, tvl, fees, incentives);
            const rowStatus = statusToRangeStatus(position.status);
            const rangeMin = maybeNumber(position.rangeMin);
            const rangeMax = maybeNumber(position.rangeMax);
            const currentPrice = maybeNumber(position.currentPrice);
            const claimDex = position.dexName ?? position.provider;
            const claimPool = position.poolId ?? position.marketId ?? position.tokenId;

            return (
              <React.Fragment key={poolKey}>
                <div
                  role="row"
                  className="ll-row ll-grid cursor-pointer items-end pt-4 transition-colors"
                  onClick={() => onRowClick?.(poolKey)}
                  data-pool-id={poolKey}
                >
                  <div role="cell" className="flex flex-col justify-center px-6">
                    <div className="flex items-center gap-2.5 whitespace-nowrap">
                      <div className="flex items-center -space-x-2">
                        {position.token0Icon ? (
                          <Image
                            src={position.token0Icon}
                            alt={getSymbol(position.token0)}
                            width={24}
                            height={24}
                            className="rounded-full border border-[rgba(255,255,255,0.1)]"
                          />
                        ) : (
                          <TokenIcon symbol={getSymbol(position.token0)} size={24} />
                        )}
                        {position.token1Icon ? (
                          <Image
                            src={position.token1Icon}
                            alt={getSymbol(position.token1)}
                            width={24}
                            height={24}
                            className="rounded-full border border-[rgba(255,255,255,0.1)]"
                          />
                        ) : (
                          <TokenIcon symbol={getSymbol(position.token1)} size={24} />
                        )}
                      </div>
                      <span className="text-[15px] font-semibold leading-none text-white">
                        {getSymbol(position.token0)} / {getSymbol(position.token1)}
                      </span>
                    </div>
                    <div className="ll-specifics-line mt-1 flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#9CA3AF]/50">
                      <span>{dex}</span>
                      <span className="text-white/15">•</span>
                      <span>{position.displayId ?? `#${position.poolId ?? position.marketId ?? poolKey}`}</span>
                      <span className="text-white/15">•</span>
                      <span className="font-semibold">{feeTierLabel(position)}</span>
                    </div>
                  </div>

                  <div role="cell" className="flex items-center px-6">
                    <span className="tnum text-[15px] font-semibold leading-none text-white">
                      {formatUsd(tvl)}
                    </span>
                  </div>

                  <div role="cell" className="flex items-center px-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="tnum text-[15px] font-semibold leading-none text-white">
                        {formatUsd(fees)}
                      </span>
                      {!hideClaimLink && shouldRenderClaimLink(position) && claimDex && claimPool && (
                        <a
                          href={buildClaimLink(claimDex, String(claimPool))}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-left text-[9px] font-semibold text-[#3B82F6] transition hover:text-[#60A5FA] hover:underline"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          Claim →
                        </a>
                      )}
                    </div>
                  </div>

                  <div role="cell" className="flex items-center px-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="tnum text-[15px] font-semibold leading-none text-white">
                        {formatUsd(incentives)}
                      </span>
                      {position.incentivesToken && position.incentivesTokenAmount && position.incentivesTokenAmount > 0 && (
                        <span className="tnum text-[9px] text-[#9CA3AF]/60">
                          {formatCompactNumber(position.incentivesTokenAmount)} {position.incentivesToken}
                        </span>
                      )}
                    </div>
                  </div>

                  <div role="cell" className="flex items-center justify-end px-6">
                    <span
                      className="tnum text-[15px] font-semibold leading-none text-white"
                      aria-label={`24-hour APR ${apr.toFixed(1)} percent`}
                    >
                      {Number.isFinite(apr) ? `${Math.min(apr, 999).toFixed(1)}%` : '—'}
                    </span>
                  </div>
                </div>

                <div
                  role="row"
                  className="ll-row ll-grid cursor-pointer pb-4 transition-colors"
                  onClick={() => onRowClick?.(poolKey)}
                  data-pool-id={poolKey}
                >
                  <div role="cell" className="px-6" aria-hidden="true" />

                  <div
                    role="cell"
                    className="flex items-center justify-center px-6"
                    style={{ gridColumn: '2 / span 4' }}
                  >
                    <div className="w-full max-w-[600px]">
                      <RangeBand
                        min={rangeMin}
                        max={rangeMax}
                        current={currentPrice}
                        status={rowStatus}
                        token0Symbol={getSymbol(position.token0)}
                        token1Symbol={getSymbol(position.token1)}
                      />
                    </div>
                  </div>
                </div>

                <div className="ll-divider border-t transition-colors" role="presentation" data-pool-id={poolKey} />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-[rgba(255,255,255,0.1)] font-ui lg:hidden">
        {positions.map((position, index) => {
          const poolKey = poolKeyFromPosition(position, index);
          const dex = providerLabel(position);
          const tvl = liquidityUsd(position);
          const fees = feesUsd(position);
          const incentives = incentivesUsd(position);
          const apr = computeApr(position, tvl, fees, incentives);
          const rowStatus = statusToRangeStatus(position.status);
          const rangeMin = maybeNumber(position.rangeMin);
          const rangeMax = maybeNumber(position.rangeMax);
          const currentPrice = maybeNumber(position.currentPrice);

          return (
            <div
              key={poolKey}
              onClick={() => onRowClick?.(poolKey)}
              className="cursor-pointer p-4 transition-colors hover:bg-[rgba(0,230,255,0.05)]"
            >
              <div className="mb-3 flex items-start justify-between font-ui">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#9CA3AF]/50">
                    <span>{dex}</span>
                    <span className="text-white/15">•</span>
                    <span>{position.displayId ?? `#${position.poolId ?? position.marketId ?? poolKey}`}</span>
                    <span className="text-white/15">•</span>
                    <span className="font-semibold">{feeTierLabel(position)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center -space-x-2">
                      {position.token0Icon ? (
                        <Image
                          src={position.token0Icon}
                          alt={getSymbol(position.token0)}
                          width={24}
                          height={24}
                          className="rounded-full border border-[rgba(255,255,255,0.1)]"
                        />
                      ) : (
                        <TokenIcon symbol={getSymbol(position.token0)} size={24} />
                      )}
                      {position.token1Icon ? (
                        <Image
                          src={position.token1Icon}
                          alt={getSymbol(position.token1)}
                          width={24}
                          height={24}
                          className="rounded-full border border-[rgba(255,255,255,0.1)]"
                        />
                      ) : (
                        <TokenIcon symbol={getSymbol(position.token1)} size={24} />
                      )}
                    </div>

                    <span className="text-sm font-bold text-white">
                      {getSymbol(position.token0)} / {getSymbol(position.token1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="font-medium text-[#9CA3AF]/60">Liquidity</div>
                  <div className="tnum mt-0.5 font-semibold text-white">{formatUsd(tvl)}</div>
                </div>
                <div>
                  <div className="font-medium text-[#9CA3AF]/60">Fees</div>
                  <div className="tnum mt-0.5 font-semibold text-white">{formatUsd(fees)}</div>
                </div>
                <div>
                  <div className="font-medium text-[#9CA3AF]/60">Incentives</div>
                  <div className="tnum mt-0.5 font-semibold text-white">{formatUsd(incentives)}</div>
                  {position.incentivesToken && position.incentivesTokenAmount && position.incentivesTokenAmount > 0 && (
                    <div className="tnum text-[9px] text-[#9CA3AF]/60">
                      {formatCompactNumber(position.incentivesTokenAmount)} {position.incentivesToken}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-[#9CA3AF]/60">24h APR</div>
                  <div className="tnum mt-0.5 font-semibold text-white">
                    {Number.isFinite(apr) ? `${Math.min(apr, 999).toFixed(1)}%` : '—'}
                  </div>
                </div>
              </div>

              <div>
                <RangeBand
                  min={rangeMin}
                  max={rangeMax}
                  current={currentPrice}
                  status={rowStatus}
                  token0Symbol={getSymbol(position.token0)}
                  token1Symbol={getSymbol(position.token1)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default PositionsTable;

