'use client';

import React from 'react';
import Image from 'next/image';

import { TokenIcon } from '@/components/TokenIcon';
import RangeBand, { RangeStatus } from '@/components/pools/PoolRangeIndicator';
import { calcApr24h } from '@/lib/metrics';

interface PoolRowToken {
  symbol: string;
  iconSrc?: string;
  name?: string;
}

export type PoolRangeStatus = RangeStatus;

export interface PoolRowViewModel {
  id: string;
  providerName: string;
  poolDisplayId: string;
  pairLabel: string;
  token0: PoolRowToken;
  token1: PoolRowToken;
  feeTier: string;
  rangeLabel: string;
  liquidityUsd: string;
  liquidityShareLabel?: string;
  unclaimedFeesUsd: string;
  incentivesUsd: string;
  incentivesLabel?: string;
  lowerPrice?: number | null;
  upperPrice?: number | null;
  currentPrice?: number | null;
  apr24hLabel?: string;
  apr24hValue?: number;
  dailyFeesUsdValue?: number;
  dailyIncentivesUsdValue?: number;
  tvlUsdValue?: number;
  /** @deprecated — use apr24hLabel */
  apy24hLabel?: string;
  status: PoolRangeStatus;
  shareUrl?: string;
}

interface PoolRowProps {
  pool: PoolRowViewModel;
  onNavigate?: (poolId: string) => void;
  onShare?: (poolId: string) => void;
}

const metricLabelClass = 'font-ui text-xs font-medium uppercase tracking-wide text-white/60';
const metricValueClass = 'font-ui tnum text-right text-base font-semibold text-white';

/**
 * Robust formatter that accepts multiple fee encodings.
 * Uniswap v3 onchain "fee" is *hundredths of a bip* (1e-6): 3000 -> 0.3%.
 * Some APIs provide bps (30 -> 0.30%), or direct pct (0.003 -> 0.3% or 0.3 -> 0.3%).
 */
function toFeePercentNumber(input: unknown): number {
  const v = Number(input ?? 0);
  if (!isFinite(v) || v <= 0) return 0;

  // Heuristics:
  // - Common Uniswap-style (hundredths of a bip): 500, 3000, 10000 -> 0.05/0.3/1.0 %
  if (v >= 500 && v <= 10000) return v / 1e4; // 3000 => 0.3

  // - True bps: 5, 30, 100 -> 0.05/0.3/1.0 %
  if (v <= 100) return v / 100;

  // - Already percent fraction (0.003) or percent number (0.3)
  if (v > 0 && v < 2) return v >= 1 ? v : v * 100; // 0.3 -> 0.3% | 1.2 -> 1.2%

  // Fallback: assume hundredths-of-bip
  return v / 1e4;
}

function formatFeePercent(input: unknown): string {
  const n = toFeePercentNumber(input);
  // Show up to one decimal for typical tiers (0.3%, 1.0%), two decimals for small values (0.05%)
  const decimals = n < 0.1 ? 2 : 1;
  return `${n.toFixed(decimals)}%`;
}

function coerceNumeric(value: string | number | null | undefined): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function TokenStack({ token, tokenKey }: { token: PoolRowToken; tokenKey: string }) {
  const { symbol, iconSrc, name } = token;
  const alt = `${symbol} token`;

  if (iconSrc) {
    return (
      <>
        <Image
          key={`${tokenKey}-desktop`}
          src={iconSrc}
          alt={alt}
          width={28}
          height={28}
          className="hidden md:block rounded-full object-contain"
        />
        <Image
          key={`${tokenKey}-mobile`}
          src={iconSrc}
          alt={alt}
          width={20}
          height={20}
          className="md:hidden rounded-full object-contain"
        />
      </>
    );
  }

  return (
    <>
      <TokenIcon
        key={`${tokenKey}-desktop`}
        symbol={symbol}
        size={28}
        alt={name ?? alt}
        className="hidden md:block"
      />
      <TokenIcon
        key={`${tokenKey}-mobile`}
        symbol={symbol}
        size={20}
        alt={name ?? alt}
        className="md:hidden"
      />
    </>
  );
}

export function PoolRow({ pool, onNavigate, onShare }: PoolRowProps) {
  const {
    id,
    providerName,
    poolDisplayId,
    pairLabel,
    token0,
    token1,
    feeTier,
    rangeLabel: _rangeLabel,
    liquidityUsd,
    liquidityShareLabel,
    unclaimedFeesUsd,
    incentivesUsd,
    incentivesLabel,
    lowerPrice,
    upperPrice,
    currentPrice,
    apr24hLabel,
    apr24hValue,
    dailyFeesUsdValue,
    dailyIncentivesUsdValue,
    tvlUsdValue,
    apy24hLabel,
    status,
    shareUrl,
  } = pool;

  const handleNavigate = React.useCallback(() => {
    if (onNavigate) {
      onNavigate(id);
    }
  }, [id, onNavigate]);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onNavigate) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onNavigate(id);
      }
    },
    [id, onNavigate],
  );

  const handleShare = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (onShare) {
        onShare(id);
      } else if (shareUrl && typeof window !== 'undefined') {
        const intent = new URL('https://twitter.com/intent/tweet');
        intent.searchParams.set('url', shareUrl);
        intent.searchParams.set('text', `Tracking ${pairLabel} on LiquiLab`);
        window.open(intent.toString(), '_blank', 'noopener,noreferrer');
      }
    },
    [id, onShare, pairLabel, shareUrl],
  );

  const STATUS_CONFIG: Record<PoolRangeStatus, { label: string; color: string; animation?: string }> = {
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

  const statusMeta = STATUS_CONFIG[status];
  const explicitAprValue =
    typeof apr24hValue === 'number' && Number.isFinite(apr24hValue) ? apr24hValue : undefined;
  const resolvedTvl =
    typeof tvlUsdValue === 'number' && Number.isFinite(tvlUsdValue)
      ? tvlUsdValue
      : coerceNumeric(liquidityUsd);
  const aprFromMetrics = calcApr24h({
    tvlUsd: resolvedTvl,
    dailyFeesUsd: dailyFeesUsdValue,
    dailyIncentivesUsd: dailyIncentivesUsdValue,
  });
  const aprRawValue = explicitAprValue ?? aprFromMetrics;
  const fallbackAprLabel = Number.isFinite(aprRawValue)
    ? `${Math.min(aprRawValue, 999).toFixed(1)}%`
    : '—';
  const displayApr = apr24hLabel ?? apy24hLabel ?? fallbackAprLabel;

  // Format fee percentage robustly
  const formattedFee = formatFeePercent(feeTier);

  return (
    <div
      data-ll-ui="v2025-10"
      role={onNavigate ? 'button' : 'group'}
      tabIndex={onNavigate ? 0 : -1}
      onClick={handleNavigate}
      onKeyDown={handleKeyDown}
      className="group relative overflow-hidden rounded-2xl border border-white/8 bg-[rgba(10,15,26,0.82)] p-4 transition hover:bg-[rgba(0,230,255,0.05)] focus:outline-none focus:ring-2 focus:ring-liqui-aqua md:p-6"
    >
      <div
        className="absolute right-4 top-4 flex items-center gap-2 md:static md:col-start-5 md:row-span-2 md:flex md:justify-end"
      >
        <span
          className="flex h-3.5 w-3.5 items-center justify-center rounded-full"
          style={{
            backgroundColor: statusMeta.color,
            animation: statusMeta.animation,
          }}
          aria-label={statusMeta.label}
        />
        <span className="hidden text-sm font-medium text-white/80 md:inline" aria-hidden>
          {statusMeta.label}
        </span>
      </div>

      {/* Mobile layout */}
      <div className="md:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/60">
              <span>{providerName}</span>
              <span className="text-white/30">•</span>
              <span>#{poolDisplayId}</span>
              <span className="text-white/30">•</span>
              <span>{formattedFee}</span>
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold text-white">
              <div className="flex items-center -space-x-2">
                <TokenStack token={token0} tokenKey={`${id}-token0`} />
                <TokenStack token={token1} tokenKey={`${id}-token1`} />
              </div>
              <span className="font-ui">{pairLabel}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-white/80 font-ui">
          <div className="font-ui">
            <span className="font-medium text-white">TVL </span>
            <span className="tnum">{liquidityUsd}</span>
          </div>
          <div className="font-ui">
            <span className="font-medium text-white">Fees </span>
            <span className="tnum">{unclaimedFeesUsd}</span>
          </div>
          <div className="font-ui">
            <span className="font-medium text-white">Incentives </span>
            <span className="tnum">{incentivesUsd}</span>
          </div>
        </div>

        <div className="mt-4">
          <RangeBand
            min={lowerPrice}
            max={upperPrice}
            current={currentPrice}
            status={status ?? 'out'}
            token0Symbol={token0.symbol}
            token1Symbol={token1.symbol}
          />
        </div>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="bg-gradient-to-r from-[#00E6FF] to-[#007FFF] bg-clip-text font-semibold text-transparent">
            {displayApr}
          </span>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share this pool on X"
            title="Share this pool on X"
            className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/80 transition hover:border-liqui-aqua hover:text-liqui-aqua"
          >
            <XIcon />
            Share
          </button>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden grid-cols-[minmax(0,2.6fr)_repeat(3,minmax(0,1fr))_minmax(120px,1fr)] grid-rows-[auto_auto] gap-x-6 gap-y-4 md:grid">
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-white/60">
              <span>{providerName}</span>
              <span className="text-white/30">•</span>
              <span>#{poolDisplayId}</span>
              <span className="text-white/30">•</span>
              <span>{formattedFee}</span>
            </div>
            <div className="flex items-center gap-3 text-base font-semibold text-white">
              <div className="flex items-center -space-x-2">
                <TokenStack token={token0} tokenKey={`${id}-desktop-token0`} />
                <TokenStack token={token1} tokenKey={`${id}-desktop-token1`} />
              </div>
              <span className="font-ui">{pairLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end justify-center gap-1">
          <div className={metricValueClass}>{liquidityUsd}</div>
          <div className="font-ui text-xs text-white/50">{liquidityShareLabel ?? ''}</div>
        </div>

        <div className="flex flex-col items-end justify-center gap-1">
          <div className={metricValueClass}>{unclaimedFeesUsd}</div>
          <div className={metricLabelClass}>Unclaimed fees</div>
        </div>

        <div className="flex flex-col items-end justify-center gap-1">
          <div className={metricValueClass}>{incentivesUsd}</div>
          <div className="font-ui text-xs text-white/50">{incentivesLabel ?? ''}</div>
        </div>

        <div className="col-span-3">
          <RangeBand
            min={lowerPrice}
            max={upperPrice}
            current={currentPrice}
            status={status ?? 'out'}
            token0Symbol={token0.symbol}
            token1Symbol={token1.symbol}
          />
        </div>

        <div className="flex items-center justify-end">
          <span className="bg-gradient-to-r from-[#00E6FF] to-[#007FFF] bg-clip-text text-base font-semibold text-transparent">
            {displayApr}
          </span>
        </div>

        <div className="flex items-center justify-end">
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share this pool on X"
            title="Share this pool on X"
            className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/80 transition hover:border-liqui-aqua hover:text-liqui-aqua"
          >
            <XIcon />
            Share
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes heartbeat {
          0% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.2);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0.7;
          }
        }

        @keyframes rangeGlow {
          0% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.15);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M4.25 3h4.178l3.127 4.77L15.75 3h4l-5.75 7.686L20 21h-4.25l-3.5-5.238L8.5 21h-4l5.684-7.939L4.25 3z" />
    </svg>
  );
}

export default PoolRow;
