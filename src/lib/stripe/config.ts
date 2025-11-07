/**
 * Stripe Configuration & Price IDs
 * Freemium v2: BASE_5, POOL_SLOT, ALERTS_PACK_5
 */

export type StripePriceConfig = {
  PREMIUM_BASE_5?: string;
  POOL_SLOT?: string;
  ALERTS_PACK_5?: string;
};

/**
 * Get Stripe price IDs from environment
 */
export function getStripePriceConfig(): StripePriceConfig {
  return {
    PREMIUM_BASE_5: process.env.LL_STRIPE_PRICE_PREMIUM_BASE_5,
    POOL_SLOT: process.env.LL_STRIPE_PRICE_POOL_SLOT,
    ALERTS_PACK_5: process.env.LL_STRIPE_PRICE_ALERTS_PACK_5,
  };
}

/**
 * Validate that all required Stripe price IDs are configured
 */
export function validateStripeConfig(): { valid: boolean; missing: string[] } {
  const config = getStripePriceConfig();
  const missing: string[] = [];
  
  if (!config.PREMIUM_BASE_5) missing.push('LL_STRIPE_PRICE_PREMIUM_BASE_5');
  if (!config.POOL_SLOT) missing.push('LL_STRIPE_PRICE_POOL_SLOT');
  if (!config.ALERTS_PACK_5) missing.push('LL_STRIPE_PRICE_ALERTS_PACK_5');
  
  return {
    valid: missing.length === 0,
    missing,
  };
}

/**
 * Build Stripe line items for checkout
 */
export function buildStripeLineItems({
  slots,
  alertsSelected,
}: {
  slots: number;
  alertsSelected: boolean;
}): Array<{ price: string; quantity: number }> | null {
  const config = getStripePriceConfig();
  const validation = validateStripeConfig();
  
  if (!validation.valid) {
    console.warn('[Stripe] Missing price IDs:', validation.missing);
    return null;
  }
  
  const lineItems: Array<{ price: string; quantity: number }> = [];
  
  // Base 5 pools (always included)
  lineItems.push({
    price: config.PREMIUM_BASE_5!,
    quantity: 1,
  });
  
  // Extra pool slots (if more than 5)
  const extraSlots = Math.max(0, slots - 5);
  if (extraSlots > 0) {
    lineItems.push({
      price: config.POOL_SLOT!,
      quantity: extraSlots,
    });
  }
  
  // Alerts packs (if selected)
  if (alertsSelected) {
    const alertsPacks = Math.ceil(slots / 5);
    lineItems.push({
      price: config.ALERTS_PACK_5!,
      quantity: alertsPacks,
    });
  }
  
  return lineItems;
}




