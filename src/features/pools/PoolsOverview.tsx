'use client';

import React from 'react';

import { TokenIcon } from '@/components/TokenIcon';
import { InfoNote } from '@/components/ui/InfoNote';
import { includedCapacity, freeBonus } from '@/data/pricing';
import { fetchPositions, computeSummary } from '@/lib/positions/client';
import type { PositionRow } from '@/lib/positions/types';

const STORAGE_KEY_TRIAL = 'liquilab/trial-pool';

function formatUsd(value: number | undefined | null): string {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return '$0.00';
  }
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

type WalletPosition = PositionRow & { id: string };

function deriveCategory(position: PositionRow): NonNullable<PositionRow['category']> {
  if (position.category) {
    return position.category;
  }

  const tvl = typeof position.tvlUsd === 'number' ? position.tvlUsd : 0;
  const rewards = typeof position.rewardsUsd === 'number'
    ? position.rewardsUsd
    : (typeof position.unclaimedFeesUsd === 'number' ? position.unclaimedFeesUsd : 0) +
      (typeof position.incentivesUsd === 'number' ? position.incentivesUsd : 0);

  if (tvl > 0) return 'Active';
  if (rewards > 0) return 'Inactive';
  return 'Ended';
}

function derivePositionId(position: PositionRow, index: number): string {
  return (
    position.tokenId ??
    position.poolId ??
    position.marketId ??
    `${position.provider}-${position.token0?.symbol ?? 'token0'}-${position.token1?.symbol ?? 'token1'}-${index}`
  );
}

function mapToWalletPosition(position: PositionRow, index: number): WalletPosition {
  const id = derivePositionId(position, index);
  const category = deriveCategory(position);

  return {
    ...position,
    id,
    category,
  };
}

type PreviewResponse = {
  pricing: {
    paidPools: number;
    freeBonus: number;
    totalCapacity: number;
  };
};

async function fetchPreview(activePools: number): Promise<PreviewResponse | null> {
  try {
    const response = await fetch(`/api/billing/preview?activePools=${activePools}&billingCycle=month`, { cache: 'no-store' });
    if (!response.ok) throw new Error('response not ok');
    return (await response.json()) as PreviewResponse;
  } catch (error) {
    console.warn('[PoolsOverview] Failed to fetch preview', error);
    return null;
  }
}

type PoolsOverviewProps = {
  address: string;
};

export default function PoolsOverview({ address }: PoolsOverviewProps) {
  const [positions, setPositions] = React.useState<WalletPosition[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [trialPool, setTrialPool] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<PreviewResponse | null>(null);
  const [activePoolCount, setActivePoolCount] = React.useState(0);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setTrialPool(localStorage.getItem(STORAGE_KEY_TRIAL));
    }
  }, []);

  const handleRetry = React.useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  React.useEffect(() => {
    if (!address) {
      setPositions([]);
      setActivePoolCount(0);
      setPreview(null);
      setError(null);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchPositions(address, { signal: controller.signal });
        const rows = response.data?.positions ?? [];
        const mapped = rows.map(mapToWalletPosition);
        if (isCancelled) return;

        setPositions(mapped);

        const aggregate = response.data?.summary ?? computeSummary(rows);

        const activeCount = aggregate.active ?? mapped.filter((row) => row.category === 'Active').length;
        setActivePoolCount(activeCount);

        const previewResponse = await fetchPreview(activeCount);
        if (!isCancelled) {
          setPreview(previewResponse);
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('[PoolsOverview] load failed', err);
          setError('Unable to load pools for your wallet.');
          setPositions([]);
          setActivePoolCount(0);
          setPreview(null);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [address, reloadKey]);

  const activePositions = React.useMemo(
    () => positions.filter((position) => position.category === 'Active'),
    [positions],
  );
  const inactivePositions = React.useMemo(
    () =>
      positions.filter(
        (position) => position.category === 'Inactive' || position.category === 'Ended',
      ),
    [positions],
  );
  const planPaidPools = preview?.pricing?.paidPools ?? 0;
  const planCapacity = preview?.pricing?.totalCapacity ?? includedCapacity(0);
  const planBonus = preview?.pricing?.freeBonus ?? freeBonus(0);

  function handleSelectTrial(poolId: string) {
    setTrialPool(poolId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_TRIAL, poolId);
    }
  }

  function handleClearTrial() {
    setTrialPool(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_TRIAL);
    }
  }

  const planLabel = planPaidPools > 0
    ? `${planPaidPools} paid • ${planBonus} bonus`
    : 'Free plan';

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.85)] px-6 py-6 backdrop-blur-xl md:px-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-brand text-2xl font-semibold text-white">Your LiquiLab plan</h2>
            <p className="font-ui text-sm text-[#B0B9C7]">
              {planLabel} · capacity {planCapacity} pools · active {activePoolCount}
            </p>
          </div>
          {trialPool ? (
            <button
              type="button"
              onClick={handleClearTrial}
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white hover:text-white"
            >
              Clear trial selection
            </button>
          ) : (
            <span className="rounded-full border border-[#6EA8FF]/30 bg-[#6EA8FF]/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-[#6EA8FF]">
              First pool is free
            </span>
          )}
        </div>
        <p className="mt-2 font-ui text-xs text-[#748199]">
          Select any position to attach your free pool slot. Bonus capacity unlocks automatically for every ten paid pools.
        </p>
      </section>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-6 text-center font-ui text-sm text-[#B0B9C7]">
          Loading pools from Enosys, BlazeSwap, and SparkDEX…
        </div>
      )}

      {error && (
        <InfoNote title="Unable to load pools" variant="muted">
          <div className="flex flex-wrap items-center gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={handleRetry}
              disabled={loading}
              className="rounded-md border border-white/20 px-3 py-1 text-xs font-semibold text-white/80 transition hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Retry
            </button>
          </div>
        </InfoNote>
      )}

      {!loading && !error && positions.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-6 text-center font-ui text-sm text-[#B0B9C7]">
          No pools detected yet. Connect a wallet or refresh once you have minted a position.
        </div>
      )}

      {activePositions.length > 0 && (
        <section className="flex flex-col gap-4">
          <header className="flex items-center justify-between">
            <h3 className="font-brand text-xl font-semibold text-white">Active pools</h3>
            <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-[#B0B9C7]">
              {activePositions.length}
            </span>
          </header>
          <div className="grid gap-4">
            {activePositions.map((pool) => {
              const isTrial = trialPool === pool.id;
              return (
                <article
                  key={pool.id}
                  className="rounded-2xl border border-white/10 bg-[rgba(10,15,26,0.7)] px-5 py-5 backdrop-blur-xl"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col gap-2">
                      {/* Token icons met 30% overlap - BOVEN het pool pair */}
                      <div className="flex items-center -space-x-3">
                        <div className="relative">
                          <TokenIcon
                            symbol={pool.token0.symbol}
                            size={40}
                            className="rounded-full border-2 border-[#0A0F1C]"
                          />
                        </div>
                        <div className="relative">
                          <TokenIcon
                            symbol={pool.token1.symbol}
                            size={40}
                            className="rounded-full border-2 border-[#0A0F1C]"
                          />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-brand text-lg font-semibold text-white">
                          {pool.token0.symbol} / {pool.token1.symbol}
                        </h4>
                        <p className="font-ui text-xs uppercase tracking-wider text-[#6EA8FF]/80">{pool.provider ?? 'Unknown provider'}</p>
                        <p className="font-ui text-sm text-[#B0B9C7]">TVL {formatUsd(pool.tvlUsd)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {isTrial && (
                        <span className="rounded-full border border-[#6EA8FF]/40 bg-[#6EA8FF]/10 px-3 py-1 text-xs font-semibold text-[#6EA8FF]">
                          Trial slot
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleSelectTrial(pool.id)}
                        className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white hover:text-white"
                      >
                        {isTrial ? 'Selected' : 'Use free pool'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {inactivePositions.length > 0 && (
        <section className="flex flex-col gap-4">
          <header className="flex items-center justify-between">
            <h3 className="font-brand text-xl font-semibold text-white">Inactive pools</h3>
            <span className="rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-xs font-semibold text-[#B0B9C7]">
              {inactivePositions.length}
            </span>
          </header>
          <div className="grid gap-4">
            {inactivePositions.map((pool) => {
              const isTrial = trialPool === pool.id;
              return (
                <article
                  key={pool.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-5 backdrop-blur-md"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-col gap-2">
                      {/* Token icons met 30% overlap - BOVEN het pool pair */}
                      <div className="flex items-center -space-x-3">
                        <div className="relative">
                          <TokenIcon
                            symbol={pool.token0.symbol}
                            size={40}
                            className="rounded-full border-2 border-[#0A0F1C]"
                          />
                        </div>
                        <div className="relative">
                          <TokenIcon
                            symbol={pool.token1.symbol}
                            size={40}
                            className="rounded-full border-2 border-[#0A0F1C]"
                          />
                        </div>
                      </div>
                      <div>
                        <h4 className="font-brand text-lg font-semibold text-white">
                          {pool.token0.symbol} / {pool.token1.symbol}
                        </h4>
                        <p className="font-ui text-xs uppercase tracking-wider text-[#748199]">Inactive</p>
                        <p className="font-ui text-sm text-[#B0B9C7]">TVL {formatUsd(pool.tvlUsd)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {isTrial && (
                        <span className="rounded-full border border-[#6EA8FF]/40 bg-[#6EA8FF]/10 px-3 py-1 text-xs font-semibold text-[#6EA8FF]">
                          Trial slot
                        </span>
                      )}
                      {!isTrial && (
                        <button
                          type="button"
                          onClick={() => handleSelectTrial(pool.id)}
                          className="rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-white hover:text-white"
                        >
                          Assign free slot
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
