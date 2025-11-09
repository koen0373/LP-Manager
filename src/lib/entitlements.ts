/**
 * Entitlements & Role-based Access Control
 * Role model (2025-11-09):
 * VISITOR (read-only teaser) → PREMIUM (full product) → PRO (Premium + Analytics)
 */

import type { NextApiRequest } from 'next';

export type Role = 'VISITOR' | 'PREMIUM' | 'PRO';

const ROLE_VALUES: Role[] = ['VISITOR', 'PREMIUM', 'PRO'];

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
  VISITOR: {
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
  PREMIUM: {
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
    alerts: true,
    signals: true,
  },
  PRO: {
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
    alerts: true,
    signals: true,
  },
};

/**
 * Get user role from request (stub via cookie/header; default VISITOR)
 */
export function getRoleForUser(req: NextApiRequest): Role {
  const headerRole = normalizeRoleValue(req.headers['x-ll-session-role']);
  if (headerRole) return headerRole;

  const cookieRole = normalizeRoleValue(req.cookies['ll_session_role']);
  if (cookieRole) return cookieRole;

  return 'VISITOR';
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
    alerts: caps.alerts || alertsEnabled,
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
 * @throws {status: 402, upgrade_required: true, plan_hint: 'PREMIUM'}
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
      plan_hint: 'PREMIUM',
      message: `You are watching ${watchingCount} pools but your ${role} plan allows ${limit}. Please upgrade.`,
    };
  }
}

/**
 * Mask fields for non-premium users (server-side enforcement)
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

function normalizeRoleValue(value: unknown): Role | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return ROLE_VALUES.includes(upper as Role) ? (upper as Role) : null;
}
