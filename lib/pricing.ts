/**
 * Pricing helpers - Single Source of Truth integration
 * 
 * Computes pricing quotes based on plan, pools, and alerts configuration.
 * Validates against examples in config/pricing.json.
 */

import pricingConfig from '@/config/pricing.json';

export type Plan = 'VISITOR' | 'PREMIUM' | 'PRO' | 'ENTERPRISE';

export interface PricingConfig {
  version: string;
  currency: string;
  bundles: {
    size_pools: number;
  };
  plans: {
    [K in Plan]?: {
      price: number;
      bundles_included: number;
      extra_bundle_price?: number;
      alerts_bundle_price?: number;
      trial_days?: number;
      features: string[];
    };
  };
  rules: {
    billing_cycle: string;
    cancel_anytime: boolean;
    alerts_scale_per: string;
    enterprise_on_request: boolean;
  };
  examples: Array<{
    plan: Plan;
    pools: number;
    alerts: boolean;
    expected_total: number;
  }>;
}

export interface PriceQuote {
  total: number;
  base: number;
  extraBundles: number;
  alertBundles: number;
  currency: string;
  version: string;
}

/**
 * Calculate bundles needed for given number of pools
 */
function calculateBundles(pools: number, bundleSize: number): number {
  return Math.ceil(pools / bundleSize);
}

/**
 * Generate a price quote for a given plan, pools, and alerts configuration
 */
export function priceQuote(params: {
  plan: Plan;
  pools: number;
  alerts: boolean;
}): PriceQuote {
  const { plan, pools, alerts } = params;
  const config = pricingConfig as PricingConfig;
  const planConfig = config.plans[plan];

  if (!planConfig) {
    throw new Error(`Plan "${plan}" not found in pricing config`);
  }

  const bundleSize = config.bundles.size_pools;
  const totalBundles = calculateBundles(pools, bundleSize);
  const bundlesIncluded = planConfig.bundles_included || 0;
  const extraBundles = Math.max(0, totalBundles - bundlesIncluded);

  // Base plan price
  const base = planConfig.price || 0;

  // Extra bundles cost
  const extraBundlePrice = planConfig.extra_bundle_price || 0;
  const extraBundlesCost = extraBundles * extraBundlePrice;

  // Alerts cost (scales per bundle)
  const alertsBundlePrice = planConfig.alerts_bundle_price || 0;
  const alertBundles = alerts ? totalBundles : 0;
  const alertsCost = alertBundles * alertsBundlePrice;

  const total = base + extraBundlesCost + alertsCost;

  return {
    total: Math.round(total * 100) / 100, // Round to 2 decimals
    base,
    extraBundles,
    alertBundles,
    currency: config.currency,
    version: config.version,
  };
}

/**
 * Validate pricing calculations against examples in config
 */
export function validatePricing(): void {
  const config = pricingConfig as PricingConfig;

  for (const example of config.examples) {
    const quote = priceQuote({
      plan: example.plan,
      pools: example.pools,
      alerts: example.alerts,
    });

    if (Math.abs(quote.total - example.expected_total) > 0.01) {
      throw new Error(
        `Pricing validation failed for ${example.plan} (${example.pools} pools, alerts: ${example.alerts}): ` +
        `Expected ${example.expected_total}, got ${quote.total}`
      );
    }
  }
}

/**
 * Get pricing config (read-only)
 */
export function getPricingConfig(): PricingConfig {
  return pricingConfig as PricingConfig;
}

