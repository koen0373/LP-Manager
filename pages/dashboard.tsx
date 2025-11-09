'use client';

import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';

import Header from '@/components/Header';
import WalletConnect from '@/components/WalletConnect';
import PricingCalculator from '@/components/billing/PricingCalculator';
import PoolsOverview from '@/features/pools/PoolsOverview';
import {
  RoleOverrideToggle,
  formatRoleLabel,
  getRoleFlags,
  normalizeRoleParam,
  type RoleOverride,
} from '@/components/dev/RoleOverrideToggle';

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [showUpgrade, setShowUpgrade] = React.useState(false);
  const router = useRouter();
  const role = React.useMemo<RoleOverride>(() => normalizeRoleParam(router.query?.role) ?? "VISITOR", [router.query?.role]);
  const flags = getRoleFlags(role);
  const premiumView = flags.premium;
  const roleLabel = formatRoleLabel(role);

  return (
    <>
      <Head>
        <title>LiquiLab · Dashboard</title>
        <meta
          name="description"
          content="Connect your wallet to review all of your active and inactive liquidity pools, assign your free trial slot, and upgrade capacity in predictable bundles."
        />
      </Head>
      <div className="relative min-h-screen bg-[#05070C] text-white">
        <RoleOverrideToggle activeRole={role} />
        <Header showTabs={false} currentPage="dashboard" />
        <main className="relative mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 pb-24 pt-12 md:px-10">
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
          {!isConnected ? (
            <section className="rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.85)] px-8 py-14 text-center backdrop-blur-2xl md:px-16">
              <h1 className="font-brand text-3xl font-semibold text-white md:text-4xl">
                Connect your wallet to load pools
              </h1>
              <p className="mt-3 font-ui text-sm text-[#B0B9C7] md:text-base">
                LiquiLab scans Enosys, BlazeSwap, and SparkDEX for all positions owned by your wallet. The first pool is free — upgrade as you grow.
              </p>
              <div className="mt-6 flex justify-center">
                <WalletConnect />
              </div>
            </section>
          ) : (
            <>
              <section className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.8)] px-6 py-6 backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-10">
                <div>
                  <h2 className="font-brand text-xl font-semibold text-white md:text-2xl">Connected wallet</h2>
                  <p className="font-ui text-sm text-[#B0B9C7]">{address}</p>
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
                  <PricingCalculator address={address} />
                </section>
              )}

              <section>
                <PoolsOverview address={address ?? ''} />
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}
