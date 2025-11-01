'use client';

import React from 'react';

import {
  BUNDLE_SIZE,
  PRICE_PER_POOL_USD,
  includedCapacity,
  freeBonus,
  monthlyAmountUsdForPaidCapacity,
  yearlyAmountUsdForPaidCapacity,
} from '@/data/pricing';
import {
  ALERTS_PRICE_PER_BUNDLE_USD,
  ANNUAL_MULTIPLIER,
} from '@/data/subscriptionPlans';
import { track } from '@/lib/analytics';
import { fetchPositions, computeSummary } from '@/lib/positions/client';
import type { PositionRow } from '@/lib/positions/types';

const TIERS = [5, 10, 20, 30];
const STORAGE_KEY_HISTORY = 'liquilab/pricing/address-history';

function shortAddress(value: string) {
  if (!value) return '';
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatCurrency(amount: number): string {
  if (!Number.isFinite(amount)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

type AdminSettings = {
  WAITLIST_ENABLED: boolean;
  FASTFORWARD_ENABLED: boolean;
};

type SeatStats = {
  limit: number;
  activated: number;
  remaining: number;
};

type PreviewResponse = {
  pricing: {
    billingCycle: 'month' | 'year';
    paidPools: number;
    totalCapacity: number;
    amountUsd: number;
    monthlyEquivalentUsd: number;
  };
  alerts?: {
    enabled: boolean;
    pricePerBundleUsd: number;
    bundles: number;
    amountUsd: number;
    monthlyEquivalentUsd: number;
  };
  suggestion: {
    activePools: number;
    recommendedBundles: number;
    recommendedPaidPools: number;
    recommendedCapacity: number;
  };
  seats?: {
    cap: number;
    active: number | null;
    waitlistEnabled: boolean;
    fastforwardEnabled: boolean;
  };
};

type TierCard = {
  paidPools: number;
  title: string;
  freeBonus: number;
  totalCapacity: number;
  monthlyAmount: number;
  yearlyAmount: number;
  recommended: boolean;
};

type PricingCalculatorProps = {
  address?: string;
};

function parseSettings(input: Record<string, string | undefined>): AdminSettings {
  return {
    WAITLIST_ENABLED: (input.WAITLIST_ENABLED ?? '0') === '1',
    FASTFORWARD_ENABLED: (input.FASTFORWARD_ENABLED ?? '1') === '1',
  };
}

function countActivePools(positions: PositionRow[]): number {
  return positions.reduce((count, position) => {
    if (position.category === 'Active') {
      return count + 1;
    }
    const tvl = typeof position.tvlUsd === 'number' ? position.tvlUsd : 0;
    return tvl > 0 ? count + 1 : count;
  }, 0);
}

function createTierCards(recommendedPaidPools: number): TierCard[] {
  return TIERS.map((paidPools) => {
    const bonus = freeBonus(paidPools);
    const totalCapacity = includedCapacity(paidPools);
    return {
      paidPools,
      title: `${paidPools} pools`,
      freeBonus: bonus,
      totalCapacity,
      monthlyAmount: monthlyAmountUsdForPaidCapacity(paidPools),
      yearlyAmount: yearlyAmountUsdForPaidCapacity(paidPools),
      recommended: paidPools === recommendedPaidPools,
    };
  });
}

function loadHistory(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY_HISTORY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function persistHistory(address: string) {
  if (typeof window === 'undefined') return;
  const history = loadHistory().filter((item) => item.toLowerCase() !== address.toLowerCase());
  history.unshift(address);
  localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history.slice(0, 5)));
}

const initialSettings: AdminSettings = {
  WAITLIST_ENABLED: false,
  FASTFORWARD_ENABLED: true,
};

const initialSeats: SeatStats = {
  limit: 100,
  activated: 0,
  remaining: 100,
};

export default function PricingCalculator({ address: initialAddress }: PricingCalculatorProps) {
  const [addressInput, setAddressInput] = React.useState(initialAddress ?? '');
  const [activePools, setActivePools] = React.useState(0);
  const [billingCycle, setBillingCycle] = React.useState<'month' | 'year'>('month');
  const [alertsEnabled, setAlertsEnabled] = React.useState(false);
  const [loadingPools, setLoadingPools] = React.useState(false);
  const [poolError, setPoolError] = React.useState<string | null>(null);
  const [settings, setSettings] = React.useState<AdminSettings>(initialSettings);
  const [seatStats, setSeatStats] = React.useState<SeatStats>(initialSeats);
  const [previewMonth, setPreviewMonth] = React.useState<PreviewResponse | null>(null);
  const [previewYear, setPreviewYear] = React.useState<PreviewResponse | null>(null);
  const [history, setHistory] = React.useState<string[]>(() => (typeof window === 'undefined' ? [] : loadHistory()));

  const activePreview = billingCycle === 'month' ? previewMonth : previewYear;
  const recommendedPaidPools = activePreview?.pricing?.paidPools ?? 0;
  const tierCards = createTierCards(recommendedPaidPools);
  const seatsAvailable = seatStats.remaining > 0;
  const alertsPreview = activePreview?.alerts;
  const alertsBundleCount =
    alertsPreview?.bundles ??
    (alertsEnabled && recommendedPaidPools > 0
      ? Math.ceil(recommendedPaidPools / BUNDLE_SIZE)
      : 0);
  const alertsMonthlyDisplay =
    alertsPreview?.monthlyEquivalentUsd ??
    Number((alertsBundleCount * ALERTS_PRICE_PER_BUNDLE_USD).toFixed(2));
  const alertsAmountDisplay =
    alertsPreview?.amountUsd ??
    (billingCycle === 'month'
      ? alertsMonthlyDisplay
      : Number(
          (alertsMonthlyDisplay * ANNUAL_MULTIPLIER).toFixed(2),
        ));
  const paidPoolsForAlerts =
    previewMonth?.pricing?.paidPools ??
    previewYear?.pricing?.paidPools ??
    recommendedPaidPools;

  const waitlistEnabled = settings.WAITLIST_ENABLED;
  const fastForwardEnabled = settings.FASTFORWARD_ENABLED;

  React.useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/admin/settings', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load settings');
        const data = await response.json();
        if (data?.settings) {
          setSettings(parseSettings(data.settings));
        }
      } catch (error) {
        console.warn('[PricingCalculator] Failed to load admin settings', error);
      }
    }

    async function fetchSeatStats() {
      try {
        const response = await fetch('/api/early-access/stats', { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load seat stats');
        const data = await response.json();
        if (data && typeof data.limit === 'number') {
          setSeatStats({ limit: data.limit, activated: data.activated ?? 0, remaining: data.remaining ?? data.limit });
        }
      } catch (error) {
        console.warn('[PricingCalculator] Failed to load seat stats', error);
      }
    }

    fetchSettings();
    fetchSeatStats();
  }, []);

  React.useEffect(() => {
    if (!initialAddress) return;
    setAddressInput(initialAddress);
    void lookupPools(initialAddress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialAddress]);

  React.useEffect(() => {
    void fetchPreview('month');
    void fetchPreview('year');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePools, alertsEnabled]);

  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      setHistory(loadHistory());
    }
  }, []);

  async function fetchPreview(cycle: 'month' | 'year') {
    try {
      const response = await fetch(
        `/api/billing/preview?activePools=${activePools}&billingCycle=${cycle}&alerts=${
          alertsEnabled ? '1' : '0'
        }`,
        { cache: 'no-store' },
      );
      if (!response.ok) throw new Error('Failed to fetch billing preview');
      const data = (await response.json()) as PreviewResponse;
      if (cycle === 'month') {
        setPreviewMonth(data);
      } else {
        setPreviewYear(data);
      }
    } catch (error) {
      console.warn('[PricingCalculator] Preview failed', error);
    }
  }

  async function lookupPools(address: string) {
    if (!address) {
      setActivePools(0);
      setPoolError(null);
      return;
    }

    setLoadingPools(true);
    setPoolError(null);
    try {
      const result = await fetchPositions(address);
      const rows = result.data?.positions ?? [];
      const summary = result.data?.summary ?? computeSummary(rows);

      const active = summary.active ?? countActivePools(rows);
      setActivePools(active);
      if (typeof window !== 'undefined') {
        persistHistory(address);
        setHistory(loadHistory());
      }
    } catch (error) {
      console.error('[PricingCalculator] lookup failed', error);
      setPoolError('Unable to load pools for that address.');
      setActivePools(0);
    } finally {
      setLoadingPools(false);
    }
  }

  function handleLookupSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookupPools(addressInput.trim());
  }

  const handleAlertsToggle = React.useCallback(() => {
    const next = !alertsEnabled;
    const bundlesForToggle =
      next && paidPoolsForAlerts > 0
        ? Math.ceil(paidPoolsForAlerts / BUNDLE_SIZE)
        : 0;
    track('billing_alerts_toggle', {
      enabled: next,
      paidPools: paidPoolsForAlerts,
      bundles: bundlesForToggle,
    });
    setAlertsEnabled(next);
  }, [alertsEnabled, paidPoolsForAlerts]);

  const previewForCycle = billingCycle === 'month' ? previewMonth : previewYear;
  const monthlyPerPool = PRICE_PER_POOL_USD.toFixed(2);

  const recommended = previewForCycle?.pricing?.paidPools ?? 0;
  const suggestedCapacity = previewForCycle?.pricing?.totalCapacity ?? includedCapacity(0);

  const note = seatsAvailable
    ? `Seats available — ${Math.max(0, seatStats.remaining)} remaining.`
    : 'Seat cap reached — join the priority list to reserve your spot.';

  const ctaPrimary = seatsAvailable ? 'Start with your free pool' : 'Join the priority list';

  return (
    <section className="rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.78)] px-6 py-10 backdrop-blur-xl text-white">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-brand text-xs uppercase tracking-[0.32em] text-[#6EA8FF]/80">Liquidity Journey Pricing</span>
          <h2 className="font-brand text-3xl font-semibold md:text-4xl">Predictable pricing with flexible capacity</h2>
          <p className="font-ui text-sm text-[#B0B9C7] md:text-base">
            First pool is always free. Bundles add paid capacity — each bundle includes a free bonus slot. Annual billing charges ten months (two months on us).
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 font-ui text-sm text-[#B0B9C7]">
          <strong className="font-semibold text-white">${monthlyPerPool}</strong> per pool / month · billed in bundles of {BUNDLE_SIZE}
        </div>
      </header>

      <form onSubmit={handleLookupSubmit} className="mt-8 flex flex-col gap-3 font-ui md:flex-row">
        <div className="flex w-full flex-col">
          <label htmlFor="wallet" className="sr-only">Wallet address</label>
          <input
            id="wallet"
            type="text"
            value={addressInput}
            onChange={(event) => setAddressInput(event.target.value)}
            placeholder="0x… or paste your wallet address"
            className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-base text-white placeholder:text-[#748199] focus:border-[#6EA8FF] focus:outline-none focus:ring-2 focus:ring-[#6EA8FF]/40"
          />
        </div>
        <button
          type="submit"
          disabled={loadingPools}
          className="inline-flex items-center justify-center rounded-xl bg-[#6EA8FF] px-5 py-3 text-base font-semibold text-[#0A0F1C] transition hover:shadow-[0_0_24px_rgba(110,168,255,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6EA8FF] disabled:cursor-wait disabled:opacity-60"
        >
          {loadingPools ? 'Analysing…' : 'Estimate pricing'}
        </button>
      </form>
      {poolError && <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">{poolError}</p>}

      {history.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#748199]">
          <span className="uppercase tracking-wide text-[#6EA8FF]">Recent:</span>
          {history.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setAddressInput(item);
                void lookupPools(item);
              }}
              className="rounded-full border border-white/20 px-3 py-1 text-white/80 transition hover:border-white hover:text-white"
            >
              {shortAddress(item)}
            </button>
          ))}
        </div>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-6">
          <h3 className="font-brand text-xl font-semibold text-white">Usage summary</h3>
          <p className="mt-2 font-ui text-sm text-[#B0B9C7]">
            Active pools detected: <strong className="text-white">{activePools}</strong>
          </p>
          <p className="mt-1 font-ui text-sm text-[#B0B9C7]">
            Recommended capacity: <strong className="text-white">{suggestedCapacity}</strong> pools ({recommended > 0 ? `${recommended} paid + bonus` : 'starter free plan'})
          </p>
          {alertsEnabled ? (
            <p className="mt-1 font-ui text-sm text-[#B0B9C7]">
              Pro Alerts on — {alertsBundleCount} bundle{alertsBundleCount === 1 ? '' : 's'} ·{' '}
              {alertsMonthlyDisplay > 0
                ? `${formatCurrency(alertsMonthlyDisplay)}/month`
                : 'no charge until you add paid pools'}
            </p>
          ) : null}
          <p className="mt-1 font-ui text-sm text-[#B0B9C7]">
            {note}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-4 py-2 font-ui text-xs uppercase tracking-wider text-[#6EA8FF]">
            {seatsAvailable ? 'Seats open' : 'Priority list only'}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-brand text-xl font-semibold text-white">Billing cycle</h3>
            <div className="inline-flex rounded-full border border-white/10 bg-white/[0.08] p-1 text-sm">
              <button
                type="button"
                onClick={() => setBillingCycle('month')}
                className={`rounded-full px-4 py-1.5 transition ${billingCycle === 'month' ? 'bg-[#6EA8FF] text-[#0A0F1C]' : 'text-[#B0B9C7]'}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('year')}
                className={`rounded-full px-4 py-1.5 transition ${billingCycle === 'year' ? 'bg-[#6EA8FF] text-[#0A0F1C]' : 'text-[#B0B9C7]'}`}
              >
                Annual (2 months free)
              </button>
            </div>
          </div>
          <p className="mt-3 font-ui text-sm text-[#B0B9C7]">
            Annual billing charges ten months up-front and locks pricing for 12 months. Switch any time.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-brand text-xl font-semibold text-white">Pro Alerts add-on</h3>
              <p className="mt-2 font-ui text-sm text-[#B0B9C7]">
                Email alerts when a pool nears its band or exits the range — powered by RangeBand™.
              </p>
              <p className="mt-3 font-ui text-xs text-[#8E99AD]">
                + {formatCurrency(ALERTS_PRICE_PER_BUNDLE_USD)} per {BUNDLE_SIZE} pools / month (annual = {ANNUAL_MULTIPLIER}× monthly).
              </p>
              {alertsEnabled && (
                <p className="mt-2 font-ui text-xs text-[#6EA8FF]">
                  {alertsBundleCount} bundle{alertsBundleCount === 1 ? '' : 's'} ·{' '}
                  {alertsAmountDisplay > 0
                    ? `${formatCurrency(alertsAmountDisplay)} ${
                        billingCycle === 'month' ? '/month' : '/year'
                      }`
                    : 'no charge until you add paid pools'}
                </p>
              )}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={alertsEnabled}
              onClick={handleAlertsToggle}
              className={`mt-1 inline-flex h-7 w-12 items-center rounded-full transition ${
                alertsEnabled ? 'bg-[#6EA8FF]' : 'bg-white/20'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${
                  alertsEnabled ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
              <span className="sr-only">Toggle Pro Alerts</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {tierCards.map((card) => {
          const price = billingCycle === 'month' ? card.monthlyAmount : card.yearlyAmount;
          const unitLabel = billingCycle === 'month' ? 'per month' : 'per year';
          const recommendedBadge = card.recommended && seatsAvailable;

          return (
            <div
              key={card.paidPools}
              className={`flex flex-col gap-4 rounded-2xl border px-5 py-6 transition ${
                recommendedBadge ? 'border-[#6EA8FF]/60 bg-[#6EA8FF]/10 shadow-[0_0_24px_rgba(110,168,255,0.25)]' : 'border-white/10 bg-white/[0.03]'
              }`}
            >
              <div className="flex items-center justify-between">
                <h4 className="font-brand text-lg font-semibold text-white">{card.title}</h4>
                {recommendedBadge && (
                  <span className="rounded-full bg-[#6EA8FF] px-3 py-1 text-xs font-semibold text-[#0A0F1C]">Recommended</span>
                )}
              </div>
              <div className="font-brand text-3xl font-semibold text-white">
                ${price.toFixed(2)}
                <span className="ml-2 align-middle text-sm font-normal text-[#B0B9C7]">{unitLabel}</span>
              </div>
              <ul className="space-y-2 font-ui text-sm text-[#B0B9C7]">
                <li><span className="text-white">{card.totalCapacity}</span> total capacity ({card.paidPools} paid + {card.freeBonus} bonus)</li>
                <li>First pool always free (trial included)</li>
                <li>Bundle size: {BUNDLE_SIZE} pools</li>
              </ul>
              <button
                type="button"
                disabled={!seatsAvailable}
                className={`mt-auto rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  seatsAvailable ? 'bg-[#6EA8FF] text-[#0A0F1C] hover:shadow-[0_0_18px_rgba(110,168,255,0.3)]' : 'bg-white/10 text-white/50'
                }`}
              >
                {seatsAvailable ? 'Select plan' : 'Join waitlist'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-6 font-ui text-sm text-[#B0B9C7]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-1 text-white">
            <span className="font-brand text-base">Ready to get started?</span>
            <span className="text-sm text-[#B0B9C7]">Free plan includes 1 pool. Upgrade when you exceed your free capacity.</span>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl bg-[#6EA8FF] px-4 py-2 text-sm font-semibold text-[#0A0F1C] transition hover:shadow-[0_0_18px_rgba(110,168,255,0.3)]"
            >
              {ctaPrimary}
            </button>
            {!seatsAvailable && fastForwardEnabled && (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white hover:text-white"
              >
                Fast-track ($50)
              </button>
            )}
            {!seatsAvailable && waitlistEnabled && (
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white hover:text-white"
              >
                Join waitlist
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-[#748199]">
          Need more than 30 paid pools? Contact the LiquiLab team for an enterprise quote — every additional 10 paid pools unlocks an extra bonus slot automatically.
        </p>
      </div>
    </section>
  );
}
