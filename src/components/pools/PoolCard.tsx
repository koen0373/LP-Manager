'use client';

import Link from 'next/link';
import React from 'react';

import { TokenIcon } from '@/components/TokenIcon';
import type { PositionRow } from '@/lib/positions/types';

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

type PoolCardProps = {
  position: PositionRow;
  demoMode?: boolean;
};

const FALLBACK_ENTITLEMENTS: PositionRow['entitlements'] = {
  role: 'VISITOR',
  flags: { premium: false, analytics: false },
};

export function PoolCard({ position, demoMode = false }: PoolCardProps) {
  const entitlements = position.entitlements ?? FALLBACK_ENTITLEMENTS;
  const premium = Boolean(entitlements?.flags?.premium);
  const shouldMask = !demoMode && !premium;
  const statusMeta = getStatusMeta(position.status);

  const tvl = safeNumber(position.amountsUsd?.total);
  const tvlDisplay = usd(tvl);

  const tvlForApr = typeof tvl === 'number' && tvl > 0 ? tvl : null;
  const feesApr = tvlForApr && !shouldMask ? aprFromUsd(position.fees24hUsd, tvlForApr) : null;
  const incentivesApr =
    tvlForApr && !shouldMask ? aprFromUsd(position.incentivesUsdPerDay ? position.incentivesUsdPerDay * 365 : null, tvlForApr) : null;
  const totalApr = [feesApr, incentivesApr].filter((value): value is number => typeof value === 'number').reduce((sum, current) => sum + current, 0);

  const totalAprDisplay =
    typeof totalApr === 'number' && Number.isFinite(totalApr) && totalApr > 0 ? percent(totalApr) : '—';
  const feesAprDisplay = formatAprDetail(feesApr, 'fees');
  const incentivesAprDisplay = formatAprDetail(incentivesApr, 'incentives');

  const claimUsd = !shouldMask ? safeNumber(position.claim?.usd) : null;
  const manageUrl = getDexLink(position.dex, position.poolAddress);
  const detailUrl = `/pool/${position.tokenId}`;
  const tokenBreakdown = buildTokenBreakdown(position);
  const [rangeExpanded, setRangeExpanded] = React.useState(!premium);

  return (
    <article className="rounded-3xl border border-white/10 bg-[rgba(11,21,48,0.9)] p-6 text-white shadow-2xl transition hover:border-white/20">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <TokenPair symbol0={position.pair.symbol0} symbol1={position.pair.symbol1} />
          <div>
            <p className="font-brand text-xl text-white">{position.pair.symbol0} / {position.pair.symbol1}</p>
            <p className="font-ui text-xs uppercase tracking-[0.3em] text-white/50">{formatFee(position.pair.feeBps)}</p>
          </div>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">{position.dex === 'enosys-v3' ? 'Ēnosys' : 'SparkDEX'}</span>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 text-sm text-white/80 sm:grid-cols-3">
        <div>
          <p className="font-ui text-xs uppercase tracking-[0.2em] text-white/50">TVL</p>
          <p className="font-num text-2xl font-semibold tabular-nums">{tvlDisplay}</p>
          {tokenBreakdown && (
            <p className="font-num text-xs text-white/60 tabular-nums">{tokenBreakdown}</p>
          )}
        </div>
        <div>
          <p className="font-ui text-xs uppercase tracking-[0.2em] text-white/50">Total APR</p>
          <p className="font-num text-2xl font-semibold tabular-nums">{totalAprDisplay}</p>
          <p className="font-ui text-xs text-white/60">
            {[feesAprDisplay, incentivesAprDisplay].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex h-3 w-3 rounded-full ${statusMeta.dot}`} aria-hidden="true" />
          <div>
            <p className="font-ui text-xs uppercase tracking-[0.2em] text-white/50">RangeBand</p>
            <p className="font-ui text-base font-semibold text-white">{statusMeta.label}</p>
          </div>
        </div>
      </div>

      {!shouldMask && position.incentivesUsdPerDay !== null && (
        <div className="mt-5 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="font-ui text-xs uppercase tracking-[0.2em] text-white/50">Incentives</p>
          <p className="font-ui font-semibold text-white">{usd(position.incentivesUsdPerDay)} / day</p>
          {renderIncentiveBreakdown(position.incentivesTokens)}
        </div>
      )}

      {shouldMask && (
        <div className="mt-5 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 w-fit">
          Premium feature
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3">
        <div className="flex items-center justify-between">
          <p className="font-ui text-xs uppercase tracking-[0.2em] text-white/50">RangeBand™</p>
          <div className="flex overflow-hidden rounded-full border border-white/10">
            <button
              type="button"
              className={`px-3 py-1 text-xs font-semibold text-white ${rangeExpanded ? 'bg-[#3B82F6]' : 'bg-transparent'}`}
              onClick={() => setRangeExpanded(true)}
            >
              –
            </button>
            <button
              type="button"
              className={`px-3 py-1 text-xs font-semibold text-white ${!rangeExpanded ? 'bg-[#3B82F6]' : 'bg-transparent'}`}
              onClick={() => setRangeExpanded(false)}
            >
              +
            </button>
          </div>
        </div>
        {rangeExpanded && (
          <p className="mt-2 font-ui text-sm text-white/70">
            Current status: <span className="font-semibold text-white">{statusMeta.label}</span>
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {!shouldMask ? (
          claimUsd ? (
            <ActionLink href={manageUrl} variant="primary" ariaLabel="Claim rewards">
              Claim {compactFormatter.format(claimUsd)}
            </ActionLink>
          ) : (
            <ActionLink href={manageUrl} variant="ghost" ariaLabel="View pool on DEX">
              View on DEX
            </ActionLink>
          )
        ) : (
          <ActionLink href={manageUrl} variant="ghost" ariaLabel="View pool on DEX">
            View on DEX
          </ActionLink>
        )}
        <ActionLink href={manageUrl} variant="primary" ariaLabel="Manage on DEX">
          Manage on DEX
        </ActionLink>
        <Link
          href={detailUrl}
          className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white hover:text-white"
        >
          Details
        </Link>
      </div>
    </article>
  );
}

function TokenPair({ symbol0, symbol1 }: { symbol0: string; symbol1: string }) {
  return (
    <div className="flex items-center -space-x-2">
      <TokenIcon symbol={symbol0} size={36} />
      <TokenIcon symbol={symbol1} size={36} className="border-2 border-[#0B1530]" />
    </div>
  );
}

function formatFee(feeBps: number) {
  return `${(feeBps / 100).toFixed(2)}%`;
}

function getStatusMeta(status: PositionRow['status']) {
  switch (status) {
    case 'in':
      return { dot: 'bg-[#34D399]', label: 'In range' };
    case 'near':
      return { dot: 'bg-[#FBBF24]', label: 'Near band' };
    case 'out':
      return { dot: 'bg-[#F87171]', label: 'Out of range' };
    default:
      return { dot: 'bg-white/30', label: 'Unknown' };
  }
}

function getDexLink(dex: PositionRow['dex'], poolAddress: string) {
  if (dex === 'sparkdex-v3') {
    return `https://app.sparkdex.fi/pool/${poolAddress}`;
  }
  return `https://app.enosys.io/pool/${poolAddress}`;
}

type ActionLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
  ariaLabel: string;
};

function ActionLink({ href, children, variant = 'primary', ariaLabel }: ActionLinkProps) {
  if (variant === 'ghost') {
    return (
      <Link
        href={href}
        target="_blank"
        rel="noreferrer"
        aria-label={ariaLabel}
        className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white hover:text-white"
      >
        {children}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={ariaLabel}
      className="btn-primary inline-flex items-center justify-center px-5 py-2 text-sm"
    >
      {children}
    </Link>
  );
}

function formatUsd(value: number | null | undefined) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return currencyFormatter.format(value);
}

function buildTokenBreakdown(position: PositionRow) {
  const amount0 = safeNumber(position.amountsUsd?.token0);
  const amount1 = safeNumber(position.amountsUsd?.token1);
  if (amount0 == null && amount1 == null) return null;
  const parts: string[] = [];
  if (amount0 != null && position.pair?.symbol0) {
    parts.push(`${position.pair.symbol0} ${formatAmount(amount0)}`);
  }
  if (amount1 != null && position.pair?.symbol1) {
    parts.push(`${position.pair.symbol1} ${formatAmount(amount1)}`);
  }
  return parts.length ? parts.join(' · ') : null;
}

function renderIncentiveBreakdown(tokens: PositionRow['incentivesTokens']) {
  if (!tokens?.length) return null;
  return (
    <p className="font-ui text-xs text-white/60">
      {tokens
        .map((token) => {
          const symbol = token?.symbol ?? '—';
          const perDay = formatAmount(token?.amountPerDay ? Number(token.amountPerDay) : null, 4);
          return `${symbol} ${perDay}/day`;
        })
        .join(' · ')}
    </p>
  );
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function usd(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return '—';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function formatAmount(value: number | null | undefined, digits = 4) {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { maximumFractionDigits: digits });
}

function aprFromUsd(value: number | null | undefined, tvl: number) {
  if (value == null || !Number.isFinite(value) || tvl <= 0) return null;
  return (value / tvl) * 100;
}

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatAprDetail(value: number | null, label: string) {
  if (value == null || !Number.isFinite(value)) return null;
  return `${value.toFixed(1)}% ${label}`;
}
