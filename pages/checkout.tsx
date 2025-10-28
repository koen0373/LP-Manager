'use client';

import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { LiquiLabLogo } from '@/components/LiquiLabLogo';
import { Button } from '@/components/ui/Button';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import {
  FREE_POOLS,
  PRICE_PER_POOL_USD,
  ANNUAL_MULTIPLIER,
} from '@/data/subscriptionPlans';
import { track } from '@/lib/analytics';

type BillingCycle = 'month' | 'year';

type BillingPreviewResponse = {
  pricing: {
    billingCycle: BillingCycle;
    pricePerPoolUsd: number;
    freePools: number;
    paidPools: number;
    totalCapacity: number;
    amountUsd: number;
    monthlyEquivalentUsd: number;
  };
  suggestion?: {
    activePools: number;
    recommendedPaidPools: number;
    recommendedCapacity: number;
  };
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

export default function CheckoutPage() {
  const router = useRouter();
  const [billingCycle, setBillingCycle] = React.useState<BillingCycle>('month');
  const [suggestedPools, setSuggestedPools] = React.useState<number>(FREE_POOLS);
  const [quote, setQuote] = React.useState<BillingPreviewResponse | null>(null);
  const [isFetchingQuote, setIsFetchingQuote] = React.useState(false);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);

  const [email, setEmail] = React.useState('');
  const [company, setCompany] = React.useState('');
  const [vat, setVat] = React.useState('');
  const [showInvoiceFields, setShowInvoiceFields] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [feedback, setFeedback] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!router.isReady) return;

    const rawCapacity =
      router.query.desiredCapacity ??
      router.query.activePools ??
      router.query.suggested;
    const parsed =
      typeof rawCapacity === 'string' ? rawCapacity : rawCapacity?.[0];
    const numeric = Number(parsed);
    if (Number.isFinite(numeric) && numeric > 0) {
      setSuggestedPools(Math.max(FREE_POOLS, Math.floor(numeric)));
    } else {
      setSuggestedPools(FREE_POOLS);
    }

    const rawBilling = router.query.billingCycle;
    const billingParam =
      typeof rawBilling === 'string' ? rawBilling : rawBilling?.[0];
    if (billingParam === 'year' || billingParam === 'month') {
      setBillingCycle(billingParam);
    }
  }, [router.isReady, router.query.activePools, router.query.billingCycle, router.query.desiredCapacity, router.query.suggested]);

  React.useEffect(() => {
    if (!suggestedPools) return;

    const controller = new AbortController();
    let cancelled = false;

    async function loadQuote() {
      setIsFetchingQuote(true);
      setQuoteError(null);
      try {
        const params = new URLSearchParams({
          activePools: String(suggestedPools),
          billingCycle,
        });
        const response = await fetch(`/api/billing/preview?${params.toString()}`, {
          method: 'GET',
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        const data = (await response.json()) as BillingPreviewResponse;
        if (!cancelled) {
          setQuote(data);
        }
      } catch (error) {
        if (cancelled) return;
        setQuoteError(
          error instanceof Error ? error.message : 'Cannot fetch billing preview right now.',
        );
      } finally {
        if (!cancelled) {
          setIsFetchingQuote(false);
        }
      }
    }

    loadQuote();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [billingCycle, suggestedPools]);

  React.useEffect(() => {
    track('checkout_viewed', { billingCycle });
  }, [billingCycle]);

  const capacity = quote?.pricing.totalCapacity ?? suggestedPools;
  const freePools = quote?.pricing.freePools ?? FREE_POOLS;
  const paidPools = quote?.pricing.paidPools ?? Math.max(0, capacity - freePools);
  const pricePerPool = quote?.pricing.pricePerPoolUsd ?? PRICE_PER_POOL_USD;
  const amount = quote?.pricing.amountUsd ?? Number((paidPools * pricePerPool * (billingCycle === 'year' ? ANNUAL_MULTIPLIER : 1)).toFixed(2));
  const monthlyEquivalent =
    quote?.pricing.monthlyEquivalentUsd ??
    Number((paidPools * pricePerPool).toFixed(2));

  const emailValid = React.useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  const handleToggleBilling = React.useCallback(() => {
    setBillingCycle((current) => (current === 'month' ? 'year' : 'month'));
  }, []);

  const handleSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!emailValid) return;

      setIsSubmitting(true);
      setFeedback(null);
      try {
        await new Promise((resolve) => setTimeout(resolve, 900));
        track('payment_success', {
          billingCycle,
          amountUsd: amount,
          suggested: suggestedPools,
        });
        setFeedback('Payment captured. You now follow your selected pools.');
      } catch (error) {
        track('payment_error', {
          billingCycle,
          error: error instanceof Error ? error.message : 'unknown',
        });
        setFeedback('Payment failed. Try again or contact support.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [amount, billingCycle, emailValid, suggestedPools],
  );

  return (
    <>
      <Head>
        <title>Checkout · LiquiLab</title>
      </Head>

      <div className="relative min-h-screen overflow-hidden text-white">
        <div className="page-bg" aria-hidden="true" />
        <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-4xl flex-col px-6 pb-20 pt-10 sm:px-10">
          <header className="flex items-center justify-between">
            <LiquiLabLogo variant="full" size="sm" theme="dark" />
            <Link
              href="/login"
              className="text-sm font-semibold text-white/80 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
            >
              Sign in
            </Link>
          </header>

          <main className="mt-12 flex flex-col gap-12 sm:mt-16">
            <ProgressSteps current="checkout" />

            <section className="rounded-3xl border border-white/10 bg-[rgba(10,15,26,0.82)] px-6 py-10 backdrop-blur-xl sm:px-10">
              <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h1 className="font-brand text-3xl font-semibold text-white sm:text-4xl">
                    Start following your pools
                  </h1>
                  <p className="mt-2 text-sm text-white/60">
                    Suggested capacity:{' '}
                    <span className="tnum text-white">
                      {suggestedPools}
                    </span>{' '}
                    pools
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleBilling}
                  className="self-start text-sm font-semibold text-[#6EA8FF] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6EA8FF]/60"
                >
                  {billingCycle === 'month' ? 'Pay annually — 2 months free' : 'Switch to monthly billing'}
                </button>
              </header>

              <div className="mt-8 flex flex-col gap-8">
                <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm backdrop-blur">
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                      Included capacity
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-lg font-semibold text-white">
                      <span className="rounded-full bg-[#6EA8FF]/10 px-3 py-1 text-[#6EA8FF]">
                        You can follow{' '}
                        <span className="tnum text-white">{capacity}</span>{' '}
                        pools now
                      </span>
                      <span className="text-sm text-white/60">
                        Free:{' '}
                        <span className="tnum text-white">{freePools}</span> · Paid:{' '}
                        <span className="tnum text-white">{paidPools}</span> · $
                        {pricePerPool.toFixed(2)}/month per additional pool
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 text-sm text-white/70">
                    <span>
                      Billing: {billingCycle === 'month' ? 'Monthly' : 'Annual (10× monthly)'}
                    </span>
                    <span>
                      Due today:{' '}
                      <strong className="tnum text-white">
                        {isFetchingQuote ? '…' : formatCurrency(amount)}
                      </strong>{' '}
                      {billingCycle === 'month' ? 'per month' : 'per year'}
                    </span>
                    {billingCycle === 'year' ? (
                      <span className="text-xs text-white/50">
                        Effective monthly cost:{' '}
                        <span className="tnum text-white/80">
                          {formatCurrency(monthlyEquivalent)}
                        </span>
                        /mo
                      </span>
                    ) : null}
                    {quoteError ? (
                      <span className="text-xs text-[#FFA500]">{quoteError}</span>
                    ) : null}
                  </div>
                </div>

                <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="email" className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
                      Invoice email
                    </label>
                    <input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className="h-12 rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 focus:border-[#6EA8FF] focus:outline-none focus:ring-2 focus:ring-[#6EA8FF]/40"
                      placeholder="founder@liquilab.io"
                    />
                    {!emailValid && email.length > 0 ? (
                      <span className="text-xs text-[#FFA500]">Enter a valid email address.</span>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <button
                      type="button"
                      onClick={() => setShowInvoiceFields((value) => !value)}
                      className="flex items-center justify-between text-sm font-semibold text-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6EA8FF]/60"
                    >
                      Company & VAT details (optional)
                      <span className="text-xs text-white/50">{showInvoiceFields ? 'Hide' : 'Add'}</span>
                    </button>
                    {showInvoiceFields ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="flex flex-col gap-2">
                          <label htmlFor="company" className="text-xs uppercase tracking-[0.18em] text-white/40">
                            Company name
                          </label>
                          <input
                            id="company"
                            value={company}
                            onChange={(event) => setCompany(event.target.value)}
                            className="h-11 rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 focus:border-[#6EA8FF] focus:outline-none focus:ring-2 focus:ring-[#6EA8FF]/40"
                            placeholder="LiquiLab BV"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label htmlFor="vat" className="text-xs uppercase tracking-[0.18em] text-white/40">
                            VAT / Tax ID
                          </label>
                          <input
                            id="vat"
                            value={vat}
                            onChange={(event) => setVat(event.target.value)}
                            className="h-11 rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 focus:border-[#6EA8FF] focus:outline-none focus:ring-2 focus:ring-[#6EA8FF]/40"
                            placeholder="NL123456789B01"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-3">
                    <Button type="submit" loading={isSubmitting} disabled={!emailValid || isFetchingQuote || isSubmitting}>
                      Pay now
                    </Button>
                    {feedback ? (
                      <p className="text-sm text-white/70">{feedback}</p>
                    ) : (
                      <p className="text-xs text-white/40">
                        Upgrades prorate instantly. Downgrades take effect on renewal.
                      </p>
                    )}
                  </div>
                </form>
              </div>
            </section>
          </main>
        </div>
      </div>
    </>
  );
}
