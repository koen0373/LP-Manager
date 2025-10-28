// Single source of truth for LiquiLab pricing

export const PRICE_PER_POOL_USD = 1.99;
export const BUNDLE_SIZE = 5 as const;

export type BillingCycle = 'month' | 'year';

function normalizePaidCapacity(paidCapacity: number): number {
  if (!Number.isFinite(paidCapacity) || paidCapacity < 0) {
    return 0;
  }
  return Math.floor(paidCapacity);
}

export function freeBonus(paidCapacityInput: number): number {
  const paidCapacity = normalizePaidCapacity(paidCapacityInput);
  if (paidCapacity <= 0) {
    // First pool is always free
    return 1;
  }

  if (paidCapacity <= BUNDLE_SIZE) {
    // 5-pack receives a single bonus slot (covers the free starter pool)
    return 1;
  }

  // Additional free capacity is granted on each multiple of 10 paid pools
  return Math.floor(paidCapacity / 10);
}

export function includedCapacity(paidCapacityInput: number): number {
  const paidCapacity = normalizePaidCapacity(paidCapacityInput);
  const bonus = freeBonus(paidCapacity);
  const capacity = paidCapacity + bonus;
  return capacity > 0 ? capacity : 0;
}

export function bundlesForActivePools(activePoolsInput: number): number {
  const activePools = Math.max(0, Math.floor(activePoolsInput));
  let paid = 0;

  while (includedCapacity(paid) < activePools) {
    paid += BUNDLE_SIZE;
    if (paid > 5000) {
      // Prevent runaway loops in unexpected scenarios
      break;
    }
  }

  return paid / BUNDLE_SIZE;
}

export function monthlyAmountUsdForPaidCapacity(paidCapacityInput: number): number {
  const paidCapacity = normalizePaidCapacity(paidCapacityInput);
  return Number((paidCapacity * PRICE_PER_POOL_USD).toFixed(2));
}

export function yearlyAmountUsdForPaidCapacity(paidCapacityInput: number): number {
  // Yearly billing = pay 10 months
  const monthly = monthlyAmountUsdForPaidCapacity(paidCapacityInput);
  return Number((monthly * 10).toFixed(2));
}

export function quote(activePoolsInput: number, billing: BillingCycle = 'month') {
  const activePools = Math.max(0, Math.floor(activePoolsInput));
  const bundles = bundlesForActivePools(activePools);
  const paidPools = bundles * BUNDLE_SIZE;
  const bonus = freeBonus(paidPools);
  const totalCapacity = includedCapacity(paidPools);

  const monthlyAmount = monthlyAmountUsdForPaidCapacity(paidPools);
  const amountUsd = billing === 'year' ? yearlyAmountUsdForPaidCapacity(paidPools) : monthlyAmount;

  return {
    ok: true,
    pricing: {
      billingCycle: billing,
      pricePerPoolUsd: PRICE_PER_POOL_USD,
      bundles,
      paidPools,
      freeBonus: bonus,
      totalCapacity,
      amountUsd,
      monthlyEquivalentUsd: monthlyAmount,
    },
    suggestion: {
      activePools,
      recommendedBundles: bundles,
      recommendedPaidPools: paidPools,
      recommendedCapacity: totalCapacity,
    },
  };
}
