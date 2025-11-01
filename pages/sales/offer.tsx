import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

type Summary = {
  tvlUsd: number;
  fees24hUsd: number;
  incentivesUsd: number;
  rewardsUsd: number;
  count: number;
  active: number;
  inactive: number;
  ended: number;
};
type ApiOk = { success: true; data: { summary: Summary } };
type ApiErr = { success: false; error?: string };
type ApiResp = ApiOk | ApiErr;

function currency(n: number | undefined) {
  const v = typeof n === 'number' ? n : 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(v);
}

export default function SalesOfferPage() {
  const router = useRouter();
  const address = useMemo(() => {
    const a = String(router.query.address || '').trim();
    return a && a.startsWith('0x') && a.length === 42 ? a : '';
  }, [router.query.address]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let abort = false;
    async function run() {
      if (!address) return;
      setLoading(true);
      setError(null);
      try {
        const u = new URL('/api/positions', window.location.origin);
        u.searchParams.set('address', address);
        const res = await fetch(u.toString(), { method: 'GET' });
        const json = (await res.json()) as ApiResp;
        if (abort) return;
        if ('success' in json && json.success) {
          setSummary(json.data.summary);
        } else {
          setError((json as ApiErr).error || 'Unable to load positions');
        }
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : 'Network error';
        if (!abort) setError(errMsg);
      } finally {
        if (!abort) setLoading(false);
      }
    }
    void run();
    return () => {
      abort = true;
    };
  }, [address]);

  const hasPools = !!summary && summary.active + summary.inactive > 0;

  return (
    <main className="min-h-screen bg-liqui-bg">
      <div className="mx-auto max-w-[1100px] px-6 py-16">
        <header className="mb-8">
          <h1 className="font-brand text-3xl font-semibold text-white">Your Liquidity Journey</h1>
          <p className="mt-2 font-ui text-sm text-white/70">
            Connect your wallet → see what you can follow → subscribe when ready.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
          {!address && (
            <div className="text-center">
              <h2 className="font-brand text-2xl text-white">No address provided</h2>
              <p className="mt-2 font-ui text-sm text-white/70">
                Please connect your wallet from the homepage to continue.
              </p>
            </div>
          )}

          {address && loading && (
            <div className="text-center">
              <p className="font-ui text-sm text-white/80">
                Scanning your pools for <span className="font-mono tabular-nums">{address}</span>…
              </p>
            </div>
          )}

          {address && !loading && error && (
            <div className="text-center">
              <h2 className="font-brand text-xl text-white">We couldn&apos;t fetch your pools</h2>
              <p className="mt-2 font-ui text-sm text-white/70">{error}</p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => router.reload()}
                  className="rounded-2xl border border-white/20 bg-white/10 px-4 py-2 font-ui text-sm text-white hover:bg-white/15"
                >
                  Try again
                </button>
                <Link
                  href="/pricing"
                  className="rounded-2xl bg-[#3B82F6] px-4 py-2 font-ui text-sm font-semibold text-white hover:bg-[#2563EB]"
                >
                  Continue to Pricing
                </Link>
              </div>
            </div>
          )}

          {address && !loading && !error && summary && (
            <>
              {hasPools ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                    <h3 className="font-brand text-lg text-white">Summary for your wallet</h3>
                    <p className="mt-1 font-ui text-sm text-white/60">
                      Active: <span className="font-mono tabular-nums text-white/90">{summary.active}</span>
                      {' '}· Inactive:{' '}
                      <span className="font-mono tabular-nums text-white/90">{summary.inactive}</span>
                      {' '}· Ended:{' '}
                      <span className="font-mono tabular-nums text-white/90">{summary.ended}</span>
                    </p>
                    <p className="mt-1 font-ui text-sm text-white/60">
                      TVL:{' '}
                      <span className="font-mono tabular-nums text-white/90">{currency(summary.tvlUsd)}</span>
                    </p>
                    <div className="mt-4">
                      <a
                        href={`/pricing?address=${address}`}
                        className="inline-flex items-center justify-center rounded-2xl bg-[#3B82F6] px-5 py-2.5 font-ui text-sm font-semibold text-white hover:bg-[#2563EB]"
                      >
                        Continue to Pricing
                      </a>
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/0 p-5">
                    <p className="font-ui text-sm text-white/70">
                      LiquiLab brings all your Flare LPs together — with live RangeBand™ insights, fees
                      and incentives. Your pools will appear in your dashboard right after subscribing.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <h2 className="font-brand text-2xl text-white">
                    No pools found for this wallet (yet)
                  </h2>
                  <p className="mt-2 font-ui text-sm text-white/70">
                    LiquiLab works with your liquidity pools on Flare. Create a pool at a partner DEX
                    and it will appear here automatically.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <a
                      className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 font-ui text-sm text-white hover:bg-white/15"
                      href="/contact?dex=enosys"
                      aria-label="Learn about Enosys pools"
                    >
                      Enosys
                    </a>
                    <a
                      className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 font-ui text-sm text-white hover:bg-white/15"
                      href="/contact?dex=sparkdex"
                      aria-label="Learn about SparkDEX pools"
                    >
                      SparkDEX
                    </a>
                    <a
                      className="rounded-lg border border-white/15 bg-white/10 px-4 py-3 font-ui text-sm text-white hover:bg-white/15"
                      href="/contact?dex=blazeswap"
                      aria-label="Learn about BlazeSwap pools"
                    >
                      BlazeSwap
                    </a>
                  </div>
                  <div className="mt-6">
                    <Link
                      href="/pricing"
                      className="inline-flex items-center justify-center rounded-2xl bg-[#3B82F6] px-5 py-2.5 font-ui text-sm font-semibold text-white hover:bg-[#2563EB]"
                    >
                      Continue anyway
                    </Link>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
