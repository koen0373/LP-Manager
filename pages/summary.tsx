'use client';

import React from 'react';
import Header from '@/components/Header';
import { fetchSummary } from '@/lib/api/analytics';
import type { AnalyticsSummaryData } from '@/lib/api/analytics';
import { formatUsd } from '@/lib/format';

type SummaryState = {
  loading: boolean;
  degrade: boolean;
  metrics: AnalyticsSummaryData | null;
  ts: number | null;
};

const INITIAL_STATE: SummaryState = {
  loading: true,
  degrade: false,
  metrics: null,
  ts: null,
};

const METRIC_META: Array<{ key: keyof AnalyticsSummaryData; label: string; description: string }> = [
  { key: 'tvlTotal', label: 'Total TVL', description: 'USD across tracked pools' },
  { key: 'poolsActive', label: 'Active Pools', description: 'Pools with non-zero TVL' },
  { key: 'positionsActive', label: 'Positions', description: 'Distinct LP tokens observed' },
  { key: 'fees24h', label: 'Fees · 24h', description: 'Last 24 hours (USD)' },
  { key: 'fees7d', label: 'Fees · 7d', description: 'Trailing 7 days (USD)' },
];

function formatMetricValue(key: keyof AnalyticsSummaryData, value: number): string {
  if (key === 'tvlTotal' || key === 'fees24h' || key === 'fees7d') {
    return `$${formatUsd(value)}`;
  }
  return value.toLocaleString();
}

export default function SummaryPage() {
  const [state, setState] = React.useState<SummaryState>(INITIAL_STATE);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      const response = await fetchSummary();
      if (!mounted) return;

      if (response.degrade) {
        setState({
          loading: false,
          degrade: true,
          metrics: null,
          ts: response.ts ?? Date.now(),
        });
        return;
      }

      setState({
        loading: false,
        degrade: false,
        metrics: response.data ?? null,
        ts: response.ts ?? Date.now(),
      });
    })().catch(() => {
      if (!mounted) return;
      setState({
        loading: false,
        degrade: true,
        metrics: null,
        ts: Date.now(),
      });
    });

    return () => {
      mounted = false;
    };
  }, []);

  const { loading, degrade, metrics, ts } = state;

  const renderMetricValue = (key: keyof AnalyticsSummaryData): string => {
    if (loading) return '...';
    if (degrade || !metrics) return '--';
    const value = metrics[key] ?? 0;
    return formatMetricValue(key, value);
  };

  return (
    <div className="min-h-screen bg-[#010615] text-white font-ui">
      <div className="fixed inset-0 opacity-90 pointer-events-none" aria-hidden />
      <div className="relative z-10">
        <Header currentPage="summary" showTabs={false} showWalletActions={false} />
        <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-16 pt-10">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">Analytics</p>
            <h1 className="font-brand text-3xl text-white">Network Summary</h1>
            {!degrade && ts && (
              <p className="text-sm text-white/60">
                Last updated {new Date(ts).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })}
              </p>
            )}
          </div>

          {degrade && (
            <div className="rounded-2xl border border-white/10 bg-[#0B1530] px-6 py-4 text-sm text-white/70">
              Analytics services are in degrade mode. Tiles show a neutral placeholder until the database is available
              again. No action required.
            </div>
          )}

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {METRIC_META.map((metric) => (
              <article
                key={metric.key}
                className={`rounded-2xl border border-white/10 bg-[#0B1530] px-6 py-5 ${
                  degrade ? 'opacity-70' : ''
                }`}
              >
                <div className="text-xs uppercase tracking-wider text-white/60">{metric.label}</div>
                <div className="mt-3 text-3xl font-semibold text-white tnum">{renderMetricValue(metric.key)}</div>
                <p className="mt-2 text-sm text-white/60">{metric.description}</p>
              </article>
            ))}
          </section>

          {loading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-live="polite">
              {METRIC_META.map((metric) => (
                <div key={metric.key} className="rounded-2xl bg-white/5 p-6 opacity-60">
                  <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
                  <div className="mt-4 h-8 w-32 animate-pulse rounded bg-white/10" />
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
