// Single source of truth for LiquiLab pricing

export const PRICE_PER_POOL_USD = 1.99
export const BUNDLE_SIZE = 5 as const

export type BillingCycle = 'month' | 'year'

export function freeBonus(paidCapacity: number): number {
  // Rule: +1 free per 10 paid pools (5-tier gets +1 as well): ceil(paid/10)
  if (paidCapacity <= 0) return 0
  return Math.ceil(paidCapacity / 10)
}

export function includedCapacity(paidCapacity: number): number {
  return paidCapacity + freeBonus(paidCapacity)
}

export function bundlesForActivePools(activePools: number): number {
  // Find the smallest multiple of 5 whose included capacity >= activePools
  let paid = 0
  while (includedCapacity(paid) < Math.max(0, activePools)) {
    paid += BUNDLE_SIZE
  }
  return paid / BUNDLE_SIZE
}

export function quote(activePools: number, billing: BillingCycle = 'month') {
  const bundles = bundlesForActivePools(activePools)
  const paidPools = bundles * BUNDLE_SIZE
  const bonus = freeBonus(paidPools)
  const capacity = paidPools + bonus

  const monthly = +(paidPools * PRICE_PER_POOL_USD).toFixed(2)
  const amount = billing === 'year' ? +(monthly * 10).toFixed(2) : monthly

  return {
    ok: true,
    pricing: {
      billingCycle: billing,
      pricePerPoolUsd: PRICE_PER_POOL_USD,
      bundles,
      paidPools,
      freeBonus: bonus,
      totalCapacity: capacity,
      amountUsd: amount,
      monthlyEquivalentUsd: monthly
    },
    suggestion: {
      activePools,
      recommendedBundles: bundles,
      recommendedPaidPools: paidPools,
      recommendedCapacity: capacity
    }
  }
}
