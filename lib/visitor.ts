/**
 * Visitor context builder - Server-side helper
 * 
 * Builds visitor context from session, wallet, and subscription records.
 * Falls back to VISITOR segment if no subscription found.
 */

import type { NextApiRequest } from 'next';
import { prisma } from '@/server/db';
import { getPricingConfig } from '@/lib/pricing';
import type { Plan } from '@/lib/pricing';

export interface VisitorContext {
  visitor_id: string;
  segment: 'VISITOR' | 'PREMIUM' | 'PRO' | 'ENTERPRISE';
  plan: Plan;
  pools_owned: number;
  bundles_purchased: number;
  alerts_bundles: number;
  trial_active: boolean;
  trial_ends: string | null;
  locale: string;
  as_of: string;
  pricing_version: string;
}

/**
 * Build visitor context from request
 * 
 * Extracts visitor info from:
 * - Session/cookies (visitor_id)
 * - Wallet address (if authenticated)
 * - User record (subscription state, pool allowance)
 * - Wallet record (billing dates, pools)
 */
export async function buildVisitorContext(req: NextApiRequest): Promise<VisitorContext> {
  const config = getPricingConfig();
  const bundleSize = config.bundles.size_pools;
  
  // Extract visitor ID from session/cookie/wallet
  const visitorId = 
    req.cookies?.ll_session ||
    req.headers['x-visitor-id'] ||
    req.query?.wallet ||
    'anonymous';

  // Default to VISITOR segment
  let segment: 'VISITOR' | 'PREMIUM' | 'PRO' | 'ENTERPRISE' = 'VISITOR';
  let plan: Plan = 'VISITOR';
  let poolsOwned = 0;
  let bundlesPurchased = 0;
  let alertsBundles = 0;
  let trialActive = false;
  let trialEnds: string | null = null;

  // Try to resolve user from wallet address or session
  const walletAddress = typeof req.query?.address === 'string' 
    ? req.query.address 
    : req.headers['x-wallet-address'] as string | undefined;

  if (walletAddress) {
    try {
      // Find wallet and user
      const wallet = await prisma.wallet.findFirst({
        where: { address: walletAddress.toLowerCase() },
        include: {
          user: true,
          pools: {
            where: { status: 'ACTIVE' },
          },
        },
      });

      if (wallet && wallet.user) {
        const user = wallet.user;
        poolsOwned = wallet.pools.length;

        // Determine plan from user state and billing
        const now = new Date();
        const billingExpiresAt = wallet.billingExpiresAt;
        const billingStartedAt = wallet.billingStartedAt;

        // Check if billing is active
        const isBillingActive = billingExpiresAt > now;

        if (isBillingActive) {
          // Determine plan based on poolAllowance or default to PREMIUM
          // For now, assume poolAllowance > 0 means PRO, otherwise PREMIUM
          if (user.poolAllowance >= 10) {
            plan = 'PRO';
            segment = 'PRO';
          } else if (user.poolAllowance > 0) {
            plan = 'PREMIUM';
            segment = 'PREMIUM';
          } else {
            plan = 'PREMIUM';
            segment = 'PREMIUM';
          }

          // Calculate bundles
          bundlesPurchased = Math.ceil(poolsOwned / bundleSize);

          // Check for trial (if billing started recently and expires soon)
          const daysSinceStart = (now.getTime() - billingStartedAt.getTime()) / (1000 * 60 * 60 * 24);
          const daysUntilExpiry = (billingExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
          
          if (daysSinceStart <= config.plans[plan]?.trial_days && daysUntilExpiry <= config.plans[plan]?.trial_days) {
            trialActive = true;
            trialEnds = billingExpiresAt.toISOString();
          }
        } else {
          // No active billing - check if user is activated but not paying
          if (user.state === 'ACTIVATED') {
            // Could be trial expired or not started
            plan = 'VISITOR';
            segment = 'VISITOR';
          }
        }
      }
    } catch (error) {
      // Silently fallback to VISITOR on database errors
      console.warn('[buildVisitorContext] Error fetching user data:', error);
    }
  }

  // Extract locale from headers or default
  const locale = 
    req.headers['accept-language']?.split(',')[0]?.split('-')[0] + '-US' ||
    'en-US';

  return {
    visitor_id: visitorId,
    segment,
    plan,
    pools_owned: poolsOwned,
    bundles_purchased: bundlesPurchased,
    alerts_bundles: alertsBundles, // TODO: Add alerts tracking to schema
    trial_active: trialActive,
    trial_ends: trialEnds,
    locale,
    as_of: new Date().toISOString(),
    pricing_version: config.version,
  };
}

