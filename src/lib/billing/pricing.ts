export type PriceInput = {
  slots: number;
  alertsSelected: boolean;
};

type PlanConfig = {
  BASE5: number;
  EXTRA_SLOT: number;
  ALERTS_PACK5: number;
  UI_PACK_COPY: string;
};

const PLAN_ID = (process.env.LL_PRICING_PLAN || 'A').trim().toUpperCase();

const PLAN_A: PlanConfig = {
  BASE5: 14.95,
  EXTRA_SLOT: 1.99,
  ALERTS_PACK5: 2.49,
  UI_PACK_COPY: '+5 pools = +$9.95',
};

const PLAN_B: PlanConfig = {
  BASE5: 19.95,
  EXTRA_SLOT: 2.59,
  ALERTS_PACK5: 2.45,
  UI_PACK_COPY: '+5 pools = +$12.95',
};

const ACTIVE_PLAN = PLAN_ID === 'B' ? PLAN_B : PLAN_A;

export const ACTIVE_PLAN_ID = PLAN_ID === 'B' ? 'B' : 'A';
export const BASE5_USD = ACTIVE_PLAN.BASE5;
export const EXTRA_PER_SLOT_USD = ACTIVE_PLAN.EXTRA_SLOT;
export const ALERTS_PACK5_USD = ACTIVE_PLAN.ALERTS_PACK5;
export const UI_PACK_COPY = ACTIVE_PLAN.UI_PACK_COPY;

export type PriceBreakdownResult = {
  base5: number;
  extras: number;
  alerts: number;
  alertsPacks: number;
  total: number;
};

export function priceBreakdown({ slots, alertsSelected }: PriceInput): PriceBreakdownResult {
  const normalizedSlots = Math.max(5, Math.ceil(slots / 5) * 5);
  const base5 = +(BASE5_USD).toFixed(2);
  const extraBundles = Math.max(0, Math.ceil((normalizedSlots - 5) / 5));
  const extras = +(extraBundles * 9.95).toFixed(2);
  const alertsPacks = alertsSelected ? Math.ceil(normalizedSlots / 5) : 0;
  const alerts = +(alertsPacks * 2.49).toFixed(2);
  const total = +(base5 + extras + alerts).toFixed(2);

  return { base5, extras, alerts, alertsPacks, total };
}



