'use client';

import React, { useEffect, useState } from 'react';

type ProviderStats = {
  name: string;
  v3Pools: number;
  poolsChange24h?: number;
  poolsChange7d?: number;
  poolsChange30d?: number;
  tvl: number;
  status: 'operational' | 'degraded' | 'offline';
};

type StatsData = {
  providers: ProviderStats[];
  totals: {
    v3Pools: number;
    totalTVL: number;
  };
  timestamp?: string;
};

export default function NetworkMetrics() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        console.log('[ProviderStatsOverview] Fetching stats...');
        const response = await fetch('/api/stats/providers');
        console.log('[ProviderStatsOverview] Response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[ProviderStatsOverview] Data received:', data);
          setStats(data);
        } else {
          console.error('[ProviderStatsOverview] Bad response:', response.status);
        }
      } catch (error) {
        console.error('[ProviderStatsOverview] Failed to fetch provider stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const formatTVL = (tvl: number) => {
    if (tvl >= 1_000_000) {
      return `$${(tvl / 1_000_000).toFixed(2)}M`;
    }
    if (tvl >= 1_000) {
      return `$${(tvl / 1_000).toFixed(1)}K`;
    }
    return `$${tvl.toFixed(0)}`;
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'operational':
        return 'bg-[#00C66B]';
      case 'degraded':
        return 'bg-[#FFA500]';
      case 'offline':
        return 'bg-[#E74C3C]';
      default:
        return 'bg-white/40';
    }
  };

  const formatChange = (change?: number) => {
    if (change === undefined || change === null) return '—';
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <section aria-label="Network metrics" className="w-full">
        <div className="rounded-3xl bg-[#0B1530]/[0.92] p-6 md:p-8 backdrop-blur-xl">
          <div className="flex flex-col items-center gap-3 text-center text-white">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-white/25 border-t-[#3B82F6]" />
            <p className="font-ui text-sm text-white/60">Loading network metrics…</p>
          </div>
        </div>
      </section>
    );
  }

  if (!stats) {
    return (
      <section aria-label="Network metrics" className="w-full">
        <div className="rounded-3xl bg-[#0B1530]/[0.92] p-6 md:p-8 backdrop-blur-xl">
          <p className="font-ui text-sm text-white/60">
            Network metrics temporarily unavailable — check console logs for details.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Network metrics" className="w-full">
      <div className="rounded-3xl bg-[#0B1530]/[0.92] p-6 md:p-8 backdrop-blur-xl text-white shadow-[0_32px_80px_rgba(9,20,45,0.45)]">
        <header className="space-y-2 text-center md:text-left">
          <h2 className="font-brand text-2xl font-semibold text-white md:text-3xl">
            Network metrics
          </h2>
          <p className="font-ui text-sm text-white/65">
            TVL and V3 pool counts across Enosys and SparkDEX (Flare network)
          </p>
          {stats.timestamp && (
            <p className="font-ui text-xs text-white/40">
              Updated {new Date(stats.timestamp).toLocaleString()}
            </p>
          )}
        </header>

        {/* Total Metrics - Prominent */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-gradient-to-br from-[#3B82F6]/10 to-transparent border border-white/5 p-6 space-y-2">
            <p className="font-ui text-xs uppercase tracking-[0.3em] text-white/50">
              Total V3 Pools
            </p>
            <p className="font-num text-4xl font-bold text-white tabular-nums">
              {stats.totals.v3Pools.toLocaleString()}
            </p>
            {/* TODO: Show 24h change when available */}
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-[#00D9A3]/10 to-transparent border border-white/5 p-6 space-y-2">
            <p className="font-ui text-xs uppercase tracking-[0.3em] text-white/50">
              Total TVL
            </p>
            <p className="font-num text-4xl font-bold text-white tabular-nums">
              {formatTVL(stats.totals.totalTVL)}
            </p>
            {/* TODO: Show 24h change when available */}
          </div>
        </div>

        {/* Provider Breakdown */}
        <div className="mt-8 space-y-6">
          <div className="divider" />
          <h3 className="font-ui text-xs uppercase tracking-[0.3em] text-white/50">
            Provider Breakdown
          </h3>
          {stats.providers.map((provider, index) => (
            <React.Fragment key={provider.name}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-start gap-4 md:items-center md:gap-6">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-3 w-3 rounded-full ${getStatusDot(provider.status)}`}
                        aria-hidden="true"
                      />
                      <span className="font-ui text-[10px] uppercase tracking-[0.3em] text-white/40">
                        {provider.status}
                      </span>
                    </div>
                    <p className="font-brand text-lg font-semibold text-white md:text-xl">
                      {provider.name}
                    </p>
                  </div>
                  <div className="min-w-[140px] text-right">
                    <p className="font-ui text-xs text-white/50">TVL</p>
                    <p className="font-num text-xl font-semibold text-white tabular-nums">
                      {formatTVL(provider.tvl)}
                    </p>
                  </div>
                  <div className="min-w-[120px] text-right">
                    <p className="font-ui text-xs text-white/50">V3 pools</p>
                    <p className="font-num text-xl font-semibold text-white tabular-nums">
                      {provider.v3Pools.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Growth metrics (when available) */}
                {(provider.poolsChange24h !== null || provider.poolsChange7d !== null || provider.poolsChange30d !== null) && (
                  <div className="flex flex-wrap items-center justify-end gap-4 pt-2">
                    <span className="font-ui text-[10px] uppercase tracking-[0.25em] text-white/30">Growth:</span>
                    <MetricChange label="24h" value={formatChange(provider.poolsChange24h)} />
                    <MetricChange label="7d" value={formatChange(provider.poolsChange7d)} />
                    <MetricChange label="30d" value={formatChange(provider.poolsChange30d)} />
                  </div>
                )}
              </div>
              {index < stats.providers.length - 1 && <div className="divider opacity-30" />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

type MetricChangeProps = {
  label: string;
  value: string;
};

function MetricChange({ label, value }: MetricChangeProps) {
  const positive = value.startsWith('+');
  const negative = value.startsWith('-');
  const color = positive ? 'text-[#00C66B]' : negative ? 'text-[#E74C3C]' : 'text-white/45';

  return (
    <div className="text-right">
      <p className="font-ui text-[10px] uppercase tracking-[0.25em] text-white/35">{label}</p>
      <p className={`font-num text-xs font-medium ${color}`}>{value}</p>
    </div>
  );
}
