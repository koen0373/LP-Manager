import type { NextApiRequest, NextApiResponse } from 'next';

import { priceBreakdown } from '@/lib/billing/pricing';
import { getEntitlements, type Role } from '@/lib/entitlements';

function parseBoolean(value: string | string[] | undefined, fallback = false): boolean {
  if (Array.isArray(value)) return parseBoolean(value[0], fallback);
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(lowered)) return true;
    if (['0', 'false', 'no', 'off'].includes(lowered)) return false;
  }
  return fallback;
}

function parseSlots(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 5;
  return Math.max(5, Math.ceil(parsed / 5) * 5);
}

function parseRole(value: string | string[] | undefined): Role {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw && raw.toUpperCase() === 'PREMIUM_V1') return 'PREMIUM_V1';
  return 'FREE';
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slots = parseSlots(req.query.slots);
  const alertsSelected = parseBoolean(req.query.alertsSelected, false);
  const role = parseRole(req.query.role);

  const breakdown = priceBreakdown({ slots, alertsSelected });
  const entitlements = getEntitlements(role, slots, alertsSelected, slots);

  const response = {
    role,
    entitlements: {
      role: entitlements.role,
      caps: { maxPools: entitlements.maxPools },
      fields: {
        apr: entitlements.fields.apr,
        incentives: entitlements.fields.incentives,
        rangeBand: entitlements.fields.rangeBand,
      },
      ...(typeof entitlements.remainingSlots === 'number'
        ? { remainingSlots: entitlements.remainingSlots }
        : {}),
    },
    pricingPreview: breakdown,
  };

  return res.status(200).json(response);
}



