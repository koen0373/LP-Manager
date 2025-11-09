'use client';

import { useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';

import Paywall from '@/components/paywall/Paywall';
import { TokenIcon } from '@/components/TokenIcon';
import RangeBand, { type RangeStatus } from '@/components/pools/PoolRangeIndicator';

type AllowedProvider = 'enosys-v3' | 'sparkdex-v3' | string;

type PoolsTableRange = {
  min: number | null | undefined;
  max: number | null | undefined;
  current: number | null | undefined;
};

export type PoolsTableItem = {
  provider: AllowedProvider;
  token0: { symbol: string; address: string; decimals?: number };
  token1: { symbol: string; address: string; decimals?: number };
  tvlUsd: number;
  unclaimedFeesUsd: number;
  incentivesUsd?: number | null;
  incentivesToken?: string | null;
  incentivesTokenAmount?: number | null;
  apr24h?: number | null;
  isInRange: boolean;
  status: 'in' | 'near' | 'out' | 'ended';
  range?: PoolsTableRange | null;
  tokenId?: string | null;
  poolAddress?: string | null;
  marketId?: string | null;
  poolFeeBps?: number | null;
  amount0?: number | null;
  amount1?: number | null;
  fee0?: number | null;
  fee1?: number | null;
  liquidityShare?: number | null;
};

export type PoolsTableProps = {
  title: string;
  items: PoolsTableItem[];
  entitlements: {
    role?: 'VISITOR' | 'PREMIUM' | 'PRO';
    fields?: {
      apr?: boolean;
      incentives?: boolean;
      rangeBand?: boolean;
    };
  };
  defaultExpanded?: boolean;
  onRowClick?: (item: PoolsTableItem) => void;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function formatNumeric(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (abs >= 1) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  if (abs >= 0.01) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function formatPercent(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return `${value.toFixed(value < 1 ? 2 : 1)}%`;
}

function formatRangeValue(value?: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function shortId(id?: string | null) {
  if (!id) return '';
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function resolveRangeStatus(status: PoolsTableItem['status']): RangeStatus {
  if (status === 'in' || status === 'near' || status === 'out') return status;
  return 'out';
}

function statusMeta(status: PoolsTableItem['status'], inRange: boolean) {
  if (inRange || status === 'in') {
    return { className: 'status-dot status-dot--in', label: 'In range' as const };
  }
  if (status === 'near') {
    return { className: 'status-dot status-dot--near', label: 'Near band' as const };
  }
  return {
    className: 'status-dot status-dot--out',
    label: status === 'ended' ? 'Ended' : 'Out of range',
  };
}

export default function PoolsTable({
  title,
  items,
  entitlements,
  defaultExpanded = false,
  onRowClick,
}: PoolsTableProps) {
  const [expanded, setExpanded] = useState<boolean>(defaultExpanded);

  const canViewApr = entitlements.fields?.apr !== false;
  const canViewIncentives = entitlements.fields?.incentives !== false;
  const rows = useMemo(() => {
    return items.map((item, index) => {
      const id =
        item.marketId ??
        item.tokenId ??
        item.poolAddress ??
        `${item.provider}-${item.token0.symbol}-${item.token1.symbol}-${index}`;

      const providerParts = [
        item.provider ? item.provider.toUpperCase() : 'UNKNOWN',
        item.marketId ?? item.tokenId ?? shortId(item.poolAddress),
        typeof item.poolFeeBps === 'number' && Number.isFinite(item.poolFeeBps)
          ? `${(item.poolFeeBps / 100).toFixed(2)}%`
          : null,
      ].filter(Boolean);

      const budgetClick = typeof onRowClick === 'function';

      const handleClick = () => {
        if (budgetClick) onRowClick?.(item);
      };

      const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!budgetClick) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onRowClick?.(item);
        }
      };

      const status = statusMeta(item.status, item.isInRange);

      const mainRow = (
        <div
          key={`${id}-row`}
          className={cx(
            'group radius-card px-4 py-4 font-ui transition-colors hover:bg-white/5 focus-within:bg-white/5 min-h-[68px] md:min-h-[76px]',
            budgetClick && 'cursor-pointer',
          )}
          role={budgetClick ? 'button' : undefined}
          tabIndex={budgetClick ? 0 : undefined}
          onClick={budgetClick ? handleClick : undefined}
          onKeyDown={budgetClick ? handleKeyDown : undefined}
        >
          <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1.8fr)_repeat(4,minmax(0,1fr))] md:items-center">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center" aria-hidden="true">
                  <span className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-white/10">
                    <TokenIcon symbol={item.token0.symbol} address={item.token0.address} size={20} />
                  </span>
                  <span className="-ml-2 inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-white/10">
                    <TokenIcon symbol={item.token1.symbol} address={item.token1.address} size={20} />
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-brand text-base font-semibold text-white">
                    {item.token0.symbol} / {item.token1.symbol}
                    {!expanded && (
                      <span
                        className={cx(status.className, 'ml-3 align-middle')}
                        role="img"
                        aria-label={status.label}
                      />
                    )}
                  </p>
                  <p className="mt-1 truncate thead-label">
                    {providerParts.join(' • ')}
                  </p>
                </div>
              </div>
            </div>

            <div className="font-num text-right text-base font-semibold text-white">
              {formatNumeric(item.tvlUsd)}
            </div>

            <div className="font-num text-right text-base font-semibold text-white">
              {formatNumeric(item.unclaimedFeesUsd)}
            </div>

            <div className="text-right">
              {canViewIncentives ? (
                <p className="font-num text-base font-semibold text-white">
                  {formatNumeric(item.incentivesUsd ?? 0)}
                </p>
              ) : (
                <Paywall inline />
              )}
            </div>

            <div className="text-right">
              {canViewApr ? (
                <p className="font-num text-base font-semibold text-white">
                  {formatPercent(item.apr24h)}
                </p>
              ) : (
                <Paywall inline />
              )}
            </div>
          </div>
        </div>
      );

      const stackedRow =
        expanded && item.range
          ? (
              <div
                key={`${id}-stacked`}
                className="relative mt-1 px-4 py-4 font-ui text-xs text-white/70 transition-colors group-hover:bg-white/5"
              >
                <RangeBand
                  min={item.range.min}
                  max={item.range.max}
                  current={item.range.current}
                  status={resolveRangeStatus(item.status)}
                  token0Symbol={item.token0.symbol}
                  token1Symbol={item.token1.symbol}
                  variant="stacked"
                />
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px] text-white/65">
                  <span>
                    Range:{' '}
                    <span className="font-num text-white">
                      {formatRangeValue(item.range.min)} — {formatRangeValue(item.range.max)}
                    </span>
                  </span>
                  {typeof item.range.current === 'number' && Number.isFinite(item.range.current) && (
                    <span>
                      Current:{' '}
                      <span className="font-num text-white">
                        {formatRangeValue(item.range.current)}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            )
          : null;

      return (
        <div key={id} className="space-y-2">
          {mainRow}
          {stackedRow}
          {index < items.length - 1 && <div className="divider" />}
        </div>
      );
    });
  }, [expanded, items, onRowClick, canViewApr, canViewIncentives]);

  const toggleLabel = expanded ? '+' : '−';
  const toggleClassName = expanded
    ? 'btn-primary segmented-btn--icon'
    : 'segmented-btn--off segmented-btn--icon';

  return (
    <section className="card space-y-5 font-ui">
      <header className="radius-card flex flex-col gap-3 bg-white/[0.02] px-4 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="thead-label">
          {title}
        </p>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className={toggleClassName}
          aria-label="Toggle RangeBand view"
          aria-pressed={expanded}
        >
          {toggleLabel}
        </button>
      </header>

      {items.length === 0 ? (
        <div className="card--quiet font-ui text-sm text-white/70">
          No pools available yet. Create liquidity on a partner DEX and it will appear automatically.
        </div>
      ) : (
        <div className="space-y-3">{rows}</div>
      )}
    </section>
  );
}
