'use client';
import React, { useMemo } from 'react';
import { FeeBadge } from './FeeBadge';
import { RangeStatus, PositionStatus } from './StatusPill';
import { TokenIcon } from './TokenIcon';
import type { PositionRow } from '../types/positions';
import { fmtUsd, fmtAmt } from '../lib/format';

type Props = {
  positions: PositionRow[];
  headerNote?: string;
  globalRflrPriceUsd?: number;
  showTotalsRow?: boolean;
};

export default function PositionsTable({ positions, headerNote, globalRflrPriceUsd, showTotalsRow = true }: Props) {
  const enriched = useMemo(() => {
    return positions.map((p) => {
      const price = typeof p.rflrPriceUsd === 'number' ? p.rflrPriceUsd : globalRflrPriceUsd;
      const rflrUsd =
        typeof p.rflrUsd === 'number'
          ? p.rflrUsd
          : typeof p.rflrAmount === 'number' && typeof price === 'number'
          ? p.rflrAmount * price
          : undefined;
      const totalUsd = (p.rewardsUsd ?? 0) + (rflrUsd ?? 0);
      return { ...p, _rflrUsdComputed: rflrUsd, _totalUsdComputed: totalUsd };
    });
  }, [positions, globalRflrPriceUsd]);

  const totals = useMemo(() => {
    const sum = (key: string) =>
      enriched.reduce((acc, row: Record<string, unknown>) => acc + (typeof row[key] === 'number' ? row[key] as number : 0), 0);
    return {
      tvl: sum('tvlUsd'),
      fees: sum('rewardsUsd'),
      rflrUsd: sum('_rflrUsdComputed'),
      totalUsd: sum('_totalUsdComputed'),
    };
  }, [enriched]);

  return (
    <div className="w-full max-w-[1200px] mx-auto mt-8">
      <div 
        className="bg-enosys-card rounded-xl overflow-hidden overflow-auto"
        style={{ 
          marginLeft: '32px', 
          marginRight: '32px', 
          marginTop: '24px', 
          marginBottom: '24px' 
        }}
      >
        {/* Sticky Header */}
        <div className="sticky top-0 bg-enosys-subcard">
          <div className="grid grid-cols-[30%_18%_15%_12%_12%_13%] px-8 py-4 gap-8">
            {/* Position Specifics - 1 line */}
            <div className="text-center">
              <div className="text-[12px] font-medium text-enosys-subtext uppercase tracking-wider">
                POSITION SPECIFICS
              </div>
            </div>
            
            {/* Position TVL - 1 line */}
            <div className="text-center">
              <div className="text-[12px] font-medium text-enosys-subtext uppercase tracking-wider">
                POSITION TVL
              </div>
            </div>
            
            {/* Pool Rewards - 1 line */}
            <div className="text-center">
              <div className="text-[12px] font-medium text-enosys-subtext uppercase tracking-wider">
                POOL REWARDS
              </div>
            </div>
            
            {/* RFLR Rewards - 1 line */}
            <div className="text-center">
              <div className="text-[12px] font-medium text-enosys-subtext uppercase tracking-wider">
                RFLR REWARDS
              </div>
            </div>
            
            {/* Range Status - 1 line */}
            <div className="text-center">
              <div className="text-[12px] font-medium text-enosys-subtext uppercase tracking-wider">
                RANGE STATUS
              </div>
            </div>
            
            {/* Position Status - 1 line */}
            <div className="text-center">
              <div className="text-[12px] font-medium text-enosys-subtext uppercase tracking-wider">
                POSITION STATUS
              </div>
            </div>
          </div>
        </div>

        {/* Table Rows */}
        <div>
          {enriched.map((p, index) => (
            <div key={p.id}>
              <div 
                className="grid grid-cols-[30%_18%_15%_12%_12%_13%] px-8 gap-8 hover:bg-enosys-hover transition-all duration-200"
                style={{ 
                  paddingTop: '20px', 
                  paddingBottom: '20px'
                }}
              >
                {/* Position Specifics */}
                <div className="flex flex-col gap-1 items-center">
                  {/* Eerste regel: Pool nummer + Token icons + Pair + Fee percentage */}
                  <div className="flex items-center gap-3">
                    {/* Pool Number - vaste breedte */}
                    <div className="text-[12px] text-enosys-subtext font-mono min-w-[60px]">#{p.id}</div>
                    
                    {/* Token Icons + Pair Label */}
                    <div className="flex items-center gap-2">
                      {/* Token Icons - Robuuste fallback strategie */}
                      <div className="flex -space-x-1">
                        <div className="w-6 h-6 rounded-full overflow-hidden shadow-lg">
                          <TokenIcon 
                            symbol={p.token0.symbol} 
                            address={p.token0.address}
                            size={24}
                            className="w-full h-full"
                          />
                        </div>
                        <div className="w-6 h-6 rounded-full overflow-hidden shadow-lg">
                          <TokenIcon 
                            symbol={p.token1.symbol} 
                            address={p.token1.address}
                            size={24}
                            className="w-full h-full"
                          />
                        </div>
                      </div>
                      <div className="text-[15px] font-medium text-enosys-text">{p.pairLabel}</div>
                    </div>
                    
                    {/* Fee Percentage - meer afstand */}
                    <div className="text-[12px] text-enosys-subtext font-mono ml-12">
                      {(p.feeTierBps / 100).toFixed(2)}%
                    </div>
                  </div>
                  
                  {/* Tweede regel: Range gecentreerd onder pair name */}
                  <div className="text-[12px] text-enosys-subtext font-mono text-center">
                    {p.tickLowerLabel} - {p.tickUpperLabel}
                  </div>
                </div>

                {/* Position TVL */}
                <div className="flex flex-col gap-1 items-center justify-center">
                  <div className="text-[15px] font-medium text-enosys-text font-mono">
                    {p.tvlUsd > 0 ? `${p.tvlUsd.toFixed(2)}$` : '0.00$'}
                  </div>
                  {p.tvlUsd > 0 && (
                    <div className="text-[12px] text-enosys-subtext font-mono">
                      (0.07%)
                    </div>
                  )}
                </div>

                {/* Pool Rewards */}
                <div className="flex flex-col gap-1 items-center justify-center">
                  <div className="text-[15px] font-medium text-enosys-text font-mono">
                    {p.rewardsUsd > 0 ? `${p.rewardsUsd.toFixed(2)}$` : '0.00$'}
                  </div>
                </div>

                {/* RFLR Rewards */}
                <div className="flex flex-col gap-1 items-center justify-center">
                  <div className="text-[15px] font-medium text-enosys-text font-mono">
                    {p.rflrAmount && p.rflrAmount > 0 ? `${p.rflrAmount.toFixed(2)} rFLR` : '0.00 rFLR'}
                  </div>
                  {p.rflrAmount && p.rflrAmount > 0 ? (
                    <div className="text-[12px] text-enosys-subtext font-mono">
                      (${((p.rflrAmount || 0) * 0.01758).toFixed(2)})
                    </div>
                  ) : null}
                </div>

                {/* Range Status */}
                <div className="flex items-center justify-center">
                  <RangeStatus inRange={p.inRange} />
                </div>

                {/* Position Status */}
                <div className="flex items-center justify-center">
                  <PositionStatus status={p.status} />
                </div>
              </div>
              
              {/* Dun divider lijntje tussen rijen */}
              {index < enriched.length - 1 && (
                <div className="border-b border-gray-800/10 mx-8"></div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
