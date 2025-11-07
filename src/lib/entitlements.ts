/**
 * Entitlements & Role-based Access Control
 * Freemium v2: FREE (3 pools, basic view) → PREMIUM_V1 (5+ pools, full features)
 */

import type { NextApiRequest } from 'next';

export type Role = 'FREE' | 'PREMIUM_V1' | 'PREMIUM_V2';

export type FieldEntitlements = {
  pair: boolean;
  tvl: boolean;
  unclaimedFees: boolean;
  inRange: boolean;
  apr: boolean;
  incentives: boolean;
  rangeBand: boolean;
};

export type Entitlements = {
  role: Role;
  maxPools: number;
  basePools?: number;
  slotPrice?: number;
  fields: FieldEntitlements;
  alerts: boolean;
  signals: boolean;
  remainingSlots?: number;
  alertsPacks?: number;
};

const ROLE_CAPS: Record<Role, Omit<Entitlements, 'role' | 'remainingSlots' | 'alertsPacks'>> = {
  FREE: {
    maxPools: 3,
    fields: {
      pair: true,
      tvl: true,
      unclaimedFees: true,
      inRange: true,
      apr: false,
      incentives: false,
      rangeBand: false,
    },
    alerts: false,
    signals: false,
  },
  PREMIUM_V1: {
    maxPools: Infinity,
    basePools: 5,
    slotPrice: 1.99,
    fields: {
      pair: true,
      tvl: true,
      unclaimedFees: true,
      inRange: true,
      apr: true,
      incentives: true,
      rangeBand: true,
    },
    alerts: false, // requires ADDON_ALERTS
    signals: true,
  },
  PREMIUM_V2: {
    maxPools: Infinity,
    basePools: 5,
    slotPrice: 1.99,
    fields: {
      pair: true,
      tvl: true,
      unclaimedFees: true,
      inRange: true,
      apr: true,
      incentives: true,
      rangeBand: true,
    },
    alerts: false, // requires ADDON_ALERTS
    signals: true,
  },
};

/**
 * Get user role from request (stub via cookie/header; default FREE)
 */
export function getRoleForUser(req: NextApiRequest): Role {
  // Stub: check cookie or header
  const roleCookie = req.cookies['ll_role'];
  const roleHeader = req.headers['x-ll-role'] as string | undefined;
  
  const rawRole = roleCookie || roleHeader;
  
  if (rawRole === 'PREMIUM_V1' || rawRole === 'PREMIUM_V2') {
    return rawRole;
  }
  
  return 'FREE';
}

/**
 * Get entitlements for a given role with optional pool capacity and alerts
 */
export function getEntitlements(
  role: Role,
  poolCapacity?: number,
  alertsEnabled: boolean = false,
  watchingCount?: number
): Entitlements {
  const caps = ROLE_CAPS[role];
  
  const entitlements: Entitlements = {
    role,
    ...caps,
    alerts: alertsEnabled && role !== 'FREE',
  };
  
  // Calculate remaining slots if watchingCount is provided
  if (typeof watchingCount === 'number') {
    entitlements.remainingSlots = Math.max(0, caps.maxPools - watchingCount);
  }
  
  // Calculate alerts packs if alerts are enabled
  if (alertsEnabled && typeof poolCapacity === 'number') {
    entitlements.alertsPacks = Math.ceil(poolCapacity / 5);
  }
  
  return entitlements;
}

/**
 * Enforce pool limit for a given role and watching count
 * @throws {status: 402, upgrade_required: true, plan_hint: 'PREMIUM_V1'}
 */
export function enforcePoolsLimit(
  address: string,
  watchingCount: number,
  role: Role,
  poolCapacity?: number
): void {
  const caps = ROLE_CAPS[role];
  const limit = poolCapacity || caps.maxPools;
  
  if (watchingCount > limit) {
    throw {
      status: 402,
      upgrade_required: true,
      plan_hint: 'PREMIUM_V1',
      message: `You are watching ${watchingCount} pools but your ${role} plan allows ${limit}. Please upgrade.`,
    };
  }
}

/**
 * Mask fields for FREE users (server-side enforcement)
 */
export function maskFreeView<T extends Record<string, unknown>>(
  position: T,
  entitlements: Entitlements
): T {
  const masked = { ...position };
  
  if (!entitlements.fields.apr) {
    delete masked.apr;
    delete masked.apr24h;
  }
  
  if (!entitlements.fields.incentives) {
    delete masked.incentives;
    delete masked.incentivesUsd;
    delete masked.incentivesToken;
    delete masked.incentivesTokenAmount;
  }
  
  if (!entitlements.fields.rangeBand) {
    delete masked.rangeBand;
    delete masked.rangeStatus;
  }
  
  return masked;
}

