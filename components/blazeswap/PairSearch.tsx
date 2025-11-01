'use client';

import * as React from 'react';

type PairSearchProps = {
  selectedPair?: string | null;
  onSelect: (address: string) => void;
};

type PairListPayload = {
  ok: true;
  factory: string;
  pairs: string[];
  totalPairs: number;
  nextStart: number | null;
};

export function PairSearch({ selectedPair, onSelect }: PairSearchProps) {
  const [_start, setStart] = React.useState(0);
  const [limit, setLimit] = React.useState(25);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [pairs, setPairs] = React.useState<string[]>([]);
  const [factory, setFactory] = React.useState<string | null>(null);
  const [nextStart, setNextStart] = React.useState<number | null>(null);
  const [manualAddress, setManualAddress] = React.useState('');

  const loadPairs = React.useCallback(
    async (startIndex: number, reset = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          start: String(startIndex),
          limit: String(limit),
        });
        const response = await fetch(`/api/blazeswap/pairs?${params.toString()}`);
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body?.error ?? 'Unable to load BlazeSwap pairs.');
        }
        const payload = (await response.json()) as PairListPayload;
        setFactory(payload.factory);
        setPairs((prev) => (reset ? payload.pairs : [...prev, ...payload.pairs]));
        setNextStart(payload.nextStart);
        setStart(startIndex);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unexpected error loading pairs.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  React.useEffect(() => {
    void loadPairs(0, true);
  }, [limit, loadPairs]);

  const handleManualSelect = () => {
    const value = manualAddress.trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      setError('Enter a valid pair address (0x…).');
      return;
    }
    setError(null);
    onSelect(value);
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <header className="space-y-1">
        <h2 className="font-brand text-lg font-semibold text-white">BlazeSwap pairs</h2>
        <p className="font-ui text-xs text-white/50">
          Browse pairs discovered on Flare. Use a manual address if you already know the LP.
        </p>
        {factory && (
          <p className="font-ui text-[11px] text-white/40">
            Factory: <span className="font-mono text-white/70">{factory}</span>
          </p>
        )}
      </header>

      <div className="flex flex-col gap-3">
        <label htmlFor="limit" className="font-ui text-xs uppercase text-white/50 tracking-[0.18em]">
          Page size
        </label>
        <input
          id="limit"
          type="number"
          min={5}
          max={100}
          value={limit}
          onChange={(event) => setLimit(Math.min(100, Math.max(5, Number(event.target.value) || 25)))}
          className="w-full rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="manual-address" className="font-ui text-xs uppercase text-white/50 tracking-[0.18em]">
          Manual pair address
        </label>
        <div className="flex gap-2">
          <input
            id="manual-address"
            value={manualAddress}
            onChange={(event) => setManualAddress(event.target.value)}
            placeholder="0x…"
            className="flex-1 rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-white focus:border-[#3B82F6] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
          />
          <button
            type="button"
            onClick={handleManualSelect}
            className="rounded-lg bg-[#3B82F6] px-4 py-2 text-sm font-semibold text-[#0A0F1C] transition hover:bg-[#60A5FA]"
          >
            Load
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-ui text-xs text-white/50">
          Showing {pairs.length} pairs{nextStart !== null ? ` (more available)` : ''}
        </span>
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadPairs(0, true)}
          className="text-xs font-semibold text-[#3B82F6] hover:text-white disabled:opacity-60"
        >
          Refresh list
        </button>
      </div>

  <div className="max-h-80 overflow-y-auto rounded-xl border border-white/10 bg-black/20">
        <ul className="divide-y divide-white/5">
          {pairs.map((pair) => {
            const isSelected =
              selectedPair && selectedPair.toLowerCase() === pair.toLowerCase();
            return (
              <li key={pair}>
                <button
                  type="button"
                  onClick={() => onSelect(pair)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-left transition ${
                    isSelected ? 'bg-[#3B82F6]/20 text-white' : 'text-white/70 hover:bg-white/5'
                  }`}
                >
                  <span className="font-mono text-[13px]">{pair}</span>
                  {isSelected && (
                    <span className="text-xs uppercase tracking-wide text-[#3B82F6]">
                      Selected
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {pairs.length === 0 && !loading && (
            <li className="px-4 py-6 text-center font-ui text-sm text-white/50">
              No pairs loaded yet. Try refreshing.
            </li>
          )}
        </ul>
      </div>

      {nextStart !== null && (
        <button
          type="button"
          disabled={loading}
          onClick={() => void loadPairs(nextStart)}
          className="w-full rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:border-white hover:bg-white/10 disabled:opacity-60"
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}

      {error && (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          {error}
        </p>
      )}
    </div>
  );
}
