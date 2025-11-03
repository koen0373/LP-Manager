'use client';

import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import Header from '@/components/Header';
import { formatEUR, calcPoolsCost, calcNotifCost, calcTotal, nextTierFor } from '@/lib/pricing';
import { TokenIcon } from '@/components/TokenIcon';
import WalletConnect from '@/components/WalletConnect';
import { fetchPositions, computeSummary as computeClientSummary } from '@/lib/positions/client';
import type { PositionRow } from '@/lib/positions/types';

type PositionSummary = {
  total: number;
  active: number;
  inactive: number;
  ended: number;
  archived: number;
  totals: {
    tvlUsd: number;
    unclaimedFeesUsd: number;
    incentivesUsd: number;
    totalRewardsUsd: number;
  };
};

type SummaryLike = {
  active?: number;
  inactive?: number;
  ended?: number;
  count?: number;
  tvlUsd?: number;
  fees24hUsd?: number;
  incentivesUsd?: number;
  rewardsUsd?: number;
};

/**
 * Type-safe summary picker that handles both response schemas:
 * - `{ success: true, data: { summary } }` (canonical)
 * - `{ success: true, summary }` (legacy/alt)
 */
function pickSummary(resp: unknown): SummaryLike | null {
  const r = resp as Record<string, unknown>;
  const dataObj = r?.data as Record<string, unknown> | undefined;
  const s = dataObj?.summary ?? r?.summary;
  if (s && typeof s === 'object') return s as SummaryLike;
  return null;
}

const MIN_POOLS = 5;
const MAX_POOLS = 100;
const STEP = 5;

const PROVIDER_LINKS: Record<string, string> = {
  enosys: 'https://enosys.global',
  sparkdex: 'https://sparkdex.ai',
  blazeswap: 'https://blazeswap.com',
};

function buildPositionSummary(
  positions: PositionRow[],
  summary?: SummaryLike | null,
): PositionSummary {
  const derived = summary ?? computeClientSummary(positions);

  const active = summary?.active ?? positions.filter((p) => p.category === 'Active').length;
  const inactive = summary?.inactive ?? positions.filter((p) => p.category === 'Inactive').length;
  const ended = summary?.ended ?? positions.filter((p) => p.category === 'Ended').length;

  return {
    total: summary?.count ?? positions.length,
    active,
    inactive,
    ended,
    archived: ended,
    totals: {
      tvlUsd: derived.tvlUsd ?? 0,
      unclaimedFeesUsd: derived.fees24hUsd ?? 0,
      incentivesUsd: derived.incentivesUsd ?? 0,
      totalRewardsUsd: derived.rewardsUsd ?? 0,
    },
  };
}

function hydratePositionForUi(position: PositionRow): PositionRow {
  return {
    ...position,
    poolId: position.marketId,
  } as PositionRow;
}

export default function PricingPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [positions, setPositions] = React.useState<PositionRow[] | null>(null);
  const [summary, setSummary] = React.useState<PositionSummary | null>(null);
  const [loadingPositions, setLoadingPositions] = React.useState(false);
  const [positionsError, setPositionsError] = React.useState<string | null>(null);

  const [paidPools, setPaidPools] = React.useState<number>(5);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState<boolean>(false);
  const [hasAutoSet, setHasAutoSet] = React.useState<boolean>(false);
  const [selectedPoolIds, setSelectedPoolIds] = React.useState<Set<string>>(new Set());
  const [showArchived, setShowArchived] = React.useState<boolean>(false);
  const [expandedPairs, setExpandedPairs] = React.useState<Set<string>>(new Set());

  const loadPositions = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!address || !isConnected) {
        setPositions(null);
        setSummary(null);
        setPositionsError(null);
        setLoadingPositions(false);
        return;
      }

      setLoadingPositions(true);
      setPositionsError(null);

      try {
        const payload = await fetchPositions(address, { signal });
        const positionsData = payload.data?.positions ?? [];
        const summaryData = pickSummary(payload);
        const hydratedPositions = positionsData.map(hydratePositionForUi);

        setPositions(hydratedPositions);
        setSummary(buildPositionSummary(hydratedPositions, summaryData));
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          return;
        }

        console.error('[pricing] positions fetch failed', error);
        setPositions([]);
        setSummary(null);
        setPositionsError('Couldn\'t load positions. Please retry.');
      } finally {
        setLoadingPositions(false);
      }
    },
    [address, isConnected],
  );

  // Fetch positions when wallet connects
  React.useEffect(() => {
    if (!address || !isConnected) {
      setPositions(null);
      setSummary(null);
      setPositionsError(null);
      return;
    }

    const controller = new AbortController();
    void loadPositions(controller.signal);

    return () => {
      controller.abort();
    };
  }, [address, isConnected, loadPositions]);

  const handleRetry = React.useCallback(() => {
    void loadPositions();
  }, [loadPositions]);

  // Calculate summary (use API summary if available, otherwise calculate client-side)
  const calculatedSummary = summary;
  
  // Recommended tier based on Active + Inactive only (Archived excluded)
  const recommendedCount = calculatedSummary ? calculatedSummary.active + calculatedSummary.inactive : 0;
  const tierRecommended = nextTierFor(recommendedCount);

  // Set initial pool count to recommended tier when positions load (only once)
  React.useEffect(() => {
    if (calculatedSummary && calculatedSummary.total > 0 && !hasAutoSet) {
      setPaidPools(tierRecommended);
      setHasAutoSet(true);
      
      // Select Active and Inactive pools by default (exclude Ended/Archived)
      // ✅ Use .category field from API (no more inline calculations!)
      if (positions && positions.length > 0) {
        const activeAndInactiveIds = new Set(
          positions
            .filter(p => p.category === 'Active' || p.category === 'Inactive')
            .map(p => p.marketId)
        );
        setSelectedPoolIds(activeAndInactiveIds);
      }
    }
  }, [calculatedSummary, tierRecommended, hasAutoSet, positions]);

  const poolsCost = calcPoolsCost(paidPools);
  const notifCost = calcNotifCost(paidPools, notificationsEnabled);
  const totalCost = calcTotal(paidPools, notificationsEnabled);

  // Calculate capacity feedback (only count Active + Inactive; Archived excluded)
  const getCapacityFeedback = (): string | null => {
    if (!calculatedSummary || recommendedCount === 0) return null;

    const active = calculatedSummary.active;
    const inactive = calculatedSummary.inactive;
    // Only count pools that generate value (Active + Inactive)
    const valueGeneratingPools = active + inactive;

    if (paidPools >= valueGeneratingPools) {
      // Can manage everything that matters with room to spare
      const extra = paidPools - valueGeneratingPools;
      if (extra === 0) {
        return `You can manage all your pools (${active} active, ${inactive} inactive).`;
      }
      return `You can manage all your pools (${active} active, ${inactive} inactive) with room for ${extra} more.`;
    } else if (paidPools >= active) {
      // Can manage all active + some inactive
      const inactiveCount = paidPools - active;
      if (inactiveCount === 0) {
        return `You can manage all ${active} active pools. Select ${nextTierFor(active + 1)} to include inactive pools.`;
      } else if (inactiveCount === inactive) {
        return `You can manage all your pools (${active} active, ${inactive} inactive).`;
      }
      return `You can manage all ${active} active pools and ${inactiveCount} inactive pool${inactiveCount === 1 ? '' : 's'}.`;
    } else {
      // Can only manage some active pools
      return `You can manage only ${paidPools} of your ${active} active pools. Select ${nextTierFor(active)} to manage all active pools${inactive > 0 ? ` and ${Math.min(inactive, nextTierFor(active) - active)} inactive` : ''}.`;
    }
  };

  const capacityFeedback = getCapacityFeedback();

  const handleStepDown = () => {
    setPaidPools((prev) => Math.max(MIN_POOLS, prev - STEP));
  };

  const handleStepUp = () => {
    setPaidPools((prev) => Math.min(MAX_POOLS, prev + STEP));
  };

  const handleTogglePool = (poolId: string) => {
    setSelectedPoolIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(poolId)) {
        newSet.delete(poolId);
      } else {
        newSet.add(poolId);
      }
      
      // Auto-adjust paidPools to match selected count
      const selectedCount = newSet.size;
      const recommendedTier = nextTierFor(selectedCount);
      setPaidPools(recommendedTier);
      
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (positions && positions.length > 0) {
      const allIds = new Set(positions.map((p, idx) => `${p.poolId || p.marketId || idx}`));
      setSelectedPoolIds(allIds);
      const recommendedTier = nextTierFor(allIds.size);
      setPaidPools(recommendedTier);
    }
  };

  const handleDeselectAll = () => {
    setSelectedPoolIds(new Set());
    setPaidPools(MIN_POOLS);
  };

  const handleTogglePairGroup = (pairKey: string, poolIds: string[]) => {
    const allSelected = poolIds.every(id => selectedPoolIds.has(id));
    setSelectedPoolIds((prev) => {
      const newSet = new Set(prev);
      if (allSelected) {
        // Deselect all in group
        poolIds.forEach(id => newSet.delete(id));
      } else {
        // Select all in group
        poolIds.forEach(id => newSet.add(id));
      }
      
      // Auto-adjust paidPools
      const recommendedTier = nextTierFor(newSet.size);
      setPaidPools(recommendedTier);
      
      return newSet;
    });
  };

  const handleToggleExpand = (pairKey: string) => {
    setExpandedPairs((prev) => {
      const next = new Set(prev);
      if (next.has(pairKey)) {
        next.delete(pairKey);
      } else {
        next.add(pairKey);
      }
      return next;
    });
  };

  const selectedCount = selectedPoolIds.size;
  const allSelected = positions && selectedCount === positions.length;

  const handleSubscribe = () => {
    const query = new URLSearchParams({
      paidPools: String(paidPools),
      addNotifications: notificationsEnabled ? '1' : '0',
    });
    router.push(`/sales?${query.toString()}`);
  };

  return (
    <>
      <Head>
        <title>Pricing · LiquiLab</title>
        <meta
          name="description"
          content="€1.99 per pool/month. Keep effortless overview of all your Flare LPs in one place."
        />
      </Head>

      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="page-bg" aria-hidden="true" />

        <Header currentPage="pricing" showTabs={false} showWalletActions={true} />

        <main className="relative z-10 mx-auto w-[94vw] max-w-3xl px-4 pb-20 pt-14 lg:px-0">
          {/* Hero Section */}
          <section className="text-center">
            <h1 className="font-brand text-5xl font-bold leading-tight text-white sm:text-6xl">
              Simple pricing
            </h1>
            <p className="mx-auto mt-4 max-w-xl font-ui text-base text-white/70 sm:text-lg">
              Pick your plan in seconds. Adjust anytime.
            </p>
          </section>

          {/* Benefits Section */}
          <section className="mt-12 space-y-6">
            <h2 className="font-brand text-2xl font-semibold text-center text-white">
              Why LiquiLab?
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl bg-white/[0.02] p-6">
                <div className="mb-3 text-[#1BE8D2]">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 className="mb-2 font-brand text-lg font-semibold text-white">
                  All your pools in one place
                </h3>
                <p className="font-ui text-sm text-white/70">
                  Enosys, SparkDEX, BlazeSwap — see all your LP positions unified in a single dashboard.
                </p>
              </div>
              
              <div className="rounded-xl bg-white/[0.02] p-6">
                <div className="mb-3 text-[#1BE8D2]">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="mb-2 font-brand text-lg font-semibold text-white">
                  RangeBand™ visualization
                </h3>
                <p className="font-ui text-sm text-white/70">
                  See pool health at a glance — in range, near boundary, or out of range.
                </p>
              </div>
              
              <div className="rounded-xl bg-white/[0.02] p-6">
                <div className="mb-3 text-[#1BE8D2]">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mb-2 font-brand text-lg font-semibold text-white">
                  Real-time metrics
                </h3>
                <p className="font-ui text-sm text-white/70">
                  Live TVL, 24h fees, incentives, and APR — always up to date.
                </p>
              </div>
              
              <div className="rounded-xl bg-white/[0.02] p-6">
                <div className="mb-3 text-[#1BE8D2]">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <h3 className="mb-2 font-brand text-lg font-semibold text-white">
                  Optional notifications
                </h3>
                <p className="font-ui text-sm text-white/70">
                  Get email alerts when pools go near or out of range — never miss a rebalance.
                </p>
              </div>
            </div>
          </section>

          {/* Your Personal Plan Section */}
          <section
            className="mt-12 rounded-3xl px-8 py-10 backdrop-blur-xl sm:px-12"
            style={{ background: 'rgba(10, 15, 28, 0.85)' }}
          >
            <h2 className="mb-6 font-brand text-3xl font-semibold text-center text-white">
              Your personal plan
            </h2>

            {!isConnected ? (
              <div className="space-y-6 text-center">
                <p className="font-ui text-base text-white/80">
                  Connect your wallet to see exactly how many pools you can manage and get your personalized quote.
                </p>
                <div className="flex justify-center">
                  <WalletConnect />
                </div>
                <p className="font-ui text-sm text-white/60">
                  We&apos;ll scan your wallet for LP positions on Flare (Enosys, SparkDEX, BlazeSwap)
                </p>
              </div>
            ) : (
              <div className="space-y-10">
                {/* Pricing Explainer */}
                <div className="space-y-4 border-b border-white/10 pb-8">
                  <h3 className="font-brand text-xl font-semibold text-white">
                    How it works
                  </h3>
                  <p className="font-ui text-base leading-relaxed text-white/80">
                    First 5 pools: <strong className="tabular-nums">$1.99/mo</strong> (one bundle). Add more in packs of 5.
                  </p>
                  <ul className="space-y-2.5 font-ui text-sm leading-relaxed text-white/70">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#1BE8D2]" aria-hidden="true">•</span>
                      <span><strong className="text-white">Notifications Add-on +25%</strong> — email alerts for Near/Out of Range</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#1BE8D2]" aria-hidden="true">•</span>
                      <span>New pools auto-added within capacity; <strong className="text-white">upgrade anytime</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#1BE8D2]" aria-hidden="true">•</span>
                      <span><strong className="text-white">14-day free trial. Cancel anytime.</strong></span>
                    </li>
                  </ul>
                </div>

                {/* Quote Section */}
                <div className="space-y-6">
                  <h3 className="font-brand text-xl font-semibold text-white">
                    Your pools
                  </h3>

                  {loadingPositions ? (
                    <div className="rounded-xl bg-white/[0.02] p-8 text-center">
                      <p className="font-ui text-sm text-white/70">Loading your pools...</p>
                    </div>
                  ) : calculatedSummary && calculatedSummary.total > 0 ? (
                    <div className="space-y-6">
                      {/* Summary + Your Plan combined */}
                      <div className="rounded-xl bg-[#3B82F6]/5 p-6">
                        {/* Pool selector header */}
                        <div className="mb-6 flex items-center justify-between">
                          <div>
                            <h3 className="font-brand text-lg font-semibold text-white">
                              Select pools to manage
                            </h3>
                            <p className="mt-1 font-ui text-sm text-white/60">
                              <strong className="tnum text-white">{calculatedSummary.active}</strong> active · <strong className="tnum text-white">{calculatedSummary.inactive}</strong> inactive
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <p className="font-ui text-xs text-white/60">
                              <span className="tnum">{selectedCount}</span> of <span className="tnum">{positions?.length || 0}</span> selected
                            </p>
                            <button
                              type="button"
                              onClick={allSelected ? handleDeselectAll : handleSelectAll}
                              className="font-ui text-xs font-semibold text-[#3B82F6] transition hover:text-[#60A5FA]"
                            >
                              {allSelected ? 'Deselect all' : 'Select all'}
                            </button>
                          </div>
                        </div>
                      
                      {/* Pool lists */}
                        <div className="grid grid-cols-2 gap-4">
                          {/* Active pools - left column */}
                          <div>
                            <p className="mb-1 font-ui text-xs font-semibold text-[#3B82F6]">
                              Active ({calculatedSummary?.active || 0})
                            </p>
                            <p className="mb-3 font-ui text-[10px] text-white/50">
                              TVL, Rewards
                            </p>
                            <div className="max-h-[300px] space-y-1 overflow-y-auto">
                              {(() => {
                                if (!positions) return null;
                                
                                // ✅ Use .category field from API (already filtered & sorted!)
                                const activePools = positions.filter(p => p.category === 'Active');
                                
                                // Helper to extract token symbols
                                const getTokenSymbol = (token: string | { symbol?: string } | undefined): string => {
                                  if (!token) return '?';
                                  if (typeof token === 'string') return token;
                                  if (typeof token === 'object' && token.symbol) return token.symbol;
                                  return '?';
                                };
                                
                                // Group pools by token pair
                                const grouped = new Map<string, (PositionRow & { _idx: number })[]>();
                                activePools.forEach((pool, idx) => {
                                  const token0 = getTokenSymbol(pool.token0?.symbol || pool.token0);
                                  const token1 = getTokenSymbol(pool.token1?.symbol || pool.token1);
                                  const pairKey = `${token0}/${token1}`;
                                  
                                  if (!grouped.has(pairKey)) {
                                    grouped.set(pairKey, []);
                                  }
                                  grouped.get(pairKey)!.push({ ...pool, _idx: idx });
                                });
                                
                                // Sort groups by total TVL (high to low)
                                const sortedGroups = Array.from(grouped.entries()).sort((a, b) => {
                                  const tvlA = a[1].reduce((sum, p) => sum + (p.tvlUsd || 0), 0);
                                  const tvlB = b[1].reduce((sum, p) => sum + (p.tvlUsd || 0), 0);
                                  return tvlB - tvlA;
                                });
                                
                                // Render groups
                                return sortedGroups.map(([pairKey, pools]) => {
                                  const isSinglePool = pools.length === 1;
                                  const totalTvl = pools.reduce((sum, p) => sum + (p.tvlUsd || 0), 0);
                                  const poolIds = pools.map(p => `${p.poolId || p.marketId || p._idx}`);
                                  const allSelected = poolIds.every(id => selectedPoolIds.has(id));
                                  const isExpanded = expandedPairs.has(pairKey);
                                  
                                  const [token0, token1] = pairKey.split('/');
                                  
                                  if (isSinglePool) {
                                    // Render single pool as before
                                    const pool = pools[0];
                                    const poolId = `${pool.poolId || pool.marketId || pool._idx}`;
                                    const isSelected = selectedPoolIds.has(poolId);
                                    const provider = pool.provider || pool.dexName || 'unknown';
                                    const tvl = pool.tvlUsd || 0;
                                    const rawMarketId = pool.poolId || pool.marketId || pool._idx;
                                    const marketId = typeof rawMarketId === 'string' && rawMarketId.includes(':')
                                      ? rawMarketId.split(':').pop()
                                      : rawMarketId;
                                    
                                    return (
                                      <label
                                        key={poolId}
                                        className={`flex items-center gap-2 rounded px-2 py-1.5 transition cursor-pointer ${
                                          isSelected ? 'bg-[#3B82F6]/8' : 'bg-transparent hover:bg-white/5'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => handleTogglePool(poolId)}
                                          className="h-3 w-3 rounded border-white/20 bg-white/5 text-[#1BE8D2] focus:ring-1 focus:ring-[#1BE8D2]/50 focus:ring-offset-0"
                                        />
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                          <div className="flex items-center -space-x-1.5">
                                            <TokenIcon symbol={token0} size={16} />
                                            <TokenIcon symbol={token1} size={16} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="font-brand text-xs font-semibold text-white truncate">
                                              {token0}/{token1}
                                            </p>
                                            <p className="font-ui text-[10px] text-white/50 truncate">
                                              {provider} #{marketId}
                                            </p>
                                          </div>
                                        </div>
                                        <p className="tnum font-ui text-[10px] text-white/60">
                                          ${tvl >= 1000 ? `${(tvl / 1000).toFixed(1)}k` : tvl.toFixed(0)}
                                        </p>
                                      </label>
                                    );
                                  }
                                  
                                  // Render grouped pair
                                  return (
                                    <div key={pairKey} className="space-y-0.5">
                                      {/* Group header */}
                                      <div
                                        className={`flex items-center gap-2 rounded px-2 py-1.5 transition ${
                                          allSelected ? 'bg-[#3B82F6]/8' : 'bg-transparent hover:bg-white/5'
                                        }`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={allSelected}
                                          onChange={() => handleTogglePairGroup(pairKey, poolIds)}
                                          className="h-3 w-3 rounded border-white/20 bg-white/5 text-[#1BE8D2] focus:ring-1 focus:ring-[#1BE8D2]/50 focus:ring-offset-0"
                                        />
                                        <div className="flex items-center gap-1.5 flex-1 min-w-0 cursor-pointer" onClick={() => handleToggleExpand(pairKey)}>
                                          <div className="flex items-center -space-x-1.5">
                                            <TokenIcon symbol={token0} size={16} />
                                            <TokenIcon symbol={token1} size={16} />
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="font-brand text-xs font-semibold text-white truncate">
                                              {token0}/{token1}
                                            </p>
                                            <p className="font-ui text-[10px] text-white/50 truncate">
                                              {pools.length} pools
                                            </p>
                                          </div>
                                        </div>
                                        <p className="tnum font-ui text-[10px] text-white/60 mr-1">
                                          ${totalTvl >= 1000 ? `${(totalTvl / 1000).toFixed(1)}k` : totalTvl.toFixed(0)}
                                        </p>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleExpand(pairKey)}
                                          className="flex items-center justify-center w-4 h-4 text-white/40 hover:text-white/60 transition"
                                        >
                                          <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                      </div>
                                      
                                      {/* Expanded individual pools */}
                                      {isExpanded && (
                                        <div className="ml-6 space-y-0.5">
                                          {pools.map(pool => {
                                            const poolId = `${pool.poolId || pool.marketId || pool._idx}`;
                                            const isSelected = selectedPoolIds.has(poolId);
                                            const provider = pool.provider || pool.dexName || 'unknown';
                                            const tvl = pool.tvlUsd || 0;
                                            const rawMarketId = pool.poolId || pool.marketId || pool._idx;
                                            const marketId = typeof rawMarketId === 'string' && rawMarketId.includes(':')
                                              ? rawMarketId.split(':').pop()
                                              : rawMarketId;
                                            
                                            return (
                                              <label
                                                key={poolId}
                                                className={`flex items-center gap-2 rounded px-2 py-1.5 transition cursor-pointer ${
                                                  isSelected ? 'bg-[#3B82F6]/8' : 'bg-transparent hover:bg-white/5'
                                                }`}
                                              >
                                                <input
                                                  type="checkbox"
                                                  checked={isSelected}
                                                  onChange={() => handleTogglePool(poolId)}
                                                  className="h-3 w-3 rounded border-white/20 bg-white/5 text-[#1BE8D2] focus:ring-1 focus:ring-[#1BE8D2]/50 focus:ring-offset-0"
                                                />
                                                <div className="flex-1 min-w-0">
                                                  <p className="font-ui text-[10px] text-white/50 truncate">
                                                    {provider} #{marketId}
                                                  </p>
                                                </div>
                                                <p className="tnum font-ui text-[10px] text-white/60">
                                                  ${tvl >= 1000 ? `${(tvl / 1000).toFixed(1)}k` : tvl.toFixed(0)}
                                                </p>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                          
                          {/* Inactive pools - right column */}
                          <div>
                            <p className="mb-1 font-ui text-xs font-semibold text-white/60">
                              Inactive ({calculatedSummary.inactive})
                            </p>
                            <p className="mb-2 font-ui text-[10px] text-white/50">
                              No TVL, Rewards
                            </p>
                            <div className="max-h-[300px] space-y-1 overflow-y-auto">
                              {positions && positions
                                // ✅ Use .category field from API (already filtered & sorted!)
                                .filter(p => p.category === 'Inactive')
                                .map((pool, idx) => {
                                  const poolId = `${pool.poolId || pool.marketId || idx}`;
                                  const isSelected = selectedPoolIds.has(poolId);
                                  const provider = pool.provider || pool.dexName || 'unknown';
                                  
                                  // Safe token extraction - handle both string and object formats
                                  const getTokenSymbol = (token: string | { symbol?: string } | undefined): string => {
                                    if (!token) return '?';
                                    if (typeof token === 'string') return token;
                                    if (typeof token === 'object' && token.symbol) return token.symbol;
                                    return '?';
                                  };
                                  
                                  const token0 = getTokenSymbol(pool.token0);
                                  const token1 = getTokenSymbol(pool.token1);
                                  
                                  // ✅ Use .rewardsUsd from API (no more inline calculation!)
                                  const rewards = pool.rewardsUsd || 0;
                                  
                                  // Clean marketId - remove provider prefix for display
                                  const rawMarketId = pool.poolId || pool.marketId || idx;
                                  const marketId = typeof rawMarketId === 'string' && rawMarketId.includes(':')
                                    ? rawMarketId.split(':').pop()
                                    : rawMarketId;
                                  
                                  return (
                                      <label
                                        key={poolId}
                                        className={`flex items-center gap-2 rounded px-2 py-1.5 transition cursor-pointer ${
                                          isSelected
                                            ? 'bg-[#3B82F6]/8'
                                            : 'bg-transparent hover:bg-white/5'
                                        }`}
                                      >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleTogglePool(poolId)}
                                        className="h-3 w-3 rounded border-white/20 bg-white/5 text-[#1BE8D2] focus:ring-1 focus:ring-[#1BE8D2]/50 focus:ring-offset-0"
                                      />
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <div className="flex items-center -space-x-1.5">
                                          <TokenIcon symbol={token0} size={16} />
                                          <TokenIcon symbol={token1} size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-brand text-xs font-semibold text-white truncate">
                                            {token0}/{token1}
                                          </p>
                                          <p className="font-ui text-[10px] text-white/50 truncate">
                                            {provider} #{marketId}
                                          </p>
                                        </div>
                                      </div>
                                      <div className="text-right">
                                        <p className="tabular-nums font-ui text-[10px] text-white/60">
                                          ${rewards >= 1000 ? `${(rewards / 1000).toFixed(1)}k` : rewards.toFixed(0)}
                                        </p>
                                        <p className="tabular-nums font-ui text-[9px] text-white/40">
                                          {(() => {
                                            const tokenAmount = pool.incentivesTokenAmount || (rewards / 0.016);
                                            const tokenSymbol = pool.incentivesToken || 'rFLR';
                                            const formatted = tokenAmount >= 1000 
                                              ? `${(tokenAmount / 1000).toFixed(1)}K` 
                                              : Math.round(tokenAmount);
                                            return `${formatted} ${tokenSymbol}`;
                                          })()}
                                        </p>
                                      </div>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        </div>
                      
                      {/* Ended pools - collapsed by default */}
                      {calculatedSummary && calculatedSummary.archived > 0 && (
                        <div className="pt-4">
                          <div className="mb-3">
                            <button
                              type="button"
                              onClick={() => setShowArchived(!showArchived)}
                              className="flex w-full items-center justify-between rounded px-2 py-1.5 font-ui transition hover:bg-white/5"
                            >
                              <div>
                                <p className="text-xs font-semibold text-white/40">
                                  Ended ({calculatedSummary.archived})
                                </p>
                                <p className="text-[10px] text-white/30">
                                  No TVL, No Rewards
                                </p>
                              </div>
                              <svg
                                className={`h-4 w-4 text-white/40 transition-transform ${showArchived ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                          </div>
                          
                          {showArchived && (
                            <div className="max-h-[200px] space-y-1 overflow-y-auto opacity-60">
                              {positions && positions
                                // ✅ Use .category field from API (already filtered & sorted!)
                                .filter(p => p.category === 'Ended')
                                .map((pool, idx) => {
                                  const poolId = `${pool.poolId || pool.marketId || idx}`;
                                  const isSelected = selectedPoolIds.has(poolId);
                                  const provider = pool.provider || pool.dexName || 'unknown';
                                  
                                  const getTokenSymbol = (token: string | { symbol?: string } | undefined): string => {
                                    if (!token) return '?';
                                    if (typeof token === 'string') return token;
                                    if (typeof token === 'object' && token.symbol) return token.symbol;
                                    return '?';
                                  };
                                  
                                  const token0 = getTokenSymbol(pool.token0);
                                  const token1 = getTokenSymbol(pool.token1);
                                  
                                  const rawMarketId = pool.poolId || pool.marketId || idx;
                                  const marketId = typeof rawMarketId === 'string' && rawMarketId.includes(':')
                                    ? rawMarketId.split(':').pop()
                                    : rawMarketId;
                                  
                                  return (
                                    <label
                                      key={poolId}
                                      className={`flex items-center gap-2 rounded px-2 py-1.5 transition cursor-pointer ${
                                        isSelected
                                          ? 'bg-white/5'
                                          : 'bg-transparent hover:bg-white/[0.02]'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleTogglePool(poolId)}
                                        className="h-3 w-3 rounded border-white/20 bg-white/5 text-white/40 focus:ring-1 focus:ring-white/30 focus:ring-offset-0"
                                      />
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <div className="flex items-center -space-x-1.5 opacity-50">
                                          <TokenIcon symbol={token0} size={16} />
                                          <TokenIcon symbol={token1} size={16} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-brand text-xs font-semibold text-white/50 truncate">
                                            {token0}/{token1}
                                          </p>
                                          <p className="font-ui text-[10px] text-white/30 truncate">
                                            {provider} #{marketId}
                                          </p>
                                        </div>
                                      </div>
                                      <p className="tnum font-ui text-[10px] text-white/30">
                                        —
                                      </p>
                                    </label>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Your plan */}
                      <div className="pt-4">
                        <h3 className="mb-2 font-brand text-lg font-semibold text-white">
                          Your plan: <span className="tnum">{paidPools}</span> pools
                        </h3>
                        <p className="font-ui text-sm text-white/80">
                          {capacityFeedback}
                        </p>
                      </div>
                    </div>

                    {/* Stepper */}
                    <div className="rounded-xl bg-white/[0.04] p-6">
                      <p className="mb-4 font-brand text-sm font-semibold text-white/80">
                        How many pools would you like to manage?
                      </p>
                      <div className="flex items-center justify-center gap-6">
                        <button
                          type="button"
                          onClick={handleStepDown}
                          disabled={paidPools <= MIN_POOLS}
                          className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 font-ui text-2xl text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Decrease pool count"
                        >
                          −
                        </button>

                        <div className="text-center">
                          <div
                            className="tnum font-brand text-5xl font-bold text-white"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {paidPools}
                          </div>
                          <p className="mt-1 font-ui text-sm text-white/60">pools</p>
                        </div>

                        <button
                          type="button"
                          onClick={handleStepUp}
                          disabled={paidPools >= MAX_POOLS}
                          className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 font-ui text-2xl text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="Increase pool count"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Notifications add-on */}
                    <div className="rounded-xl bg-white/[0.04] p-6">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-brand text-base font-semibold text-white">
                              Notifications add-on
                            </h3>
                            <p className="mt-1 font-ui text-sm text-white/70">
                              Get email alerts when a pool turns Near Band or Out of Range.
                            </p>
                            <p className="mt-2 font-ui text-xs text-white/50">
                              +€2.50 per set of 5 pools
                            </p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={notificationsEnabled}
                            onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition ${
                              notificationsEnabled ? 'bg-[#3B82F6]' : 'bg-white/20'
                            }`}
                          >
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                                notificationsEnabled ? 'translate-x-5' : 'translate-x-1'
                              }`}
                            />
                            <span className="sr-only">Toggle Notifications</span>
                          </button>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="rounded-xl bg-white/[0.06] p-6" aria-live="polite" aria-atomic="true">
                        <div className="space-y-3">
                          <div className="flex items-baseline justify-between gap-4 font-ui text-sm text-white/70">
                            <span>Pools: <span className="tabular-nums">{paidPools}</span> × €<span className="tabular-nums">1.99</span> / month</span>
                            <span className="tabular-nums font-semibold text-white">
                              {formatEUR(poolsCost)}
                            </span>
                          </div>
                          {notificationsEnabled && (
                            <div className="flex items-baseline justify-between gap-4 font-ui text-sm text-white/70">
                              <span>Notifications: €<span className="tabular-nums">2.50</span> per 5 pools</span>
                              <span className="tabular-nums font-semibold text-white">
                                {formatEUR(notifCost)}
                              </span>
                            </div>
                          )}
                          <div className="pt-3">
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="font-brand text-base font-semibold text-white">
                                Total
                              </span>
                              <span
                                className="tabular-nums font-brand text-3xl font-bold text-white"
                              >
                                {formatEUR(totalCost)}
                              </span>
                            </div>
                            <p className="mt-1 text-right font-ui text-sm text-white/60">per month</p>
                          </div>
                        </div>
                      </div>

                      {/* CTA */}
                      <button
                        type="button"
                        onClick={handleSubscribe}
                        className="w-full rounded-2xl bg-[#3B82F6] px-6 py-4 font-ui text-base font-semibold text-white transition hover:bg-[#2563EB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3B82F6]/60"
                        aria-label="Continue to checkout"
                      >
                        Continue to checkout
                      </button>

                      {positionsError && (
                        <div className="mt-3 flex flex-col items-center gap-2">
                          <p className="text-center font-ui text-xs text-[#FFA500]">
                            {positionsError}
                          </p>
                          <button
                            type="button"
                            onClick={handleRetry}
                            className="rounded-lg border border-[#FFA500]/40 px-3 py-1 text-xs font-semibold text-[#FFA500] transition hover:border-[#FFA500] hover:text-[#FFD280]"
                          >
                            Retry
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-white/[0.02] p-8">
                      <p className="mb-4 text-center font-ui text-base text-white">
                        No pools found
                      </p>
                      <p className="mb-6 text-center font-ui text-sm text-white/60">
                        We couldn&apos;t detect any LP positions in your wallet. If you have positions on Enosys, SparkDEX or BlazeSwap, try connecting again or check the links below.
                      </p>
                      <div className="flex flex-wrap justify-center gap-3">
                        {Object.entries(PROVIDER_LINKS).map(([name, url]) => (
                          <a
                            key={name}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg bg-white/[0.05] px-4 py-2 font-ui text-sm capitalize text-white/80 transition hover:bg-white/10 hover:text-white"
                          >
                            {name}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
          </div>
        </div>
      )}
    </section>

          {/* Footer */}
          <footer className="py-8 text-center">
            <p className="font-ui text-xs text-white/40">
              Powered by RangeBand™ — patent pending
            </p>
          </footer>
        </main>
      </div>
    </>
  );
}
