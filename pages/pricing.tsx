'use client';

import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import Header from '@/components/Header';
import { summarizePositions } from '@/lib/positions';
import { formatEUR, calcPoolsCost, calcNotifCost, calcTotal, nextTierFor } from '@/lib/pricing';
import { TokenIcon } from '@/components/TokenIcon';
import WalletConnect from '@/components/WalletConnect';

const MIN_POOLS = 5;
const MAX_POOLS = 100;
const STEP = 5;

const PROVIDER_LINKS: Record<string, string> = {
  enosys: 'https://enosys.global',
  sparkdex: 'https://sparkdex.ai',
  blazeswap: 'https://blazeswap.com',
};

export default function PricingPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const [positions, setPositions] = React.useState<any[] | null>(null);
  const [loadingPositions, setLoadingPositions] = React.useState(false);
  const [positionsError, setPositionsError] = React.useState<string | null>(null);

  const [paidPools, setPaidPools] = React.useState<number>(5);
  const [notificationsEnabled, setNotificationsEnabled] = React.useState<boolean>(false);
  const [hasAutoSet, setHasAutoSet] = React.useState<boolean>(false);
  const [selectedPoolIds, setSelectedPoolIds] = React.useState<Set<string>>(new Set());

  // Fetch positions when wallet connects
  React.useEffect(() => {
    if (!address || !isConnected) {
      setPositions(null);
      setPositionsError(null);
      return;
    }

    let cancelled = false;

    async function loadPositions() {
      setLoadingPositions(true);
      setPositionsError(null);
      try {
        const response = await fetch(`/api/positions?address=${address}`, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load positions (${response.status})`);
        }
        const data = await response.json();
        if (cancelled) return;

        if (Array.isArray(data?.positions)) {
          console.log('[pricing] Received positions:', data.positions.length, 'total');
          console.log('[pricing] Providers:', data.positions.map((p: any) => p.providerSlug || p.provider || p.dexName));
          setPositions(data.positions);
        } else if (Array.isArray(data)) {
          console.log('[pricing] Received positions array:', data.length, 'total');
          console.log('[pricing] Providers:', data.map((p: any) => p.providerSlug || p.provider || p.dexName));
          setPositions(data);
        } else {
          console.log('[pricing] No positions found in response');
          setPositions([]);
        }
      } catch (error) {
        if (cancelled) return;
        console.error('[pricing] positions fetch failed', error);
        setPositions([]);
        setPositionsError('Could not detect pools. You can still subscribe manually.');
      } finally {
        if (!cancelled) {
          setLoadingPositions(false);
        }
      }
    }

    void loadPositions();

    return () => {
      cancelled = true;
    };
  }, [address, isConnected]);

  const summary = positions ? summarizePositions(positions) : null;
  const tierAll = summary ? nextTierFor(summary.total) : MIN_POOLS;
  const tierActive = summary ? nextTierFor(summary.active) : MIN_POOLS;

  // Set initial pool count to recommended tier when positions load (only once)
  React.useEffect(() => {
    if (summary && summary.total > 0 && !hasAutoSet) {
      setPaidPools(tierAll);
      setHasAutoSet(true);
      
      // Select all pools by default
      if (positions && positions.length > 0) {
        const allIds = new Set(positions.map((p, idx) => `${p.poolId || p.id || idx}`));
        setSelectedPoolIds(allIds);
      }
    }
  }, [summary, tierAll, hasAutoSet, positions]);

  const poolsCost = calcPoolsCost(paidPools);
  const notifCost = calcNotifCost(paidPools, notificationsEnabled);
  const totalCost = calcTotal(paidPools, notificationsEnabled);

  // Calculate capacity feedback
  const getCapacityFeedback = (): string | null => {
    if (!summary || summary.total === 0) return null;

    const active = summary.active;
    const inactive = summary.inactive;
    const total = summary.total;

    if (paidPools >= total) {
      // Can manage everything with room to spare
      const extra = paidPools - total;
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
      const allIds = new Set(positions.map((p, idx) => `${p.poolId || p.id || idx}`));
      setSelectedPoolIds(allIds);
      const recommendedTier = nextTierFor(allIds.size);
      setPaidPools(recommendedTier);
    }
  };

  const handleDeselectAll = () => {
    setSelectedPoolIds(new Set());
    setPaidPools(MIN_POOLS);
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

  const providerEntries = summary ? Object.entries(summary.byProvider) : [];

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
              Simple pricing.
            </h1>
            <p className="mx-auto mt-4 max-w-xl font-ui text-base text-white/70 sm:text-lg">
              Keep effortless overview of all your Flare LPs in one place.
            </p>
          </section>

          {/* Benefits Section */}
          <section className="mt-12 space-y-6">
            <h2 className="font-brand text-2xl font-semibold text-center text-white">
              Why LiquiLab?
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
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
              
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <div className="mb-3 text-[#1BE8D2]">
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="mb-2 font-brand text-lg font-semibold text-white">
                  RangeBand™ visualization
                </h3>
                <p className="font-ui text-sm text-white/70">
                  See pool health at a glance — in range, near boundary, or out of range. Patent pending.
                </p>
              </div>
              
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
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
              
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
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
            className="mt-12 rounded-3xl border border-white/10 px-8 py-10 backdrop-blur-xl sm:px-12"
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
                  We'll scan your wallet for LP positions on Flare (Enosys, SparkDEX, BlazeSwap)
                </p>
              </div>
            ) : (
              <div className="space-y-10">
                {/* Pricing Explainer */}
                <div className="space-y-4 border-b border-white/10 pb-8">
                  <h3 className="font-brand text-xl font-semibold text-white">
                    Pricing model
                  </h3>
                  <p className="font-ui text-base leading-relaxed text-white/80">
                    Simple, transparent pricing. Pay only for the pools you want to manage — buy capacity in sets of 5, upgrade anytime or downgrade at renewal.
                  </p>
                  <ul className="space-y-2.5 font-ui text-sm leading-relaxed text-white/70">
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#1BE8D2]" aria-hidden="true">•</span>
                      <span><strong className="text-white">€1.99 per pool/month</strong> — capacity in sets of 5 (5, 10, 15…)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#1BE8D2]" aria-hidden="true">•</span>
                      <span><strong className="text-white">Notifications: €2.50 per 5 pools</strong> — email alerts for Near/Out of Range</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#1BE8D2]" aria-hidden="true">•</span>
                      <span>New pools auto-added within capacity; <strong className="text-white">upgrade anytime</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-0.5 text-[#1BE8D2]" aria-hidden="true">•</span>
                      <span>Billing cycle: <strong className="text-white">30 days</strong>; downgrade takes effect at next renewal</span>
                    </li>
                  </ul>
                </div>

                {/* Quote Section */}
                <div className="space-y-6">
                  <h3 className="font-brand text-xl font-semibold text-white">
                    Your pools
                  </h3>

                  {loadingPositions ? (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8 text-center">
                      <p className="font-ui text-sm text-white/70">Loading your pools...</p>
                    </div>
                  ) : summary && summary.total > 0 ? (
                    <div className="space-y-6">
                      {/* Summary + Your Plan combined */}
                      <div className="rounded-xl border border-[#1BE8D2]/30 bg-[#1BE8D2]/5 p-6">
                        {/* Current pools summary */}
                        <div className="mb-4 pb-4 border-b border-white/10">
                          <p className="mb-3 font-ui text-base text-white">
                            You can manage <strong className="tnum font-semibold">{summary.total}</strong> pool{summary.total === 1 ? '' : 's'} with LiquiLab
                          </p>
                          <div className="space-y-2 font-ui text-sm text-white/70">
                            <p>
                              <strong className="tnum text-white">{summary.active}</strong> active (generating fees) · <strong className="tnum text-white">{summary.inactive}</strong> inactive (may have incentives to claim)
                            </p>
                            {providerEntries.length > 0 && (
                              <p className="text-xs text-white/60">
                                {providerEntries.map(([provider, count]) => `${count} ${provider}`).join(' / ')}
                              </p>
                            )}
                          </div>
                        </div>
                      
                      {/* Pool selector */}
                      <div className="mb-4 pb-4 border-b border-white/10">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="font-brand text-sm font-semibold text-white">
                            Select pools to manage
                          </p>
                          <div className="flex items-center gap-3">
                            <p className="font-ui text-xs text-white/60">
                              {selectedCount} of {positions?.length || 0} selected
                            </p>
                            <button
                              onClick={allSelected ? handleDeselectAll : handleSelectAll}
                              className="font-ui text-xs text-[#1BE8D2] hover:text-[#1BE8D2]/80 transition"
                            >
                              {allSelected ? 'Deselect all' : 'Select all'}
                            </button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {/* Active pools - left column */}
                          <div>
                            <p className="mb-2 font-ui text-xs font-semibold text-[#00C66B]">
                              Active ({summary.active})
                            </p>
                            <div className="max-h-[300px] space-y-1 overflow-y-auto">
                              {positions && positions
                                .filter(p => p.isInRange === true || p.status === 'in')
                                .sort((a, b) => (b.tvlUsd || 0) - (a.tvlUsd || 0))
                                .map((pool, idx) => {
                                  const poolId = `${pool.poolId || pool.id || idx}`;
                                  const isSelected = selectedPoolIds.has(poolId);
                                  const provider = pool.providerSlug || pool.provider || pool.dexName || 'unknown';
                                  
                                  // Safe token extraction - handle both string and object formats
                                  const getTokenSymbol = (token: any): string => {
                                    if (!token) return '?';
                                    if (typeof token === 'string') return token;
                                    if (typeof token === 'object' && token.symbol) return token.symbol;
                                    return '?';
                                  };
                                  
                                  const token0 = getTokenSymbol(pool.token0Symbol || pool.token0);
                                  const token1 = getTokenSymbol(pool.token1Symbol || pool.token1);
                                  const tvl = pool.tvlUsd || 0;
                                  const marketId = pool.poolId || pool.marketId || pool.id || idx;
                                  
                                  return (
                                    <label
                                      key={poolId}
                                      className={`flex items-center gap-2 rounded px-2 py-1.5 transition cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#1BE8D2]/10'
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
                                      <p className="tnum font-ui text-[10px] text-white/60">
                                        ${tvl >= 1000 ? `${(tvl / 1000).toFixed(1)}k` : tvl.toFixed(0)}
                                      </p>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                          
                          {/* Inactive pools - right column */}
                          <div>
                            <p className="mb-2 font-ui text-xs font-semibold text-white/60">
                              Inactive ({summary.inactive})
                            </p>
                            <div className="max-h-[300px] space-y-1 overflow-y-auto">
                              {positions && positions
                                .filter(p => !(p.isInRange === true || p.status === 'in'))
                                .sort((a, b) => (b.incentivesUsd || 0) - (a.incentivesUsd || 0))
                                .map((pool, idx) => {
                                  const poolId = `${pool.poolId || pool.id || idx}`;
                                  const isSelected = selectedPoolIds.has(poolId);
                                  const provider = pool.providerSlug || pool.provider || pool.dexName || 'unknown';
                                  
                                  // Safe token extraction - handle both string and object formats
                                  const getTokenSymbol = (token: any): string => {
                                    if (!token) return '?';
                                    if (typeof token === 'string') return token;
                                    if (typeof token === 'object' && token.symbol) return token.symbol;
                                    return '?';
                                  };
                                  
                                  const token0 = getTokenSymbol(pool.token0Symbol || pool.token0);
                                  const token1 = getTokenSymbol(pool.token1Symbol || pool.token1);
                                  const incentives = pool.incentivesUsd || 0;
                                  const marketId = pool.poolId || pool.marketId || pool.id || idx;
                                  
                                  return (
                                    <label
                                      key={poolId}
                                      className={`flex items-center gap-2 rounded px-2 py-1.5 transition cursor-pointer ${
                                        isSelected
                                          ? 'bg-[#1BE8D2]/10'
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
                                      <p className="tnum font-ui text-[10px] text-amber-400/80">
                                        ${incentives >= 1000 ? `${(incentives / 1000).toFixed(1)}k` : incentives.toFixed(0)}
                                      </p>
                                    </label>
                                  );
                                })}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Your plan */}
                      <div>
                        <h3 className="mb-2 font-brand text-lg font-semibold text-white">
                          Your plan: <span className="tnum">{paidPools}</span> pools
                        </h3>
                        <p className="font-ui text-sm text-white/80">
                          {capacityFeedback}
                        </p>
                      </div>
                    </div>
                  </div>

                      {/* Stepper */}
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
                        <p className="mb-4 font-brand text-sm font-semibold text-white/80">
                          How many pools would you like to manage?
                        </p>
                        <div className="flex items-center justify-center gap-6">
                          <button
                            type="button"
                            onClick={handleStepDown}
                            disabled={paidPools <= MIN_POOLS}
                            className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/20 bg-white/[0.05] font-brand text-2xl text-white transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
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
                            className="flex h-12 w-12 items-center justify-center rounded-lg border border-white/20 bg-white/[0.05] font-brand text-2xl text-white transition hover:border-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Increase pool count"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Notifications add-on */}
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6">
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
                      <div className="rounded-xl border border-white/10 bg-white/[0.06] p-6">
                        <div className="space-y-3">
                          <div className="flex items-baseline justify-between gap-4 font-ui text-sm text-white/70">
                            <span>Pools: {paidPools} × €1.99 / month</span>
                            <span className="tnum font-semibold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                              {formatEUR(poolsCost)}
                            </span>
                          </div>
                          {notificationsEnabled && (
                            <div className="flex items-baseline justify-between gap-4 font-ui text-sm text-white/70">
                              <span>Notifications: €2.50 per 5 pools</span>
                              <span className="tnum font-semibold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                                {formatEUR(notifCost)}
                              </span>
                            </div>
                          )}
                          <div className="border-t border-white/10 pt-3">
                            <div className="flex items-baseline justify-between gap-4">
                              <span className="font-brand text-base font-semibold text-white">
                                Total
                              </span>
                              <span
                                className="tnum font-brand text-3xl font-bold text-white"
                                style={{ fontVariantNumeric: 'tabular-nums' }}
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
                        className="w-full rounded-xl bg-[#3B82F6] px-6 py-4 font-brand text-base font-semibold text-white transition hover:bg-[#60A5FA] hover:shadow-[0_0_24px_rgba(59,130,246,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA]/60"
                      >
                        Continue to checkout
                      </button>

                      {positionsError && (
                        <p className="text-center font-ui text-xs text-[#FFA500]">{positionsError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-8">
                      <p className="mb-4 text-center font-ui text-base text-white">
                        No pools found
                      </p>
                      <p className="mb-6 text-center font-ui text-sm text-white/60">
                        We couldn't detect any LP positions in your wallet. If you have positions on Enosys, SparkDEX or BlazeSwap, try connecting again or check the links below.
                      </p>
                      <div className="flex flex-wrap justify-center gap-3">
                        {Object.entries(PROVIDER_LINKS).map(([name, url]) => (
                          <a
                            key={name}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-white/20 bg-white/[0.05] px-4 py-2 font-ui text-sm capitalize text-white/80 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
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
        </main>
      </div>
    </>
  );
}
