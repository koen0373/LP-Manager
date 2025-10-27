import React from 'react';

export type RangeStatus = 'IN_RANGE' | 'NEAR_BAND' | 'OUT_OF_RANGE';

interface PoolRangeIndicatorProps {
  lowerPrice?: number | null;
  upperPrice?: number | null;
  currentPrice?: number | null;
  status: RangeStatus;
  className?: string;
}

const gradientClass =
  'relative w-full overflow-hidden rounded-full bg-[linear-gradient(90deg,#E74C3C_0%,#FFA500_20%,#00C66B_50%,#FFA500_80%,#E74C3C_100%)]';

const STATUS_COLORS: Record<RangeStatus, string> = {
  IN_RANGE: '#00C66B',
  NEAR_BAND: '#FFA500',
  OUT_OF_RANGE: '#E74C3C',
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function getRangeStatus(
  currentPrice: number | null | undefined,
  lowerPrice: number | null | undefined,
  upperPrice: number | null | undefined,
): RangeStatus {
  if (
    typeof currentPrice !== 'number' ||
    !Number.isFinite(currentPrice) ||
    typeof lowerPrice !== 'number' ||
    typeof upperPrice !== 'number' ||
    !Number.isFinite(lowerPrice) ||
    !Number.isFinite(upperPrice) ||
    lowerPrice >= upperPrice
  ) {
    return 'OUT_OF_RANGE';
  }

  const width = upperPrice - lowerPrice;
  const near = width * 0.03;
  const nearLower = lowerPrice + near;
  const nearUpper = upperPrice - near;

  if (currentPrice < lowerPrice || currentPrice > upperPrice) {
    return 'OUT_OF_RANGE';
  }

  if (currentPrice <= nearLower || currentPrice >= nearUpper) {
    return 'NEAR_BAND';
  }

  return 'IN_RANGE';
}

export function PoolRangeIndicator({
  lowerPrice,
  upperPrice,
  currentPrice,
  status,
  className,
}: PoolRangeIndicatorProps) {
  const hasRange =
    typeof lowerPrice === 'number' &&
    typeof upperPrice === 'number' &&
    Number.isFinite(lowerPrice) &&
    Number.isFinite(upperPrice) &&
    lowerPrice < upperPrice;

  const markerPosition = React.useMemo(() => {
    if (!hasRange || typeof currentPrice !== 'number' || !Number.isFinite(currentPrice)) {
      return status === 'OUT_OF_RANGE' ? (currentPrice && currentPrice < (lowerPrice ?? 0) ? 0 : 100) : 50;
    }

    const ratio = (currentPrice - (lowerPrice as number)) / ((upperPrice as number) - (lowerPrice as number));
    return clamp(ratio * 100, 0, 100);
  }, [currentPrice, hasRange, lowerPrice, status, upperPrice]);

  const markerColor = STATUS_COLORS[status] ?? STATUS_COLORS.OUT_OF_RANGE;
  const labelStatus = status.replace(/_/g, ' ').toLowerCase();

  const ariaLabel =
    typeof currentPrice === 'number' && typeof lowerPrice === 'number' && typeof upperPrice === 'number'
      ? `Current price ${currentPrice.toFixed(5)}, minimum ${lowerPrice.toFixed(5)}, maximum ${upperPrice.toFixed(5)}, status ${labelStatus}`
      : 'Current price status unavailable';

  return (
    <div
      className={`${gradientClass} h-[6px] md:h-2 ${className ?? ''}`.trim()}
      role="img"
      aria-label={ariaLabel}
    >
      <span
        className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border shadow-[0_0_8px_rgba(255,255,255,0.5)] transition-transform"
        style={{
          left: `${markerPosition}%`,
          transform: 'translate(-50%, -50%)',
          backgroundColor: markerColor,
          borderColor: markerColor,
        }}
      />
    </div>
  );
}

export default PoolRangeIndicator;
