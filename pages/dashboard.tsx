'use client';

import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';

import Header from '@/components/Header';
import WalletConnect from '@/components/WalletConnect';
import PricingCalculator from '@/components/billing/PricingCalculator';
import { PoolsGrid } from '@/components/pools/PoolsGrid';
import { Hero } from '@/components/hero/Hero';
import { DemoPools } from '@/components/demo/DemoPools';
import ScreenshotButton from '@/components/utils/ScreenshotButton';
import {
  RoleOverrideToggle,
  formatRoleLabel,
  getRoleFlags,
  normalizeRoleParam,
  type RoleOverride,
} from '@/components/dev/RoleOverrideToggle';
import type { PositionsResponse, PositionsSummaryPayload, PositionRow } from '@/lib/positions/types';

const ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/i;
const FALLBACK_ENTITLEMENTS: PositionRow['entitlements'] = {
  role: 'VISITOR',
  flags: { premium: false, analytics: false },
};

export default function DashboardPage() {
  const { address } = useAccount();
  const [showUpgrade, setShowUpgrade] = React.useState(false);
  const router = useRouter();
  const role = React.useMemo<RoleOverride>(() => normalizeRoleParam(router.query?.role) ?? "VISITOR", [router.query?.role]);
  const flags = getRoleFlags(role);
  const premiumView = flags.premium;
  const roleLabel = formatRoleLabel(role);
  const roleOverrideParam = typeof router.query?.role === 'string' ? router.query.role : undefined;

  const queryAddress = React.useMemo(() => {
    const raw = typeof router.query?.address === 'string' ? router.query.address : undefined;
    if (!raw || !ADDRESS_REGEX.test(raw)) return undefined;
    return raw.toLowerCase();
  }, [router.query?.address]);

  const walletAddress = React.useMemo(() => {
    if (queryAddress) return queryAddress;
    if (address && ADDRESS_REGEX.test(address)) return address.toLowerCase();
    return undefined;
  }, [queryAddress, address]);

  React.useEffect(() => {
    if (!walletAddress && showUpgrade) {
      setShowUpgrade(false);
    }
  }, [walletAddress, showUpgrade]);

  const positionsQuery = useQuery<PositionsResponse>({
    queryKey: ['positions', walletAddress, roleOverrideParam],
    queryFn: () => fetchPositions(walletAddress as string, roleOverrideParam),
    staleTime: 120_000,
    enabled: Boolean(walletAddress),
    retry: 1,
  });

  const summaryQuery = useQuery<PositionsSummaryPayload>({
    queryKey: ['positions-summary', walletAddress, roleOverrideParam],
    queryFn: () => fetchSummary(walletAddress as string, roleOverrideParam),
    staleTime: 120_000,
    enabled: Boolean(walletAddress),
    retry: 1,
  });

  const positions = positionsQuery.data?.data?.positions ?? [];
  const entitlements = React.useMemo(() => {
    const candidate = positions[0]?.entitlements ?? summaryQuery.data?.entitlements;
    return safeEntitlements(candidate);
  }, [positions, summaryQuery.data?.entitlements]);

  const isGridLoading = positionsQuery.isLoading || summaryQuery.isLoading;

  return (
    <>
      <Head>
        <title>LiquiLab · Dashboard</title>
        <meta
          name="description"
          content="Connect your wallet to review all of your active and inactive liquidity pools, assign your free trial slot, and upgrade capacity in predictable bundles."
        />
      </Head>
      <div className="relative min-h-screen text-white">
        <div className="page-bg" aria-hidden="true" />
        <div className="relative z-10">
          <RoleOverrideToggle activeRole={role} />
          <Header showTabs={false} currentPage="dashboard" />
          <div className="flex justify-end px-6 pt-4">
            <ScreenshotButton />
          </div>
          <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-24 pt-12 md:px-10">
          <Hero />
          <DemoPools walletAddress={walletAddress} entitlements={entitlements} />
          <section className="rounded-3xl border border-white/10 bg-[rgba(11,21,48,0.85)] px-6 py-4 text-sm text-white/70 shadow-lg backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Viewing entitlements as <span className="font-semibold text-white">{roleLabel}</span>
              </span>
              <span className={premiumView ? 'text-white/70' : 'text-[#FECACA]'}>
                {flags.analytics
                  ? 'Premium + Analytics enabled'
                  : premiumView
                  ? 'Analytics hidden for this role'
                  : 'Premium metrics masked for this view'}
              </span>
            </div>
          </section>
          {walletAddress ? (
            <>
              <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.8)] px-6 py-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-10">
                <div>
                  <h2 className="font-brand text-xl font-semibold text-white md:text-2xl">Connected wallet</h2>
                  <p className="font-ui text-sm text-[#B0B9C7]">{walletAddress}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowUpgrade((prev) => !prev)}
                    className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white hover:text-white"
                  >
                    {showUpgrade ? 'Hide pricing' : 'Upgrade capacity'}
                  </button>
                </div>
              </section>
              {showUpgrade && (
                <section>
                  <PricingCalculator address={walletAddress} />
                </section>
              )}
            </>
          ) : (
            <section className="rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.85)] px-8 py-14 text-center backdrop-blur-2xl md:px-16">
              <h1 className="font-brand text-3xl font-semibold text-white md:text-4xl">Connect your wallet to load pools</h1>
              <p className="mt-3 font-ui text-sm text-[#B0B9C7] md:text-base">
                LiquiLab scans Ēnosys and SparkDEX automatically. Your first pools appear here in seconds.
              </p>
              <div className="mt-6 flex justify-center">
                <WalletConnect />
              </div>
            </section>
          )}

          <PoolsGrid
            positions={positions}
            entitlements={entitlements}
            isLoading={isGridLoading}
            walletAddress={walletAddress}
            connectCta={<WalletConnect />}
            demoMode={!walletAddress}
          />
          </main>
        </div>
      </div>
    </>
  );
}

async function fetchPositions(wallet: string, role?: string): Promise<PositionsResponse> {
  const params = new URLSearchParams({ wallet });
  if (role) params.set('role', role);
  const response = await fetch(`/api/positions?${params.toString()}`);
  if (!response.ok) {
    throw new Error('positions_fetch_failed');
  }
  return response.json();
}

async function fetchSummary(wallet: string, role?: string): Promise<PositionsSummaryPayload> {
  const params = new URLSearchParams({ wallet });
  if (role) params.set('role', role);
  const response = await fetch(`/api/positions/summary?${params.toString()}`);
  if (!response.ok) {
    throw new Error('summary_fetch_failed');
  }
  return response.json();
}

function safeEntitlements(ent?: PositionRow['entitlements'] | PositionsSummaryPayload['entitlements']): PositionRow['entitlements'] {
  return {
    role: ent?.role ?? 'VISITOR',
    flags: {
      premium: Boolean(ent?.flags?.premium),
      analytics: Boolean(ent?.flags?.analytics),
    },
  };
}
