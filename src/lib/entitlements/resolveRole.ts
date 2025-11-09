import type { NextApiRequest } from 'next';

import { getRoleForUser, type Role } from '@/lib/entitlements';

/**
 * Role override helper used by API routes to simulate downstream states.
 *
 * Precedence (highest → lowest): query (?role=), header (x-ll-role), cookie (ll_role),
 * then existing session resolver. Overrides are ignored in production builds unless
 * `NODE_ENV !== 'production'`.
 */
export type ResolvedRole = Role;
export type RoleSource = 'query' | 'header' | 'cookie' | 'session';

const ROLE_VALUES: ResolvedRole[] = ['VISITOR', 'PREMIUM', 'PRO'];

const FLAG_MAP: Record<ResolvedRole, { premium: boolean; analytics: boolean }> = {
  VISITOR: { premium: false, analytics: false },
  PREMIUM: { premium: true, analytics: false },
  PRO: { premium: true, analytics: true },
};

export type RoleResolution = {
  role: ResolvedRole;
  source: RoleSource;
};

export function roleFlags(role: ResolvedRole) {
  return FLAG_MAP[role];
}

export function resolveRole(req: NextApiRequest): RoleResolution {
  const allowOverride = process.env.NODE_ENV !== 'production';

  if (allowOverride) {
    const queryRole = normalizeRole(req.query?.role);
    if (queryRole) {
      return { role: queryRole, source: 'query' };
    }

    const headerRole = normalizeRole(req.headers['x-ll-role']);
    if (headerRole) {
      return { role: headerRole, source: 'header' };
    }

    const cookieRole = normalizeRole(req.cookies?.ll_role);
    if (cookieRole) {
      return { role: cookieRole, source: 'cookie' };
    }
  }

  return {
    role: fallbackRole(req),
    source: 'session',
  };
}

function normalizeRole(value: unknown): ResolvedRole | null {
  if (!value) return null;
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return ROLE_VALUES.includes(upper as ResolvedRole) ? (upper as ResolvedRole) : null;
}

function fallbackRole(req: NextApiRequest): ResolvedRole {
  const sessionRole = getRoleForUser(req);
  if (ROLE_VALUES.includes(sessionRole)) {
    return sessionRole;
  }
  return 'VISITOR';
}
