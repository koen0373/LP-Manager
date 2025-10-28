import React from 'react';

export type RangeStatus = 'in' | 'near' | 'out';

export const RANGE_STATUS_COLORS: Record<RangeStatus, string> = {
  in: '#00C66B',
  near: '#FFA500',
  out: '#E74C3C',
};

export const RANGE_STRATEGY_THRESHOLDS = {
  aggressiveMax: 12, // < 12% → Aggressive
  balancedMax: 35, // 12% – 35% → Balanced
};

export type RangeStrategyTone = 'narrow' | 'balanced' | 'wide';

export interface RangeStrategyResult {
  label: 'Aggressive' | 'Balanced' | 'Conservative';
  tone: RangeStrategyTone;
  pct: number;
}

interface RangeBandProps {
  min?: number | null;
  max?: number | null;
  current?: number | null;
  status: RangeStatus;
  token0Symbol: string;
  token1Symbol: string;
  className?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function formatPrice(value: number | null | undefined): string {
  if (!isFiniteNumber(value)) return '—';
  return value.toFixed(6);
}

export function getStrategy(rangeWidthPct: number): RangeStrategyResult {
  const pct = Number.isFinite(rangeWidthPct) ? Math.max(0, rangeWidthPct) : 0;

  if (pct < RANGE_STRATEGY_THRESHOLDS.aggressiveMax) {
    return { label: 'Aggressive', tone: 'narrow', pct };
  }
  if (pct <= RANGE_STRATEGY_THRESHOLDS.balancedMax) {
    return { label: 'Balanced', tone: 'balanced', pct };
  }
  return { label: 'Conservative', tone: 'wide', pct };
}

export function getRangeStatus(
  currentPrice: number | null | undefined,
  lowerPrice: number | null | undefined,
  upperPrice: number | null | undefined,
): RangeStatus {
  if (!isFiniteNumber(lowerPrice) || !isFiniteNumber(upperPrice) || lowerPrice >= upperPrice) {
    return 'out';
  }

  if (!isFiniteNumber(currentPrice)) {
    return 'out';
  }

  const width = upperPrice - lowerPrice;
  const near = width * 0.03;
  const nearLower = lowerPrice + near;
  const nearUpper = upperPrice - near;

  if (currentPrice < lowerPrice || currentPrice > upperPrice) {
    return 'out';
  }

  if (currentPrice <= nearLower || currentPrice >= nearUpper) {
    return 'near';
  }

  return 'in';
}

export function calculateMarkerPosition(
  min: number | null | undefined,
  max: number | null | undefined,
  current: number | null | undefined,
): number {
  const hasRange = isFiniteNumber(min) && isFiniteNumber(max) && (min as number) < (max as number);
  const safeMin = hasRange ? (min as number) : null;
  const safeMax = hasRange ? (max as number) : null;

  if (!hasRange || safeMin === null || safeMax === null) {
    return 50;
  }

  if (!isFiniteNumber(current)) {
    return 50;
  }

  const safeCurrent = current as number;

  if (safeCurrent <= safeMin) {
    return 0;
  }

  if (safeCurrent >= safeMax) {
    return 100;
  }

  const ratio = (safeCurrent - safeMin) / (safeMax - safeMin);
  return clamp(ratio * 100, 0, 100);
}

export function RangeBand({
  min,
  max,
  current,
  status,
  token0Symbol,
  token1Symbol,
  className,
}: RangeBandProps) {
  const hasRange = isFiniteNumber(min) && isFiniteNumber(max) && (min as number) < (max as number);

  const safeMin = hasRange ? (min as number) : null;
  const safeMax = hasRange ? (max as number) : null;
  const safeCurrent = isFiniteNumber(current) ? (current as number) : null;

  const markerPosition = React.useMemo(
    () => calculateMarkerPosition(min ?? null, max ?? null, current ?? null),
    [current, max, min],
  );

  const rangeWidthPct = React.useMemo(() => {
    if (!hasRange || safeMin === null || safeMax === null) {
      return 0;
    }

    const midpoint = (safeMin + safeMax) / 2;
    if (midpoint === 0) {
      return 0;
    }

    return Math.abs(((safeMax - safeMin) / midpoint) * 100);
  }, [hasRange, safeMax, safeMin]);

  const strategy = React.useMemo(() => getStrategy(rangeWidthPct), [rangeWidthPct]);
  const statusColor = RANGE_STATUS_COLORS[status] ?? RANGE_STATUS_COLORS.out;

  const formattedCurrent = formatPrice(safeCurrent);

  // Bereken lijnlengte op basis van strategy
  // Aggressive (< 12%): 30% breed
  // Balanced (12-35%): 60% breed
  // Conservative (> 35%): 90% breed
  const lineWidth = strategy.tone === 'narrow' ? 30 : strategy.tone === 'balanced' ? 60 : 90;

  const ariaLabel = hasRange
    ? `Range: Current ${formattedCurrent}, Strategy ${strategy.label}.`
    : 'Range data unavailable.';

  return (
    <div
      className={`ll-rangeband-v2 ${className ?? ''}`.trim()}
      role="img"
      aria-label={ariaLabel}
      style={{ 
        '--rangeband-color': statusColor,
        '--line-width': `${lineWidth}%`,
        '--marker-left': `${markerPosition}%`
      } as React.CSSProperties}
    >
      {/* Current price label boven de lijn */}
      <div className="ll-range-label">Current price</div>

      {/* Horizontale lijn met marker - lengte = strategy */}
      <div className="ll-range-track">
        <span className="ll-range-line" aria-hidden="true" />
        <span
          className={`ll-range-marker ll-range-marker--${status}`}
          style={{ left: `${markerPosition}%` }}
          title={`Current: ${formattedCurrent} ${token1Symbol}/${token0Symbol}`}
        />
      </div>

      {/* Current price value onder de lijn */}
      <div className="ll-range-value">{formattedCurrent}</div>
    </div>
  );
}

export default RangeBand;
