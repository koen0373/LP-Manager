'use client';

import React from 'react';

type StrategyKey = 'AGGR' | 'BAL' | 'CONS';

type InlineRealProps = {
  pair?: { base: 'WFLR' | 'FXRP'; quote: 'USDTe' | 'USDT0' | 'USDC.e' };
  defaultStrategy?: StrategyKey;
  pollMs?: number;
  min?: number;
  max?: number;
  price?: number;
};

const STRATEGY_WIDTH: Record<StrategyKey, number> = {
  AGGR: 0.1,
  BAL: 0.2,
  CONS: 0.35,
};

export function InlineReal({
  pair = { base: 'WFLR', quote: 'USDTe' },
  defaultStrategy = 'BAL',
  pollMs = 15000,
  min,
  max,
  price,
}: InlineRealProps) {
  const [strategy, setStrategy] = React.useState<StrategyKey>(defaultStrategy);
  const [remotePrice, setRemotePrice] = React.useState<number | null>(price ?? null);

  React.useEffect(() => {
    let active = true;

    async function fetchPrice() {
      try {
        const response = await fetch('/api/prices/current?symbol=WFLR');
        if (!response.ok) throw new Error('price_fetch_failed');
        const data = await response.json();
        const value = Number(data?.prices?.WFLR ?? data?.prices?.wflr);
        if (active && Number.isFinite(value)) {
          setRemotePrice(value);
        }
      } catch (error) {
        if (active && remotePrice == null) {
          setRemotePrice(1);
        }
      }
    }

    fetchPrice();
    const id = setInterval(fetchPrice, pollMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pollMs, remotePrice]);

  const effectivePrice = price ?? remotePrice ?? 1;

  const computedRange = React.useMemo(() => {
    if (typeof min === 'number' && typeof max === 'number') {
      return { min, max };
    }
    const width = STRATEGY_WIDTH[strategy];
    const half = width / 2;
    return {
      min: effectivePrice * (1 - half),
      max: effectivePrice * (1 + half),
    };
  }, [min, max, strategy, effectivePrice]);

  const width = Math.max(computedRange.max - computedRange.min, Number.EPSILON);
  const domain = {
    min: computedRange.min - width * 0.1,
    max: computedRange.max + width * 0.1,
  };

  const status = computeStatus(effectivePrice, computedRange.min, computedRange.max);
  const rangeStartPercent = normalize(computedRange.min, domain.min, domain.max);
  const rangeWidthPercent = normalize(computedRange.max, domain.min, domain.max) - rangeStartPercent;
  const dotPercent = normalize(effectivePrice, domain.min, domain.max);

  return (
    <div className="w-full rounded-2xl border border-white/10 bg-[rgba(11,21,48,0.9)] px-6 py-6 text-left shadow-2xl">
      <div className="flex items-center justify-between text-xs text-white/60">
        <span className="font-num tabular-nums">Min {computedRange.min.toFixed(2)}</span>
        <span className="font-num tabular-nums">Max {computedRange.max.toFixed(2)}</span>
      </div>
      <div className="rb-rail mt-4">
        <div
          className="rb-range"
          style={{ left: `${rangeStartPercent}%`, width: `${Math.max(rangeWidthPercent, 0)}%` }}
        />
        <span
          className="rb-dot absolute -top-[4px]"
          style={{ left: `calc(${dotPercent}% - 9px)` }}
          aria-label="RangeBand™ current price marker"
        />
      </div>
      <div className="mt-4 flex flex-col items-center gap-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Current price</p>
        <p className="font-num text-3xl font-semibold text-white tabular-nums">
          {effectivePrice.toFixed(4)} {pair.base}/{pair.quote}
        </p>
      </div>
      <div className="mt-4 flex flex-col gap-3 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between">
        <span>Powered by RangeBand™</span>
        <div className="flex flex-wrap items-center gap-2" aria-label="Select RangeBand strategy">
          {(['AGGR', 'BAL', 'CONS'] as StrategyKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStrategy(key)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${strategy === key ? 'border-[#3B82F6] text-white' : 'border-white/20 text-white/70'}`}
            >
              {key}
            </button>
          ))}
          <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/80">
            <StatusDot status={status} /> {statusLabel(status)}
          </span>
        </div>
      </div>
    </div>
  );
}

function computeStatus(price: number, min: number, max: number): 'in' | 'near' | 'out' {
  if (max <= min) return 'out';
  const width = max - min;
  const tolerance = width * 0.05;
  if (price >= min && price <= max) return 'in';
  if (price < min) return Math.abs(price - min) <= tolerance ? 'near' : 'out';
  return Math.abs(price - max) <= tolerance ? 'near' : 'out';
}

function normalize(value: number, min: number, max: number) {
  if (max === min) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function StatusDot({ status }: { status: 'in' | 'near' | 'out' }) {
  const meta =
    status === 'in'
      ? 'bg-[#34D399]'
      : status === 'near'
      ? 'bg-[#FBBF24]'
      : 'bg-[#F87171]';
  return <span className={`h-2.5 w-2.5 rounded-full ${meta}`} aria-hidden="true" />;
}

function statusLabel(status: 'in' | 'near' | 'out') {
  if (status === 'in') return 'In range';
  if (status === 'near') return 'Near band';
  return 'Out of range';
}
