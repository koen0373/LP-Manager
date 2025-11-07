import { useEffect, useMemo, useState } from 'react';

import Head from 'next/head';

type CostRecord = {
  ts: string;
  dayCostUsd: number;
  monthCostUsd: number;
  totalCalls: number;
  lastUpdated: string;
};

type ApiResponse = {
  ok: boolean;
  data?: CostRecord;
  history?: CostRecord[];
  apiKeyTail?: string;
  reason?: string;
  stale?: boolean;
};

export default function AnkrDashboard() {
  const [record, setRecord] = useState<CostRecord | null>(null);
  const [history, setHistory] = useState<CostRecord[]>([]);
  const [apiKeyTail, setApiKeyTail] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);

  const fetchData = async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ankr${force ? '?refresh=1' : ''}`);
      const json = (await res.json()) as ApiResponse;
      if (!json.ok || !json.data) {
        throw new Error(json.reason || 'Unable to load ANKR usage');
      }
      setRecord(json.data);
      setHistory(json.history ?? []);
      setApiKeyTail(json.apiKeyTail ?? '');
      setStale(Boolean(json.stale));
    } catch (err) {
      setError((err as Error).message);
      setRecord(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formattedHistory = useMemo(() => {
    const source = history.length ? history : record ? [record] : [];
    return [...source].reverse();
  }, [history, record]);

  const chartPath = useMemo(() => {
    if (!formattedHistory.length) return '';
    const maxVal = Math.max(...formattedHistory.map((entry) => entry.dayCostUsd), 1);
    const width = 480;
    const height = 140;
    return formattedHistory
      .map((entry, idx) => {
        const x = formattedHistory.length === 1 ? width : (idx / (formattedHistory.length - 1)) * width;
        const y = height - (entry.dayCostUsd / maxVal) * height;
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [formattedHistory]);

  const lastUpdated = record?.lastUpdated ? new Date(record.lastUpdated).toUTCString() : '—';

  return (
    <>
      <Head>
        <title>ANKR Usage — LiquiLab</title>
      </Head>
      <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <header className="space-y-2">
            <p className="text-sm uppercase tracking-wide text-emerald-300/80">Monitoring</p>
            <h1 className="text-3xl font-semibold text-sky-300">ANKR API Usage & Cost</h1>
            <p className="text-sm text-slate-400">
              Cached every 24h via `/api/admin/ankr`. Force refresh pulls billing data immediately. Values use tabular
              numerals for easier scanning.
            </p>
          </header>

          <section
            className="rounded-xl border border-slate-800 p-6 shadow-2xl"
            style={{ backgroundColor: '#0B1530' }}
          >
            <div
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              <Metric label="API Key" value={apiKeyTail ? `••••${apiKeyTail}` : 'Unavailable'} accent />
              <Metric label="Daily cost (USD)" value={record ? record.dayCostUsd.toFixed(2) : '—'} />
              <Metric label="Monthly cost (USD)" value={record ? record.monthCostUsd.toFixed(2) : '—'} />
              <Metric label="Total calls" value={record ? record.totalCalls.toLocaleString() : '—'} />
              <Metric label="Last updated (UTC)" value={lastUpdated} />
              <Metric label="Data freshness" value={stale ? 'STALE (cached)' : 'Fresh'} />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                className="rounded-md bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-900 shadow hover:bg-sky-300"
                disabled={loading}
                onClick={() => fetchData(true)}
              >
                Force Refresh
              </button>
              <button
                className="rounded-md border border-slate-500 px-4 py-2 text-sm text-slate-200 hover:border-slate-300"
                disabled={loading}
                onClick={() => fetchData(false)}
              >
                Reload
              </button>
              {loading && <span className="text-xs text-slate-400">Loading…</span>}
              {error && <span className="text-xs text-rose-300">{error}</span>}
            </div>
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-sky-300">Daily cost trend</h2>
            {formattedHistory.length > 1 && chartPath ? (
              <svg viewBox="0 0 500 160" className="mt-4 w-full" role="img" aria-label="Day cost trend">
                <defs>
                  <linearGradient id="costGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00D1FF" />
                    <stop offset="100%" stopColor="#38BDF8" />
                  </linearGradient>
                </defs>
                <path d={chartPath} fill="none" stroke="url(#costGradient)" strokeWidth="4" strokeLinecap="round" />
              </svg>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                Not enough historical points yet. Once the daily cron hits this endpoint, the chart will populate.
              </p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold ${accent ? 'text-sky-300' : 'text-emerald-200'}`}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </p>
    </div>
  );
}
