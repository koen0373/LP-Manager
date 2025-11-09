'use client';

import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import Header from '@/components/Header';
import PoolsTable, { type PoolsTableItem } from '@/components/pools/PoolsTable';
import type { PositionRow } from '@/lib/positions/types';
import { fmtUsd } from '@/lib/format';

type SummaryEntitlements = {
  role?: 'VISITOR' | 'PREMIUM' | 'PRO';
  flags?: {
    premium: boolean;
    analytics: boolean;
  };
  fields?: {
    apr?: boolean;
    incentives?: boolean;
    rangeBand?: boolean;
  };
};

type PositionsSummary = {
  tvlUsd: number;
  fees24hUsd: number;
  incentivesUsd: number;
  rewardsUsd: number;
  count: number;
  active?: number;
  inactive?: number;
  ended?: number;
  entitlements?: SummaryEntitlements;
};

type PositionsResponse = {
  success: boolean;
  data?: {
    positions: PositionRow[];
    summary: PositionsSummary;
  };
  error?: string;
};

const CTA_SWITCH =
  'inline-flex items-center justify-center radius-ctrl bg-white/10 px-4 py-2 font-ui text-xs font-semibold text-white transition hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530]';

function toPoolsTableItem(position: PositionRow): PoolsTableItem {
  const status: PoolsTableItem['status'] =
    position.category === 'Ended' ? 'ended' : (position.status ?? 'out');

  return {
    provider: position.provider,
    token0: {
      symbol: position.token0.symbol,
      address: position.token0.address,
      decimals: position.token0.decimals,
    },
    token1: {
      symbol: position.token1.symbol,
      address: position.token1.address,
      decimals: position.token1.decimals,
    },
    tvlUsd: Number(position.tvlUsd ?? 0),
    unclaimedFeesUsd: Number(position.unclaimedFeesUsd ?? 0),
    incentivesUsd: position.incentivesUsd ?? 0,
    incentivesToken: position.incentivesToken ?? null,
    incentivesTokenAmount: position.incentivesTokenAmount ?? null,
    apr24h: position.apr24h ?? null,
    isInRange: Boolean(position.isInRange),
    status,
    range: {
      min: position.rangeMin ?? null,
      max: position.rangeMax ?? null,
      current: position.currentPrice ?? null,
    },
    tokenId: position.tokenId ?? null,
    poolAddress: position.poolId ?? position.marketId ?? null,
    marketId: position.marketId ?? null,
    poolFeeBps: position.poolFeeBps ?? null,
    amount0: position.amount0 ?? null,
    amount1: position.amount1 ?? null,
    fee0: position.fee0 ?? null,
    fee1: position.fee1 ?? null,
    liquidityShare: position.liquidityShare ?? null,
  };
}

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString('en-US');
}

export default function KoenDashboard() {
  const router = useRouter();
  const DEFAULT_WALLET =
    process.env.NEXT_PUBLIC_KOEN_WALLET || '0x57d294d815968f0efa722f1e8094da65402cd951';
  const walletAddress = (router.query.address as string) || DEFAULT_WALLET;

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [summary, setSummary] = useState<PositionsSummary | null>(null);
  const [premiumView, setPremiumView] = useState<boolean>(true);

  useEffect(() => {
    if (!walletAddress) return;
    let cancelled = false;

    const fetchPositions = async () => {
      setLoading(true);
      setError(null);

      try {
        const premiumParam = premiumView ? '&premium=1' : '';
        const res = await fetch(`/api/positions?address=${walletAddress}${premiumParam}`);
        const json: PositionsResponse = await res.json();

        if (!json.success) {
          throw new Error(json.error || 'Failed to fetch positions');
        }

        if (!cancelled && json.data) {
          setPositions(json.data.positions ?? []);
          setSummary(json.data.summary ?? null);
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        setPositions([]);
        setSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchPositions();

    return () => {
      cancelled = true;
    };
  }, [walletAddress, premiumView]);

  const entitlements = useMemo(
    () => ({
      role: summary?.entitlements?.role ?? 'VISITOR',
      fields: summary?.entitlements?.fields ?? {},
    }),
    [summary?.entitlements],
  );

  const activeItems = useMemo(
    () =>
      positions
        .filter((p) => p.category === 'Active')
        .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))
        .map(toPoolsTableItem),
    [positions],
  );

  const inactiveItems = useMemo(
    () =>
      positions
        .filter((p) => p.category === 'Inactive')
        .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))
        .map(toPoolsTableItem),
    [positions],
  );

  const endedItems = useMemo(
    () =>
      positions
        .filter((p) => p.category === 'Ended')
        .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))
        .map(toPoolsTableItem),
    [positions],
  );

  const handleRowClick = (item: PoolsTableItem) => {
    const target = item.tokenId ?? item.poolAddress;
    if (target) {
      router.push(`/pool/${target}`);
    }
  };

  const hasPools = positions.length > 0;

  return (
    <>
      <Head>
        <title>Koen — Personal dashboard · LiquiLab</title>
        <meta
          name="description"
          content="Inspect Koen’s liquidity positions on Ēnosys and SparkDEX with RangeBand™ insights."
        />
      </Head>
      <div className="relative min-h-screen text-white">
        <div className="page-bg" aria-hidden="true" />
        <Header currentPage="koen" showTabs={false} />

        <main className="relative z-10 mx-auto w-full max-w-6xl px-6 py-20 md:py-24">
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-brand text-3xl font-semibold text-white md:text-4xl">
                Koen&apos;s Liquidity Overview
              </h1>
              <p className="mt-2 font-ui text-sm text-white/70">
                Wallet <span className="font-num text-white/90">{walletAddress}</span> — real-time view across Ēnosys &amp; SparkDEX.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setPremiumView((prev) => !prev)}
                className={CTA_SWITCH}
                aria-pressed={premiumView}
                aria-label={premiumView ? 'Disable premium entitlements' : 'Enable premium entitlements'}
              >
                {premiumView ? 'Premium data on' : 'Premium data off'}
              </button>
              <a
                href={`/pricing?address=${walletAddress}`}
                className="btn-primary"
                aria-label="View pricing plans"
              >
                View pricing
              </a>
            </div>
          </div>

          {loading && (
            <div className="card text-center font-ui text-sm text-white/70">
              Loading Koen&apos;s pools…
            </div>
          )}

          {error && !loading && (
            <div className="card bg-red-500/15 text-center font-ui text-sm text-red-100">
              {error}
            </div>
          )}

          {!loading && !error && summary && (
            <div className="mb-10 grid gap-6 md:grid-cols-3">
              <div className="card--quiet">
                <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/50">
                  Total TVL
                </p>
                <p className="mt-3 font-num text-2xl font-semibold text-white">
                  {fmtUsd(summary.tvlUsd)}
                </p>
                <p className="mt-2 font-ui text-xs text-white/60">
                  Active positions:{' '}
                  <span className="font-num text-white/90">{formatCount(summary.active)}</span>
                </p>
              </div>

              <div className="card--quiet">
                <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/50">
                  Unclaimed fees
                </p>
                <p className="mt-3 font-num text-2xl font-semibold text-white">
                  {fmtUsd(summary.fees24hUsd)}
                </p>
                <p className="mt-2 font-ui text-xs text-white/60">
                  Rewards:{' '}
                  <span className="font-num text-white/90">{fmtUsd(summary.rewardsUsd)}</span>
                </p>
              </div>

              <div className="card--quiet">
                <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/50">
                  Incentives
                </p>
                <p className="mt-3 font-num text-2xl font-semibold text-white">
                  {fmtUsd(summary.incentivesUsd)}
                </p>
                <p className="mt-2 font-ui text-xs text-white/60">
                  Entitlement role:{' '}
                  <span className="font-num text-white/90">{summary.entitlements?.role ?? 'FREE'}</span>
                </p>
              </div>
            </div>
          )}

          {!loading && !error && hasPools && (
            <div className="space-y-8">
              {activeItems.length > 0 && (
                <PoolsTable
                  title={`Active Pools (${activeItems.length})`}
                  items={activeItems}
                  entitlements={entitlements}
                  defaultExpanded
                  onRowClick={handleRowClick}
                />
              )}

              {inactiveItems.length > 0 && (
                <PoolsTable
                  title={`Inactive Pools (${inactiveItems.length})`}
                  items={inactiveItems}
                  entitlements={entitlements}
                  defaultExpanded={false}
                  onRowClick={handleRowClick}
                />
              )}

              {endedItems.length > 0 && (
                <PoolsTable
                  title={`Ended Pools (${endedItems.length})`}
                  items={endedItems}
                  entitlements={entitlements}
                  defaultExpanded={false}
                  onRowClick={handleRowClick}
                />
              )}
            </div>
          )}

          {!loading && !error && !hasPools && (
            <div className="card text-center">
              <h2 className="font-brand text-2xl text-white">No positions found</h2>
              <p className="mt-3 font-ui text-sm text-white/70">
                Create liquidity on Ēnosys or SparkDEX and refresh this page to see RangeBand™
                insights.
              </p>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
                <a
                  href="https://v3.dex.enosys.global/"
                  target="_blank"
                  rel="noreferrer"
                  className={CTA_SWITCH}
                >
                  Ēnosys
                </a>
                <a
                  href="https://sparkdex.ai"
                  target="_blank"
                  rel="noreferrer"
                  className={CTA_SWITCH}
                >
                  SparkDEX
                </a>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
