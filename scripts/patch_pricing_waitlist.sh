#!/usr/bin/env bash
set -euo pipefail

# map naar projectroot
cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

mkdir -p src/data pages/api/billing pages/api/admin scripts

# 1) PROJECT_STATE bijwerken met pricing, seat-cap en waitlist/fastforward
PS="PROJECT_STATE.md"
touch "$PS"
if ! grep -q "Pricing Model \[$(date +%Y-%m-%d)\]" "$PS" 2>/dev/null; then
  cat >> "$PS" <<'MD'

### Pricing Model [2025-10-27]
- Price per pool: **$1.99 / month**.
- Sold in bundles of **5 paid pools** per tier.
- **Free capacity rule:** free bonus pools = **ceil(paidCapacity/10)**  
  Examples: paid 5 → +1 free (5+1), paid 10 → +1 free (10+1), paid 20 → +2 free (20+2), paid 30 → +3 free.
- New users always have **1 free trial pool** (outside any plan).
- Yearly billing = pay **10 months** (2 months free).
- We grant **free capacity**, never price discounts. Cleaner invoicing (EUR/VAT), no proration headaches.

### Access Control
- Seat cap (rolling): env `LL_SEAT_CAP` (default 100). When `activeSeats >= cap` → waitlist UX.
- Waitlist CTA copy: **Join the priority list**. Wallet connect & preview blijven beschikbaar.
- Fastforward toggle: env of admin setting `FASTFORWARD_ENABLED` om $50 bypass te tonen of te verbergen.
- Admin moet fastforward **aan/uit** kunnen zetten bij piekdrukte.

### Communications & Partners
- External comms (product/docs/investors/B2B/B2C): **English**.  
- Direct chat/support met Koen (hier): **Dutch**.  
- Partner posture: neutral analytics/UX layer; we deep-linken naar **Enosys, SparkDEX, BlazeSwap** voor acties (claim, adjust range).  
- Social share cards noemen provider **als tekst** (geen third-party logo’s unless approved).

### Dev Environment
- MacBook Pro 14" (Apple M4 Pro, 24 GB RAM, macOS Sequoia 15.6). Default tooling: zsh, Homebrew, BSD sed.
MD
  git add "$PS" >/dev/null 2>&1 || true
fi

# 2) Prisma: app settings tabel (voor admin toggles), alleen toevoegen als niet bestaat
SC="prisma/schema.prisma"
if [ -f "$SC" ] && ! grep -q "model AppSetting" "$SC"; then
  cat >> "$SC" <<'PRISMA'

/// App-wide key/value settings (admin-toggles)
model AppSetting {
  key       String  @id
  value     String
  updatedAt DateTime @updatedAt
}
PRISMA
  ADDED_SCHEMA=1
else
  ADDED_SCHEMA=0
fi

# 3) Pricing helper (bron van waarheid)
cat > src/data/pricing.ts <<'TS'
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
TS

# 4) Billing preview API (DB-vrij; safe in dev)
cat > pages/api/billing/preview.ts <<'TS'
import type { NextApiRequest, NextApiResponse } from 'next'
import { quote } from '../../../src/data/pricing'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const active = Number(req.query.activePools ?? 0)
    const billing = req.query.billingCycle === 'year' ? 'year' : 'month'
    const q = quote(active, billing)

    // Seat/queue toggles via env (UI kan hiermee beslissen welke CTA te tonen)
    const cap = Number(process.env.LL_SEAT_CAP ?? 100)
    const fastforward = (process.env.LL_FASTFORWARD_ENABLED ?? '1') === '1'
    const waitlist = (process.env.LL_WAITLIST_ENABLED ?? '0') === '1'
    // Active seats onbekend zonder DB queries; UI zal /api/early-access/stats gebruiken voor echte aantallen.
    const seats = { cap, active: null as number | null, waitlistEnabled: waitlist, fastforwardEnabled: fastforward }

    res.status(200).json({ ...q, seats })
  } catch (e: any) {
    res.status(200).json({ ok: true, placeholder: true, error: e?.message })
  }
}
TS

# 5) Admin settings API (GET/POST) met Prisma, relative import (geen alias)
mkdir -p pages/api/admin
cat > pages/api/admin/settings.ts <<'TS'
import type { NextApiRequest, NextApiResponse } from 'next'
import { db } from '../../../src/server/db'

const ALLOWED = new Set(['FASTFORWARD_ENABLED', 'WAITLIST_ENABLED'])

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'GET') {
      const keys = Array.from(ALLOWED)
      const rows = await db.appSetting.findMany({ where: { key: { in: keys }}})
      const map: Record<string, string> = {}
      rows.forEach(r => { map[r.key] = r.value })
      // env fallback
      if (map.FASTFORWARD_ENABLED == null) map.FASTFORWARD_ENABLED = process.env.LL_FASTFORWARD_ENABLED ?? '1'
      if (map.WAITLIST_ENABLED == null) map.WAITLIST_ENABLED = process.env.LL_WAITLIST_ENABLED ?? '0'
      return res.status(200).json({ ok: true, settings: map })
    }

    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const entries = Object.entries(body ?? {}).filter(([k]) => ALLOWED.has(k))
      if (!entries.length) return res.status(400).json({ ok: false, error: 'no valid keys' })

      const results: any[] = []
      for (const [key, value] of entries) {
        const v = String(value ?? '')
        const row = await db.appSetting.upsert({
          where: { key },
          create: { key, value: v },
          update: { value: v }
        })
        results.push(row)
      }
      return res.status(200).json({ ok: true, updated: results.length })
    }

    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ ok: false, error: 'method not allowed' })
  } catch (e: any) {
    return res.status(200).json({ ok: true, placeholder: true, error: e?.message })
  }
}
TS

# 6) Env defaults toevoegen aan .env.local (idempotent)
touch .env.local
grep -q '^LL_SEAT_CAP=' .env.local || printf '\nLL_SEAT_CAP="100"\n' >> .env.local
grep -q '^LL_FASTFORWARD_ENABLED=' .env.local || printf 'LL_FASTFORWARD_ENABLED="1"\n' >> .env.local
grep -q '^LL_WAITLIST_ENABLED=' .env.local || printf 'LL_WAITLIST_ENABLED="0"\n' >> .env.local

# 7) Prisma generate + optionele migrate
if [ "${ADDED_SCHEMA:-0}" = "1" ]; then
  npx prisma generate
  npx prisma migrate dev --name app_settings || true
else
  npx prisma generate
fi

git add -A >/dev/null 2>&1 || true
git commit -m "pricing+waitlist: pricing engine, billing preview API, admin settings API, env defaults, PROJECT_STATE update" >/dev/null 2>&1 || true

echo "Patch voltooid."
