# Codex Handover — 2025-10-28 Evening

## Context
Claude Sonnet heeft de homepage en onboarding flow volledig herontworpen volgens de LiquiLab Design System. De nieuwe implementatie is deployed naar Railway met placeholder gate. Dit document beschrijft de integration & cleanup taken voor Codex.

---

## 1. WALLET ICON ASSETS (Missing Files)

**Status:** Wallet connect modal gebruikt lokale icons uit `/public/icons/`, maar 2 icons ontbreken.

**Missing files:**
- `/public/icons/rabby.webp` — Rabby wallet icon
- `/public/icons/bifrost.webp` — Bifrost wallet icon

**Action:**
1. Download officiële Rabby icon: https://rabby.io/assets/images/logo-128.png → save as `/public/icons/rabby.webp` (40×40px optimized)
2. Download officiële Bifrost icon: https://www.bifrostwallet.com/images/bifrost-icon.png → save as `/public/icons/bifrost.webp` (40×40px optimized)
3. Verify all 7 wallet icons render correctly in modal grid

**Files to update:**
- `/public/icons/` (add 2 files)

---

## 2. API RESPONSE DATA MAPPING (Pool Detail Fields)

**Status:** `/src/components/onboarding/ConnectWalletModal.tsx` fetches `/api/positions?address={wallet}` maar heeft flexible mapping nodig voor verschillende response formats.

**Current flexible mapping:**
```typescript
token0Symbol: top.token0Symbol ?? top.token0?.symbol ?? '?'
token0Icon: top.token0Icon ?? top.token0?.iconSrc
rangeMin: top.lowerPrice ?? top.rangeMin
currentPrice: top.currentPrice ?? (calculated midpoint)
```

**Issue:** Als API response fields niet exact matchen, krijgen we "?" symbols of missing data.

**Action:**
1. Test `/api/positions?address=0x57d294D815968F0EFA722f1E8094da65402cd951` response structure
2. Check console.log output: `[ConnectWalletModal] Top pool data:` en `[ConnectWalletModal] Range data:`
3. Verify all fields map correctly:
   - `token0Symbol`, `token1Symbol` (flat) OF `token0.symbol`, `token1.symbol` (nested)
   - `token0Icon`, `token1Icon` OF `token0.iconSrc`, `token1.iconSrc`
   - `lowerPrice`, `upperPrice` OF `rangeMin`, `rangeMax`
   - `currentPrice` (live price from pool)
   - `rewardsUsd` OR `feesUsd` (unclaimed fees)
   - `rflrUsd` OR `incentivesUsd` (incentive rewards)
   - `feeTier` OR calculate from `feeTierBps`
4. If fields missing, update API response OR improve mapping in ConnectWalletModal.tsx

**Files to check:**
- `/pages/api/positions.ts` (API response structure)
- `/src/components/onboarding/ConnectWalletModal.tsx` (line 143-180, data mapping)

**Test wallet:** `0x57d294D815968F0EFA722f1E8094da65402cd951`

---

## 3. COMPONENT CLEANUP (Unused Marketing Components)

**Status:** Homepage nu inline in `/pages/index.tsx`, oude separate components niet meer gebruikt.

**Unused components:**
- `/src/components/marketing/Proposition.tsx` — merged into index.tsx
- `/src/components/marketing/TrialAcquisition.tsx` — merged into index.tsx

**Action:**
1. Verify these components are not imported anywhere else (grep entire codebase)
2. If unused, remove files OR move to `/src/components/archive/` for reference
3. Update imports if needed

**Files to check/remove:**
- `/src/components/marketing/Proposition.tsx`
- `/src/components/marketing/TrialAcquisition.tsx`

---

## 4. DEMO POOL APR CALCULATION (Daily Fees Field)

**Status:** Demo pools calculate APR from `dailyFeesUsd` field, but this must be added to all sample pools.

**Current implementation:**
```typescript
// In /pages/api/demo/pools.ts
dailyFeesUsd: 0.89  // Added manually per pool
APR = (dailyFeesUsd / tvlUsd) × 365 × 100
```

**Action:**
1. Verify all 9 sample pools in `/pages/api/demo/pools.ts` have realistic `dailyFeesUsd` values
2. Check that APR calculations display correctly (range 0-999%)
3. Ensure Out of Range pools have `dailyFeesUsd: 0` (no fees when out of range)

**Files to check:**
- `/pages/api/demo/pools.ts` (SAMPLE_POOLS array, lines 24-183)
- `/src/components/demo/DemoPoolsTable.tsx` (calculateAPY24h function)

---

## 5. POOL TABLE SPECIFICATION ENFORCEMENT

**Status:** Complete pool table spec documented in PROJECT_STATE.md section 5, must be applied consistently.

**Critical specs:**
- Row heights: 60px base + pt-4 (16px) row 1 + pb-4 (16px) row 2 = 152px per pool
- Divider: no margin (was my-2), direct against rows
- Hover: Electric Blue `rgba(59,130,246,0.06)` on both rows, extends to divider
- Token icons: 24×24px with -space-x-2 overlap
- Fonts: 15px amounts, 9px secondary, tabular-nums
- APR calculation: `(dailyFees / TVL) × 365 × 100` (NOT total unclaimed fees)

**Action:**
1. Verify demo pool table matches spec (homepage /demo section)
2. Verify live pool table on dashboard matches same spec
3. Test hover effect extends to divider lines (no dark gap)
4. Ensure consistent styling between demo and live pools

**Files to verify:**
- `/src/components/PositionsTable.tsx` (definitive implementation)
- `/src/components/demo/DemoPoolsTable.tsx` (uses PositionsTable)
- `/src/features/pools/PoolRow.tsx` (if still used elsewhere)

---

## 6. WALLET CONNECT FLOW END-TO-END TEST

**Status:** New inline onboarding flow: Homepage → Modal → Top pool display → Trial/Subscribe choice.

**Test scenario:**
1. Go to homepage (after placeholder login)
2. Click "Connect wallet — start free"
3. Connect with MetaMask (or test wallet)
4. Verify modal shows 3 phases:
   - Connect: 7 wallets with icons + "INSTALLED" badges
   - Loading: Spinner "Scanning your pools..."
   - Result: Top pool card + "14 active and 1 inactive" + 2 CTAs
5. Verify top pool shows:
   - Icons (28px) + Pool pair
   - Provider · Fee tier
   - Current Price box ($2.XXXXXX)
   - 4-col grid (TVL, FEES, INCENTIVES, 24h APR)
   - RangeBand with min/max/current + status indicator
6. Click "Start your free trial" → redirects to `/dashboard?trial={poolId}`
7. Click "Subscribe to follow all" → redirects to `/pricing`

**Test with wallet:** `0x57d294D815968F0EFA722f1E8094da65402cd951`

**Files involved:**
- `/pages/index.tsx` (homepage)
- `/src/components/onboarding/ConnectWalletModal.tsx` (modal flow)
- `/pages/api/positions.ts` (data source)

---

## 7. COLOR CONSISTENCY FINAL AUDIT

**Status:** Comprehensive color audit done, but verify consistency across ALL pages.

**Color rules (strict):**
- **Aqua `#1BE8D2`:** Checkmarks ONLY (signals, not actions)
- **Electric Blue `#3B82F6`:** ALL buttons, links, hovers, highlights, CTAs
- **Mist `#9CA3AF`:** Muted text everywhere
- **Status:** Green `#00C66B`, Amber `#FFA500`, Red `#E74C3C`

**Action:**
1. Search entire codebase for `#1BE8D2` and verify ONLY used for checkmarks
2. Search for old incorrect colors: `#6EA8FF`, `#B9C7DA`, `#B0B9C7` and replace if found
3. Verify button styling uses `#3B82F6` primary, `#60A5FA` hover
4. Check `/pages/dashboard.tsx`, `/pages/pricing.tsx`, `/pages/pool/[id].tsx` for consistency

**Files to audit:**
- All `/pages/*.tsx`
- All `/src/components/**/*.tsx`
- `/src/styles/globals.css`

---

## 8. DOCUMENTATION SYNC

**Status:** PROJECT_STATE.md updated with complete pool table spec, but some references may be outdated.

**Action:**
1. Review PROJECT_STATE.md section 5 "Pool Table Layout (v2025.10.28 — Compact Two-Row Design)"
2. Verify all dimensions/specs match actual implementation
3. Update any outdated references (e.g., old "Share button" removed, APY→APR)
4. Ensure RangeBand calculation formulas documented correctly
5. Add any missing implementation notes from today's session

**Files to sync:**
- `/PROJECT_STATE.md` (sections 5, 6, changelog)
- `/docs/STYLEGUIDE.md` (if color changes affect this)

---

## 9. PRODUCTION ENVIRONMENT VARIABLES

**Status:** Verify all required env vars are set on Railway.

**Required:**
```bash
DATABASE_URL=postgresql://...  # Railway PostgreSQL
NEXT_PUBLIC_RPC_URL=https://flare.flr.finance/ext/bc/C/rpc
NODE_ENV=production
PORT=<Railway assigns>
```

**Action:**
1. Check Railway dashboard → Environment variables
2. Verify DATABASE_URL points to Railway PostgreSQL
3. Verify RPC_URL is public Flare endpoint
4. Check build logs for missing env warnings

---

## 10. POST-DEPLOYMENT SMOKE TEST

**Action (after deployment completes):**

```bash
# Homepage smoke test
curl -I https://liquilab.io/
# Should return: 200 (shows placeholder)

# API health check
curl -s https://liquilab.io/api/health
# Should return: {"status":"ok",...}

# Demo pools API
curl -s https://liquilab.io/api/demo/pools | jq length
# Should return: 9

# Placeholder login (manual)
# Go to https://liquilab.io → Enter password → Should redirect to homepage

# Wallet connect test (manual)
# Homepage → Click "Connect wallet — start free" → Connect MetaMask
# Should show top pool + counts → Click "Start your free trial"
# Should redirect to dashboard
```

---

## Priority Order

**High (blocking):**
1. ✅ Deployment successful → verify site loads
2. Wallet icon assets (rabby.webp, bifrost.webp)
3. End-to-end wallet connect test
4. API response mapping verification

**Medium:**
5. Component cleanup (unused Proposition/TrialAcquisition)
6. Color audit final sweep
7. Documentation sync

**Low:**
8. Performance optimization (if needed)
9. Accessibility audit (AA contrast, focus states)

---

## Success Criteria

✅ Homepage loads with 2 sections (Hero + Demo)  
✅ Demo pool table shows 9 pools with correct data  
✅ Wallet connect modal opens with 7 wallets + icons  
✅ After connect: top pool displays with all fields populated  
✅ Trial CTA redirects to dashboard  
✅ Subscribe CTA redirects to pricing  
✅ All colors match Design System (Aqua signals, Blue actions)  
✅ No console errors  
✅ Lighthouse score >90 (performance/accessibility)  

---

**Deployment timestamp:** 2025-10-28 evening  
**Claude Sonnet session:** Complete  
**Codex tasks:** As listed above  
**Next review:** After Codex integration + testing  

---

© 2025 LiquiLab — The easy way to manage your liquidity pools.





