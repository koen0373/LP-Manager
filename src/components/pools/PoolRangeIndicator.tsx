import React from 'react';

export type RangeStatus = 'in' | 'near' | 'out';

export const PRODUCT_NAME = 'RangeBand™';

export const RANGE_STATUS_COLORS: Record<RangeStatus, string> = {
  in: '#00C66B',
  near: '#FFA500',
  out: '#E74C3C',
};

export const RANGE_STATUS_CONFIG: Record<RangeStatus, { label: string; color: string; animation?: string }> = {
  in: {
    label: 'In Range',
    color: '#00C66B',
    animation: 'heartbeat 1.5s ease-in-out infinite',
  },
  near: {
    label: 'Near Band',
    color: '#FFA500',
    animation: 'rangeGlow 2s ease-in-out infinite',
  },
  out: {
    label: 'Out of Range',
    color: '#E74C3C',
  },
};

export const STRATEGY_THRESHOLDS = {
  aggressiveLt: 12, // < 12% → Aggressive
  conservativeGt: 35, // > 35% → Conservative
};

// Legacy alias for backward compatibility with tests
export const RANGE_STRATEGY_THRESHOLDS = {
  aggressiveMax: STRATEGY_THRESHOLDS.aggressiveLt,
  balancedMax: STRATEGY_THRESHOLDS.conservativeGt,
};

type ResizeObserverCtor = new (callback: () => void) => {
  observe: (target: unknown) => void;
  disconnect: () => void;
};

interface GlobalResizeTarget {
  ResizeObserver?: ResizeObserverCtor;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

export type RangeStrategyTone = 'aggressive' | 'balanced' | 'conservative';

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

export function getRangeWidthPct(min: number | null | undefined, max: number | null | undefined): number {
  if (!isFiniteNumber(min) || !isFiniteNumber(max) || min >= max) {
    return 0;
  }

  const midpoint = (min + max) / 2;
  if (midpoint === 0) {
    return 0;
  }

  const pct = Math.abs(((max - min) / midpoint) * 100);
  return clamp(pct, 0, 999);
}

export function getStrategy(rangeWidthPct: number): RangeStrategyResult {
  const pct = Number.isFinite(rangeWidthPct) ? Math.max(0, rangeWidthPct) : 0;

  if (pct < STRATEGY_THRESHOLDS.aggressiveLt) {
    return { label: 'Aggressive', tone: 'aggressive', pct };
  }
  if (pct <= STRATEGY_THRESHOLDS.conservativeGt) {
    return { label: 'Balanced', tone: 'balanced', pct };
  }
  return { label: 'Conservative', tone: 'conservative', pct };
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

/**
 * Compute track width based on strategy classification.
 * Returns a percentage factor to apply to available container width.
 * 
 * Strategy-based factors:
 * - Aggressive (<12%): 52% of container (shorter track = tighter range)
 * - Balanced (12–35%): 70% of container (medium track)
 * - Conservative (>35%): 88% of container (longer track = wider range)
 */
export function computeTrackWidthFactor(strategy: RangeStrategyResult): number {
  switch (strategy.tone) {
    case 'aggressive':
      return 0.52;
    case 'balanced':
      return 0.70;
    case 'conservative':
      return 0.88;
    default:
      return 0.70;
  }
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
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(600); // default fallback

  const hasRange = isFiniteNumber(min) && isFiniteNumber(max) && (min as number) < (max as number);

  const safeMin = hasRange ? (min as number) : null;
  const safeMax = hasRange ? (max as number) : null;
  const safeCurrent = isFiniteNumber(current) ? (current as number) : null;

  const markerPosition = React.useMemo(
    () => calculateMarkerPosition(min ?? null, max ?? null, current ?? null),
    [current, max, min],
  );

  const rangeWidthPct = React.useMemo(() => {
    return getRangeWidthPct(min ?? null, max ?? null);
  }, [max, min]);

  const strategy = React.useMemo(() => getStrategy(rangeWidthPct), [rangeWidthPct]);
  const statusColor = RANGE_STATUS_COLORS[status] ?? RANGE_STATUS_COLORS.out;
  const statusMeta = RANGE_STATUS_CONFIG[status] ?? RANGE_STATUS_CONFIG.out;

  const formattedCurrent = formatPrice(safeCurrent);
  const formattedMin = formatPrice(safeMin);
  const formattedMax = formatPrice(safeMax);

  // Compute track width based on strategy
  const trackWidthFactor = computeTrackWidthFactor(strategy);
  const computedTrackWidth = containerWidth * trackWidthFactor;
  
  // Apply min/max clamps: desktop min 320px, max 980px; mobile min 260px
  const minTrackWidth = typeof window !== 'undefined' && window.innerWidth < 768 ? 260 : 320;
  const maxTrackWidth = 980;
  const finalTrackWidth = clamp(computedTrackWidth, minTrackWidth, maxTrackWidth);

  // Measure container width
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = () => {
      const rect = container.getBoundingClientRect();
      setContainerWidth(rect.width);
    };

    updateWidth();

    const globalTarget: GlobalResizeTarget | undefined =
      typeof window !== 'undefined'
        ? (window as unknown as GlobalResizeTarget)
        : typeof globalThis !== 'undefined'
          ? (globalThis as unknown as GlobalResizeTarget)
          : undefined;

    if (!globalTarget) {
      return undefined;
    }

    if (globalTarget.ResizeObserver) {
      const Observer = globalTarget.ResizeObserver;
      const observer = new Observer(updateWidth);
      observer.observe(container);
      return () => observer.disconnect();
    }

    if (typeof globalTarget.addEventListener === 'function') {
      globalTarget.addEventListener('resize', updateWidth);
      return () => {
        if (typeof globalTarget.removeEventListener === 'function') {
          globalTarget.removeEventListener('resize', updateWidth);
        }
      };
    }

    return undefined;
  }, []);

  // Enhanced aria-label with status for screen readers
  const ariaLabel = hasRange
    ? `${PRODUCT_NAME}, Strategy: ${strategy.label} (${strategy.pct.toFixed(1)}%), Status: ${statusMeta.label}, Min ${formattedMin}, Current ${formattedCurrent}, Max ${formattedMax}, Width ${rangeWidthPct.toFixed(1)}%`
    : `${PRODUCT_NAME}: Range data unavailable.`;

  const markerTooltip = hasRange
    ? `${PRODUCT_NAME} — Strategy: ${strategy.label} (${strategy.pct.toFixed(1)}%) — Status: ${statusMeta.label} — Current: ${formattedCurrent} ${token1Symbol}/${token0Symbol}`
    : `${PRODUCT_NAME}: Range data unavailable`;

  const strategyAriaLabel = `Strategy: ${strategy.label} (${strategy.pct.toFixed(1)}%)`;

  // Determine marker animation class based on status
  const markerAnimationClass =
    status === 'in'
      ? 'rb-heartbeat-fast'
      : status === 'near'
        ? 'rb-heartbeat-slow'
        : ''; // No animation for 'out'

  // Determine status color class
  const statusColorClass = `rb-status-${status}`;

  return (
    <div
      ref={containerRef}
      className={`ll-rangeband-v2 ${className ?? ''}`.trim()}
      role="img"
      aria-label={ariaLabel}
      style={{
        '--rangeband-color': statusColor,
        '--marker-left': `${markerPosition}%`,
      } as React.CSSProperties}
    >
      {/* Strategy label only (no product title) */}
      <div className="mb-2 flex items-center justify-end">
        <span
          className="text-[12px] font-medium text-[#9AA1AB]"
          style={{ fontFeatureSettings: '"tnum"' }}
          aria-label={strategyAriaLabel}
          title={strategyAriaLabel}
        >
          <span className="text-white/80">{strategy.label}</span>{' '}
          <span className="tnum">({strategy.pct.toFixed(1)}%)</span>
        </span>
      </div>

      {/* Band row: min label + track (strategy-scaled width) + max label */}
      <div className="mb-2 flex w-full items-center justify-center gap-3">
        {/* Min label */}
        <span className="tnum text-[10px] font-semibold text-[#9AA1AB]">{formattedMin}</span>

        {/* Track wrapper with computed width */}
        <div
          className="relative flex items-center"
          style={{ width: `${finalTrackWidth}px` }}
        >
          {/* Horizontal line */}
          <span
            className="absolute left-0 right-0 h-[2px] rounded-full"
            style={{
              background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.15) 100%)',
            }}
            aria-hidden="true"
          />
          {/* Marker (current price dot) - color indicates status */}
          <span
            className={`ll-range-marker ll-range-marker--${status} ${statusColorClass} ${markerAnimationClass}`.trim()}
            style={{
              position: 'absolute',
              left: `${markerPosition}%`,
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: 'currentColor',
              zIndex: 10,
              cursor: 'pointer',
              transition: 'left 0.3s ease-out',
            }}
            title={markerTooltip}
          >
            {/* Screen reader only status text */}
            <span className="sr-only">Status: {statusMeta.label}</span>
          </span>
        </div>

        {/* Max label */}
        <span className="tnum text-[10px] font-semibold text-[#9AA1AB]">{formattedMax}</span>
      </div>

      {/* Current price block (centered below band) */}
      <div className="mt-1 text-center">
        <div className="text-[10px] uppercase tracking-wide text-[#9AA1AB]">Current price</div>
        <div className="tnum text-[16px] font-semibold text-white">{formattedCurrent}</div>
      </div>

      {/* Powered by RangeBand footer (right-bottom corner) */}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-1.5 text-[11px] leading-none text-[#9CA3AF] opacity-70">
        <span className="font-ui">Powered by</span>
        <img
          src="/icons/RangeBand-icon.svg"
          alt="RangeBand icon"
          width={21}
          height={21}
          className="inline-block opacity-80"
        />
        <span className="font-brand font-semibold">RangeBand™</span>
      </div>
    </div>
  );
}

export default RangeBand;
