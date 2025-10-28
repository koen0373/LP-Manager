import React from 'react';
import Image from 'next/image';
import { TokenIcon } from './TokenIcon';
import RangeBand, { RangeStatus } from '@/components/pools/PoolRangeIndicator';
import { formatUsd } from '@/utils/format';

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

const APY_PLACEHOLDER = '12.4%';

export function PositionsTable({ positions, onRowClick }: PositionsTableProps) {
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
          className="ll-row ll-grid items-end uppercase tracking-[0.18em] text-[11px] text-[#9AA1AB]/70"
        >
          <div role="columnheader" className="px-6">Pool</div>
          <div role="columnheader" className="px-5">Liquidity</div>
          <div role="columnheader" className="px-5">Unclaimed fees</div>
          <div role="columnheader" className="px-5">Incentives</div>
          <div role="columnheader" className="px-5">APY / Status</div>
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
                  className="ll-row ll-grid cursor-pointer transition-colors"
                  onClick={() => onRowClick?.(position.tokenId)}
                >
                  <div role="cell" className="px-6">
                    <div className="flex flex-col gap-4">
                      <div className="ll-specifics-line text-[11px] font-medium uppercase tracking-widest text-[#9AA1AB]/70">
                        {position.dexName} <span className="text-white/25">•</span> {position.poolId}
                      </div>
                      <div className="flex items-center gap-3 whitespace-nowrap">
                        <div className="flex items-center -space-x-2">
                          {position.token0Icon ? (
                            <Image
                              src={position.token0Icon}
                              alt={position.token0Symbol}
                              width={28}
                              height={28}
                              className="rounded-full border border-[rgba(255,255,255,0.1)]"
                            />
                          ) : (
                            <TokenIcon symbol={position.token0Symbol} size={28} />
                          )}
                          {position.token1Icon ? (
                            <Image
                              src={position.token1Icon}
                              alt={position.token1Symbol}
                              width={28}
                              height={28}
                              className="rounded-full border border-[rgba(255,255,255,0.1)]"
                            />
                          ) : (
                            <TokenIcon symbol={position.token1Symbol} size={28} />
                          )}
                        </div>
                        <span className="text-[18px] font-semibold text-white">
                          {position.token0Symbol} / {position.token1Symbol}
                        </span>
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[11px] font-medium text-white/70">
                          {position.feeTier}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div role="cell" className="px-5">
                    <div className="flex flex-col gap-2 font-ui">
                      <div className="text-[16px] font-semibold text-white">{formatUsd(position.liquidityUsd)}</div>
                      {position.liquidityShare !== undefined && (
                        <div className="tnum text-[12px] text-[#9AA1AB]">({position.liquidityShare.toFixed(2)}%)</div>
                      )}
                    </div>
                  </div>

                  <div role="cell" className="px-5">
                    <div className="flex flex-col gap-2 font-ui">
                      <div className="text-[16px] font-semibold text-white">{formatUsd(position.feesUsd)}</div>
                      <button
                        type="button"
                        className="text-left text-[13px] font-medium text-[rgba(110,168,255,0.9)] transition hover:text-[#6EA8FF]"
                        onClick={(event) => {
                          event.stopPropagation();
                          alert('Claim fees — coming soon.');
                        }}
                      >
                        Claim fees →
                      </button>
                    </div>
                  </div>

                  <div role="cell" className="px-5">
                    <div className="flex flex-col gap-2 font-ui">
                      <div className="text-[16px] font-semibold text-white">{formatUsd(position.incentivesUsd)}</div>
                      {position.incentivesToken && (
                        <div className="text-[12px] text-[#9AA1AB]">{position.incentivesToken}</div>
                      )}
                    </div>
                  </div>

                  <div role="cell" className="px-5">
                    <div className="flex flex-col items-end gap-3 font-ui">
                      <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-white">
                        <span className="ll-status-dot" style={{ background: statusColor }} aria-hidden="true" />
                        <span>{statusMeta.label}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  role="row"
                  className="ll-row ll-grid cursor-pointer transition-colors"
                  onClick={() => onRowClick?.(position.tokenId)}
                >
                  <div role="cell" className="px-6" aria-hidden="true" />

                  <div
                    role="cell"
                    className="px-5"
                    style={{ gridColumn: '2 / span 3' }}
                  >
                    <RangeBand
                      min={position.rangeMin}
                      max={position.rangeMax}
                      current={position.currentPrice}
                      status={rowStatus}
                      token0Symbol={position.token0Symbol}
                      token1Symbol={position.token1Symbol}
                    />
                  </div>

                  <div role="cell" className="px-5">
                    <div className="ll-apy text-right">
                      <div className="tnum text-xl font-semibold text-white">{APY_PLACEHOLDER}</div>
                      <div className="text-sm text-[#9AA1AB]">Average 24h APY</div>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          className="ll-btn-primary inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-[#0A0F1A]"
                          onClick={(event) => {
                            event.stopPropagation();
                            alert('Share to X — coming soon.');
                          }}
                          title="Share your APY snapshot"
                        >
                          Share
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="ll-divider my-4 border-t" role="presentation" />
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
