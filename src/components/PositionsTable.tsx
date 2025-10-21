import React from 'react';
import { TokenIcon } from './TokenIcon';
import { StatusPill } from './StatusPill';
import { FeeBadge } from './FeeBadge';
import { fmtUsd, fmtAmt, formatUsd, formatPrice } from '../lib/format';
import type { PositionRow } from '../types/positions';

interface PositionsTableProps {
  positions: PositionRow[];
  headerNote: string;
  globalRflrPriceUsd: number;
  showTotalsRow: boolean;
}

export default function PositionsTable({
  positions,
  headerNote,
  globalRflrPriceUsd: _globalRflrPriceUsd,
  showTotalsRow,
}: PositionsTableProps) {
  const totals = positions.reduce(
    (acc, pos) => ({
      tvl: acc.tvl + (pos.tvlUsd || 0),
      rewards: acc.rewards + (pos.rewardsUsd || 0),
      rflr: acc.rflr + (pos.rflrUsd || 0),
    }),
    { tvl: 0, rewards: 0, rflr: 0 }
  );

  return (
    <div className="w-full max-w-[1200px] mx-auto">
      <div className="text-enosys-subtext text-sm mb-4">{headerNote}</div>
      
      <div className="bg-enosys-card rounded-lg border border-enosys-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-5 gap-4 px-6 py-4 border-b border-enosys-border bg-enosys-subcard">
          <div className="text-enosys-subtext text-sm font-medium">Position Specifics</div>
          <div className="text-enosys-subtext text-sm font-medium text-center">TVL</div>
          <div className="text-enosys-subtext text-sm font-medium text-center">Pool Rewards</div>
          <div className="text-enosys-subtext text-sm font-medium text-center">RFLR Rewards</div>
          <div className="text-enosys-subtext text-sm font-medium text-center">Range Status</div>
        </div>

        {/* Rows */}
            {positions.map((position) => (
          <div key={position.id} className="grid grid-cols-5 gap-4 px-6 py-4 hover:bg-white/5 transition-colors">
            {/* Position Specifics */}
            <div className="flex items-center space-x-3">
              <div className="text-enosys-subtext text-sm">#{position.id}</div>
              <div className="flex -space-x-2">
                <TokenIcon symbol={position.token0.symbol} size={28} />
                <TokenIcon symbol={position.token1.symbol} size={28} />
              </div>
                  <div>
                    <div className="text-white font-medium whitespace-nowrap">{position.pairLabel}</div>
                    <div className="text-enosys-subtext text-xs">
                      {formatPrice(position.lowerPrice || 0)} - {formatPrice(position.upperPrice || 0)}
                    </div>
                  </div>
              <FeeBadge feeBps={position.feeTierBps} />
            </div>

                {/* TVL */}
                <div className="text-center">
                  <div className="text-white font-medium">${formatUsd(position.tvlUsd || 0)}</div>
                </div>

                {/* Pool Rewards */}
                <div className="text-center">
                  <div className="text-white font-medium">${formatUsd(position.rewardsUsd || 0)}</div>
                  {position.rewardsUsd > 0 && (
                    <div className="text-enosys-subtext text-xs">
                      Unclaimed fees
                    </div>
                  )}
                </div>

            {/* RFLR Rewards */}
            <div className="text-center">
              {position.rflrUsd > 0 ? (
                <div>
                  <div className="text-white font-medium">${fmtUsd(position.rflrUsd)}</div>
                  <div className="text-enosys-subtext text-xs">{fmtAmt(position.rflrAmount)} RFLR</div>
                </div>
              ) : (
                <div className="text-enosys-subtext">-</div>
              )}
            </div>

                {/* Range Status */}
                <div className="text-center">
                  <StatusPill inRange={position.isInRange !== undefined ? position.isInRange : position.inRange} />
                </div>
          </div>
        ))}

        {/* Totals Row */}
        {showTotalsRow && (
          <div className="grid grid-cols-5 gap-4 px-6 py-4 border-t border-enosys-border bg-enosys-subcard">
            <div className="text-enosys-subtext text-sm font-medium">Total</div>
            <div className="text-center">
              <div className="text-white font-medium">${fmtUsd(totals.tvl)}</div>
            </div>
            <div className="text-center">
              <div className="text-white font-medium">${fmtUsd(totals.rewards)}</div>
            </div>
            <div className="text-center">
              <div className="text-white font-medium">${fmtUsd(totals.rflr)}</div>
            </div>
            <div></div>
          </div>
        )}
      </div>
    </div>
  );
}
