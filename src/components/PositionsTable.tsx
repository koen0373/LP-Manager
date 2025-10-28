import React from 'react';
import Image from 'next/image';
import { TokenIcon } from './TokenIcon';
import RangeBand, { RangeStatus } from '@/components/pools/PoolRangeIndicator';
import { formatUsd } from '@/utils/format';
import { buildClaimLink } from '@/lib/poolDeepLinks';

export interface PositionData {
  tokenId: string;
  dexName: string;
  poolId: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Icon?: string;
  token1Icon?: string;
  feeTier: string;
  rangeMin?: number;
  rangeMax?: number;
  liquidityUsd: number;
  liquidityShare?: number;
  feesUsd: number;
  incentivesUsd: number;
  incentivesToken?: string;
  currentPrice?: number;
  status: RangeStatus;
  apy24h?: number;
}

interface PositionsTableProps {
  positions: PositionData[];
  onRowClick?: (tokenId: string) => void;
}

const STATUS_CONFIG: Record<RangeStatus, { label: string; dotColor: string }> = {
  in: { label: 'In Range', dotColor: '#00C66B' },
  near: { label: 'Near Band', dotColor: '#FFA500' },
  out: { label: 'Out of Range', dotColor: '#E74C3C' },
};

function formatAPY(apy?: number): string {
  if (typeof apy !== 'number' || !Number.isFinite(apy)) return '—';
  return `${apy.toFixed(1)}%`;
}

export function PositionsTable({ positions, onRowClick }: PositionsTableProps) {
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
        <p className="font-ui text-[#9AA1AB]">No positions found</p>
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
          className="ll-row ll-grid items-end pb-4 uppercase tracking-[0.18em] text-[10px] text-[#9AA1AB]/50"
        >
          <div role="columnheader" className="px-6">Pool</div>
          <div role="columnheader" className="px-6">Liquidity</div>
          <div role="columnheader" className="px-6">Unclaimed fees</div>
          <div role="columnheader" className="px-6">Incentives</div>
          <div role="columnheader" className="px-6 text-right">APY / Status</div>
        </div>

        <div role="rowgroup">
          {positions.map((position) => {
            const rowStatus: RangeStatus = position.status ?? 'out';
            const statusMeta = STATUS_CONFIG[rowStatus] ?? STATUS_CONFIG.out;
            const statusColor = statusMeta.dotColor;

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
                    <div className="ll-specifics-line mt-1 flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#9AA1AB]/50">
                      <span>{position.dexName}</span>
                      <span className="text-white/15">•</span>
                      <span>{position.poolId}</span>
                      <span className="text-white/15">•</span>
                      <span className="font-semibold">{position.feeTier}</span>
                    </div>
                  </div>

                  <div role="cell" className="flex items-center px-6">
                    <span className="tnum text-[15px] font-semibold leading-none text-white">{formatUsd(position.liquidityUsd)}</span>
                  </div>

                  <div role="cell" className="flex items-center px-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="tnum text-[15px] font-semibold leading-none text-white">{formatUsd(position.feesUsd)}</span>
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
                    </div>
                  </div>

                  <div role="cell" className="flex items-center px-6">
                    <div className="flex flex-col gap-0.5">
                      <span className="tnum text-[15px] font-semibold leading-none text-white">{formatUsd(position.incentivesUsd)}</span>
                      {position.incentivesToken && (
                        <span className="text-[9px] text-[#9AA1AB]/60">{position.incentivesToken}</span>
                      )}
                    </div>
                  </div>

                  <div role="cell" className="flex items-center justify-end px-6">
                    <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-[12px] font-medium text-white">
                      <span className="ll-status-dot" style={{ background: statusColor }} aria-hidden="true" />
                      <span>{statusMeta.label}</span>
                    </div>
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
                    style={{ gridColumn: '2 / span 3' }}
                  >
                    <div className="w-full max-w-[500px]">
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

                  <div role="cell" className="flex items-center justify-end px-6">
                    <div className="ll-apy flex flex-col items-end gap-0.5 text-right">
                      <span className="tnum text-[18px] font-bold leading-none text-white">{formatAPY(position.apy24h)}</span>
                      <span className="text-[9px] uppercase tracking-wide text-[#9AA1AB]/50">APR</span>
                    </div>
                  </div>
                </div>

                <div className="ll-divider border-t" role="presentation" />
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="divide-y divide-[rgba(255,255,255,0.1)] font-ui lg:hidden">
        {positions.map((position) => {
          const rowStatus: RangeStatus = position.status ?? 'out';
          const statusMeta = STATUS_CONFIG[rowStatus] ?? STATUS_CONFIG.out;

          return (
            <div
              key={position.tokenId}
              onClick={() => onRowClick?.(position.tokenId)}
              className="cursor-pointer p-4 transition-colors hover:bg-[rgba(0,230,255,0.05)]"
            >
              <div className="mb-3 flex items-center justify-between font-ui">
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

                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs font-medium text-white/70">
                    {position.feeTier}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: statusMeta.dotColor }} />
                  <span className="text-xs font-medium text-white">{statusMeta.label}</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-4 text-[#9AA1AB]">
                  <div className="font-ui">
                    <span className="font-medium text-white">Liquidity: </span>
                    <span className="tnum">{formatUsd(position.liquidityUsd)}</span>
                  </div>
                  <div className="font-ui">
                    <span className="font-medium text-white">Fees: </span>
                    <span className="tnum">{formatUsd(position.feesUsd)}</span>
                  </div>
                  <div className="font-ui">
                    <span className="font-medium text-white">Incentives: </span>
                    <span className="tnum">{formatUsd(position.incentivesUsd)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
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
