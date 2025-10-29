import React from 'react';
import Image from 'next/image';
import { TokenIcon } from './TokenIcon';
import RangeBand, { RangeStatus } from '@/components/pools/PoolRangeIndicator';
import { formatUsd } from '@/utils/format';
import { buildClaimLink } from '@/lib/poolDeepLinks';
import { calcApr24h, formatFeeTier, formatCompactNumber } from '@/lib/metrics';

export interface PositionData {
  tokenId: string;
  dexName: string;
  poolId: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Icon?: string;
  token1Icon?: string;
  feeTier: string;
  feeTierBps?: number;
  rangeMin?: number;
  rangeMax?: number;
  liquidityUsd: number;
  liquidityShare?: number;
  feesUsd: number;
  incentivesUsd: number;
  incentivesToken?: string;
  incentivesTokenAmount?: number;
  currentPrice?: number;
  status: RangeStatus;
  apr24h?: number;
  dailyFeesUsd?: number;
  dailyIncentivesUsd?: number;
}

interface PositionsTableProps {
  positions: PositionData[];
  onRowClick?: (tokenId: string) => void;
  hideClaimLink?: boolean; // Hide claim link for demo/public views
}

function formatApr(apr?: number): string {
  if (typeof apr !== 'number' || !Number.isFinite(apr)) return '—';
  const capped = Math.min(apr, 999);
  return `${capped.toFixed(1)}%`;
}

export function PositionsTable({ positions, onRowClick, hideClaimLink = false }: PositionsTableProps) {
  React.useEffect(() => {
    // Add hover effect for both rows of same pool
    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      const poolId = target.getAttribute('data-pool-id');
      if (!poolId) return;
      
      document.querySelectorAll(`[data-pool-id="${poolId}"]`).forEach((el) => {
        el.classList.add('pool-hover');
      });
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLElement;
      const poolId = target.getAttribute('data-pool-id');
      if (!poolId) return;
      
      document.querySelectorAll(`[data-pool-id="${poolId}"]`).forEach((el) => {
        el.classList.remove('pool-hover');
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
          {positions.map((position) => {
            const rowStatus: RangeStatus = position.status ?? 'out';
            const apr24h =
              position.apr24h ??
              calcApr24h({
                tvlUsd: position.liquidityUsd,
                dailyFeesUsd: position.dailyFeesUsd,
                dailyIncentivesUsd: position.dailyIncentivesUsd,
              });

            const formattedFeeTier = position.feeTierBps 
              ? formatFeeTier(position.feeTierBps) 
              : position.feeTier;

            return (
              <React.Fragment key={position.tokenId}>
                <div
                  role="row"
                  className="ll-row ll-grid cursor-pointer items-end pt-4 transition-colors"
                  onClick={() => onRowClick?.(position.tokenId)}
                  data-pool-id={position.tokenId}
                >
                  <div role="cell" className="flex flex-col justify-center px-6">
                    <div className="flex items-center gap-2.5 whitespace-nowrap">
                      <div className="flex items-center -space-x-2">
                        {position.token0Icon ? (
                          <Image
                            src={position.token0Icon}
                            alt={position.token0Symbol}
                            width={24}
                            height={24}
                            className="rounded-full border border-[rgba(255,255,255,0.1)]"
                          />
                        ) : (
                          <TokenIcon symbol={position.token0Symbol} size={24} />
                        )}
                        {position.token1Icon ? (
                          <Image
                            src={position.token1Icon}
                            alt={position.token1Symbol}
                            width={24}
                            height={24}
                            className="rounded-full border border-[rgba(255,255,255,0.1)]"
                          />
                        ) : (
                          <TokenIcon symbol={position.token1Symbol} size={24} />
                        )}
                      </div>
                      <span className="text-[15px] font-semibold leading-none text-white">
                        {position.token0Symbol} / {position.token1Symbol}
                      </span>
                    </div>
                    <div className="ll-specifics-line mt-1 flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#9CA3AF]/50">
                      <span>{position.dexName}</span>
                      <span className="text-white/15">•</span>
                      <span>#{position.poolId}</span>
                      <span className="text-white/15">•</span>
                      <span className="font-semibold">{formattedFeeTier}</span>
                    </div>
                  </div>

                  <div role="cell" className="flex items-center px-6">
                    <span className="tnum text-[15px] font-semibold leading-none text-white">{formatUsd(position.liquidityUsd)}</span>
                  </div>

                  <div role="cell" className="flex items-center px-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="tnum text-[15px] font-semibold leading-none text-white">{formatUsd(position.feesUsd)}</span>
                      {!hideClaimLink && (
                        <a
                          href={buildClaimLink(position.dexName, position.poolId)}
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
                      <span className="tnum text-[15px] font-semibold leading-none text-white">{formatUsd(position.incentivesUsd)}</span>
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
                      aria-label={`24-hour APR ${apr24h.toFixed(1)} percent`}
                    >
                      {formatApr(apr24h)}
                    </span>
                  </div>
                </div>

                <div
                  role="row"
                  className="ll-row ll-grid cursor-pointer pb-4 transition-colors"
                  onClick={() => onRowClick?.(position.tokenId)}
                  data-pool-id={position.tokenId}
                >
                  <div role="cell" className="px-6" aria-hidden="true" />

                  <div
                    role="cell"
                    className="flex items-center justify-center px-6"
                    style={{ gridColumn: '2 / span 4' }}
                  >
                    <div className="w-full max-w-[600px]">
                      <RangeBand
                        min={position.rangeMin}
                        max={position.rangeMax}
                        current={position.currentPrice}
                        status={rowStatus}
                        token0Symbol={position.token0Symbol}
                        token1Symbol={position.token1Symbol}
                      />
                    </div>
                  </div>
                </div>

                <div className="ll-divider border-t transition-colors" role="presentation" data-pool-id={position.tokenId} />
             </React.Fragment>
           );
         })}
       </div>
      </div>

      <div className="divide-y divide-[rgba(255,255,255,0.1)] font-ui lg:hidden">
        {positions.map((position) => {
          const rowStatus: RangeStatus = position.status ?? 'out';
          const apr24h =
            position.apr24h ??
            calcApr24h({
              tvlUsd: position.liquidityUsd,
              dailyFeesUsd: position.dailyFeesUsd,
              dailyIncentivesUsd: position.dailyIncentivesUsd,
            });

          const formattedFeeTier = position.feeTierBps 
            ? formatFeeTier(position.feeTierBps) 
            : position.feeTier;

          return (
            <div
              key={position.tokenId}
              onClick={() => onRowClick?.(position.tokenId)}
              className="cursor-pointer p-4 transition-colors hover:bg-[rgba(0,230,255,0.05)]"
            >
              <div className="mb-3 flex items-start justify-between font-ui">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#9CA3AF]/50">
                    <span>{position.dexName}</span>
                    <span className="text-white/15">•</span>
                    <span>#{position.poolId}</span>
                    <span className="text-white/15">•</span>
                    <span className="font-semibold">{formattedFeeTier}</span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex items-center -space-x-2">
                      {position.token0Icon ? (
                        <Image
                          src={position.token0Icon}
                          alt={position.token0Symbol}
                          width={24}
                          height={24}
                          className="rounded-full border border-[rgba(255,255,255,0.1)]"
                        />
                      ) : (
                        <TokenIcon symbol={position.token0Symbol} size={24} />
                      )}
                      {position.token1Icon ? (
                        <Image
                          src={position.token1Icon}
                          alt={position.token1Symbol}
                          width={24}
                          height={24}
                          className="rounded-full border border-[rgba(255,255,255,0.1)]"
                        />
                      ) : (
                        <TokenIcon symbol={position.token1Symbol} size={24} />
                      )}
                    </div>

                    <span className="text-sm font-bold text-white">
                      {position.token0Symbol} / {position.token1Symbol}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mb-3 grid grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="font-medium text-[#9CA3AF]/60">Liquidity</div>
                  <div className="tnum mt-0.5 font-semibold text-white">{formatUsd(position.liquidityUsd)}</div>
                </div>
                <div>
                  <div className="font-medium text-[#9CA3AF]/60">Fees</div>
                  <div className="tnum mt-0.5 font-semibold text-white">{formatUsd(position.feesUsd)}</div>
                </div>
                <div>
                  <div className="font-medium text-[#9CA3AF]/60">Incentives</div>
                  <div className="tnum mt-0.5 font-semibold text-white">{formatUsd(position.incentivesUsd)}</div>
                  {position.incentivesToken && position.incentivesTokenAmount && position.incentivesTokenAmount > 0 && (
                    <div className="tnum text-[9px] text-[#9CA3AF]/60">
                      {formatCompactNumber(position.incentivesTokenAmount)} {position.incentivesToken}
                    </div>
                  )}
                </div>
                <div>
                  <div className="font-medium text-[#9CA3AF]/60">24h APR</div>
                  <div className="tnum mt-0.5 font-semibold text-white">{formatApr(apr24h)}</div>
                </div>
              </div>

              <div>
                <RangeBand
                  min={position.rangeMin}
                  max={position.rangeMax}
                  current={position.currentPrice}
                  status={rowStatus}
                  token0Symbol={position.token0Symbol}
                  token1Symbol={position.token1Symbol}
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
