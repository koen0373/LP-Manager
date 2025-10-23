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
      <div className="text-enosys-subtext text-sm mb-4">{headerNote}</div>
      
      <div className="bg-enosys-card rounded-lg border border-enosys-border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-b border-enosys-border bg-enosys-subcard">
          <div className="text-enosys-subtext font-bold text-left">Specifics</div>
          <div className="text-enosys-subtext font-bold text-left">Liquidity</div>
          <div className="text-enosys-subtext font-bold text-left">Fees</div>
          <div className="text-enosys-subtext font-bold text-left">RFLR</div>
          <div className="text-enosys-subtext font-bold text-left">APS</div>
          <div className="text-enosys-subtext font-bold text-left">Status</div>
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
              <div className="text-enosys-subtext text-sm">#{position.id}</div>
              <div className="flex -space-x-2">
                <TokenIcon symbol={position.token0.symbol} size={21} />
                <TokenIcon symbol={position.token1.symbol} size={21} />
              </div>
                  <div>
                    <div className="text-white font-normal whitespace-nowrap">{position.pairLabel}</div>
                    <div className="text-enosys-subtext text-xs">
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
                    <div className="text-enosys-subtext text-xs text-left">
                      Unclaimed fees
                    </div>
                  )}
                </div>

            {/* RFLR Rewards */}
            <div className="text-left">
              {position.rflrUsd > 0 ? (
                <div>
                  <div className="text-white font-normal">${fmtUsd(position.rflrUsd)}</div>
                  <div className="text-enosys-subtext text-xs text-left">{fmtAmt(position.rflrAmount)} RFLR</div>
                  {showRflrDelta ? (
                    <div className="text-enosys-subtext text-[11px] text-left">
                      ({rflrDelta > 0 ? '+' : '-'} {formatRflrDelta(rflrDelta)})
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="text-enosys-subtext text-left">-</div>
              )}
            </div>

            {/* APS Rewards - Removed for Phase 3 */}
            {/* <div className="text-left">
              <div className="text-enosys-subtext text-left">-</div>
            </div> */}

                {/* Range Status */}
                <div className="text-left">
                  <div className="flex items-center justify-start mb-1">
                    <StatusPill inRange={position.isInRange !== undefined ? position.isInRange : position.inRange} />
                  </div>
                  {nonStablePrice && nonStablePrice.price > 0 && (
                    <div className="text-enosys-subtext text-xs text-left">
                      {formatPrice(nonStablePrice.price, nonStablePrice.price < 1 ? 5 : 3)}
                    </div>
                  )}
                </div>
          </div>
        );
        })}

        {/* Totals Row */}
        {showTotalsRow && (
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-4 px-6 py-4 border-t border-enosys-border bg-enosys-subcard">
            <div className="text-enosys-subtext text-sm font-bold text-left">Total</div>
            <div className="text-left">
              <div className="text-white font-normal">${fmtUsd(totals.tvl)}</div>
            </div>
            <div className="text-left">
              <div className="text-white font-normal">${fmtUsd(totals.rewards)}</div>
            </div>
            <div className="text-left">
              <div className="text-white font-normal">${fmtUsd(totals.rflr)}</div>
            </div>
            {/* APS total - Removed for Phase 3 */}
            {/* <div className="text-left">
              <div className="text-white font-normal">-</div>
            </div> */}
            <div></div>
          </div>
        )}
      </div>
    </div>
  );
}
