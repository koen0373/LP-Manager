import React from 'react';
import Image from 'next/image';

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
  explainer?: boolean; // NEW: Show legend row with interactive previews
}

type PreviewState = 
  | { kind: 'none' }
  | { kind: 'strategy'; value: RangeStrategyTone }
  | { kind: 'status'; value: RangeStatus };

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
 * Compute track width factor dynamically based on actual range spread percentage.
 */
export function computeTrackWidthFactor(strategy: RangeStrategyResult): number {
  const pct = Math.max(0, Math.min(strategy.pct, 100));
  const minFactor = 0.25;
  const maxFactor = 0.95;
  const factor = minFactor + (pct / 100) * (maxFactor - minFactor);
  return factor;
}

/**
 * Compute preview min/max for a strategy tone
 */
function computePreviewRange(realMin: number, realMax: number, strategyTone: RangeStrategyTone): { min: number; max: number } {
  const midpoint = (realMin + realMax) / 2;
  let widthPct: number;
  
  switch (strategyTone) {
    case 'aggressive':
      widthPct = 11; // ~11% width
      break;
    case 'balanced':
      widthPct = 22; // ~22% width
      break;
    case 'conservative':
      widthPct = 70; // ~70% width
      break;
  }
  
  const halfWidth = (midpoint * widthPct) / 200;
  return {
    min: midpoint - halfWidth,
    max: midpoint + halfWidth,
  };
}

/**
 * Compute preview marker position for a status
 */
function computePreviewMarkerPosition(min: number, max: number, statusValue: RangeStatus): number {
  const _width = max - min;
  
  switch (statusValue) {
    case 'in':
      return 50; // Center (will be animated from left to right in CSS)
    case 'near':
      // 5% from edge (still inside)
      return Math.random() > 0.5 ? 8 : 92;
    case 'out':
      // Just outside boundary
      return Math.random() > 0.5 ? -5 : 105;
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
  explainer = false,
}: RangeBandProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(600);
  const [preview, setPreview] = React.useState<PreviewState>({ kind: 'none' });
  const [previewAnnounce, setPreviewAnnounce] = React.useState<string>('');
  const [livePrice, setLivePrice] = React.useState<number | null>(null);
  const [_livePosition, setLivePosition] = React.useState<number | null>(null);

  const hasRange = isFiniteNumber(min) && isFiniteNumber(max) && (min as number) < (max as number);
  const safeMin = hasRange ? (min as number) : null;
  const safeMax = hasRange ? (max as number) : null;
  const safeCurrent = isFiniteNumber(current) ? (current as number) : null;

  // Compute display values based on preview or real data
  const displayMin = React.useMemo(() => {
    if (preview.kind === 'strategy' && safeMin !== null && safeMax !== null) {
      const previewRange = computePreviewRange(safeMin, safeMax, preview.value);
      return previewRange.min;
    }
    return safeMin;
  }, [preview, safeMin, safeMax]);

  const displayMax = React.useMemo(() => {
    if (preview.kind === 'strategy' && safeMin !== null && safeMax !== null) {
      const previewRange = computePreviewRange(safeMin, safeMax, preview.value);
      return previewRange.max;
    }
    return safeMax;
  }, [preview, safeMin, safeMax]);

  const displayCurrent = React.useMemo(() => {
    // Use live price if animating (explainer mode with 'in' status)
    if (explainer && livePrice !== null && preview.kind === 'none') {
      return livePrice;
    }
    
    if (preview.kind === 'status' && displayMin !== null && displayMax !== null) {
      // Position marker based on preview status
      const pos = computePreviewMarkerPosition(displayMin, displayMax, preview.value);
      const width = displayMax - displayMin;
      return displayMin + (width * pos) / 100;
    }
    return safeCurrent;
  }, [preview, displayMin, displayMax, safeCurrent, explainer, livePrice]);

  const displayStatus = React.useMemo(() => {
    if (preview.kind === 'status') {
      return preview.value;
    }
    
    // During live animation, calculate status dynamically
    if (explainer && livePrice !== null && displayMin !== null && displayMax !== null) {
      // First check: is price out of range?
      if (livePrice < displayMin || livePrice > displayMax) {
        return 'out'; // 🔴 Red - outside boundaries
      }
      
      // Price is within range, now check distance to boundaries
      const width = displayMax - displayMin;
      const distanceToMin = livePrice - displayMin;
      const distanceToMax = displayMax - livePrice;
      const threshold = width * 0.1; // 10% threshold for "near"
      
      // Near band: within 10% of EITHER boundary (but still inside)
      if (distanceToMin <= threshold || distanceToMax <= threshold) {
        return 'near'; // 🟠 Amber - close to edge but still in range
      }
      
      // Comfortable in range
      return 'in'; // 🟢 Green - safe in center
    }
    
    return status;
  }, [preview, status, explainer, livePrice, displayMin, displayMax]);

  const markerPosition = React.useMemo(
    () => calculateMarkerPosition(displayMin, displayMax, displayCurrent),
    [displayCurrent, displayMax, displayMin],
  );

  const rangeWidthPct = React.useMemo(() => {
    return getRangeWidthPct(displayMin, displayMax);
  }, [displayMax, displayMin]);

  const strategy = React.useMemo(() => getStrategy(rangeWidthPct), [rangeWidthPct]);
  const statusColor = RANGE_STATUS_COLORS[displayStatus] ?? RANGE_STATUS_COLORS.out;
  const statusMeta = RANGE_STATUS_CONFIG[displayStatus] ?? RANGE_STATUS_CONFIG.out;

  const formattedCurrent = formatPrice(displayCurrent);
  const formattedMin = formatPrice(displayMin);
  const formattedMax = formatPrice(displayMax);

  // Compute track width
  const trackWidthFactor = computeTrackWidthFactor(strategy);
  const computedTrackWidth = containerWidth * trackWidthFactor;
  const minTrackWidth = typeof window !== 'undefined' && window.innerWidth < 768 ? 100 : 120;
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

  // Live price animation for explainer mode
  React.useEffect(() => {
    if (!explainer || !safeMin || !safeMax || !safeCurrent) {
      setLivePrice(null);
      setLivePosition(null);
      return;
    }

    // Only pause animation for status preview, not strategy preview
    if (preview.kind === 'status') {
      setLivePrice(null);
      setLivePosition(null);
      return;
    }

    // Use preview range if strategy preview is active
    const activeMin = displayMin ?? safeMin;
    const activeMax = displayMax ?? safeMax;
    const width = activeMax - activeMin;
    
    let time = 0;
    let animationFrame: number;
    
    const animate = () => {
      // Increment time slowly (very slow for calm movement)
      time += 0.0003;
      
      // Create a composite wave that visits all states over ~60 seconds
      // Main slow oscillation with extended range
      const mainWave = Math.sin(time * Math.PI * 2);
      
      // Secondary very slow wave to create near-edge and out-of-range moments
      const edgeWave = Math.sin(time * 0.3 * Math.PI * 2);
      
      // Combine waves: main movement + occasional edge visits
      // This creates: center → near edge → center → out of range → center cycle
      const combinedPosition = mainWave * 0.6 + edgeWave * 0.5;
      
      // Map to price range
      // -1.1 to +1.1 range allows for out-of-range moments
      const normalizedPosition = (combinedPosition + 1.1) / 2.2; // 0 to 1
      
      // Calculate actual price with extended bounds for out-of-range
      const extendedMin = activeMin - width * 0.05;
      const extendedMax = activeMax + width * 0.05;
      const totalRange = extendedMax - extendedMin;
      const newPrice = extendedMin + totalRange * normalizedPosition;
      
      setLivePrice(newPrice);
      // Always calculate position against original bounds for consistency
      setLivePosition(calculateMarkerPosition(safeMin, safeMax, newPrice));
      
      animationFrame = requestAnimationFrame(animate);
    };
    
    animationFrame = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [explainer, safeMin, safeMax, safeCurrent, displayMin, displayMax, preview.kind]);

  const ariaLabel = hasRange
    ? `${PRODUCT_NAME}, Strategy: ${strategy.label} (${strategy.pct.toFixed(1)}%), Status: ${statusMeta.label}, Min ${formattedMin}, Current ${formattedCurrent}, Max ${formattedMax}`
    : `${PRODUCT_NAME}: Range data unavailable.`;

  const markerTooltip = hasRange
    ? `${PRODUCT_NAME} — Strategy: ${strategy.label} (${strategy.pct.toFixed(1)}%) — Status: ${statusMeta.label} — Current: ${formattedCurrent}`
    : `${PRODUCT_NAME}: Range data unavailable`;

  const strategyAriaLabel = `Strategy: ${strategy.label} (${strategy.pct.toFixed(1)}%)`;

  // Marker animation based on display status
  const markerAnimationClass =
    displayStatus === 'in'
      ? 'rb-heartbeat-fast'
      : displayStatus === 'near'
        ? 'rb-heartbeat-slow'
        : '';

  // Add preview-active class for green status when in preview mode
  const previewActiveClass = preview.kind === 'status' && preview.value === 'in' ? 'rb-preview-active' : '';

  const statusColorClass = `rb-status-${displayStatus}`;

  // Preview handlers
  const handleStrategyHover = (strategyTone: RangeStrategyTone) => {
    setPreview({ kind: 'strategy', value: strategyTone });
    setPreviewAnnounce(`Preview: ${strategyTone} strategy`);
  };

  const handleStatusHover = (statusValue: RangeStatus) => {
    setPreview({ kind: 'status', value: statusValue });
    const statusLabel = statusValue === 'in' ? 'In Range' : statusValue === 'near' ? 'Near Band' : 'Out of Range';
    setPreviewAnnounce(`Preview: Status ${statusLabel}`);
  };

  const handlePreviewLeave = () => {
    setPreview({ kind: 'none' });
    setPreviewAnnounce('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
    if (e.key === 'Escape') {
      handlePreviewLeave();
    }
  };

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
      {/* Strategy label - centered above band */}
      <div className="mb-3 flex items-center justify-center">
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

      {/* Band row */}
      <div className="mb-3 flex w-full items-center justify-center gap-3">
        <span className="tnum text-[10px] font-semibold text-[#9AA1AB]">{formattedMin}</span>

        <div
          className="relative flex items-center"
          style={{ width: `${finalTrackWidth}px` }}
        >
          <span
            className="absolute left-0 right-0 h-[2px] rounded-full"
            style={{
              background: 'linear-gradient(90deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.15) 100%)',
            }}
            aria-hidden="true"
          />
          <span
            className={`ll-range-marker ll-range-marker--${displayStatus} ${statusColorClass} ${markerAnimationClass} ${previewActiveClass}`.trim()}
            style={{
              position: 'absolute',
              left: `${markerPosition}%`,
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              backgroundColor: 'currentColor',
              zIndex: 10,
              cursor: 'pointer',
              transition: preview.kind === 'none' && !explainer ? 'left 0.6s ease-in-out' : 'none',
            }}
            title={markerTooltip}
          >
            <span className="sr-only">Status: {statusMeta.label}</span>
          </span>
        </div>

        <span className="tnum text-[10px] font-semibold text-[#9AA1AB]">{formattedMax}</span>
      </div>

      {/* Current price */}
      <div className="mt-3 text-center">
        <div className="text-[10px] uppercase tracking-wide text-[#9AA1AB]">Current price</div>
        <div className="tnum text-[16px] font-semibold text-white">
          {formattedCurrent} <span className="text-[13px] text-white/60">{token1Symbol}/{token0Symbol}</span>
        </div>
      </div>

      {/* Powered by RangeBand™ footer with legend (if explainer) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-white/5 pt-4 text-[11px] leading-none">
        {/* Left: Powered by */}
        <div className="flex items-center gap-1.5 text-[#9CA3AF] opacity-70">
          <span className="font-ui text-[10px]">Powered by</span>
          <Image
            src="/media/icons/rangeband.svg"
            alt=""
            width={18}
            height={18}
            className="inline-block opacity-80"
            aria-hidden="true"
          />
          <span className="font-brand text-[11px] font-semibold">RangeBand™</span>
        </div>

        {/* Right: Legend (if explainer) */}
        {explainer && (
          <div className="flex flex-wrap items-center gap-4">
            {/* Strategy chips */}
            <div className="flex items-center gap-1.5">
              <span className="mr-1 font-ui text-[10px] uppercase tracking-wider text-white/40">Strategy</span>
              {(['aggressive', 'balanced', 'conservative'] as const).map((tone) => {
                const label = tone.charAt(0).toUpperCase() + tone.slice(1);
                const shortLabel = tone === 'aggressive' ? 'Aggr' : tone === 'balanced' ? 'Bal' : 'Cons';
                return (
                  <button
                    key={tone}
                    type="button"
                    className={`rounded-md px-2.5 py-1 font-ui text-[10px] font-semibold uppercase tracking-wide transition-all ${
                      preview.kind === 'strategy' && preview.value === tone
                        ? 'bg-aqua-500/25 text-aqua-300 ring-1 ring-aqua-400/60 shadow-sm'
                        : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70'
                    }`}
                    onMouseEnter={() => handleStrategyHover(tone)}
                    onMouseLeave={handlePreviewLeave}
                    onFocus={() => handleStrategyHover(tone)}
                    onBlur={handlePreviewLeave}
                    onKeyDown={(e) => handleKeyDown(e, () => handleStrategyHover(tone))}
                    aria-label={`Preview ${label} strategy`}
                    title={label}
                  >
                    {shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Status dots */}
            <div className="flex items-center gap-1.5">
              <span className="mr-1 font-ui text-[10px] uppercase tracking-wider text-white/40">Status</span>
              {(['in', 'near', 'out'] as const).map((statusValue) => {
                const dotColor = RANGE_STATUS_COLORS[statusValue];
                const statusLabel = statusValue === 'in' ? 'In Range' : statusValue === 'near' ? 'Near Band' : 'Out of Range';
                return (
                  <button
                    key={statusValue}
                    type="button"
                    className={`h-3.5 w-3.5 rounded-full transition-all ${
                      preview.kind === 'status' && preview.value === statusValue
                        ? 'scale-125 ring-2 ring-white/40 ring-offset-1 ring-offset-transparent shadow-lg'
                        : 'scale-100 hover:scale-110 hover:ring-1 hover:ring-white/20'
                    }`}
                    style={{ 
                      backgroundColor: dotColor,
                      boxShadow: preview.kind === 'status' && preview.value === statusValue 
                        ? `0 0 8px ${dotColor}` 
                        : 'none'
                    }}
                    onMouseEnter={() => handleStatusHover(statusValue)}
                    onMouseLeave={handlePreviewLeave}
                    onFocus={() => handleStatusHover(statusValue)}
                    onBlur={handlePreviewLeave}
                    onKeyDown={(e) => handleKeyDown(e, () => handleStatusHover(statusValue))}
                    aria-label={`Preview ${statusLabel}`}
                    title={statusLabel}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Accessibility: announce preview changes */}
      {explainer && (
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {previewAnnounce}
        </div>
      )}
    </div>
  );
}

export default RangeBand;
