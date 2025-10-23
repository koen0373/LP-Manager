import React from 'react';
import { useRouter } from 'next/router';
import { TokenIcon } from './TokenIcon';
import { StatusPill } from './StatusPill';
import { FeeBadge } from './FeeBadge';
import { fmtUsd, fmtAmt, formatUsd, formatPrice } from '../lib/format';
import type { PositionRow } from '../types/positions';

interface PositionsTableProps {
  positions: PositionRow[];
  headerNote: string;
  showTotalsRow: boolean;
}

const STABLE_SYMBOLS = new Set([
  'USDT',
  'USDT0',
  'USDTO',
  'USDC',
  'USDCG',
  'USD0',
  'USDX',
  'DAI',
  'DAI0',
  'USD₮0',
  'EUSDT',
]);

const normalizeSymbol = (symbol: string): string =>
  symbol.normalize('NFKD').replace(/[^A-Z0-9]/gi, '').toUpperCase();

const isStable = (symbol: string): boolean => STABLE_SYMBOLS.has(normalizeSymbol(symbol));

const getNonStableTokenPrice = (position: PositionRow): { symbol: string; price: number } | null => {
  const token0Stable = isStable(position.token0.symbol);
  const token1Stable = isStable(position.token1.symbol);

  if (token0Stable && !token1Stable) {
    return { symbol: position.token1.symbol, price: position.price1Usd };
  }

  if (!token0Stable && token1Stable) {
    return { symbol: position.token0.symbol, price: position.price0Usd };
  }

  if (!token0Stable && !token1Stable) {
    // Default to token0 when both are volatile
    return { symbol: position.token0.symbol, price: position.price0Usd };
  }

  return null;
};

const formatRflrDelta = (delta: number): string => {
  const abs = Math.abs(delta);
  if (abs === 0) return '0';
  if (abs < 0.00001) return '<0.00001';
  if (abs < 0.001) return abs.toFixed(5);
  if (abs < 1) return abs.toFixed(4);
  if (abs < 1000) return abs.toFixed(0);
  if (abs < 1000000) return `${(abs / 1000).toFixed(1)}K`;
  return `${(abs / 1000000).toFixed(1)}M`;
};

export default function PositionsTable({
  positions,
  headerNote,
  showTotalsRow,
}: PositionsTableProps) {
  const router = useRouter();
  const previousRflrRef = React.useRef<Map<string, number>>(new Map());
  const [rflrDeltas, setRflrDeltas] = React.useState<Record<string, number>>({});

  const handleRowClick = (tokenId: string) => {
    router.push(`/pool/${tokenId}`);
  };

  React.useEffect(() => {
    const nextDeltas: Record<string, number> = {};
    const seen = new Set<string>();

    for (const position of positions) {
      const previous = previousRflrRef.current.get(position.id);
      const delta = previous !== undefined ? position.rflrAmount - previous : 0;
      nextDeltas[position.id] = delta;
      previousRflrRef.current.set(position.id, position.rflrAmount);
      seen.add(position.id);
    }

    for (const key of Array.from(previousRflrRef.current.keys())) {
      if (!seen.has(key)) {
        previousRflrRef.current.delete(key);
      }
    }

    setRflrDeltas(nextDeltas);
  }, [positions]);

  const totals = positions    .reduce(
      (acc, pos) => ({
        tvl: acc.tvl + (pos.tvlUsd || 0),
        rewards: acc.rewards + (pos.rewardsUsd || 0),
        rflr: acc.rflr + (pos.rflrUsd || 0),
      }),
      { tvl: 0, rewards: 0, rflr: 0 }
    );

  return (
    <div className="w-full max-w-[1200px] mx-auto">
      <div className="text-liqui-subtext text-sm mb-4">{headerNote}</div>
      
      <div className="bg-liqui-card rounded-lg border border-liqui-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-b border-liqui-border bg-liqui-subcard">
          <div className="text-liqui-subtext font-bold text-left">Specifics</div>
          <div className="text-liqui-subtext font-bold text-left">Liquidity</div>
          <div className="text-liqui-subtext font-bold text-left">Fees</div>
          <div className="text-liqui-subtext font-bold text-left">Incentives</div>
          <div className="text-liqui-subtext font-bold text-left">Range</div>
          <div className="text-liqui-subtext font-bold text-left">Status</div>
        </div>

        {/* Rows */}
            {positions.map((position) => {
          const nonStablePrice = getNonStableTokenPrice(position);
          const rflrDelta = rflrDeltas[position.id] ?? 0;
          const showRflrDelta = Math.abs(rflrDelta) >= 0.00001;
          
          return (
          <div 
            key={position.id} 
            className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 hover:bg-white/5 transition-colors cursor-pointer"
            onClick={() => handleRowClick(position.id)}
          >
            {/* Position Specifics */}
            <div className="flex items-center justify-start space-x-3">
              <div className="text-liqui-subtext text-sm">#{position.id}</div>
              <div className="flex -space-x-2">
                <TokenIcon symbol={position.token0.symbol} size={21} />
                <TokenIcon symbol={position.token1.symbol} size={21} />
              </div>
                  <div>
                    <div className="text-white font-normal whitespace-nowrap">{position.pairLabel}</div>
                    <div className="text-liqui-subtext text-xs">
                      {formatPrice(position.lowerPrice || 0)} - {formatPrice(position.upperPrice || 0)}
                    </div>
                  </div>
              <FeeBadge feeBps={position.feeTierBps} />
            </div>

                {/* TVL */}
                <div className="text-left">
                  <div className="text-white font-normal">${formatUsd(position.tvlUsd || 0)}</div>
                </div>

                {/* Pool Rewards */}
                <div className="text-left">
                  <div className="text-white font-normal">${formatUsd(position.rewardsUsd || 0)}</div>
                  {position.rewardsUsd > 0 && (
                    <div className="text-liqui-subtext text-xs text-left">
                      Unclaimed fees
                    </div>
                  )}
                </div>

            {/* Incentives (formerly RFLR) */}
            <div className="text-left">
              {position.rflrUsd > 0 ? (
                <div>
                  <div className="text-white font-normal">${fmtUsd(position.rflrUsd)}</div>
                  <div className="text-liqui-subtext text-xs text-left">{fmtAmt(position.rflrAmount)} RFLR</div>
                  {showRflrDelta ? (
                    <div className="text-liqui-subtext text-[11px] text-left">
                      ({rflrDelta > 0 ? '+' : '-'} {formatRflrDelta(rflrDelta)})
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-liqui-subtext text-left">-</div>
              )}
            </div>

            {/* Range Visualization (formerly APS column) */}
            <div className="text-left">
              {(() => {
                const lower = position.lowerPrice || 0;
                const upper = position.upperPrice || 0;
                const current = nonStablePrice?.price || 0;
                
                if (lower === 0 || upper === 0 || current === 0) {
                  return <div className="text-liqui-subtext text-xs">-</div>;
                }
                
                // Calculate position percentage (0-100)
                let percentage = 0;
                if (current < lower) {
                  percentage = 0;
                } else if (current > upper) {
                  percentage = 100;
                } else {
                  percentage = ((current - lower) / (upper - lower)) * 100;
                }
                
                // Determine if in range
                const inRange = position.isInRange !== undefined ? position.isInRange : position.inRange;
                const indicatorColor = inRange ? 'bg-green-500' : 'bg-red-500';
                
                return (
                  <div className="space-y-1">
                    {/* Current price label */}
                    <div className="text-liqui-subtext text-xs text-left">
                      Current price
                    </div>
                    {/* Current price value */}
                    <div className="text-white text-xs text-left mb-2">
                      {formatPrice(current, current < 1 ? 5 : 3)}
                    </div>
                    {/* Range bar - left aligned with 80% width */}
                    <div className="relative w-full flex items-center">
                      <div className="relative w-[80%] h-0.5 bg-gray-500 rounded-full">
                        <div 
                          className={`absolute top-1/2 -translate-y-1/2 w-0.5 h-3 ${indicatorColor}`}
                          style={{ left: `${Math.max(0, Math.min(100, percentage))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Status (with range indicator moved here) */}
            <div className="text-left">
              <div className="flex items-center justify-start">
                <StatusPill inRange={position.isInRange !== undefined ? position.isInRange : position.inRange} />
              </div>
            </div>
          </div>
        );
        })}

        {/* Totals Row */}
        {showTotalsRow && (
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-t border-liqui-border bg-liqui-subcard">
            <div className="text-liqui-subtext text-sm font-bold text-left">Total</div>
            <div className="text-left">
              <div className="text-white font-normal">${fmtUsd(totals.tvl)}</div>
            </div>
            <div className="text-left">
              <div className="text-white font-normal">${fmtUsd(totals.rewards)}</div>
            </div>
            <div className="text-left">
              <div className="text-white font-normal">${fmtUsd(totals.rflr)}</div>
            </div>
            {/* Range column - no total */}
            <div></div>
            {/* Status column - no total */}
            <div></div>
          </div>
        )}
      </div>
    </div>
  );
}
