'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type PositionRow = {
  token_id: string;
  owner_address: string | null;
  pool_address: string | null;
  first_block: number | null;
  last_block: number | null;
};

type ApiResponse = {
  items: PositionRow[];
  page: number;
  per: number;
  total: number;
};

const formatAddress = (value?: string | null) => {
  if (!value) return '—';
  const normalized = value.toLowerCase();
  return `${normalized.slice(0, 6)}…${normalized.slice(-4)}`;
};

const formatBlock = (value?: number | null) => (value ?? value === 0 ? value.toLocaleString() : '—');

export default function PortfolioPage() {
  const [filters, setFilters] = useState({ owner: '', pool: '', search: '' });
  const [formState, setFormState] = useState(filters);
  const [page, setPage] = useState(1);
  const [per, setPer] = useState(50);
  const [data, setData] = useState<PositionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ page: String(page), per: String(per) });
    if (filters.owner) params.set('owner', filters.owner);
    if (filters.pool) params.set('pool', filters.pool);
    if (filters.search) params.set('search', filters.search);

    fetch(`/api/analytics/positions?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const message = await res.text();
          throw new Error(message || 'Request failed');
        }
        const json = (await res.json()) as ApiResponse;
        const headerCount = Number(res.headers.get('X-Total-Count') ?? '0');
        const resolvedTotal = Number.isFinite(json.total) ? json.total : headerCount;
        setData(json.items);
        setTotal(resolvedTotal);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Failed to load positions');
        setData([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [filters, page, per]);

  const totalPages = useMemo(() => (total > 0 ? Math.ceil(total / per) : 1), [total, per]);

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters({
      owner: formState.owner.trim(),
      pool: formState.pool.trim(),
      search: formState.search.trim(),
    });
    setPage(1);
  };

  const resetFilters = () => {
    setFormState({ owner: '', pool: '', search: '' });
    setFilters({ owner: '', pool: '', search: '' });
    setPage(1);
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <header className="space-y-2">
        <p className="text-sm uppercase tracking-wide text-slate-500">Portfolio & Core Actions</p>
        <h1 className="text-3xl font-semibold text-slate-50">Indexed Positions</h1>
        <p className="text-sm text-slate-400">
          Live read from LiquiLab indexer. Filter by owner, pool or position (tokenId) to demo the portfolio view.
        </p>
      </header>

      <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-4 shadow-xl shadow-black/30">
        <form className="grid gap-4 md:grid-cols-4" onSubmit={applyFilters}>
          <label className="flex flex-col text-sm text-slate-300">
            Owner address
            <input
              className="mt-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-400 focus:outline-none"
              placeholder="0x..."
              value={formState.owner}
              onChange={(e) => setFormState((prev) => ({ ...prev, owner: e.target.value }))}
            />
          </label>
          <label className="flex flex-col text-sm text-slate-300">
            Pool address
            <input
              className="mt-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-400 focus:outline-none"
              placeholder="0x..."
              value={formState.pool}
              onChange={(e) => setFormState((prev) => ({ ...prev, pool: e.target.value }))}
            />
          </label>
          <label className="flex flex-col text-sm text-slate-300">
            TokenId search
            <input
              className="mt-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-400 focus:outline-none"
              placeholder="e.g. 22003"
              value={formState.search}
              onChange={(e) => setFormState((prev) => ({ ...prev, search: e.target.value }))}
            />
          </label>
          <label className="flex flex-col text-sm text-slate-300">
            Rows per page
            <select
              className="mt-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 focus:border-emerald-400 focus:outline-none"
              value={per}
              onChange={(e) => {
                setPer(Number(e.target.value));
                setPage(1);
              }}
            >
              {[10, 25, 50, 100, 200].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-4 flex flex-wrap gap-3">
            <button
              type="submit"
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border border-slate-600 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-400"
            >
              Reset
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
        {loading ? (
          <div className="py-10 text-center text-sm text-slate-400">Loading positions…</div>
        ) : error ? (
          <div className="space-y-3 py-10 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <button
              className="rounded-md border border-red-400 px-3 py-1 text-xs text-red-200"
              onClick={() => {
                setError(null);
                setFilters((prev) => ({ ...prev }));
              }}
            >
              Retry
            </button>
          </div>
        ) : data.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">No positions match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-sm text-slate-200">
              <thead className="bg-slate-900/60">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">TokenId</th>
                  <th className="px-3 py-2 text-left font-semibold">Owner</th>
                  <th className="px-3 py-2 text-left font-semibold">Pool</th>
                  <th className="px-3 py-2 text-left font-semibold">First block</th>
                  <th className="px-3 py-2 text-left font-semibold">Last block</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {data.map((row) => (
                  <tr key={row.token_id}>
                    <td className="px-3 py-2 font-mono text-emerald-200">{row.token_id}</td>
                    <td className="px-3 py-2 font-mono">{formatAddress(row.owner_address)}</td>
                    <td className="px-3 py-2 font-mono">{formatAddress(row.pool_address)}</td>
                    <td className="px-3 py-2">{formatBlock(row.first_block)}</td>
                    <td className="px-3 py-2">{formatBlock(row.last_block)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-200 md:flex-row md:items-center md:justify-between">
        <div>
          Page {page} of {totalPages} • {total.toLocaleString()} positions total
        </div>
        <div className="flex gap-3">
          <button
            className="rounded-md border border-slate-600 px-3 py-1 disabled:opacity-40"
            disabled={page <= 1 || loading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            Previous
          </button>
          <button
            className="rounded-md border border-slate-600 px-3 py-1 disabled:opacity-40"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Next
          </button>
        </div>
      </section>
    </main>
  );
}
