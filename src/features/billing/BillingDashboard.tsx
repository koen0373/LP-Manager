'use client';

import React from 'react';
import Link from 'next/link';

import { SUBSCRIPTION_PLANS, SubscriptionPlan, SubscriptionPlanId } from '@/data/subscriptionPlans';

interface BillingDashboardProps {
  walletId?: number;
  initialPlanId?: SubscriptionPlanId;
}

type BillingCycle = 'annual' | 'monthly';

const BILLING_CYCLES: { id: BillingCycle; label: string; helper: string }[] = [
  {
    id: 'annual',
    label: 'Annual billing',
    helper: 'Best value · pay after your 14-day trial',
  },
  {
    id: 'monthly',
    label: 'Monthly billing',
    helper: 'Flexible · cancel anytime during trial',
  },
];

const formatPriceLabel = (plan: SubscriptionPlan, cycle: BillingCycle): string => {
  const value = cycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
  if (value == null) {
    return 'Custom pricing';
  }
  const suffix = cycle === 'annual' ? '/year' : '/month';
  return `$${value.toFixed(2)}${suffix}`;
};

const monthlyText = (plan: SubscriptionPlan, cycle: BillingCycle): string => {
  if (plan.monthlyPrice == null) {
    return 'Talk to us for tailored enterprise onboarding.';
  }
  if (cycle === 'annual') {
    return `Monthly equivalent: $${plan.monthlyPrice.toFixed(2)}`;
  }
  return 'Billed every 30 days';
};

export function BillingDashboard({ walletId, initialPlanId = 'shallow' }: BillingDashboardProps) {
  const defaultPlan = React.useMemo(
    () => SUBSCRIPTION_PLANS.find((plan) => plan.id === initialPlanId) ?? SUBSCRIPTION_PLANS[0],
    [initialPlanId],
  );
  const [selectedPlan, setSelectedPlan] = React.useState<SubscriptionPlan>(defaultPlan);
  const [cycle, setCycle] = React.useState<BillingCycle>('annual');

  const priceLabel = formatPriceLabel(selectedPlan, cycle);
  const secondaryText = monthlyText(selectedPlan, cycle);

  return (
    <section className="space-y-6 rounded-3xl border border-liqui-border bg-liqui-card/60 p-6">
      <header className="space-y-2">
        <h2 className="font-brand text-2xl font-semibold text-white">Plan preview</h2>
        <p className="font-ui text-sm text-liqui-subtext">
          Every Liquidity Journey plan starts with a 14-day free trial. Authorise your preferred billing cycle today — no
          charge until the trial ends.
        </p>
      </header>

      <div className="flex flex-wrap gap-3">
        {BILLING_CYCLES.map(({ id, label, helper }) => {
          const isActive = cycle === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setCycle(id)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'border-liqui-aqua bg-liqui-aqua/10 text-liqui-aqua'
                  : 'border-liqui-border text-liqui-subtext hover:border-liqui-aqua/60 hover:text-liqui-aqua'
              }`}
            >
              <span className="block text-left">
                {label}
                <span className="block text-[11px] font-normal text-liqui-subtext">{helper}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {SUBSCRIPTION_PLANS.map((plan) => {
          const isSelected = selectedPlan.id === plan.id;
          const cardPrice = formatPriceLabel(plan, cycle);
          const cardSecondary = monthlyText(plan, cycle);

          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlan(plan)}
              className={`rounded-2xl border p-5 text-left transition ${
                isSelected
                  ? 'border-liqui-aqua bg-liqui-aqua/10 shadow-lg shadow-liqui-aqua/15'
                  : 'border-liqui-border bg-liqui-card/70 hover:border-liqui-aqua/60'
              }`}
            >
              <div className="flex flex-col gap-3">
                <span className="font-brand text-xl font-semibold text-white">{plan.name}</span>
                <span className="font-ui text-sm text-liqui-subtext">{plan.poolLimitLabel}</span>
                <div className="font-ui text-2xl font-semibold text-white">{cardPrice}</div>
                <span className="font-ui text-xs text-liqui-subtext">{cardSecondary}</span>
                <span className="font-ui text-sm text-liqui-subtext">{plan.description}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-liqui-border bg-liqui-card-hover/40 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="font-brand text-lg font-semibold text-white">
              {selectedPlan.name} plan · {priceLabel}
            </p>
            <p className="font-ui text-sm text-liqui-subtext">
              {selectedPlan.monthlyPrice == null
                ? 'Enterprise onboarding currently happens through our priority list.'
                : 'Switch billing cycle or change plan anytime during your trial.'}
            </p>
            <p className="font-ui text-xs text-liqui-subtext">{secondaryText}</p>
          </div>
          <div className="flex flex-col gap-2 md:items-end">
            <Link
              href={selectedPlan.ctaHref ?? '/waitlist'}
              className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition ${
                selectedPlan.id === 'tide'
                  ? 'border border-liqui-aqua text-liqui-aqua hover:bg-liqui-aqua/10'
                  : 'bg-liqui-aqua text-liqui-navy hover:bg-liqui-aqua/80'
              }`}
            >
              {selectedPlan.ctaLabel ?? 'Start free trial'}
            </Link>
            {walletId ? (
              <span className="font-ui text-[11px] uppercase tracking-wide text-liqui-subtext">
                Wallet ID: {walletId}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
