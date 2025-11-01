'use client';

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '@/components/Header';
import { formatEUR, calcPoolsCost, calcNotifCost, calcTotal } from '@/lib/pricing';

export default function SalesPage() {
  const router = useRouter();
  const { paidPools, addNotifications } = router.query;

  const pools = Number(paidPools) || 5;
  const notifications = addNotifications === '1';

  const poolsCost = calcPoolsCost(pools);
  const notifCost = calcNotifCost(pools, notifications);
  const totalCost = calcTotal(pools, notifications);

  return (
    <>
      <Head>
        <title>Sales Funnel · LiquiLab</title>
        <meta name="description" content="Complete your LiquiLab subscription." />
      </Head>

      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="page-bg" aria-hidden="true" />

        <Header currentPage="sales" showTabs={false} showWalletActions={false} />

        <main className="relative z-10 mx-auto w-[94vw] max-w-2xl px-4 pb-20 pt-14 lg:px-0">
          <section className="text-center">
            <h1 className="font-brand text-4xl font-bold leading-tight text-white sm:text-5xl">
              Sales Funnel (stub)
            </h1>
            <p className="mx-auto mt-4 max-w-xl font-ui text-base text-white/70">
              Payment integration coming soon. This is a placeholder.
            </p>
          </section>

          <section
            className="mt-12 rounded-3xl border border-white/10 px-8 py-10 backdrop-blur-xl sm:px-12"
            style={{ background: 'rgba(10, 15, 28, 0.85)' }}
          >
            <div className="space-y-6">
              <h2 className="font-brand text-2xl font-semibold text-white">
                Your selection
              </h2>

              <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.04] p-6 font-ui text-sm">
                <div className="flex items-baseline justify-between gap-4 text-white/70">
                  <span>Pools: {pools} × €1.99 / month</span>
                  <span className="tnum font-semibold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {formatEUR(poolsCost)}
                  </span>
                </div>
                {notifications && (
                  <div className="flex items-baseline justify-between gap-4 text-white/70">
                    <span>Notifications: €2.50 per 5 pools</span>
                    <span className="tnum font-semibold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatEUR(notifCost)}
                    </span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-brand text-base font-semibold text-white">
                      Total
                    </span>
                    <span
                      className="tnum font-brand text-2xl font-bold text-white"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatEUR(totalCost)}
                    </span>
                  </div>
                  <p className="mt-1 text-right text-white/60">per month</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => alert('Stripe checkout will be integrated here.')}
                  className="w-full rounded-xl bg-[#3B82F6] px-6 py-4 font-brand text-base font-semibold text-white transition hover:bg-[#60A5FA] hover:shadow-[0_0_24px_rgba(59,130,246,0.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#60A5FA]/60"
                >
                  Continue (placeholder)
                </button>
                <Link
                  href="/pricing"
                  className="block w-full rounded-xl border border-white/20 bg-white/[0.04] px-6 py-3.5 text-center font-brand text-base font-semibold text-white transition hover:border-[#3B82F6] hover:bg-[#3B82F6]/10"
                >
                  ← Back to pricing
                </Link>
              </div>

              <p className="text-center font-ui text-xs text-white/50">
                Payment processing will be added in a future step.
              </p>
            </div>
          </section>
        </main>
      </div>
    </>
  );
}






