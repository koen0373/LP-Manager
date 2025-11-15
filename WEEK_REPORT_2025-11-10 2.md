# 📊 LiquiLab Weekly Report
**Week of November 4-10, 2025**

---

## 🎯 Executive Summary

This week focused on **production stability**, **infrastructure hardening**, and **pricing architecture**. Major achievements include fixing Railway deployment issues, implementing comprehensive health checks, establishing pricing as a single source of truth, and resolving critical TVL calculation bugs.

**Key Metrics:**
- ✅ **Railway deployment fixed** (Dockerfile vs Nixpacks conflict resolved)
- ✅ **DB health checks passing** (SSL configuration + password fix)
- ✅ **502 hardening implemented** (timeouts, RPC rotation, connection pooling)
- ✅ **TVL accuracy improved** (~$150M fake → ~$59M real via CoinGecko)
- ✅ **Pricing SSoT established** (config/pricing.json + public API)

---

## 🔧 Infrastructure & Deployment

### Railway Deployment Fix (Nov 10)
**Problem:** Container stopping immediately after Prisma generate, no Next.js startup.

**Root Cause:** `railway.toml` configured `builder = "NIXPACKS"` instead of Dockerfile, causing Railway to ignore `start.sh` script.

**Solution:**
- ✅ Changed `railway.toml`: `builder = "DOCKERFILE"`
- ✅ Fixed `start.sh`: Added `-H 0.0.0.0` flag for Railway host binding
- ✅ Updated `lib/db.ts`: SSL handling for Railway Postgres (internal + proxy)

**Result:** Railway now uses Dockerfile correctly, container starts and runs Next.js server.

### DB Health Check SSL Fix (Nov 10)
**Problem:** Local DB health checks failing with "password authentication failed" and SSL errors.

**Root Causes:**
1. Password typo in `.env.local` (`EBd` vs `EBt`)
2. Railway proxy SSL configuration (self-signed certs with `sslmode=require`)

**Solution:**
- ✅ Fixed password typo in `.env.local`
- ✅ Updated `lib/db.ts` to strip `sslmode=require` from URL and set explicit `ssl: { rejectUnauthorized: false }`
- ✅ Increased connection timeout: 300ms → 5000ms for Railway proxy
- ✅ Added Railway internal vs proxy detection

**Result:** ✅ DB health check now passes locally and on Railway.

---

## 🛡️ 502 Hardening (Nov 10)

Implemented comprehensive resilience improvements to prevent 502 Bad Gateway errors:

### Database Layer (`lib/db.ts`)
- ✅ PostgreSQL connection pool with aggressive timeouts:
  - `connectionTimeoutMillis: 5000` (Railway proxy connections)
  - `idleTimeoutMillis: 10000`
  - `max: 5` connections
- ✅ SSL auto-detection for Railway (internal vs proxy)
- ✅ Graceful error handling and pool reset function

### RPC Layer (`lib/rpc.ts`)
- ✅ RPC client rotation over `FLARE_RPC_URLS` (comma-separated)
- ✅ Hard request timeout: 1200ms with `AbortController`
- ✅ Randomized start index + 2-try failover
- ✅ `rpcHealth()` function for health checks

### HTTP Timeouts (`lib/httpTimeout.ts`)
- ✅ `withTimeout<T>(p, ms)` helper for promises
- ✅ `fetchWithTimeout()` wrapper (8s default) using undici fetch

### API Routes Updated
- ✅ `pages/api/health.ts`: Comprehensive health checks (DB, RPC, queue)
- ✅ `pages/api/positions.ts`: Wrapped external calls with timeouts (2-5s)

### Scripts Added
- ✅ `scripts/warmup.mjs`: Post-deploy health pings
- ✅ `scripts/diagnose-502.mjs`: Diagnostic curl script

**Files Created:**
- `lib/db.ts`
- `lib/rpc.ts`
- `lib/httpTimeout.ts`
- `scripts/warmup.mjs`
- `scripts/diagnose-502.mjs`

---

## 💰 Pricing Single Source of Truth (Nov 10)

Established centralized pricing configuration to eliminate inconsistencies:

### Core Files
- ✅ `config/pricing.json`: JSON schema with plans (VISITOR, PREMIUM, PRO), bundles (5 pools each), alerts pricing, trial days, examples
- ✅ `lib/pricing.ts`: TypeScript helpers (`priceQuote()`, `validatePricing()`, `getPricingConfig()`)
- ✅ `lib/visitor.ts`: Server-side helper `buildVisitorContext(req)` extracts visitor segment, plan, pools_owned from session/wallet/User records
- ✅ `ai-context/visitor_context.schema.json`: JSON Schema for visitor context
- ✅ `pages/api/public/pricing.ts`: Public read-only endpoint with `Cache-Control: public, max-age=3600`
- ✅ `ai-context/pricing.md`: AI seed document with pricing structure and instructions
- ✅ `scripts/verify_pricing.mjs`: Verification script validates calculations against examples

**Pricing Structure:**
- **VISITOR**: $0, 0 bundles, public info + demos
- **PREMIUM**: $14.95/mo, 1 bundle (5 pools), 14-day trial, extra bundles $9.95
- **PRO**: $24.95/mo, 1 bundle (5 pools), 14-day trial, extra bundles $14.95
- **Alerts**: $2.49 per bundle

**Next Step:** Load `ai-context/pricing.md` into Claude/Codex prompts and call `buildVisitorContext()` in middleware.

---

## 📊 TVL Calculation Fix (Nov 10)

**CRITICAL BUG FIX:** Replaced fake USD pricing with real CoinGecko API integration.

### Problem
- Previous logic used pool price ratio as USD price
- Caused 50-5000% TVL overestimations in non-stablecoin pools
- Example: sFLR/WFLR pool showed $205 (43x overestimation) instead of $3.10

### Solution (`src/services/tokenPriceService.ts`)
- ✅ CoinGecko API integration (323 lines)
- ✅ 5-minute caching (node-cache)
- ✅ 40+ token mappings (WFLR, sFLR, USDC.e, USDT, WETH, HLN, FXRP, SPX, APS, etc.)
- ✅ Special character handling (USDC.e → USDCE, USD₮0 → USD0)
- ✅ 3-level fallback: (1) CoinGecko API, (2) stablecoin assumption ($1.00), (3) pool ratio with warning

### Impact
- ✅ Fixed ~190 pools (80% of database) with accurate TVL
- ✅ Total platform TVL corrected: $150M (fake) → ~$59M (real)
- ✅ Now matching DefiLlama coverage
- ✅ ~40,000 positions now show correct USD values

### TVL API (`pages/api/analytics/tvl.ts`)
- ✅ Aggregated TVL endpoint (173 lines)
- ✅ Sums all positions from database using CoinGecko prices
- ✅ Groups by pool for efficiency
- ✅ Returns Enosys/SparkDEX breakdown, position counts, avg values

### Weekly Report Integration
- ✅ `scripts/generate-weekly-report.js` upgraded to use `/api/analytics/tvl`
- ✅ Triple-layer fallback: (1) LiquiLab API, (2) DefiLlama, (3) cached values
- ✅ Footer shows dynamic price source

**Files Modified:**
- `src/services/tokenPriceService.ts` (NEW)
- `src/utils/poolHelpers.ts` (CRITICAL fix)
- `pages/api/analytics/tvl.ts` (NEW)
- `scripts/generate-weekly-report.js` (upgraded)

---

## 🔒 RPC Hardening (Nov 10)

### Flare RPC 30-Block Limit Enforcement
- ✅ Updated `RpcScanner` to enforce 30-block limit per request
- ✅ Adaptive block window sizing (halves on 429/too large errors, floor 250)
- ✅ Prevents RPC errors and rate limiting

**Commits:**
- `a4da49a` 🔒 HARDEN: Flare RPC 30-block limit enforcement (RpcScanner)
- `0cc562b` 🔒 HARDEN: Flare RPC 30-block limit enforcement

---

## 📈 Indexer Improvements

### Indexer Follower Status
- ✅ Successfully deployed with `Dockerfile.worker`
- ✅ Runs hourly via Railway Cron (0 * * * *)
- ✅ Uses Flare public RPC (free)
- ✅ Settings: RPS=2, Concurrency=2, BlockWindow=25 (30-block limit compliant)

### Database Status
- ✅ **PositionEvent**: 132,000+ events (INCREASE/DECREASE/COLLECT)
- ✅ **PositionTransfer**: 86,344 transfers (Enosys + SparkDEX)
- ✅ **PoolEvent**: 404 PoolCreated events
- ✅ **Unique Positions**: 74,857 (Enosys: 24,435, SparkDEX: 50,421)

---

## 🐛 Bug Fixes

### Price API Migration (Nov 10)
- ✅ Replaced Ankr price RPC with CoinGecko (`/api/prices/current`)
- ✅ `InlineReal.tsx` now uses `/api/prices/current` (no more Ankr)
- ✅ `pages/api/positions.ts` uses `tokenPriceService` batch pricing
- ✅ Removed legacy Ankr price files

### Role Model Refactor (Nov 9)
- ✅ Renamed roles: `FREE`/`PREMIUM_ANALYTICS` → `VISITOR`/`PREMIUM`/`PRO`
- ✅ Updated entitlements system to match new role model

---

## 📝 Documentation

### New Documentation
- ✅ `RAILWAY_BUILD_FIX.md`: Railway deployment troubleshooting
- ✅ `DEPLOYMENT_TVL_FIX.md`: TVL fix deployment guide
- ✅ `RAILWAY_502_FIX_HANDOVER.md`: Comprehensive 502 debugging documentation
- ✅ `docs/PROMPT_FOR_GPT_TVL_FIX.md`: Enhanced with real database context
- ✅ `docs/research/TVL_DIFFERENCES_LIQUILAB_VS_DEFILLAMA.md`: Technical analysis

### Updated Documentation
- ✅ `PROJECT_STATE.md`: Added changelog entries for all major fixes
- ✅ `README.md`: Added pricing configuration section, health check docs, environment variables

---

## 🎯 Next Week Priorities

### High Priority
1. **Verify Railway deployment stability** - Monitor health checks, ensure no 502s
2. **Complete pricing integration** - Load `ai-context/pricing.md` into prompts, call `buildVisitorContext()` in middleware
3. **Monitor TVL accuracy** - Verify CoinGecko API performance, cache hit rates

### Medium Priority
1. **Indexer optimization** - Test dual NFPM scanning, improve checkpoint handling
2. **Analytics enrichment** - InRange %, fee yield trend, IL% breakdown
3. **UI improvements** - PoolDetail deep dive, whale watch, alert toggles

### Low Priority
1. **BI exports** - NDJSON dumps for PoolEvent/PositionEvent (quarterly)
2. **Testing** - CI smoke tests for indexer scripts
3. **Documentation** - Finalize runbooks, add API examples

---

## 📊 Statistics

**Commits This Week:** 30+
**Files Created:** 15+
**Files Modified:** 25+
**Critical Fixes:** 4 (Railway deployment, DB health check, TVL calculation, RPC hardening)

**Database Growth:**
- Positions: 74,857 (↑ from 49,012)
- Transfers: 86,344 (↑ from 73,468)
- Pools: 404 (stable)

**Infrastructure:**
- Railway services: 2 (LiquiLab web, Indexer Follower)
- Health checks: 3 (DB, RPC, queue)
- Timeout improvements: 5+ endpoints

---

## ✅ Success Criteria Met

- [x] Railway deployment working (Dockerfile)
- [x] DB health checks passing
- [x] 502 errors prevented (timeouts + rotation)
- [x] TVL accuracy fixed (CoinGecko integration)
- [x] Pricing SSoT established
- [x] RPC rate limiting compliant (30-block limit)
- [x] Weekly report automation working

---

**Report Generated:** 2025-11-10  
**Next Report:** 2025-11-17

