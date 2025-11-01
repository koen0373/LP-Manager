'use client';

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import Header from '@/components/Header';
import { Button } from '@/components/ui/Button';
import DemoPoolsTable from '@/components/demo/DemoPoolsTable';
import { useAccount } from 'wagmi';

export default function Homepage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  // Unified CTA behavior: if ?address=0x... present → /sales/offer?address=..., else → /pricing
  const handlePrimaryCTA = () => {
    if (isConnected && address) {
      router.push(`/sales/offer?address=${address}`);
    } else {
      router.push('/pricing');
    }
  };

  return (
    <>
      <Head>
        <title>LiquiLab · Unified Dashboard for Flare Liquidity Pools</title>
        <meta
          name="description"
          content="One clean dashboard for all your liquidity pools. Powered by live RangeBand™ insights. 14-day free trial."
        />
      </Head>

      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="page-bg" aria-hidden="true" />
        
        <Header 
          currentPage="home" 
          showTabs={false} 
          showWalletActions={true}
        />
        
        <div className="relative z-10 mx-auto flex min-h-screen w-[94vw] max-w-[1200px] flex-col pb-20 pt-6 lg:w-[75vw]">
          <main className="mt-14 space-y-24 sm:mt-20 sm:space-y-32">
            {/* HERO */}
            <section
              aria-label="Hero"
              className="mx-auto w-[75vw] max-w-[1200px] rounded-3xl border border-white/5 p-10 text-center backdrop-blur-xl sm:p-14"
              style={{
                background: 'rgba(10, 15, 26, 0.88)',
              }}
            >
              <h1 className="font-brand text-4xl font-semibold leading-tight text-white sm:text-5xl">
                One dashboard for all your liquidity pools.
              </h1>
              
              <p className="mt-5 font-ui text-base leading-relaxed text-[#9CA3AF] sm:text-lg">
                See every position in one place — with live RangeBand™ insights, real-time fees, and actionable alerts.
              </p>

              <ul className="mt-10 space-y-4 text-left sm:text-center">
                <li className="flex items-start gap-3 font-ui text-sm text-white/90 sm:inline-flex sm:text-base">
                  <span className="flex-shrink-0 text-[#1BE8D2]" aria-hidden="true">✓</span>
                  <span>All your pools from Enosys, SparkDEX, and BlazeSwap — unified in one view.</span>
                </li>
                <li className="flex items-start gap-3 font-ui text-sm text-white/90 sm:inline-flex sm:text-base">
                  <span className="flex-shrink-0 text-[#1BE8D2]" aria-hidden="true">✓</span>
                  <span>RangeBand™ visualisation shows pool health at a glance — no mental math.</span>
                </li>
                <li className="flex items-start gap-3 font-ui text-sm text-white/90 sm:inline-flex sm:text-base">
                  <span className="flex-shrink-0 text-[#1BE8D2]" aria-hidden="true">✓</span>
                  <span>
                    14-day free trial. First 5 pools: <span className="tabular-nums font-semibold">$1.99</span>/mo. Add more in packs of 5.
                  </span>
                </li>
              </ul>

              <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                {!isConnected ? (
                  <>
                    <Button
                      as="button"
                      onClick={handlePrimaryCTA}
                      className="shadow-[0_0_40px_rgba(27,232,210,0.25)]"
                      aria-label="Start 14-day free trial"
                    >
                      Start free trial
                    </Button>
                    <Link
                      href="/pricing"
                      aria-label="See pricing"
                      className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 font-ui text-sm text-white transition hover:bg-white/15"
                    >
                      See pricing
                    </Link>
                  </>
                ) : (
                  <>
                    <Button
                      as="button"
                      onClick={handlePrimaryCTA}
                      className="shadow-[0_0_40px_rgba(27,232,210,0.25)]"
                      aria-label="Continue to your personalized offer"
                    >
                      View your pools
                    </Button>
                    <Link
                      href="/dashboard"
                      aria-label="Go to Dashboard"
                      className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 font-ui text-sm text-white transition hover:bg-white/15"
                    >
                      Go to Dashboard
                    </Link>
                  </>
                )}
              </div>

              {isConnected && (
                <p className="mt-4 font-ui text-xs text-white/60">
                  Connected: <span className="tabular-nums">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                </p>
              )}

              {!isConnected && (
                <p className="mt-6 text-xs uppercase tracking-[0.3em] text-white/40">
                  Read-only. No approvals.
                </p>
              )}
            </section>

            {/* LIVE DEMO */}
            <section aria-label="Live demo">
              <div
                className="mx-auto w-[75vw] max-w-[1200px] rounded-3xl border border-white/5 p-10 backdrop-blur-xl sm:p-14"
                style={{ background: 'rgba(10, 15, 26, 0.88)' }}
              >
                <DemoPoolsTable />
              </div>
            </section>

            {/* FOOTER */}
            <footer className="py-8 text-center">
              <p className="font-ui text-xs text-white/40">
                Powered by RangeBand™ — patent pending
              </p>
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}
