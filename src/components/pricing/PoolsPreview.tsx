import Link from 'next/link';

import type { PositionRow } from '@/lib/positions/types';
import { fmtUsd } from '@/lib/format';

type PoolsPreviewProps = {
  address: string;
  loading: boolean;
  error?: string | null;
  summary?: {
    active?: number;
    inactive?: number;
    ended?: number;
  };
  positions: PositionRow[];
  showAll?: boolean;
};

function formatPair(position: PositionRow) {
  const token0 =
    position.token0?.symbol ||
    position.token0?.name ||
    position.token0?.address ||
    'Token0';
  const token1 =
    position.token1?.symbol ||
    position.token1?.name ||
    position.token1?.address ||
    'Token1';
  return `${token0}/${token1}`;
}

function InRangeBadge({ inRange }: { inRange: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-ui text-xs font-medium ${
        inRange
          ? 'bg-[#1BE8D2]/12 text-[#1BE8D2]'
          : 'bg-red-500/15 text-red-200'
      }`}
    >
      {inRange ? 'In range' : 'Out of range'}
    </span>
  );
}

export default function PoolsPreview({
  address,
  loading,
  error,
  summary,
  positions,
  showAll = false,
}: PoolsPreviewProps) {
  const active = summary?.active ?? 0;
  const inactive = summary?.inactive ?? 0;
  const ended = summary?.ended ?? 0;

  const rows = positions
    .slice()
    .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))
    .slice(0, showAll ? positions.length : 3);

  return (
    <section className="rounded-3xl border border-white/10 bg-[#0B1530] p-6 shadow-[0_0_45px_rgba(11,21,48,0.65)] backdrop-blur md:p-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-brand text-2xl font-semibold text-white">Your pools</h2>
          <p className="font-ui text-sm text-white/70">
            Active:{' '}
            <span className="font-mono tabular-nums text-white/90">{active}</span> · Inactive:{' '}
            <span className="font-mono tabular-nums text-white/90">{inactive}</span> · Ended:{' '}
            <span className="font-mono tabular-nums text-white/90">{ended}</span>
          </p>
        </div>
        <Link
          href={`/sales/offer?address=${address}`}
          className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-[#0B1530] px-4 py-2 font-ui text-xs font-semibold text-white transition hover:bg-[#13274f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530]"
        >
          View all pools
        </Link>
      </header>

      <div className="mt-5 space-y-3">
        {loading && (
          <div className="rounded-2xl border border-white/10 bg-[#0B1530] p-4 font-ui text-sm text-white/70">
            Scanning your wallet…
          </div>
        )}
        {!loading && error && (
          <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4 font-ui text-sm text-red-200">
            {error}
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#0B1530] p-4 font-ui text-sm text-white/80">
            <p>
              We couldn’t find pools for this wallet yet. Create a pool at a partner DEX and it will appear automatically.
            </p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
              <a
                href="https://v3.dex.enosys.global/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm font-semibold text-white transition hover:text-white/80"
              >
                Ēnosys →
              </a>
              <a
                href="https://sparkdex.ai"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-sm font-semibold text-white transition hover:text-white/80"
              >
                SparkDEX →
              </a>
            </div>
          </div>
        )}
        {!loading &&
          !error &&
          rows.map((position) => {
            const pair = formatPair(position);
            return (
              <div
                key={`${position.provider}-${position.marketId ?? position.displayId ?? pair}`}
                className="rounded-2xl border border-white/10 bg-[#0B1530] px-4 py-3 transition hover:bg-[#13274f] md:py-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-brand text-lg text-white">{pair}</p>
                    <p className="font-ui text-xs uppercase tracking-[0.18em] text-white/40">
                      {position.provider?.toUpperCase() ?? 'V3 POOL'}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <InRangeBadge inRange={Boolean(position.isInRange)} />
                    <div className="text-right font-ui text-xs text-white/60">
                      <span className="block text-white/40">TVL</span>
                      <span className="font-mono tabular-nums text-sm text-white/90">
                        {fmtUsd(position.tvlUsd ?? 0)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
}
