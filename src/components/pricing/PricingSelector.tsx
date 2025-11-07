'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { priceBreakdown, UI_PACK_COPY, type PriceBreakdownResult } from '@/lib/billing/pricing';

type ChangePayload = {
  slots: number;
  alertsSelected: boolean;
  breakdown: PriceBreakdownResult;
};

type Props = {
  initialSlots?: number;
  initialAlerts?: boolean;
  recommendedSlots?: number;
  onChange?: (payload: ChangePayload) => void;
};

const PACK_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

function normalizeSlots(value: number): number {
  return Math.max(5, Math.ceil(value / 5) * 5);
}

export default function PricingSelector({
  initialSlots = 5,
  initialAlerts = false,
  recommendedSlots,
  onChange,
}: Props) {
  const normalizedInitial = normalizeSlots(initialSlots);
  const [slots, setSlots] = useState<number>(normalizedInitial);
  const [alertsSelected, setAlertsSelected] = useState<boolean>(Boolean(initialAlerts));
  const userAdjustedRef = useRef(false);

  const breakdown = useMemo(
    () => priceBreakdown({ slots, alertsSelected }),
    [slots, alertsSelected],
  );

  useEffect(() => {
    onChange?.({ slots, alertsSelected, breakdown });
  }, [slots, alertsSelected, breakdown, onChange]);

  useEffect(() => {
    userAdjustedRef.current = false;
    setSlots(normalizeSlots(initialSlots));
    setAlertsSelected(Boolean(initialAlerts));
  }, [initialSlots, initialAlerts]);

  useEffect(() => {
    if (typeof recommendedSlots !== 'number') return;
    const normalized = normalizeSlots(recommendedSlots);
    if (!userAdjustedRef.current && normalized !== slots) {
      setSlots(normalized);
    }
  }, [recommendedSlots, slots]);

  useEffect(() => {
    if (!userAdjustedRef.current) return;
    const normalized = normalizeSlots(slots);
    if (normalized !== slots) {
      setSlots(normalized);
    }
  }, [slots]);

  function handleSetSlots(value: number) {
    userAdjustedRef.current = true;
    setSlots(normalizeSlots(value));
  }

  return (
    <section aria-labelledby="pricing-selector-title">
      <header>
        <h2 id="pricing-selector-title" className="font-brand text-xl text-white">
          Choose your capacity
        </h2>
        <p className="mt-2 font-ui text-sm text-white/70">
          Premium starts at 5 pools. Increase in packs of 5 as you grow.
        </p>
      </header>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PACK_OPTIONS.map((pack) => {
          const value = pack * 5;
          const isActive = slots === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleSetSlots(value)}
              className={`rounded-xl px-3 py-2 font-ui text-sm font-semibold tabular-nums transition ${
                isActive
                  ? 'bg-[#3B82F6] text-[#0A0F1C]'
                  : 'border border-white/10 bg-white/10 text-white hover:border-white/20 hover:bg-white/15'
              }`}
            >
              {value}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input
          id="pricing-alerts-checkbox"
          type="checkbox"
          className="h-4 w-4 rounded border border-white/30 bg-white/10 text-[#3B82F6] focus:ring-[#3B82F6]"
          checked={alertsSelected}
          onChange={(event) => {
            userAdjustedRef.current = true;
            setAlertsSelected(event.target.checked);
          }}
        />
        <label
          htmlFor="pricing-alerts-checkbox"
          className="font-ui text-sm text-white/80"
        >
          Add <span className="font-semibold">RangeBand™ Alerts</span> (+$2.49 / 5 pools) to get an
          email when your position approaches or leaves its range.
        </label>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <ul className="space-y-1 font-ui text-sm text-white/80">
          <li className="flex items-center justify-between">
            <span>Base (5 pools)</span>
            <span className="font-mono tabular-nums">${breakdown.base5.toFixed(2)}</span>
          </li>
          <li className="flex items-center justify-between">
            <span>{UI_PACK_COPY}</span>
            <span className="font-mono tabular-nums">${breakdown.extras.toFixed(2)}</span>
          </li>
          <li className="flex items-center justify-between">
            <span>
              Alerts packs {alertsSelected ? `(×${breakdown.alertsPacks})` : ''}
            </span>
            <span className="font-mono tabular-nums">${breakdown.alerts.toFixed(2)}</span>
          </li>
          <li className="mt-2 flex items-center justify-between font-semibold text-white">
            <span>Total</span>
            <span className="font-mono tabular-nums text-lg">${breakdown.total.toFixed(2)}</span>
          </li>
        </ul>
      </div>
    </section>
  );
}



