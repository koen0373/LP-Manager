import React from 'react';
import clsx from 'clsx';

type RangeStatusKey = 'in' | 'near' | 'out' | 'unknown';

const STATUS_META: Record<
  RangeStatusKey,
  { label: string; color: string }
> = {
  in: { label: 'In Range', color: '#00C66B' },
  near: { label: 'Near Band', color: '#FFA500' },
  out: { label: 'Out of Range', color: '#E74C3C' },
  unknown: { label: '—', color: 'rgba(255,255,255,0.24)' },
};

export type PoolRowPreviewProps = {
  pool: {
    id?: string;
    provider?: string | null;
    providerSlug?: string | null;
    displayId?: string | null;
    pairLabel?: string | null;
    feeTierBps?: number | null;
    status?: string | null;
    rangeStatus?: string | null;
    inRange?: boolean | null;
  };
  className?: string;
};

export function PoolRowPreview({ pool, className }: PoolRowPreviewProps) {
  const {
    provider,
    providerSlug,
    displayId,
    pairLabel,
    feeTierBps,
    rangeStatus,
    status,
    inRange,
  } = pool;

  const normalizedStatus = React.useMemo<RangeStatusKey>(() => {
    const raw = (rangeStatus ?? status ?? '').toString().toLowerCase();
    if (raw.includes('near')) return 'near';
    if (raw.includes('out')) return 'out';
    if (raw.includes('in')) return 'in';
    if (typeof inRange === 'boolean') {
      return inRange ? 'in' : 'out';
    }
    return 'unknown';
  }, [inRange, rangeStatus, status]);

  const statusMeta = STATUS_META[normalizedStatus];

  const feeLabel =
    typeof feeTierBps === 'number' && !Number.isNaN(feeTierBps)
      ? `${(feeTierBps / 10000).toFixed(2)}%`
      : '—';

  return (
    <div
      className={clsx(
        'flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 backdrop-blur',
        className,
      )}
    >
      <div className="flex flex-col gap-1 text-left">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/50">
          <span>{provider ?? providerSlug ?? 'Liquidity Pool'}</span>
          {displayId ? (
            <>
              <span aria-hidden="true">•</span>
              <span className="tracking-[0.12em] text-white/40">{displayId}</span>
            </>
          ) : null}
        </div>
        <span className="font-semibold text-white">
          {pairLabel ?? 'Unknown pair'}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end text-xs font-medium uppercase tracking-wide">
          <span className="text-white/40">Fee</span>
          <span className="tnum text-white">{feeLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: statusMeta.color }}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold text-white/70">
            {statusMeta.label}
          </span>
        </div>
      </div>
    </div>
  );
}
