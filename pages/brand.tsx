'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import Header from '@/components/Header';
import PoolsTable, { type PoolsTableItem } from '@/components/pools/PoolsTable';
import PremiumCard from '@/components/pricing/PremiumCard';

const THEME_OPTIONS = [
  { value: 'v2-dark', label: 'Fresh Oceanic' },
  { value: 'v2-blond', label: 'Light Wave' },
] as const;

type ThemeValue = (typeof THEME_OPTIONS)[number]['value'];

const ACCENT_OPTIONS = [
  { value: 'default', label: 'Electric Blue' },
  { value: 'wavecyan', label: 'Wave Cyan' },
] as const;

const THEME_TOKENS: Record<
  ThemeValue,
  {
    label: string;
    cssVars: Record<string, string>;
    surfaces: Array<{ name: string; var: string; description: string }>;
    interactions: Array<{ name: string; var: string; description: string }>;
  }
> = {
  'v2-dark': {
    label: 'Fresh Oceanic',
    cssVars: {
      '--brand-surface': 'rgba(11, 21, 48, 0.92)',
      '--brand-surface-quiet': 'rgba(11, 21, 48, 0.82)',
      '--brand-border': 'rgba(255,255,255,0.10)',
      '--brand-text': '#F8FAFF',
      '--brand-subtext': 'rgba(255,255,255,0.65)',
      '--brand-divider': 'rgba(255,255,255,0.06)',
      '--brand-background': '#05070C',
    },
    surfaces: [
      { name: 'Card / Surface', var: 'var(--brand-surface)', description: 'Primary glass surface' },
      { name: 'Card Quiet', var: 'var(--brand-surface-quiet)', description: 'Nested content blocks' },
      { name: 'Divider', var: 'var(--brand-divider)', description: '1px separators' },
    ],
    interactions: [
      { name: 'Primary', var: 'var(--cta-base)', description: 'Electric Blue button' },
      { name: 'Primary Hover', var: 'var(--cta-hover)', description: 'Hover state' },
      { name: 'Accent', var: 'var(--accent)', description: 'Accent-only pills / icons' },
    ],
  },
  'v2-blond': {
    label: 'Light Wave',
    cssVars: {
      '--brand-surface': 'rgba(255,255,255,0.82)',
      '--brand-surface-quiet': 'rgba(255,255,255,0.72)',
      '--brand-border': 'rgba(15,19,36,0.12)',
      '--brand-text': '#0B1530',
      '--brand-subtext': 'rgba(11,21,48,0.64)',
      '--brand-divider': 'rgba(11,21,48,0.12)',
      '--brand-background': '#F3F8FF',
    },
    surfaces: [
      { name: 'Card / Surface', var: 'var(--brand-surface)', description: 'Bright glass surface' },
      { name: 'Card Quiet', var: 'var(--brand-surface-quiet)', description: 'Nested content blocks' },
      { name: 'Divider', var: 'var(--brand-divider)', description: '1px separators' },
    ],
    interactions: [
      { name: 'Primary', var: 'var(--cta-base)', description: 'Electric Blue button' },
      { name: 'Primary Hover', var: 'var(--cta-hover)', description: 'Hover state' },
      { name: 'Accent', var: 'var(--accent)', description: 'Accent-only pills / icons' },
    ],
  },
};

type BrandSnapshotEntry = {
  dex: string;
  pair: {
    symbol0: string;
    symbol1: string;
    fee_bps: number;
  };
  token0: {
    symbol: string;
    address: string | null;
    decimals: number | null;
  };
  token1: {
    symbol: string;
    address: string | null;
    decimals: number | null;
  };
  poolAddress: string | null;
  flarescan_url: string | null;
  tvlUsd: number | null;
  fees24hUsd: number | null;
  incentivesUsd: number | null;
  status: 'in' | 'near' | 'out' | 'ended';
  priority: string;
  updatedAt: string;
  sourceLabel: string;
};

type BrandUserPosition = {
  dex: 'enosys' | 'sparkdex';
  wallet: string;
  positionId: string;
  poolAddress: string;
  pair: { symbol0: string; symbol1: string; fee_bps: number };
  amount0: number | null;
  amount1: number | null;
  amountUsd: number | null;
  unclaimedUsd: number | null;
  status: 'in' | 'near' | 'out' | 'unknown';
  updatedAt: string;
};

const CLI_SCANS = [
  'pnpm lint:style -- --rule no-pale-glass',
  'pnpm lint:style -- --rule btn-primary-electric-blue',
  'pnpm lint:style -- --rule font-num-numerics',
];

const DESIGN_LINKS = [
  { label: 'Brand Style Contract', href: '/docs/design/BRAND_STYLE_CONTRACT.md' },
  { label: 'Pricing Layout Options', href: '/docs/design/PRICING_LAYOUT_OPTIONS.md' },
  { label: 'Pools Table Spec', href: '/docs/design/POOLS_TABLE_SPEC.md' },
];

export default function BrandSystemPage() {
  const router = useRouter();
  const [theme, setTheme] = useState<ThemeValue>('v2-dark');
  const [accent, setAccent] = useState<'default' | 'wavecyan'>('default');
  const [poolSnapshot, setPoolSnapshot] = useState<BrandSnapshotEntry[] | null>(null);
  const [poolLoading, setPoolLoading] = useState<boolean>(false);
  const [poolError, setPoolError] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState<number>(0);
  const [userPositions, setUserPositions] = useState<BrandUserPosition[] | null>(null);
  const [userPositionsLoading, setUserPositionsLoading] = useState<boolean>(false);
  const [userPositionsError, setUserPositionsError] = useState<string | null>(null);
  const [userPositionsRefreshTick, setUserPositionsRefreshTick] = useState<number>(0);

  useEffect(() => {
    if (!router.isReady) return;
    const queryTheme = router.query.theme;
    if (typeof queryTheme === 'string' && (queryTheme === 'v2-dark' || queryTheme === 'v2-blond')) {
      setTheme(queryTheme);
    }
  }, [router.isReady, router.query.theme]);

  useEffect(() => {
    const current = THEME_TOKENS[theme];
    document.documentElement.dataset.theme = theme;
    Object.entries(current.cssVars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
    return () => {
      if (theme === 'v2-blond') {
        // revert to default dark vars when leaving the page
        const reset = THEME_TOKENS['v2-dark'].cssVars;
        Object.entries(reset).forEach(([key, value]) => {
          document.documentElement.style.setProperty(key, value);
        });
        document.documentElement.dataset.theme = 'v2-dark';
      }
    };
  }, [theme]);

  useEffect(() => {
    if (accent === 'wavecyan') {
      document.documentElement.dataset.accent = 'wavecyan';
    } else {
      document.documentElement.removeAttribute('data-accent');
    }
    return () => {
      document.documentElement.removeAttribute('data-accent');
    };
  }, [accent]);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async () => {
      setPoolLoading(true);
      setPoolError(null);
      try {
        const response = await fetch(`/brand.pools.json?ts=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`Snapshot fetch failed (${response.status})`);
        }
        const data = (await response.json()) as BrandSnapshotEntry[];
        if (!cancelled) {
          setPoolSnapshot(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (!cancelled) {
          setPoolSnapshot(null);
          setPoolError(error instanceof Error ? error.message : 'Failed to load snapshot');
        }
      } finally {
        if (!cancelled) {
          setPoolLoading(false);
        }
      }
    };

    loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [refreshTick]);

  useEffect(() => {
    let cancelled = false;

    const loadUserPositions = async () => {
      setUserPositionsLoading(true);
      setUserPositionsError(null);
      try {
        const response = await fetch(`/brand.userPositions.json?ts=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error(`Snapshot fetch failed (${response.status})`);
        }
        const data = (await response.json()) as BrandUserPosition[];
        if (!cancelled) {
          setUserPositions(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (!cancelled) {
          setUserPositions(null);
          setUserPositionsError(error instanceof Error ? error.message : 'Failed to load positions');
        }
      } finally {
        if (!cancelled) {
          setUserPositionsLoading(false);
        }
      }
    };

    loadUserPositions();

    return () => {
      cancelled = true;
    };
  }, [userPositionsRefreshTick]);

  const handleThemeChange = (value: ThemeValue) => {
    setTheme(value);
    const nextQuery = { ...router.query, theme: value };
    router.replace({ pathname: router.pathname, query: nextQuery }, undefined, { shallow: true });
  };

  const handleAccentChange = (value: 'default' | 'wavecyan') => {
    setAccent(value);
  };

  const themeTokens = useMemo(() => THEME_TOKENS[theme], [theme]);
  const refreshSnapshot = useCallback(() => setRefreshTick((tick) => tick + 1), []);
  const refreshUserPositions = useCallback(
    () => setUserPositionsRefreshTick((tick) => tick + 1),
    [],
  );

  const poolsTableItems = useMemo<PoolsTableItem[]>(() => {
    if (!poolSnapshot) return [];
    return poolSnapshot.map((entry) => {
      const provider =
        entry.dex === 'enosys'
          ? 'enosys-v3'
          : entry.dex === 'sparkdex'
            ? 'sparkdex-v3'
            : entry.dex;

      const tvl = typeof entry.tvlUsd === 'number' ? entry.tvlUsd : Number.NaN;
      const fees = typeof entry.fees24hUsd === 'number' ? entry.fees24hUsd : Number.NaN;
      const incentives = typeof entry.incentivesUsd === 'number' ? entry.incentivesUsd : null;

      return {
        provider,
        token0: {
          symbol: entry.pair.symbol0,
          address: entry.token0.address ?? '',
          decimals: entry.token0.decimals ?? undefined,
        },
        token1: {
          symbol: entry.pair.symbol1,
          address: entry.token1.address ?? '',
          decimals: entry.token1.decimals ?? undefined,
        },
        tvlUsd: Number.isFinite(tvl) ? tvl : Number.NaN,
        unclaimedFeesUsd: Number.isFinite(fees) ? fees : Number.NaN,
        incentivesUsd: incentives ?? null,
        incentivesToken: null,
        incentivesTokenAmount: null,
        apr24h: Number.NaN,
        isInRange: entry.status === 'in' || entry.status === 'near',
        status: entry.status,
        range: null,
        tokenId: null,
        poolAddress: entry.poolAddress ?? undefined,
        marketId: entry.poolAddress ?? undefined,
        poolFeeBps: entry.pair.fee_bps,
        amount0: Number.NaN,
        amount1: Number.NaN,
        fee0: Number.NaN,
        fee1: Number.NaN,
        liquidityShare: null,
      };
    });
  }, [poolSnapshot]);

  const sourceLabel = poolSnapshot?.[0]?.sourceLabel ?? 'on-chain snapshot';

  const snapshotUpdatedLabel = useMemo(() => {
    if (!poolSnapshot || poolSnapshot.length === 0) return '—';
    const latest = poolSnapshot.reduce<number | null>((acc, entry) => {
      const parsed = Date.parse(entry.updatedAt);
      if (Number.isNaN(parsed)) return acc;
      if (acc === null || parsed > acc) return parsed;
      return acc;
    }, null);
    if (!latest) return '—';
    return `${new Date(latest).toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })} UTC`;
  }, [poolSnapshot]);

  const userPositionsSorted = useMemo(() => {
    if (!userPositions) return [] as BrandUserPosition[];
    return [...userPositions].sort((a, b) => {
      const aUsd = a.amountUsd ?? 0;
      const bUsd = b.amountUsd ?? 0;
      return bUsd - aUsd;
    });
  }, [userPositions]);

  const userPositionsUpdatedLabel = useMemo(() => {
    if (!userPositions || userPositions.length === 0) return '—';
    const latest = userPositions.reduce<number | null>((acc, entry) => {
      const parsed = Date.parse(entry.updatedAt);
      if (Number.isNaN(parsed)) return acc;
      if (acc === null || parsed > acc) return parsed;
      return acc;
    }, null);
    if (!latest) return '—';
    return `${new Date(latest).toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })} UTC`;
  }, [userPositions]);

  const statusColorMap: Record<BrandUserPosition['status'], string> = {
    in: 'bg-emerald-400/80',
    near: 'bg-amber-400/80',
    out: 'bg-rose-500/80',
    unknown: 'bg-slate-500/70',
  };

  const formatAmount = (value: number | null): string => {
    if (value === null || !Number.isFinite(value)) return '—';
    if (Math.abs(value) >= 1) {
      return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
    }
    return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  };

  const formatUsdValue = (value: number | null): string => {
    if (value === null || !Number.isFinite(value)) return '—';
    return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  };

  const formatFeePct = (feeBps: number): string => {
    return `${(feeBps / 100).toFixed(feeBps % 100 === 0 ? 1 : 2)}%`;
  };

  const shortAddress = (value: string): string => {
    if (!value || value.length < 10) return value;
    return `${value.slice(0, 6)}…${value.slice(-4)}`;
  };

  return (
    <>
      <Head>
        <title>LiquiLab Brand & Design System</title>
        <meta
          name="description"
          content="LiquiLab’s living design system. Everything you see here is the source of truth for UI and docs."
        />
      </Head>
      <div className="relative min-h-screen text-white">
        <div className="page-bg" aria-hidden="true" />
        <Header currentPage="brand" showTabs={false} />

        <main className="brand-root relative z-10 mx-auto w-full max-w-6xl space-y-10 px-6 py-20 sm:px-8 md:py-24">
          <section className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="space-y-3">
              <p className="font-ui text-xs uppercase tracking-[0.3em] text-white/55">
                LiquiLab design system
              </p>
              <h1 className="font-brand text-4xl font-semibold text-white md:text-5xl">
                Calm by default. Bright when needed.
              </h1>
              <p className="max-w-xl font-ui text-sm text-white/70">
                This page is LiquiLab&apos;s living design system. Everything you see here is the source of truth for UI,
                docs, and how we review future product changes.
              </p>
            </div>
            <div className="card--quiet self-start space-y-4">
              <div>
                <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/55">
                  Theme
                </p>
                <div className="segmented mt-2" role="group" aria-label="Toggle design system theme">
                  {THEME_OPTIONS.map((option) => {
                    const selected = option.value === theme;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={selected ? 'btn-primary' : 'segmented-btn--off'}
                        aria-pressed={selected}
                        onClick={() => handleThemeChange(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/55">
                  Hover & Accent
                </p>
                <div className="segmented mt-2" role="group" aria-label="Toggle hover and accent palette">
                  {ACCENT_OPTIONS.map((option) => {
                    const selected = option.value === accent;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={selected ? 'btn-primary' : 'segmented-btn--off'}
                        aria-pressed={selected}
                        onClick={() => handleAccentChange(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className="card space-y-6">
            <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-brand text-xl font-semibold text-white">Your liquidity (demo)</h2>
                <p className="mt-1 max-w-xl font-ui text-sm text-white/65">
                  Voorbeelddata: LP-posities op Ēnosys &amp; SparkDEX. Live on-chain snapshot voor een demo-wallet.
                </p>
              </div>
              <button
                type="button"
                onClick={refreshUserPositions}
                className="self-start rounded-lg border border-white/12 bg-white/[0.03] px-3 py-1.5 font-ui text-xs uppercase tracking-[0.25em] text-white/60 transition hover:border-white/20 hover:text-white"
              >
                Refresh snapshot
              </button>
            </header>

            {userPositionsLoading ? (
              <div className="flex justify-center py-10">
                <div className="h-8 w-8 animate-spin rounded-full border-3 border-white/15 border-t-[#3B82F6]" aria-hidden="true" />
              </div>
            ) : userPositionsError ? (
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {userPositionsError}
              </div>
            ) : userPositionsSorted.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-6 text-center font-ui text-sm text-white/65">
                Nog geen posities zichtbaar. Voeg liquiditeit toe op een partner DEX en ververs de snapshot.
              </div>
            ) : (
              <div className="divide-y divide-white/10 border-t border-white/10">
                {userPositionsSorted.map((position) => (
                  <div
                    key={`${position.wallet}-${position.positionId}`}
                    className="flex flex-col gap-5 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-white/60" aria-hidden="true" />
                        <p className="font-brand text-sm font-semibold text-white">
                          {position.pair.symbol0} / {position.pair.symbol1}{' '}
                          <span className="font-ui text-xs uppercase tracking-[0.18em] text-white/40">
                            • {formatFeePct(position.pair.fee_bps)}
                          </span>
                        </p>
                      </div>
                      <p className="font-ui text-xs text-white/50">
                        {position.dex === 'enosys' ? 'Ēnosys' : 'SparkDEX'} · {shortAddress(position.wallet)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-6 text-sm text-white/70">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Amount</p>
                        <p className="font-ui font-semibold text-white font-num">
                          {position.pair.symbol0} {formatAmount(position.amount0)} · {position.pair.symbol1} {formatAmount(position.amount1)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">24h fees (USD)</p>
                        <p className="font-ui font-semibold text-white font-num">{formatUsdValue(position.unclaimedUsd)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/40">Incentives (USD/day)</p>
                        <p className="font-ui text-white/60">—</p>
                      </div>
                      <div className="flex items-center justify-center">
                        <span
                          className={`inline-flex h-2.5 w-2.5 rounded-full ${statusColorMap[position.status] ?? statusColorMap.unknown}`}
                          aria-label={position.status}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <footer className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
              <p className="font-ui text-xs text-white/45">
                Data via on-chain snapshot · Updated {userPositionsUpdatedLabel}
              </p>
              <p className="font-ui text-[11px] uppercase tracking-[0.25em] text-white/35">
                Demo wallet · Read-only
              </p>
            </footer>
          </section>

          <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <div className="card space-y-6">
              <header>
                <h2 className="font-brand text-xl font-semibold text-white">Theme tokens</h2>
                <p className="mt-2 font-ui text-sm text-white/70">
                  Surfaces and interactions auto-reflect the selected theme. Use these CSS variables in code and docs.
                </p>
              </header>

              <div className="grid gap-5 md:grid-cols-2">
                {[themeTokens.surfaces, themeTokens.interactions].map((group, index) => (
                  <div key={index} className="card--quiet space-y-3">
                    <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">
                      {index === 0 ? 'Surfaces' : 'Interactions'}
                    </p>
                    <ul className="space-y-3">
                      {group.map((token) => (
                        <li key={token.name} className="flex items-center gap-3">
                          <span
                            className="h-10 w-10 rounded-lg border border-white/10"
                            style={{ background: token.var }}
                            aria-hidden="true"
                          />
                          <div>
                            <p className="font-ui text-sm text-white/85">{token.name}</p>
                            <p className="font-ui text-[11px] uppercase tracking-[0.18em] text-white/45">
                              {token.var}
                            </p>
                            <p className="font-ui text-xs text-white/60">{token.description}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>

            <aside className="space-y-4">
              <div className="card--quiet space-y-3">
                <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Do / Don’t</p>
                <div className="space-y-3">
                  <div className="rounded-2xl bg-[#0B1530]/92 p-4">
                    <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-2 py-1 text-xs font-semibold text-emerald-300">
                      Do
                    </span>
                    <p className="mt-3 font-ui text-sm text-white/80">
                      Use #0B1530/92 surfaces with a single border to let the wave background shine through.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <span className="inline-flex items-center rounded-full bg-red-400/20 px-2 py-1 text-xs font-semibold text-red-300">
                      Don’t
                    </span>
                    <p className="mt-3 font-ui text-sm text-white/80">
                      Avoid pale glass backgrounds—they wash out the hero wave and reduce contrast.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-4">
                    <span className="inline-flex items-center rounded-full bg-red-400/20 px-2 py-1 text-xs font-semibold text-red-300">
                      Don’t
                    </span>
                    <p className="mt-3 font-ui text-sm text-white/80">
                      Never use Aqua (#1BE8D2) on buttons. It’s accent-only for pills and icons.
                    </p>
                  </div>
                </div>
              </div>
            </aside>
          </section>

          <section className="card space-y-6">
            <header>
              <h2 className="font-brand text-xl font-semibold text-white">Typography</h2>
              <p className="mt-2 font-ui text-sm text-white/70">
                Headings use Manrope; body and UI text use Inter. Always apply Inter + tabular numerals for figures.
              </p>
            </header>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Headings</p>
                <p className="font-brand text-4xl font-semibold text-white">Manrope 700 — H1</p>
                <p className="font-brand text-3xl font-semibold text-white/90">Manrope 600 — H2</p>
                <p className="font-brand text-xl font-semibold text-white/80">Manrope 500 — H3</p>
                <p className="font-ui text-sm text-white/65">
                  Heading weight shifts between 600 and 700 for calm emphasis. Never exceed 800.
                </p>
              </div>
              <div className="space-y-4">
                <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Body & figures</p>
                <p className="font-ui text-base text-white/85">
                  Inter is our body and UI workhorse. Keep copy concise; rely on spacing for calm rhythm.
                </p>
                <div className="rounded-2xl bg-white/5 p-4">
                  <p className="font-ui text-xs uppercase tracking-[0.18em] text-white/50">
                    Numeric comparison
                  </p>
                  <div className="mt-3 flex items-center gap-6">
                    <div>
                      <p className="font-ui text-xs text-white/50">Default</p>
                      <p className="font-ui text-lg text-white">12345.67</p>
                    </div>
                    <div>
                      <p className="font-ui text-xs text-white/50">With .font-num</p>
                      <p className="font-num text-lg text-white">12345.67</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card space-y-6">
            <header>
              <h2 className="font-brand text-xl font-semibold text-white">Primitives</h2>
              <p className="mt-2 font-ui text-sm text-white/70">
                Every UI element is composed from these primitives. Use them directly or via wrappers in component code.
              </p>
            </header>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Card</p>
                  <div className="card">
                    <p className="font-brand text-lg text-white">.card</p>
                    <p className="font-ui text-sm text-white/70">
                      Primary surface. #0B1530/92 with white/10 border (dark) or white/82 with ink border (light).
                    </p>
                  </div>
                </div>
                <div>
                  <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Card Quiet</p>
                  <div className="card--quiet">
                    <p className="font-brand text-lg text-white">.card--quiet</p>
                    <p className="font-ui text-sm text-white/70">
                      Nested surface. Same tone, lighter opacity, calmer border.
                    </p>
                  </div>
                </div>
                <div>
                  <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Divider</p>
                  <div className="card--quiet">
                    <div className="divider w-full" />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Primary button</p>
                  <button type="button" className="btn-primary">
                    Primary action
                  </button>
                </div>
                <div className="space-y-3">
                  <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Pills</p>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center rounded-full bg-[#1BE8D2]/12 px-3 py-1 text-xs font-semibold text-[#1BE8D2]">
                      In-range
                    </span>
                    <span className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white">
                      Premium feature
                    </span>
                  </div>
                </div>
                <div className="space-y-3">
                  <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Segmented</p>
                  <div className="segmented">
                    <button
                      type="button"
                      className="btn-primary px-4 py-2"
                      aria-pressed="true"
                    >
                      On
                    </button>
                    <button
                      type="button"
                      className="segmented-btn--off"
                      aria-pressed="false"
                    >
                      Off
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card space-y-6">
            <header>
              <h2 className="font-brand text-xl font-semibold text-white">Composites</h2>
              <p className="mt-2 font-ui text-sm text-white/70">
                Live components using the primitives above. These are the reference implementations used across the app.
              </p>
            </header>

            <div className="space-y-6">
              <div className="space-y-4">
                <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Pools table</p>
                <div className="card--quiet space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-ui text-xs text-white/55">
                      Data via {sourceLabel}
                      {snapshotUpdatedLabel ? ` • Updated ${snapshotUpdatedLabel}` : ''}
                    </p>
                    <button
                      type="button"
                      className="inline-flex items-center rounded-[8px] border border-white/20 px-3 py-1 text-xs font-medium text-white/80 transition hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={refreshSnapshot}
                      disabled={poolLoading}
                    >
                      Refresh
                    </button>
                  </div>
                  {poolLoading ? (
                    <p className="font-ui text-xs text-white/55">Loading curated pools…</p>
                  ) : null}
                  {poolError ? (
                    <p className="font-ui text-xs text-red-300">
                      {poolError}. Update the snapshot config or retry.
                    </p>
                  ) : null}
                  {!poolLoading && !poolError && poolsTableItems.length === 0 ? (
                    <p className="font-ui text-xs text-white/55">
                      Snapshot is empty. Run the resolver or lower `minTvlUsd` to include smaller pools.
                    </p>
                  ) : null}
                </div>
                <PoolsTable
                  title="Ēnosys & SparkDEX shortlist"
                  items={poolsTableItems}
                  entitlements={{ role: 'FREE', fields: { apr: true, incentives: true, rangeBand: true } }}
                  defaultExpanded={false}
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div className="card--quiet space-y-4">
                  <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">
                    Pricing — Option A (Trial-first Minimal)
                  </p>
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="font-brand text-lg font-semibold text-white">Hero & USPs</p>
                      <p className="font-ui text-sm text-white/70">
                        Calm hero + three USP chips (Non-custodial / V3-only insights / Cancel anytime).
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="font-brand text-lg font-semibold text-white">Premium Card</p>
                      <p className="font-ui text-sm text-white/70">
                        $14.95/mo · 5 pools · RangeBand™ Alerts + $2.45 / 5 pools · CTA → .btn-primary
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="font-brand text-lg font-semibold text-white">Personal plan flow</p>
                      <ul className="list-disc pl-5 font-ui text-sm text-white/70">
                        <li>Wallet connect</li>
                        <li>Pools preview (top N)</li>
                        <li>Recommended plan copy</li>
                        <li>PackStepper (±10)</li>
                        <li>Alerts toggle + price breakdown</li>
                        <li>CTA .btn-primary</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="card--quiet space-y-4">
                  <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">
                    Pricing — Option B (Two-column Calm)
                  </p>
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="font-brand text-lg font-semibold text-white">Left column</p>
                      <p className="font-ui text-sm text-white/70">
                        Hero + USPs + Premium card stacked; persistent context.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="font-brand text-lg font-semibold text-white">Right column</p>
                      <p className="font-ui text-sm text-white/70">
                        Sticky plan summary with button + wallet connect for calm persistence.
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/5 p-4">
                      <p className="font-brand text-lg font-semibold text-white">Below</p>
                      <p className="font-ui text-sm text-white/70">
                        Personal plan details (same flow as Option A) plus optional PoolsTable.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card space-y-6">
            <header>
              <h2 className="font-brand text-xl font-semibold text-white">Pricing — Premium sample</h2>
              <p className="mt-2 font-ui text-sm text-white/70">
                This card mirrors the production Premium offer: price-first, Electric Blue CTA, and concise value bullets.
              </p>
            </header>
            <PremiumCard fullWidth showExtras />
          </section>

          <section className="card space-y-6">
            <header>
              <h2 className="font-brand text-xl font-semibold text-white">Accessibility & QA</h2>
              <p className="mt-2 font-ui text-sm text-white/70">
                Every component ships accessible by default. Use these reminders before approving a visual change.
              </p>
            </header>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Checklist</p>
                <ul className="space-y-2 font-ui text-sm text-white/70">
                  <li>Focus rings visible on keyboard navigation (btn-primary, segmented)</li>
                  <li>aria-pressed on toggles (theme, RangeBand)</li>
                  <li>aria-label for icon buttons (± toggle, close icons)</li>
                  <li>AA contrast minimum 4.5:1 for body text</li>
                  <li>No Aqua buttons; use Electric Blue for primary actions</li>
                </ul>
              </div>
              <div className="space-y-3">
                <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">CLI scans</p>
                <div className="card--quiet space-y-2">
                  {CLI_SCANS.map((command) => (
                    <pre key={command} className="overflow-x-auto font-mono text-xs text-white/70">
                      {command}
                    </pre>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Design docs</p>
                  <ul className="space-y-1 font-ui text-sm text-white/70">
                    {DESIGN_LINKS.map((link) => (
                      <li key={link.href}>
                        <a className="underline decoration-white/40 underline-offset-4 hover:text-white" href={link.href}>
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </main>
        <style jsx global>{`
          .brand-root {
            color: var(--brand-text);
          }
          .brand-root .card {
            background-color: var(--brand-surface);
            border-color: var(--brand-border);
            color: var(--brand-text);
          }
          .brand-root .card--quiet {
            background-color: var(--brand-surface-quiet);
            border-color: var(--brand-border);
            color: var(--brand-text);
          }
          .brand-root .divider {
            background: var(--brand-divider);
          }
          [data-theme='v2-blond'] .brand-root {
            color: #0B1530;
          }
          [data-theme='v2-blond'] .brand-root .text-white {
            color: #0B1530 !important;
          }
          [data-theme='v2-blond'] .brand-root .text-white\\/90 {
            color: rgba(11, 21, 48, 0.9) !important;
          }
          [data-theme='v2-blond'] .brand-root .text-white\\/85 {
            color: rgba(11, 21, 48, 0.85) !important;
          }
          [data-theme='v2-blond'] .brand-root .text-white\\/80 {
            color: rgba(11, 21, 48, 0.8) !important;
          }
          [data-theme='v2-blond'] .brand-root .text-white\\/70 {
            color: rgba(11, 21, 48, 0.7) !important;
          }
          [data-theme='v2-blond'] .brand-root .text-white\\/60,
          [data-theme='v2-blond'] .brand-root .text-white\\/55,
          [data-theme='v2-blond'] .brand-root .text-white\\/50,
          [data-theme='v2-blond'] .brand-root .text-white\\/45 {
            color: rgba(11, 21, 48, 0.55) !important;
          }
          [data-theme='v2-blond'] .brand-root .card,
          [data-theme='v2-blond'] .brand-root .card--quiet {
            color: #0B1530;
          }
        `}</style>
      </div>
    </>
  );
}
