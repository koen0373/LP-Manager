const PRICE_PER_POOL_EUR = 1.99;
const NOTIF_PER_5_EUR = 2.50;
const STEP = 5;

export function formatEUR(amount: number): string {
  if (!Number.isFinite(amount)) return '€0.00';
  return new Intl.NumberFormat('nl-NL', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calcPoolsCost(paidPools: number): number {
  return Number((paidPools * PRICE_PER_POOL_EUR).toFixed(2));
}

export function calcNotifCost(paidPools: number, enabled: boolean): number {
  if (!enabled || paidPools === 0) return 0;
  const sets = Math.ceil(paidPools / STEP);
  return Number((sets * NOTIF_PER_5_EUR).toFixed(2));
}

export function calcTotal(paidPools: number, notificationsEnabled: boolean): number {
  const poolsCost = calcPoolsCost(paidPools);
  const notifCost = calcNotifCost(paidPools, notificationsEnabled);
  return Number((poolsCost + notifCost).toFixed(2));
}

export function nextTierFor(count: number): number {
  if (count <= 0) return STEP;
  return Math.ceil(count / STEP) * STEP;
}






