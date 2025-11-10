'use client';

import Link from 'next/link';

import { InlineReal } from '@/components/rangeband/InlineReal';

const rangeProps = {
  min: 0.95,
  max: 1.05,
  current: 1.01,
  status: 'in' as const,
  token0Symbol: 'FXRP',
  token1Symbol: 'USD₮0',
};

const usps = [
  'Unified Flare V3 Liquidity Pool dashboard (Ēnosys & SparkDEX)',
  'Live Incentive Tracking',
  'RangeBand™ health with instant indicators',
  'Peer Benchmarking (Pro)',
  'Detailed pool analytics (Pro)',
];

export function Hero() {
  return (
    <section className="mx-auto w-full max-w-5xl px-6">
      <div className="rounded-[32px] border border-white/10 bg-[rgba(11,21,48,0.92)] px-8 py-10 text-center shadow-[0_20px_70px_rgba(0,0,0,0.35)] sm:px-12">
        <p className="font-brand text-sm uppercase tracking-[0.4em] text-[#1BE8D2]">Liquidity intelligence</p>
        <div className="mt-4 space-y-4">
          <h1 className="font-brand text-4xl text-white sm:text-5xl">The easy way to manage your liquidity pools</h1>
          <p className="font-ui text-lg text-white/70">
            Monitor 5+ pools. Track incentives live. Rebalance smarter. Starting at $14.95/month.
          </p>
        </div>
        <ul className="mt-6 grid gap-3 text-left text-sm text-white/80 sm:grid-cols-2">
          {usps.map((usp) => (
            <li key={usp} className="flex items-start gap-2">
              <span className="text-[#1BE8D2]">✓</span>
              <span>{usp}</span>
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <InlineReal defaultStrategy="BAL" />
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="btn-primary inline-flex items-center justify-center px-6 py-3 text-sm font-semibold"
            aria-label="Start 14 day trial"
          >
            Start 14 day trial
          </Link>
          <a href="#demo" className="btn-ghost" aria-label="See demo pools">
            See How It Works
          </a>
        </div>
      </div>
    </section>
  );
}
