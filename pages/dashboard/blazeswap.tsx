'use client';

import * as React from 'react';
import Head from 'next/head';

import Header from '@/components/Header';
import { PairSearch } from '../../components/blazeswap/PairSearch';
import { PositionCard } from '../../components/blazeswap/PositionCard';
import AddLiquidityForm from '../../components/blazeswap/AddLiquidityForm';
import { RemoveLiquidityForm } from '../../components/blazeswap/RemoveLiquidityForm';
import type {
  PairSnapshot,
  TokenMetadata,
  UserLpPosition,
} from '@/lib/blazeswap/read';
import { useAccount } from 'wagmi';

type PairResponse = {
  ok: true;
  snapshot: PairSnapshot;
  tokens: {
    token0: TokenMetadata;
    token1: TokenMetadata;
  };
  position?: UserLpPosition;
};

const BLAZESWAP_ENABLED =
  (process.env.NEXT_PUBLIC_ENABLE_BLAZESWAP ??
    process.env.ENABLE_BLAZESWAP ??
    ''
  ).toLowerCase() === 'true';

export default function BlazeSwapDashboardPage() {
  const { address } = useAccount();
  const [selectedPair, setSelectedPair] = React.useState<string | null>(null);
  const [pairData, setPairData] = React.useState<PairResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = React.useState(0);

  const account = address ?? null;

  React.useEffect(() => {
    if (!selectedPair) {
      setPairData(null);
      return;
    }

    let active = true;
    async function loadPair() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (account) params.set('user', account);
        const response = await fetch(
          `/api/blazeswap/pair/${selectedPair}${
            params.toString().length ? `?${params.toString()}` : ''
          }`,
        );
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? 'Unable to load pair details.');
        }
        const payload = (await response.json()) as PairResponse;
        if (!active) return;
        setPairData(payload);
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : 'Unexpected error loading pair.';
        setError(message);
        setPairData(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPair();
    return () => {
      active = false;
    };
  }, [selectedPair, account, refreshIndex]);

  const handleRefresh = () => {
    setRefreshIndex((prev) => prev + 1);
  };

  if (!BLAZESWAP_ENABLED) {
    return (
      <>
        <Head>
          <title>BlazeSwap · LiquiLab</title>
        </Head>
        <Header
          currentPage="blazeswap"
          showTabs={false}
        />
        <main className="mx-auto max-w-3xl px-6 py-20 text-white">
          <h1 className="font-brand text-3xl font-semibold">
            BlazeSwap integration disabled
          </h1>
          <p className="mt-4 font-ui text-sm text-white/60">
            Set <code className="font-mono">ENABLE_BLAZESWAP=true</code> and{' '}
            <code className="font-mono">FLARE_RPC_URL</code> to enable BlazeSwap liquidity
            management inside LiquiLab.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>BlazeSwap (Flare) · LiquiLab</title>
      </Head>

      <Header currentPage="blazeswap" showTabs={false} />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-10 text-white">
        <div className="mb-8 space-y-2">
          <h1 className="font-brand text-4xl font-semibold">
            Manage BlazeSwap liquidity
          </h1>
          <p className="font-ui text-sm text-white/60">
            Discover BlazeSwap pairs on Flare, inspect your LP positions, and add or remove liquidity without leaving LiquiLab.
          </p>
          <p className="font-ui text-xs text-white/40">
            Powered by BlazeSwap • RangeBand™ compatible analytics coming soon
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <PairSearch
            selectedPair={selectedPair}
            onSelect={(address) => {
              setSelectedPair(address);
              setRefreshIndex((prev) => prev + 1);
            }}
          />

          <div className="space-y-6">
            <PositionCard
              snapshot={pairData?.snapshot ?? null}
              tokens={{
                token0: pairData?.tokens.token0 ?? null,
                token1: pairData?.tokens.token1 ?? null,
              }}
              position={pairData?.position}
              account={account}
              onRefresh={handleRefresh}
            />

            {pairData && (
              <div className="grid gap-6 lg:grid-cols-2">
                <AddLiquidityForm />
                <RemoveLiquidityForm
                  account={account}
                  pairAddress={pairData.snapshot.address}
                  pairDecimals={pairData.snapshot.lpDecimals}
                  token0={pairData.tokens.token0}
                  token1={pairData.tokens.token1}
                  position={pairData.position}
                  onSubmitted={handleRefresh}
                />
              </div>
            )}

            {loading && (
              <p className="font-ui text-sm text-white/50">Loading pair details…</p>
            )}
            {error && (
              <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                {error}
              </p>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
