'use client';

import React from 'react';
import Link from 'next/link';

import { SUBSCRIPTION_PLANS } from '@/data/subscriptionPlans';

interface PricingPanelProps {
  highlight?: 'waitlist' | 'fasttrack';
}

const formatAnnualPrice = (value: number | null): string => {
  if (value == null) {
    return 'Custom pricing';
  }
  return `$${value.toFixed(2)}/year`;
};

const formatMonthlyEquivalent = (value: number | null): string => {
  if (value == null) {
    return 'Enterprise onboarding currently handled via the priority list.';
  }
  return `Monthly equivalent: $${value.toFixed(2)}`;
};

const resolveCtaLabel = (planLabel?: string): string => planLabel ?? 'Start free trial';

export function PricingPanel({ highlight }: PricingPanelProps) {
  const [billingCycle, setBillingCycle] = React.useState<'annual' | 'monthly'>('annual');

  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/5 bg-[rgba(10,15,26,0.85)] p-8 backdrop-blur-xl md:p-12">
      {/* Subtle radial gradient - softer */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(110,168,255,0.08),transparent_60%)]" />

      <div className="relative z-10 flex flex-col gap-8">
        {/* Badge - softer glow */}
        <span
          className="w-fit rounded-full border border-liqui-aqua/30 bg-liqui-aqua/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-liqui-aqua/90"
          aria-label="14-day free trial included"
        >
          14-DAY FREE TRIAL INCLUDED
        </span>

        {/* Header */}
        <div className="space-y-4">
          <h2 className="font-brand text-3xl font-semibold leading-tight text-white md:text-4xl">
            Choose your Liquidity Journey
          </h2>
          <p className="font-ui text-[15px] leading-relaxed text-[#B0B9C7] md:text-base">
            Try LiquiLab free for 14 days — no payment until your trial ends. Simple annual plans with optional monthly billing.
          </p>
        </div>

        {/* Billing Toggle - softer styling */}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setBillingCycle('annual')}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-liqui-aqua/50 ${
              billingCycle === 'annual'
                ? 'border-liqui-aqua/40 bg-liqui-aqua/8 text-liqui-aqua shadow-[0_0_8px_rgba(110,168,255,0.06)]'
                : 'border-white/10 text-[#B0B9C7] hover:border-liqui-aqua/25 hover:text-white/90'
            }`}
            aria-pressed={billingCycle === 'annual'}
          >
            <span className="block text-left">
              Annual billing
              <span className="block text-[11px] font-normal text-[#8891A0]">
                Best value · pay after your 14-day trial
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle('monthly')}
            className={`rounded-full border px-4 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-liqui-aqua/50 ${
              billingCycle === 'monthly'
                ? 'border-liqui-aqua/40 bg-liqui-aqua/8 text-liqui-aqua shadow-[0_0_8px_rgba(110,168,255,0.06)]'
                : 'border-white/10 text-[#B0B9C7] hover:border-liqui-aqua/25 hover:text-white/90'
            }`}
            aria-pressed={billingCycle === 'monthly'}
          >
            <span className="block text-left">
              Monthly billing
              <span className="block text-[11px] font-normal text-[#8891A0]">
                Flexible · cancel anytime during trial
              </span>
            </span>
          </button>
        </div>

        {/* Plan Cards - RESTORED GLASS AESTHETIC */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {SUBSCRIPTION_PLANS.map((plan) => {
            const displayPrice = billingCycle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
            const priceLabel =
              billingCycle === 'annual'
                ? formatAnnualPrice(displayPrice)
                : displayPrice
                ? `$${displayPrice.toFixed(2)}/month`
                : 'Custom pricing';
            const subLabel =
              billingCycle === 'annual' ? formatMonthlyEquivalent(plan.monthlyPrice) : 'Billed every 30 days';
            const href = plan.ctaHref ?? '/waitlist';

            return (
              <div
                key={plan.id}
                className="pricing-card group relative flex min-h-[460px] flex-col overflow-hidden rounded-2xl border border-white/5 bg-[rgba(10,15,26,0.85)] p-6 shadow-[0_4px_16px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-all duration-300 ease-in-out hover:-translate-y-1 hover:border-liqui-aqua/20 hover:shadow-[0_8px_24px_rgba(0,0,0,0.3),0_0_16px_rgba(110,168,255,0.08)]"
              >
                {/* Subtle gradient overlay */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: 'linear-gradient(180deg, rgba(110,168,255,0.03) 0%, transparent 100%)',
                  }}
                />

                {/* Trial badge - repositioned */}
                <span className="absolute right-5 top-5 rounded-full border border-liqui-aqua/20 bg-liqui-aqua/6 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-liqui-aqua/80" aria-label="14-day trial badge">
                  14-DAY TRIAL
                </span>

                <div className="relative z-10 flex h-full flex-col" style={{ gap: '8px' }}>
                  {/* Plan name & pool limit - 8px spacing */}
                  <div className="space-y-2 pt-2">
                    <h3 className="font-brand text-[28px] font-semibold leading-tight text-white">{plan.name}</h3>
                    <p className="font-ui text-[14px] leading-relaxed text-[#B0B9C7]">{plan.poolLimitLabel}</p>
                  </div>

                  {/* Pricing - 8px rhythm, min-height for alignment */}
                  <div className="mt-4 min-h-[88px] space-y-1">
                    <div className="tnum font-ui text-[32px] font-bold leading-tight text-white">{priceLabel}</div>
                    <p className="font-ui text-[13px] leading-snug text-[#8891A0]" style={{ paddingTop: '4px' }}>
                      {subLabel}
                    </p>
                  </div>

                  {/* Description - consistent line-height */}
                  <p className="font-ui text-[14px] leading-[1.6] text-[#B0B9C7]" style={{ marginTop: '8px' }}>
                    {plan.description}
                  </p>

                  {/* CTA — always at bottom, softer hover */}
                  <div className="mt-auto flex flex-col gap-2.5" style={{ paddingTop: '16px' }}>
                    {plan.id === 'tide' ? (
                      <>
                        <Link
                          href="/waitlist"
                          className="cta-secondary inline-flex items-center justify-center rounded-xl border border-liqui-aqua/30 px-4 py-2.5 text-[14px] font-semibold text-liqui-aqua transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-liqui-aqua/50 hover:border-liqui-aqua/50 hover:bg-liqui-aqua/6 hover:shadow-[0_0_8px_rgba(110,168,255,0.08)]"
                        >
                          Join priority list
                        </Link>
                        <Link
                          href="/contact?plan=tide"
                          className="cta-primary inline-flex items-center justify-center rounded-xl bg-[#6EA8FF] px-4 py-2.5 text-[14px] font-semibold text-[#0A0F1C] transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-liqui-aqua/50 hover:bg-[#78B5FF] hover:shadow-[0_0_10px_rgba(110,168,255,0.15)]"
                        >
                          Start free trial
                        </Link>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="cta-primary inline-flex items-center justify-center rounded-xl bg-[#6EA8FF] px-4 py-2.5 text-[14px] font-semibold text-[#0A0F1C] transition-all duration-200 hover:bg-[#78B5FF] hover:shadow-[0_0_10px_rgba(110,168,255,0.15)] disabled:cursor-wait disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-liqui-aqua/50"
                        aria-label="Start 14-day free trial, no payment until trial ends"
                      >
                        {resolveCtaLabel(plan.ctaLabel)}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note - improved contrast */}
        <p className="font-ui text-center text-[14px] leading-relaxed text-[#8891A0]">
          Every Liquidity Journey plan starts with a 14-day free trial. Authorize your preferred billing cycle today — no charge until your trial ends.
        </p>
      </div>
    </section>
  );
}
