'use client';

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

import { LiquiLabLogo } from '@/components/LiquiLabLogo';
import { Button } from '@/components/ui/Button';
import DemoSection from '@/components/demo/DemoSection';
import ConnectWalletModal from '@/components/onboarding/ConnectWalletModal';
import { useAccount, useDisconnect } from 'wagmi';

export default function Homepage() {
  const [isConnectOpen, setIsConnectOpen] = React.useState(false);
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  function handleConnect() {
    setIsConnectOpen(true);
  }

  async function handleDisconnect() {
    try {
      await disconnect();
    } catch (error) {
      console.error('[Homepage] Disconnect failed', error);
    }
  }

  return (
    <>
      <Head>
        <title>LiquiLab · The Liquidity Pool Intelligence Platform</title>
        <meta
          name="description"
          content="One clean dashboard for your liquidity pools. First pool is free; each additional pool is $1.99/month."
        />
      </Head>

      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="page-bg" aria-hidden="true" />
        <div className="relative z-10 mx-auto flex min-h-screen w-[94vw] max-w-[1200px] flex-col pb-20 pt-6 lg:w-[75vw]">
          <header className="flex items-center justify-between">
            <LiquiLabLogo variant="full" size="sm" theme="dark" />
            <div className="flex items-center gap-4">
              {address ? (
                <div className="flex items-center gap-3">
                  <span className="font-ui text-sm text-white/80">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </span>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="rounded-lg border border-white/20 bg-white/[0.05] px-3 py-1.5 font-ui text-xs font-semibold text-white/80 transition hover:border-[#3B82F6] hover:bg-[#3B82F6]/10 hover:text-white"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="text-sm font-semibold text-white/80 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                >
                  Sign in
                </Link>
              )}
            </div>
          </header>

          <main className="mt-14 space-y-24 sm:mt-20 sm:space-y-32">
            {/* UNIFIED HERO: Proposition + Trial CTA */}
            <section
              aria-label="Hero"
              className="mx-auto w-[75vw] max-w-[1200px] rounded-3xl border border-white/5 p-10 text-center backdrop-blur-xl sm:p-14"
              style={{
                background: 'rgba(10, 15, 26, 0.88)',
              }}
            >
              <h1 className="font-brand text-4xl font-semibold leading-tight text-white sm:text-5xl">
                The easy way to manage your liquidity pools.
              </h1>
              
              <p className="mt-5 font-ui text-base leading-relaxed text-[#9CA3AF] sm:text-lg">
                One clean dashboard for all your LPs — powered by live RangeBand™ insights.
              </p>

              <ul className="mt-10 space-y-4 text-left sm:text-center">
                <li className="flex items-start gap-3 font-ui text-sm text-white/90 sm:inline-flex sm:text-base">
                  <span className="flex-shrink-0 text-[#1BE8D2]" aria-hidden="true">✓</span>
                  <span>See every position in one view — ranges, fees, incentives, and status.</span>
                </li>
                <li className="flex items-start gap-3 font-ui text-sm text-white/90 sm:inline-flex sm:text-base">
                  <span className="flex-shrink-0 text-[#1BE8D2]" aria-hidden="true">✓</span>
                  <span>Make smarter moves with live RangeBand™ and actionable alerts.</span>
                </li>
                <li className="flex items-start gap-3 font-ui text-sm text-white/90 sm:inline-flex sm:text-base">
                  <span className="flex-shrink-0 text-[#1BE8D2]" aria-hidden="true">✓</span>
                  <span>Start free with one pool — upgrade in bundles of 5 at <span className="font-num font-semibold">$1.99</span> per pool/month.</span>
                </li>
              </ul>

              <div className="mt-12 flex flex-col items-center gap-4">
                <Button
                  as="button"
                  onClick={handleConnect}
                  className="shadow-[0_0_40px_rgba(27,232,210,0.25)]"
                  aria-label="Connect wallet to start free"
                >
                  Connect wallet — start free
                </Button>
                <span className="text-xs uppercase tracking-[0.3em] text-white/40">
                  Read-only. No approvals.
                </span>
              </div>
            </section>

            {/* PROOF OF CONCEPT: Live Demo */}
            <section aria-label="Live demo">
              <DemoSection />
            </section>
          </main>
        </div>
      </div>

      <ConnectWalletModal isOpen={isConnectOpen} onClose={() => setIsConnectOpen(false)} />
    </>
  );
}
