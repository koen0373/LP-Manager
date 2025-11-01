'use client';

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import Header from '@/components/Header';
import RangeBand, { type RangeStatus } from '@/components/pools/PoolRangeIndicator';

export default function RangeBandPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [livePrice, setLivePrice] = React.useState<number | null>(null);

  // Fetch live FXRP price on mount
  React.useEffect(() => {
    const fetchFXRPPrice = async () => {
      try {
        // Correct FXRP token address: 0xAd552A648C74D49E10027AB8a618A3ad4901c5bE
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/0xAd552A648C74D49E10027AB8a618A3ad4901c5bE');
        if (res.ok) {
          const data = await res.json();
          // Get the first pair's priceUsd
          if (data.pairs && data.pairs.length > 0) {
            const price = parseFloat(data.pairs[0].priceUsd || '2.46');
            setLivePrice(price);
          } else {
            setLivePrice(2.46); // fallback
          }
        } else {
          setLivePrice(2.46); // fallback
        }
      } catch (err) {
        console.warn('Failed to fetch FXRP price:', err);
        setLivePrice(2.46); // fallback
      }
    };
    fetchFXRPPrice();
  }, []);

  // Sample realistic data with FXRP
  const currentPrice = livePrice || 2.46;
  const sampleData = {
    provider: 'Enosys v3',
    token0Symbol: 'FXRP',
    token1Symbol: 'USDT0',
    min: 2.20,
    max: 2.75,
    current: currentPrice,
    status: (currentPrice >= 2.20 && currentPrice <= 2.75 ? 'in' : 
             currentPrice < 2.20 ? 'out' : 'near') as RangeStatus,
  };

  // Unified CTA behavior
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
        <title>RangeBand™ · LiquiLab</title>
        <meta
          name="description"
          content="See your pool's health at a glance. Live price, range boundaries, and status — all in one elegant line."
        />
      </Head>

      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="page-bg" aria-hidden="true" />
        
        <Header 
          currentPage="rangeband" 
          showTabs={false}
          showWalletActions={true}
        />

        <div className="relative z-10 mx-auto w-[94vw] max-w-[1000px] px-4 pb-20 pt-12 lg:px-8">
          {/* Hero Section */}
          <section className="mb-12 text-center">
            <h1 className="font-brand text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
              RangeBand™ simplifies LP management.
            </h1>
            <p className="mx-auto mt-6 max-w-3xl font-ui text-base leading-relaxed text-white/75 sm:text-lg">
              See what matters in one glance: your price boundaries, the live market price, and whether you need to act.
            </p>
          </section>

          {/* Main Card - Explainer + CTA + Footer */}
          <section className="mb-12">
            <div className="glass-card rounded-3xl p-8 sm:p-12">
              {/* Interactive Explainer */}
              <h2 className="mb-6 text-center font-brand text-2xl font-semibold text-white sm:text-3xl">
                Interactive Explainer
              </h2>
              
              <p className="mb-8 text-center font-ui text-sm leading-relaxed text-white/60">
                Hover over the strategy labels and status dots below to see how RangeBand™ visualizes your strategy.
              </p>

              {/* RangeBand Component with explainer */}
              <div className="mx-auto mb-12 max-w-2xl">
                <RangeBand
                  min={sampleData.min}
                  max={sampleData.max}
                  current={sampleData.current}
                  status={sampleData.status}
                  token0Symbol={sampleData.token0Symbol}
                  token1Symbol={sampleData.token1Symbol}
                  explainer={true}
                />
              </div>

              <div className="mb-8 text-center">
                <p className="font-ui text-sm text-white/60">
                  Live price: <span className="tabular-nums font-semibold text-white">${currentPrice.toFixed(2)}</span> <span className="text-white/40">USDT0/FXRP</span>
                </p>
              </div>

              {/* Divider */}
              <div className="mb-12 border-t border-white/10"></div>

              {/* CTA Section */}
              <div className="text-center">
                <h3 className="mb-4 font-brand text-2xl font-semibold text-white">
                  See RangeBand™ in action
                </h3>
                <p className="mx-auto mb-6 max-w-xl font-ui text-base leading-relaxed text-white/70">
                  Connect your wallet to view RangeBand™ with your own liquidity positions. 14-day free trial.
                </p>
                
                <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                  <button
                    onClick={handlePrimaryCTA}
                    className="inline-flex items-center justify-center rounded-2xl bg-[#3B82F6] px-8 py-3 font-ui text-base font-semibold text-white transition hover:bg-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50"
                    aria-label="Start free trial"
                  >
                    Start free trial
                  </button>
                  <Link
                    href="/pricing"
                    className="inline-flex items-center justify-center rounded-2xl border border-white/20 bg-white/10 px-8 py-3 font-ui text-base font-semibold text-white transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white/30"
                  >
                    See pricing
                  </Link>
                </div>
              </div>

              {/* Divider */}
              <div className="mb-8 mt-12 border-t border-white/10"></div>

              {/* Footer info */}
              <p className="text-center font-ui text-sm text-white/50">
                RangeBand™ is built into every pool view in LiquiLab — manage your positions with confidence.
              </p>
            </div>
          </section>

          {/* Footer */}
          <footer className="py-8 text-center">
            <p className="font-ui text-xs text-white/40">
              Powered by RangeBand™ — patent pending
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
