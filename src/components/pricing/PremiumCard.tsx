'use client';

import { useMemo, useState } from 'react';

import PackStepper from '@/components/pricing/PackStepper';
import { priceBreakdown, type PriceBreakdownResult } from '@/lib/billing/pricing';

type PremiumCardProps = {
  showExtras?: boolean;
  fullWidth?: boolean;
};

const FEATURES = [
  'Direct overview — TVL, balances, and fee tier',
  'RangeBand™ pool health — status & current price at a glance',
  'Fees — 24h / 7d / lifetime and unclaimed',
  'Incentives & APR — when available',
  'Activity timeline — mints/adds/removes & fees claimed',
  'Price chart — pair trend with RangeBand overlay',
  'Calendar — upcoming fee windows & key events',
  'Token breakdown — value per token',
  'Deep link to your pool — open on the DEX',
  'Optional email alerts — add-on',
] as const;

const MIN_SLOTS = 5;

function normalizeSlots(value: number) {
  if (!Number.isFinite(value)) return MIN_SLOTS;
  const clamped = Math.max(MIN_SLOTS, Math.round(value));
  return Math.max(MIN_SLOTS, Math.ceil(clamped / 5) * 5);
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      fill="none"
      className="h-3.5 w-3.5"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path d="M3.5 8.5 6.4 11l6.1-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PremiumCard({ showExtras = true, fullWidth = false }: PremiumCardProps) {
  const [slots, setSlots] = useState<number>(MIN_SLOTS);
  const [alertsSelected, setAlertsSelected] = useState<boolean>(false);

  const breakdown: PriceBreakdownResult = useMemo(
    () => priceBreakdown({ slots, alertsSelected }),
    [slots, alertsSelected],
  );

  const extraBundles = Math.max(0, (slots - MIN_SLOTS) / MIN_SLOTS);

  return (
    <article className={`card flex flex-col gap-6 ${fullWidth ? 'w-full' : ''}`}>
      <div className="md:grid md:grid-cols-2 md:gap-6">
        <div className="space-y-4">
          <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">What you get</p>
          <ul className="space-y-2.5">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex gap-3 text-sm text-white/85">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10">
                  <CheckIcon />
                </span>
                <span className="font-ui">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 space-y-5 md:mt-0">
          <header className="space-y-2">
            <p className="font-ui text-xs uppercase tracking-[0.25em] text-white/60">Plan</p>
            <h3 className="font-brand text-3xl font-semibold text-white">Premium</h3>
          </header>

          <div className="space-y-3">
            <div className="flex items-baseline gap-3">
              <span className="font-num text-5xl font-semibold text-white">$14.95</span>
              <span className="font-ui text-sm text-white/80">/ month</span>
            </div>
            <span className="inline-flex items-center gap-2 rounded-[8px] bg-white/10 px-3 py-1 font-ui text-xs text-white/75">
              5 pools included
            </span>
          </div>

          {showExtras && (
            <div className="space-y-5">
              <div className="space-y-2">
                <PackStepper value={slots} onChange={(next) => setSlots(normalizeSlots(next))} />
                <p className="font-ui text-xs text-white/60">
                  Add 5-pool bundles (+$9.95/month each)
                </p>
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white/10 p-4 font-ui text-sm text-white/85 transition hover:bg-white/15">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border border-white/30 bg-white/10 text-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#60A5FA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1530]"
                  checked={alertsSelected}
                  onChange={() => setAlertsSelected((prev) => !prev)}
                />
                <div>
                  <p className="font-ui">
                    RangeBand™ Alerts
                  </p>
                  <p className="font-ui text-xs text-white/60">
                    Email alerts —
                    <span className="ml-1 font-num text-white/75">$2.49</span> per 5-pool pack
                  </p>
                </div>
              </label>

              <dl className="space-y-3 rounded-2xl bg-white/8 p-4 font-ui text-sm text-white/80">
                <div className="flex items-center justify-between">
                  <dt>Plan base (5 pools)</dt>
                  <dd className="font-num text-white/90">${breakdown.base5.toFixed(2)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-2">
                    Additional bundles
                    {extraBundles > 0 && (
                      <span className="font-num text-white/70">+{extraBundles.toFixed(0)}</span>
                    )}
                  </dt>
                  <dd className="font-num text-white/90">${breakdown.extras.toFixed(2)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>
                    Alerts packs
                    {alertsSelected && (
                      <span className="ml-1 font-num text-white/70">×{breakdown.alertsPacks}</span>
                    )}
                  </dt>
                  <dd className="font-num text-white/90">${breakdown.alerts.toFixed(2)}</dd>
                </div>
                <div className="divider" />
                <div className="flex items-center justify-between font-semibold text-white">
                  <dt>Total per month</dt>
                  <dd className="font-num text-lg">${breakdown.total.toFixed(2)}</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="divider" />
        <a href="/sales/offer" className="btn-primary">
          Start 14-day free trial
        </a>
        <p className="font-ui text-xs text-white/60">
          After trial: $14.95/mo for 5 pools. Each extra 5-pool bundle: +$9.95/mo. RangeBand™ Alerts:
          $2.49 per 5-pool pack. Taxes extra. Cancel any time.
        </p>
      </div>
    </article>
  );
}
