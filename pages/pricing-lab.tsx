'use client';

import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAccount } from 'wagmi';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import Header from '@/components/Header';
import WalletConnect from '@/components/WalletConnect';
import PackStepper from '@/components/pricing/PackStepper';
import VariantToggle from '@/components/pricing/VariantToggle';
import PoolsPreview from '@/components/pricing/PoolsPreview';
import PoolsTable, { type PoolsTableItem } from '@/components/pools/PoolsTable';
import {
  ACTIVE_PLAN_ID,
  priceBreakdown,
  type PriceBreakdownResult,
} from '@/lib/billing/pricing';
import type { PositionRow, PositionsResponse } from '@/lib/positions/types';
import { fmtUsd } from '@/lib/format';

type Variant = 'A' | 'B';

type SummaryLike = {
  active?: number;
  inactive?: number;
  ended?: number;
};

type PositionsState = {
  positions: PositionRow[];
  summary: SummaryLike | null;
  loading: boolean;
  error: string | null;
};

const STRIPE_PRICE_IDS = {
  base: process.env.NEXT_PUBLIC_LL_STRIPE_PRICE_PREMIUM_BASE_5 ?? '',
  slot: process.env.NEXT_PUBLIC_LL_STRIPE_PRICE_POOL_SLOT ?? '',
  alerts: process.env.NEXT_PUBLIC_LL_STRIPE_PRICE_ALERTS_PACK_5 ?? '',
};

const STRIPE_READY =
  Boolean(STRIPE_PRICE_IDS.base) &&
  Boolean(STRIPE_PRICE_IDS.slot) &&
  Boolean(STRIPE_PRICE_IDS.alerts);

const IS_DEV = process.env.NODE_ENV === 'development';

const HERO_CHIPS = [
  'Non-custodial (you keep control)',
  'V3-only insights (Ēnosys & SparkDEX)',
  'Cancel anytime within trial',
];

type CardElement = 'section' | 'div' | 'aside';

function cx(...items: Array<string | false | null | undefined>): string {
  return items.filter(Boolean).join(' ');
}

function normalizeSlots(value: number) {
  if (!Number.isFinite(value)) return 5;
  const clamped = Math.max(5, Math.round(value));
  return Math.max(5, Math.ceil(clamped / 5) * 5);
}

type CardProps = {
  children: ReactNode;
  className?: string;
  as?: CardElement;
};

function Card({ children, className = '', as: Element = 'section' }: CardProps) {
  return (
    <Element
      className={cx(
        'card',
        className,
      )}
    >
      {children}
    </Element>
  );
}

type PanelProps = {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'dl';
};

function Panel({ children, className = '', as: Element = 'div' }: PanelProps) {
  return (
    <Element
      className={cx(
        'card--quiet',
        className,
      )}
    >
      {children}
    </Element>
  );
}

function isAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function toPoolsTableItems(positions: PositionRow[]): PoolsTableItem[] {
  return positions.map((position, index) => {
    const status: PoolsTableItem['status'] =
      position.category === 'Ended' ? 'ended' : (position.status ?? 'out');

    return {
      provider: position.provider || `pool-${index}`,
      token0: {
        symbol: position.token0.symbol,
        address: position.token0.address,
        decimals: position.token0.decimals,
      },
      token1: {
        symbol: position.token1.symbol,
        address: position.token1.address,
        decimals: position.token1.decimals,
      },
      tvlUsd: position.tvlUsd ?? 0,
      unclaimedFeesUsd: position.unclaimedFeesUsd ?? 0,
      incentivesUsd: position.incentivesUsd ?? 0,
      incentivesToken: position.incentivesToken ?? null,
      incentivesTokenAmount: position.incentivesTokenAmount ?? null,
      apr24h: position.apr24h ?? null,
      isInRange: Boolean(position.isInRange),
      status,
      range: {
        min: position.rangeMin,
        max: position.rangeMax,
        current: position.currentPrice,
      },
      tokenId: position.tokenId,
      poolAddress: position.poolId ?? position.marketId ?? null,
      marketId: position.marketId,
      poolFeeBps: position.poolFeeBps,
      amount0: position.amount0 ?? null,
      amount1: position.amount1 ?? null,
      fee0: position.fee0 ?? null,
      fee1: position.fee1 ?? null,
      liquidityShare: position.liquidityShare ?? null,
    };
  });
}

type PersonalPlanProps = {
  walletAddress: string;
  state: PositionsState;
  activeCount: number;
  recommendedSlots: number;
  slots: number;
  alertsSelected: boolean;
  breakdown: PriceBreakdownResult;
  onStepperChange: (next: number) => void;
  onToggleAlerts: () => void;
  checkoutPayload: { items: Array<{ price: string; quantity: number }> } | null;
};

function PersonalPlanSection({
  walletAddress,
  state,
  activeCount,
  recommendedSlots,
  slots,
  alertsSelected,
  breakdown,
  onStepperChange,
  onToggleAlerts,
  checkoutPayload,
}: PersonalPlanProps) {
  const extraPools = Math.max(0, slots - 5);
  const recommendedExtra = Math.max(0, recommendedSlots - 5);
  const poolWord = activeCount === 1 ? 'pool' : 'pools';
  const showFallback =
    !state.loading && state.error === null && state.positions.length === 0;

  const breakdownRows = [
    { label: 'Plan base (5 pools)', value: breakdown.base5, detail: null },
    {
      label: `Additional pools (+${extraPools} pools)`,
      value: breakdown.extras,
      detail: null,
    },
    {
      label: 'Alerts packs',
      value: breakdown.alerts,
      detail:
        alertsSelected && breakdown.alertsPacks > 0
          ? `×${breakdown.alertsPacks}`
          : null,
    },
  ];

  return (
    <Card id="personal-plan">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-brand text-2xl font-semibold text-white">
            Personal plan
          </h2>
          <p className="mt-2 font-ui text-sm text-white/70">
            Recommended: Manage{' '}
            <span className="font-num text-white/90">{activeCount}</span> active{' '}
            {poolWord} with a{' '}
            <span className="font-num text-white/90">
              {recommendedSlots}
            </span>
            -pool plan.
          </p>
        </div>
        <div role="group" aria-label="Connect wallet">
          <WalletConnect className="w-full justify-center px-4 py-2.5 text-sm" />
        </div>
      </header>

      {walletAddress ? (
        <div className="mt-6 space-y-6">
          <PoolsPreview
            address={walletAddress}
            loading={state.loading}
            error={state.error}
            summary={state.summary ?? undefined}
            positions={state.positions}
            showAll
          />

          <Panel className="font-ui text-sm text-white/70">
            You have{' '}
            <span className="font-num text-white/90">{activeCount}</span> active{' '}
            {poolWord}. Add{' '}
            <span className="font-num text-white/90">{recommendedExtra}</span>{' '}
            more to follow every position comfortably.
          </Panel>

          <div className="flex flex-wrap items-center gap-4">
            <PackStepper value={slots} onChange={onStepperChange} />
            <span className="font-ui text-xs text-white/60">
              Adjust in packs of 10 pools.
            </span>
          </div>

          <label className="card--quiet flex cursor-pointer items-center gap-3 font-ui text-sm text-white/80 transition hover:bg-white/10">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border border-white/30 bg-white/10 text-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60B0FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530]"
              checked={alertsSelected}
              onChange={onToggleAlerts}
            />
            <span>
              RangeBand™ Alerts +{' '}
              <span className="font-num text-white/90">$2.45</span> / 5 pools —
              email when your position approaches or leaves its band.
            </span>
          </label>

          <Panel as="dl" className="space-y-3 font-ui text-sm text-white/80">
            {breakdownRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between">
                <dt>
                  {row.label}{' '}
                  {row.detail && (
                    <span className="font-num text-white/70">{row.detail}</span>
                  )}
                </dt>
                <dd className="font-num text-white/90">
                  ${row.value.toFixed(2)}
                </dd>
              </div>
            ))}
            <div className="pt-1 flex items-center justify-between font-semibold text-white">
              <dt>Total per month</dt>
              <dd className="font-num text-lg">
                ${breakdown.total.toFixed(2)}
              </dd>
            </div>
          </Panel>

          <button
            type="button"
            className="btn-primary"
            aria-label="Subscribe — personal plan"
          >
            Subscribe now
          </button>

          {!STRIPE_READY && (
            <Panel className="font-ui text-sm text-white/75">
              <p className="font-semibold text-white">Stripe configuration required</p>
              <p className="mt-2 text-white/70">
                Set the env vars below to enable checkout:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-white/70">
                <li>NEXT_PUBLIC_LL_STRIPE_PRICE_PREMIUM_BASE_5</li>
                <li>NEXT_PUBLIC_LL_STRIPE_PRICE_POOL_SLOT</li>
                <li>NEXT_PUBLIC_LL_STRIPE_PRICE_ALERTS_PACK_5</li>
              </ul>
            </Panel>
          )}

          {IS_DEV && checkoutPayload && (
            <Panel className="font-ui text-xs text-white/70">
              <p className="font-semibold text-white/80">
                Stripe payload (dev only)
              </p>
              <pre className="mt-2 max-h-56 overflow-auto rounded-xl bg-black/40 p-3 font-mono text-[11px] text-white/80 tabular-nums">
                {JSON.stringify(checkoutPayload, null, 2)}
              </pre>
            </Panel>
          )}
        </div>
      ) : (
        <Panel className="mt-6 font-ui text-sm text-white/70">
          Connect your wallet to fetch pools and tailor the plan to your
          activity on Ēnosys and SparkDEX.
        </Panel>
      )}

      {showFallback && (
        <Panel className="mt-6 font-ui text-sm text-white/70">
          <p>
            We couldn’t find pools for this wallet yet. Create a pool at a partner DEX and it will appear automatically.
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <a
              href="https://v3.dex.enosys.global/"
              target="_blank"
              rel="noreferrer"
              className="font-ui text-sm font-semibold text-white transition hover:text-white/80"
            >
              Ēnosys →
            </a>
            <a
              href="https://sparkdex.ai"
              target="_blank"
              rel="noreferrer"
              className="font-ui text-sm font-semibold text-white transition hover:text-white/80"
            >
              SparkDEX →
            </a>
          </div>
        </Panel>
      )}
    </Card>
  );
}

type OptionViewProps = {
  walletAddress: string;
  state: PositionsState;
  activeCount: number;
  recommendedSlots: number;
  slots: number;
  alertsSelected: boolean;
  breakdown: PriceBreakdownResult;
  onStepperChange: (next: number) => void;
  onToggleAlerts: () => void;
  checkoutPayload: { items: Array<{ price: string; quantity: number }> } | null;
  tableItems: PoolsTableItem[];
};

function HeroCard() {
  return (
    <Card className="text-center">
      <span className="font-ui text-xs uppercase tracking-[0.3em] text-white/50">
        {ACTIVE_PLAN_ID === 'B' ? 'Plan B active' : 'Plan A active'}
      </span>
      <h1 className="mt-4 font-brand text-4xl font-semibold text-white sm:text-5xl">
        The easy way to manage your liquidity pools.
      </h1>
      <p className="mt-4 font-ui text-base text-white/80">
        Start your 14-day trial. Cancel anytime. Non-custodial.
      </p>
    </Card>
  );
}

function UspsCard() {
  return (
    <Card>
      <h2 className="font-brand text-xl font-semibold text-white">
        Why teams pick LiquiLab
      </h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {HERO_CHIPS.map((chip) => (
          <Panel
            key={chip}
            className="flex items-center gap-3 px-4 py-3 text-left"
          >
            <span className="font-ui text-sm text-white/80">{chip}</span>
          </Panel>
        ))}
      </div>
    </Card>
  );
}

function PremiumCard() {
  return (
    <Card>
      <h2 className="font-brand text-2xl font-semibold text-white">
        Premium Plan
      </h2>
      <p className="mt-3 font-ui text-sm text-white/80">
        Follow <span className="font-num text-white/90">5</span> pools (Ēnosys &amp; SparkDEX) •{' '}
        <span className="font-num text-white/90">$14.95</span>/month • RangeBand™ Alerts +{' '}
        <span className="font-num text-white/90">$2.45</span> / 5 pools
      </p>
      <a
        href="#personal-plan"
        className="btn-primary mt-6"
        aria-label="Subscribe to Premium Plan"
      >
        Subscribe now
      </a>
    </Card>
  );
}

function StickyPlanCard({
  activeCount,
  recommendedSlots,
  breakdown,
}: {
  activeCount: number;
  recommendedSlots: number;
  breakdown: PriceBreakdownResult;
}) {
  return (
    <Card as="aside" className="md:sticky md:top-24">
      <h2 className="font-brand text-2xl font-semibold text-white">
        Your plan snapshot
      </h2>
      <p className="mt-3 font-ui text-sm text-white/70">
        {activeCount > 0 ? (
          <>
            Manage{' '}
            <span className="font-num text-white/90">{activeCount}</span> active pools with a{' '}
            <span className="font-num text-white/90">
              {recommendedSlots}
            </span>
            -pool plan.
          </>
        ) : (
          'Connect your wallet to tailor the plan to your pools.'
        )}
      </p>

      <Panel className="mt-5 space-y-2 font-ui text-sm text-white/80">
        <div className="flex items-center justify-between">
          <span>Base plan</span>
          <span className="font-num text-white/90">
            ${breakdown.base5.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Extras</span>
          <span className="font-num text-white/90">
            ${breakdown.extras.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Alerts</span>
          <span className="font-num text-white/90">
            ${breakdown.alerts.toFixed(2)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between font-semibold text-white">
          <span>Total</span>
          <span className="font-num text-lg">
            ${breakdown.total.toFixed(2)}
          </span>
        </div>
      </Panel>

      <div className="mt-5 space-y-3">
        <WalletConnect className="w-full justify-center px-4 py-2.5 text-sm" />
        <button type="button" className="btn-primary">
          Start 14-day trial
        </button>
      </div>
    </Card>
  );
}

function OptionAView(props: OptionViewProps) {
  const {
    walletAddress,
    state,
    activeCount,
    recommendedSlots,
    slots,
    alertsSelected,
    breakdown,
    onStepperChange,
    onToggleAlerts,
    checkoutPayload,
    tableItems,
  } = props;

  return (
    <div className="space-y-8">
      <HeroCard />
      <UspsCard />
      <PremiumCard />
      <PersonalPlanSection
        walletAddress={walletAddress}
        state={state}
        activeCount={activeCount}
        recommendedSlots={recommendedSlots}
        slots={slots}
        alertsSelected={alertsSelected}
        breakdown={breakdown}
        onStepperChange={onStepperChange}
        onToggleAlerts={onToggleAlerts}
        checkoutPayload={checkoutPayload}
      />
      {tableItems.length > 0 && (
        <PoolsTable
          title="All pools"
          items={tableItems}
          entitlements={{
            role: 'VISITOR',
            fields: { apr: true, incentives: true, rangeBand: true },
          }}
          defaultExpanded={false}
        />
      )}
    </div>
  );
}

function OptionBView(props: OptionViewProps) {
  const {
    walletAddress,
    state,
    activeCount,
    recommendedSlots,
    slots,
    alertsSelected,
    breakdown,
    onStepperChange,
    onToggleAlerts,
    checkoutPayload,
    tableItems,
  } = props;

  return (
    <div className="space-y-10">
      <div className="grid gap-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:items-start">
        <div className="space-y-8">
          <HeroCard />
          <UspsCard />
          <PremiumCard />
        </div>
        <StickyPlanCard
          activeCount={activeCount}
          recommendedSlots={recommendedSlots}
          breakdown={breakdown}
        />
      </div>

      <PersonalPlanSection
        walletAddress={walletAddress}
        state={state}
        activeCount={activeCount}
        recommendedSlots={recommendedSlots}
        slots={slots}
        alertsSelected={alertsSelected}
        breakdown={breakdown}
        onStepperChange={onStepperChange}
        onToggleAlerts={onToggleAlerts}
        checkoutPayload={checkoutPayload}
      />

      {tableItems.length > 0 && (
        <PoolsTable
          title="All pools"
          items={tableItems}
          entitlements={{
            role: 'VISITOR',
            fields: { apr: true, incentives: true, rangeBand: true },
          }}
          defaultExpanded={false}
        />
      )}
    </div>
  );
}

export default function PricingLabPage() {
  const router = useRouter();
  const { address: connectedAddress, isConnected } = useAccount();

  const [variant, setVariant] = useState<Variant>('A');
  const [state, setState] = useState<PositionsState>({
    positions: [],
    summary: null,
    loading: false,
    error: null,
  });
  const [slots, setSlots] = useState<number>(5);
  const [alertsSelected, setAlertsSelected] = useState<boolean>(false);

  const userAdjustedRef = useRef(false);

  useEffect(() => {
    if (!router.isReady) return;
    const rawVariant = router.query.variant;
    if (typeof rawVariant === 'string') {
      const upper = rawVariant.toUpperCase();
      if (upper === 'A' || upper === 'B') {
        setVariant(upper);
      }
    }
  }, [router.isReady, router.query.variant]);

  const handleVariantChange = useCallback(
    (next: Variant) => {
      setVariant(next);
      if (!router.isReady) return;
      const nextQuery = { ...router.query, variant: next };
      router.replace(
        { pathname: router.pathname, query: nextQuery },
        undefined,
        { shallow: true },
      );
    },
    [router],
  );

  const queryAddress = useMemo(() => {
    if (!router.isReady) return '';
    const raw = router.query.address;
    return isAddress(raw) ? raw : '';
  }, [router.isReady, router.query.address]);

  const walletAddress = isConnected && connectedAddress ? connectedAddress : '';
  const effectiveAddress = walletAddress || queryAddress;

  useEffect(() => {
    if (!effectiveAddress) {
      setState({
        positions: [],
        summary: null,
        loading: false,
        error: null,
      });
      userAdjustedRef.current = false;
      setSlots(5);
      setAlertsSelected(false);
      return;
    }

    const controller = new AbortController();

    const fetchPositions = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const response = await fetch(
          `/api/positions?address=${effectiveAddress}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          throw new Error(`Failed to load positions (${response.status})`);
        }
        const payload: PositionsResponse = await response.json();
        setState({
          positions: payload.data?.positions ?? [],
          summary: payload.data?.summary ?? null,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          positions: [],
          summary: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Unable to load wallet positions.',
        });
      }
    };

    fetchPositions();
    return () => controller.abort();
  }, [effectiveAddress]);

  const activeCount = useMemo(() => {
    if (state.summary?.active !== undefined) {
      return state.summary.active ?? 0;
    }
    return state.positions.filter((position) => {
      const category = position.category?.toLowerCase();
      if (category) return category === 'active';
      const status = (position.status ?? '').toString().toLowerCase();
      return status === 'in' || status === 'active';
    }).length;
  }, [state.summary, state.positions]);

  const recommendedSlots = useMemo(() => {
    if (activeCount <= 0) return 5;
    return Math.max(5, Math.ceil(activeCount / 5) * 5);
  }, [activeCount]);

  useEffect(() => {
    if (!effectiveAddress) return;
    if (!userAdjustedRef.current) {
      const normalized = normalizeSlots(recommendedSlots);
      if (normalized !== slots) {
        setSlots(normalized);
      }
    }
  }, [effectiveAddress, recommendedSlots, slots]);

  const handleStepperChange = useCallback((next: number) => {
    userAdjustedRef.current = true;
    setSlots(normalizeSlots(next));
  }, []);

  const handleAlertsToggle = useCallback(() => {
    setAlertsSelected((prev) => !prev);
  }, []);

  const breakdown = useMemo(
    () => priceBreakdown({ slots, alertsSelected }),
    [slots, alertsSelected],
  );

  const checkoutPayload = useMemo(() => {
    if (!STRIPE_READY) return null;
    const items: Array<{ price: string; quantity: number }> = [];
    if (STRIPE_PRICE_IDS.base) {
      items.push({ price: STRIPE_PRICE_IDS.base, quantity: 1 });
    }
    const extra = Math.max(0, slots - 5);
    if (extra > 0 && STRIPE_PRICE_IDS.slot) {
      items.push({ price: STRIPE_PRICE_IDS.slot, quantity: extra });
    }
    if (alertsSelected && STRIPE_PRICE_IDS.alerts) {
      items.push({
        price: STRIPE_PRICE_IDS.alerts,
        quantity: breakdown.alertsPacks,
      });
    }
    return { items };
  }, [slots, alertsSelected, breakdown.alertsPacks]);

  const tableItems = useMemo(
    () => toPoolsTableItems(state.positions),
    [state.positions],
  );

  const totalPoolsUsd = useMemo(() => {
    const value = state.summary?.tvlUsd;
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    return fmtUsd(value);
  }, [state.summary]);

  const totalPoolsDisplay =
    totalPoolsUsd === '—' ? '—' : `$${totalPoolsUsd}`;

  const optionProps: OptionViewProps = {
    walletAddress: effectiveAddress,
    state,
    activeCount,
    recommendedSlots,
    slots,
    alertsSelected,
    breakdown,
    onStepperChange: handleStepperChange,
    onToggleAlerts: handleAlertsToggle,
    checkoutPayload,
    tableItems,
  };

  return (
    <>
      <Head>
        <title>Pricing Lab · LiquiLab</title>
        <meta
          name="description"
          content="Toggle between Pricing layout options A and B to compare hero, plan cards, and personal plan flows."
        />
      </Head>

      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="page-bg" aria-hidden="true" />
        <Header currentPage="pricing" showTabs={false} />

        <main className="relative z-10 mx-auto w-full max-w-6xl space-y-8 px-6 py-20 sm:px-8 md:py-24">
          <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="font-brand text-2xl font-semibold text-white">
                Pricing layout lab
              </h1>
              <p className="mt-2 font-ui text-sm text-white/70">
                Compare Option A and Option B with the same wallet data. Total TVL:{' '}
                <span className="font-num text-white/90">{totalPoolsDisplay}</span>
              </p>
            </div>
            <VariantToggle value={variant} onChange={handleVariantChange} />
          </div>

          {variant === 'B' ? (
            <OptionBView {...optionProps} />
          ) : (
            <OptionAView {...optionProps} />
          )}
        </main>
      </div>
    </>
  );
}
