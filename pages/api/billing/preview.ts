import type { NextApiRequest, NextApiResponse } from 'next';

import {
  ALERTS_PRICE_PER_BUNDLE_USD,
  ANNUAL_MULTIPLIER,
  BUNDLE_SIZE,
  FREE_POOLS,
  PRICE_PER_POOL_USD,
} from '@/data/subscriptionPlans';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const billing = req.query.billingCycle === 'year' ? 'year' : 'month';
    const rawActivePools = Array.isArray(req.query.activePools)
      ? req.query.activePools[0]
      : req.query.activePools;
    const rawDesiredCapacity = Array.isArray(req.query.desiredCapacity)
      ? req.query.desiredCapacity[0]
      : req.query.desiredCapacity;

    const rawAlerts = Array.isArray(req.query.alerts)
      ? req.query.alerts[0]
      : req.query.alerts;
    const alertsEnabled = rawAlerts === '1' || rawAlerts === 'true';

    const parsedRequested = Number(rawActivePools ?? rawDesiredCapacity ?? 1);
    const totalCapacity =
      Number.isFinite(parsedRequested) && parsedRequested > 0
        ? Math.floor(parsedRequested)
        : 1;

    const paidPools = Math.max(0, totalCapacity - FREE_POOLS);
    const bundles =
      paidPools > 0 ? Math.ceil(paidPools / BUNDLE_SIZE) : 0;

    const baseMonthlyAmount = Number(
      (paidPools * PRICE_PER_POOL_USD).toFixed(2),
    );
    const baseAnnualAmount = Number(
      (baseMonthlyAmount * ANNUAL_MULTIPLIER).toFixed(2),
    );

    const alertsBundles = alertsEnabled ? bundles : 0;
    const alertsMonthlyAmount = Number(
      (alertsBundles * ALERTS_PRICE_PER_BUNDLE_USD).toFixed(2),
    );
    const alertsAnnualAmount = Number(
      (alertsMonthlyAmount * ANNUAL_MULTIPLIER).toFixed(2),
    );

    const totalMonthlyAmount = Number(
      (baseMonthlyAmount + alertsMonthlyAmount).toFixed(2),
    );
    const totalAnnualAmount = Number(
      (baseAnnualAmount + alertsAnnualAmount).toFixed(2),
    );

    const responseBody = {
      ok: true as const,
      pricing: {
        billingCycle: billing,
        pricePerPoolUsd: PRICE_PER_POOL_USD,
        freePools: FREE_POOLS,
        paidPools,
        totalCapacity,
        bundles,
        amountUsd: billing === 'year' ? totalAnnualAmount : totalMonthlyAmount,
        monthlyEquivalentUsd: totalMonthlyAmount,
      },
      suggestion: {
        activePools: totalCapacity,
        recommendedPaidPools: paidPools,
        recommendedCapacity: totalCapacity,
      },
      alerts: {
        enabled: alertsEnabled,
        pricePerBundleUsd: ALERTS_PRICE_PER_BUNDLE_USD,
        bundles: alertsBundles,
        amountUsd: billing === 'year' ? alertsAnnualAmount : alertsMonthlyAmount,
        monthlyEquivalentUsd: alertsMonthlyAmount,
      },
    };

    // Seat/queue toggles via env (UI kan hiermee beslissen welke CTA te tonen)
    const cap = Number(process.env.LL_SEAT_CAP ?? 100);
    const fastforward = (process.env.LL_FASTFORWARD_ENABLED ?? '1') === '1';
    const waitlist = (process.env.LL_WAITLIST_ENABLED ?? '0') === '1';
    // Active seats onbekend zonder DB queries; UI zal /api/early-access/stats gebruiken voor echte aantallen.
    const seats = {
      cap,
      active: null as number | null,
      waitlistEnabled: waitlist,
      fastforwardEnabled: fastforward,
    };

    res.status(200).json({ ...responseBody, seats });
  } catch (e: unknown) {
    const error = e as Error;
    res
      .status(200)
      .json({ ok: true, placeholder: true, error: error?.message });
  }
}
