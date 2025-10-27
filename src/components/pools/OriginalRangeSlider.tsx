import React from 'react';

import { RangeStatus, getRangeStatus } from '@/components/pools/PoolRangeIndicator';

interface OriginalRangeSliderProps {
  lowerPrice?: number | null;
  upperPrice?: number | null;
  currentPrice?: number | null;
  status?: RangeStatus;
  className?: string;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

const STATUS_COLORS: Record<RangeStatus, string> = {
  IN_RANGE: '#00C66B',
  NEAR_BAND: '#FFA500',
  OUT_OF_RANGE: '#E74C3C',
};

export function OriginalRangeSlider({
  lowerPrice,
  upperPrice,
  currentPrice,
  status,
  className,
}: OriginalRangeSliderProps) {
  const derivedStatus = React.useMemo(
    () =>
      status ??
      getRangeStatus(
        currentPrice ?? null,
        typeof lowerPrice === 'number' ? lowerPrice : null,
        typeof upperPrice === 'number' ? upperPrice : null,
      ),
    [currentPrice, lowerPrice, status, upperPrice],
  );

  const hasRange =
    typeof lowerPrice === 'number' &&
    typeof upperPrice === 'number' &&
    Number.isFinite(lowerPrice) &&
    Number.isFinite(upperPrice) &&
    lowerPrice < upperPrice;

  const markerPosition = React.useMemo(() => {
    if (!hasRange || typeof currentPrice !== 'number' || !Number.isFinite(currentPrice)) {
      return derivedStatus === 'OUT_OF_RANGE' ? (currentPrice && currentPrice < (lowerPrice ?? 0) ? 0 : 100) : 50;
    }

    const ratio = (currentPrice - (lowerPrice as number)) / ((upperPrice as number) - (lowerPrice as number));
    return clamp(ratio * 100, 0, 100);
  }, [currentPrice, derivedStatus, hasRange, lowerPrice, upperPrice]);

  const markerColor = STATUS_COLORS[derivedStatus];
  const labelStatus = derivedStatus.replace(/_/g, ' ').toLowerCase();

  // Animation classes based on status
  const markerAnimationClass = 
    derivedStatus === 'IN_RANGE' ? 'animate-pulse-green' :
    derivedStatus === 'NEAR_BAND' ? 'animate-glow-orange' :
    '';

  // Static shadow for red (no animation)
  const staticShadow = derivedStatus === 'OUT_OF_RANGE' ? `0 0 8px ${markerColor}60` : undefined;

  const ariaLabel =
    typeof currentPrice === 'number' && typeof lowerPrice === 'number' && typeof upperPrice === 'number'
      ? `Current price ${currentPrice.toFixed(5)}, minimum ${lowerPrice.toFixed(5)}, maximum ${upperPrice.toFixed(5)}, status ${labelStatus}`
      : 'Current price status unavailable';

  return (
    <div className={`flex flex-col items-center gap-2 ${className ?? ''}`.trim()} role="img" aria-label={ariaLabel}>
      <div className="font-ui text-xs font-medium text-[#E6E6E6]">Current price</div>
      <div className="relative w-full max-w-[200px] mx-auto">
        <div className="h-[2px] w-full rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
        <div
          className={`absolute top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-sm ${markerAnimationClass}`}
          style={{
            left: `${markerPosition}%`,
            transform: 'translate(-50%, -50%)',
            backgroundColor: markerColor,
            ...(staticShadow && { boxShadow: staticShadow }),
          }}
        />
      </div>
      {typeof currentPrice === 'number' && Number.isFinite(currentPrice) && (
        <div className="font-ui tnum text-sm font-medium text-white">{currentPrice.toFixed(3)}</div>
      )}
    </div>
  );
}

export default OriginalRangeSlider;
