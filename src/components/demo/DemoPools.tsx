'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';

import WalletConnect from '@/components/WalletConnect';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const USD_COMPACT = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

interface DemoPool {
  poolAddress: string;
  dex: 'enosys-v3' | 'sparkdex-v3';
  token0: { symbol: string };
  token1: { symbol: string };
  feeBps: number;
  tvlUsd: number | null;
  fees24hUsd: number | null;
  incentivesUsd: number | null;
  status: 'in' | 'near' | 'out' | 'unknown';
}

interface ApiResponse {
  ok: boolean;
  items: DemoPool[];
}

type DemoPoolsProps = {
  walletAddress?: string;
  entitlements: { flags: { premium: boolean } };
};

export function DemoPools({ walletAddress, entitlements }: DemoPoolsProps) {
  const [view, setView] = React.useState<'list' | 'grid'>('list');
  const query = useQuery<ApiResponse>({
    queryKey: ['demo-pools'],
    queryFn: fetchDemoPools,
    staleTime: 120_000,
  });

  const pools = query.data?.items ?? [];
  const shouldMask = Boolean(walletAddress) && !entitlements.flags.premium;

  return (
    <section id="demo" className="rounded-3xl border border-white/10 bg-[rgba(11,21,48,0.9)] px-6 py-8 text-white shadow-2xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-brand text-2xl text-white">See how it looks with real pools</h2>
          <p className="font-ui text-sm text-white/70">Live demo data refreshed from the indexer.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <WalletConnect />
          <div className="overflow-hidden rounded-full border border-white/10">
            <button
              type="button"
              className={`px-4 py-2 text-xs font-semibold ${view === 'list' ? 'bg-[#3B82F6]' : 'text-white/70'}`}
              onClick={() => setView('list')}
            >
              List
            </button>
            <button
              type="button"
              className={`px-4 py-2 text-xs font-semibold ${view === 'grid' ? 'bg-[#3B82F6]' : 'text-white/70'}`}
              onClick={() => setView('grid')}
            >
              Grid
            </button>
          </div>
        </div>
      </div>

      {query.isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="h-32 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      ) : view === 'list' ? (
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-white/60">
              <tr>
                <th className="py-3 font-normal">Pool</th>
                <th className="py-3 font-normal">TVL (USD)</th>
                <th className="py-3 font-normal">24h fees</th>
                <th className="py-3 font-normal">Incentives</th>
                <th className="py-3 font-normal">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10 font-num">
              {pools.map((pool) => (
                <tr key={pool.poolAddress} className="text-white/80">
                  <td className="py-3">
                    <div className="font-ui text-base text-white">{pool.token0.symbol} / {pool.token1.symbol}</div>
                    <div className="text-xs text-white/60">{pool.dex === 'enosys-v3' ? 'Ēnosys' : 'SparkDEX'} · {formatFee(pool.feeBps)}</div>
                  </td>
                  <td className="py-3">{usd(pool.tvlUsd)}</td>
                  <td className="py-3">{shouldMask ? 'Premium feature' : usd(pool.fees24hUsd)}</td>
                  <td className="py-3">{shouldMask ? 'Premium feature' : usd(pool.incentivesUsd)}</td>
                  <td className="py-3">
                    <a href={dexLink(pool)} className="text-sm text-[#3B82F6]" target="_blank" rel="noreferrer">
                      View
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {pools.map((pool) => (
            <article key={pool.poolAddress} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
              <header className="flex items-center justify-between text-sm text-white/70">
                <span className="font-ui text-white">{pool.token0.symbol} / {pool.token1.symbol}</span>
                <StatusDot status={pool.status} />
              </header>
              <p className="text-xs text-white/50">{pool.dex === 'enosys-v3' ? 'Ēnosys' : 'SparkDEX'} · {formatFee(pool.feeBps)}</p>
              <div className="mt-4 space-y-2 font-num text-sm">
                <div>
                  <p className="text-white/50">TVL</p>
                  <p className="text-lg text-white">{usd(pool.tvlUsd)}</p>
                </div>
                <div>
                  <p className="text-white/50">24h fees</p>
                  <p>{shouldMask ? 'Premium feature' : usd(pool.fees24hUsd)}</p>
                </div>
                <div>
                  <p className="text-white/50">Incentives</p>
                  <p>{shouldMask ? 'Premium feature' : usd(pool.incentivesUsd)}</p>
                </div>
              </div>
              <footer className="mt-4 flex gap-3">
                <a
                  href={dexLink(pool)}
                  className="btn-primary inline-flex flex-1 items-center justify-center px-4 py-2 text-sm"
                  target="_blank"
                  rel="noreferrer"
                >
                  Manage on DEX
                </a>
              </footer>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

async function fetchDemoPools(): Promise<ApiResponse> {
  const response = await fetch('/api/demo/pools?limit=9&minTvl=150');
  if (!response.ok) {
    throw new Error('demo_pools_failed');
  }
  return response.json();
}

function usd(value: number | null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return USD.format(value);
}

function formatFee(feeBps: number) {
  return `${(feeBps / 100).toFixed(2)}%`;
}

function dexLink(pool: DemoPool) {
  if (pool.dex === 'sparkdex-v3') {
    return `https://app.sparkdex.fi/pool/${pool.poolAddress}`;
  }
  return `https://app.enosys.io/pool/${pool.poolAddress}`;
}

function StatusDot({ status }: { status: DemoPool['status'] }) {
  const meta =
    status === 'in'
      ? 'bg-[#34D399]'
      : status === 'near'
      ? 'bg-[#FBBF24]'
      : status === 'out'
      ? 'bg-[#F87171]'
      : 'bg-white/30';
  return <span className={`inline-flex h-2.5 w-2.5 rounded-full ${meta}`} aria-hidden="true" />;
}
