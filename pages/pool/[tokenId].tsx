'use client';

import React from 'react';
import type { GetServerSideProps } from 'next';
import Header from '@/components/Header';
import { fetchPool } from '@/lib/api/analytics';
import type { AnalyticsPoolData } from '@/lib/api/analytics';
import { formatUsd } from '@/lib/format';

interface PoolPageProps {
  tokenId: string;
}

type PoolState = {
  loading: boolean;
  degrade: boolean;
  data: AnalyticsPoolData | null;
  ts: number | null;
  error?: string;
};

const INITIAL_STATE: PoolState = {
  loading: true,
  degrade: false,
  data: null,
  ts: null,
};

export default function PoolAnalyticsPage({ tokenId }: PoolPageProps) {
  const [state, setState] = React.useState<PoolState>(INITIAL_STATE);

  React.useEffect(() => {
    let mounted = true;

    setState({ ...INITIAL_STATE });

    (async () => {
      const response = await fetchPool(tokenId);
      if (!mounted) {
        return;
      }

      if (response.degrade) {
        setState({
          loading: false,
          degrade: true,
          data: null,
          ts: response.ts ?? Date.now(),
        });
        return;
      }

      if (!response.pool) {
        setState({
          loading: false,
          degrade: false,
          data: null,
          ts: response.ts ?? Date.now(),
          error: 'Pool data unavailable.',
        });
        return;
      }

      setState({
        loading: false,
        degrade: false,
        data: response.pool,
        ts: response.ts ?? Date.now(),
      });
    })().catch(() => {
      if (!mounted) return;
      setState({
        loading: false,
        degrade: true,
        data: null,
        ts: Date.now(),
      });
    });

    return () => {
      mounted = false;
    };
  }, [tokenId]);

  const { loading, degrade, data, error, ts } = state;

  const metricCards = [
    {
      label: 'Pool State',
      value: degrade ? '--' : data?.state ?? 'unknown',
      description: 'Latest known status from mv_pool_latest_state',
    },
    {
      label: 'TVL (USD)',
      value: degrade ? '--' : `$${formatUsd(data?.tvl ?? 0)}`,
      description: 'Current USD value',
    },
    {
      label: 'Fees · 24h',
      value: degrade ? '--' : `$${formatUsd(data?.fees24h ?? 0)}`,
      description: 'Fees captured in the last 24h',
    },
    {
      label: 'Fees · 7d',
      value: degrade ? '--' : `$${formatUsd(data?.fees7d ?? 0)}`,
      description: 'Fees captured in the trailing 7 days',
    },
    {
      label: 'Active Positions',
      value: degrade ? '--' : (data?.positionsCount ?? 0).toLocaleString(),
      description: 'Distinct LP tokenIds observed',
    },
  ];

  return (
    <div className="min-h-screen bg-[#010615] text-white font-ui">
      <div className="fixed inset-0 opacity-90 pointer-events-none" aria-hidden />
      <div className="relative z-10">
        <Header currentPage="pools" showTabs={false} showWalletActions={false} />
        <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-16 pt-10">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">Pool analytics</p>
            <h1 className="font-brand text-3xl text-white break-all">
              Pool · <span className="text-liqui-blue">{tokenId}</span>
            </h1>
            {!degrade && ts && (
              <p className="text-sm text-white/60">
                Last updated{' '}
                {new Date(ts).toLocaleString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                  day: 'numeric',
                  month: 'short',
                })}
              </p>
            )}
          </div>

          {degrade && (
            <div className="rounded-2xl border border-white/10 bg-[#0B1530] px-6 py-4 text-sm text-white/70">
              Analytics backend is unavailable. These tiles remain neutral until the database comes back online.
            </div>
          )}

          {error && !degrade && (
            <div className="rounded-2xl border border-white/10 bg-[#0B1530] px-6 py-4 text-sm text-white/70">
              {error}
            </div>
          )}

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {metricCards.map((metric) => (
              <article
                key={metric.label}
                className={`rounded-2xl border border-white/10 bg-[#0B1530] px-6 py-5 ${
                  degrade ? 'opacity-70' : ''
                }`}
              >
                <div className="text-xs uppercase tracking-wider text-white/60">{metric.label}</div>
                <div className="mt-3 text-3xl font-semibold text-white tnum">
                  {loading ? '...' : metric.value}
                </div>
                <p className="mt-2 text-sm text-white/60">{metric.description}</p>
              </article>
            ))}
          </section>
        </main>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const tokenId = typeof context.params?.tokenId === 'string' ? context.params.tokenId : '';

  return {
    props: {
      tokenId,
    },
  };
};
