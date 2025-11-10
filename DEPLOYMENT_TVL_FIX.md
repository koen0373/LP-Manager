# TVL Fix Deployment Guide

**Date:** 2025-11-10  
**Commit:** `a857ed5` - 🔧 Implement Real USD Pricing via CoinGecko API  
**Status:** ✅ Ready for Railway Auto-Deploy

---

## 📦 WHAT WAS DEPLOYED

### **New Files:**
- ✅ `src/services/tokenPriceService.ts` (323 lines)
  - CoinGecko API integration
  - 5-min caching with node-cache
  - 40+ token mappings
  - 3-level fallback strategy

### **Modified Files:**
- ✅ `src/utils/poolHelpers.ts` (calculatePositionValue)
  - Replaced fake USD logic with real price fetching
  - Added price source logging
  - Added warnings for inaccurate fallbacks

- ✅ `.env.example`
  - Added `COINGECKO_API_KEY` documentation

- ✅ `package.json` + `package-lock.json`
  - Added `node-cache` dependency

---

## 🚀 RAILWAY DEPLOYMENT

### **Auto-Deploy Status:**

```bash
✅ Commit a857ed5 pushed to main branch
⏳ Railway auto-deploy triggered
⏱️ Expected deploy time: 2-3 minutes
📍 Service: Liquilab (main web app)
```

### **What Railway Will Do:**

1. ✅ Detect new commit on main branch
2. ✅ Pull latest code
3. ✅ Run `npm install` (installs node-cache)
4. ✅ Run `npx prisma generate`
5. ✅ Build Next.js application
6. ✅ Deploy to production
7. ✅ Health check passes
8. ✅ Traffic switches to new deployment

---

## 📊 MONITORING

### **Success Indicators** (Look for in Railway logs):

```bash
✅ Build logs:
   - added 1 package (node-cache)
   - ✓ Compiled successfully

✅ Runtime logs:
   - [PRICE] Fetched WFLR: $0.0159 (CoinGecko ID: flare-networks)
   - [PRICE] Cache hit for USDT: $1.00
   - [VALUE] Prices: WFLR=$0.0159 (coingecko), USDT=$1.00 (stablecoin)
   - [VALUE] TVL: $3.10, Rewards: $0.15
```

### **Warning Indicators** (Expected, OK):

```bash
⚠️ [PRICE] No CoinGecko ID mapping for UNKNOWNTOKEN
⚠️ [PRICE] ⚠️ WARNING: Using pool price ratio for UNKNOWNTOKEN
⚠️ [VALUE] ⚠️ TVL may be inaccurate - using pool price ratio for SFLR
```

### **Error Indicators** (NOT OK, requires action):

```bash
❌ CoinGecko API error: 429 Too Many Requests
   → Action: Add COINGECKO_API_KEY or reduce request frequency

❌ Cannot find module 'node-cache'
   → Action: Verify package-lock.json committed, rebuild

❌ Module not found: Can't resolve '@/services/tokenPriceService'
   → Action: Verify file committed, check import paths
```

---

## 🔍 VERIFICATION STEPS

### **1. Check Railway Dashboard:**
```
1. Go to https://railway.app/
2. Select Liquilab project
3. Click on "Liquilab" service
4. Check "Deployments" tab
5. Verify commit a857ed5 is deploying/deployed
```

### **2. Monitor Build Logs:**
```
1. Click on latest deployment
2. Watch "Build Logs" tab
3. Look for: "added 1 package, changed 47 packages"
4. Look for: "✓ Compiled successfully"
```

### **3. Monitor Runtime Logs:**
```
1. Click "View Logs" button
2. Filter for "[PRICE]" to see price fetching
3. Filter for "[VALUE]" to see TVL calculations
4. Verify CoinGecko calls are working
```

### **4. Test Production API:**
```bash
# Test with a wallet that has positions
curl -s "https://app.liquilab.io/api/positions?wallet=0xf406b4E97c31420D91fBa42a3a9D8cfe47BF710b&premium=1" | python3 -m json.tool

# Look for:
# - "tvlUsd" values using real prices
# - "price0Usd" and "price1Usd" fields
```

---

## 📈 EXPECTED IMPACT

### **Before (Fake USD):**
```json
{
  "pool": "sFLR/WFLR",
  "tvlUsd": 205.00,  // ❌ 43x too high!
  "price0Usd": 1.05, // ❌ Pool ratio
  "price1Usd": 1.00  // ❌ Arbitrary
}
```

### **After (Real USD):**
```json
{
  "pool": "sFLR/WFLR",
  "tvlUsd": 3.10,     // ✅ Real TVL!
  "price0Usd": 0.015, // ✅ CoinGecko
  "price1Usd": 0.016  // ✅ CoinGecko
}
```

### **Overall:**
- ~190 pools (80%) will show accurate TVL
- ~40,000 positions will have corrected pricing
- Total TVL: $150M (fake) → ~$59M (real)
- Match with DefiLlama: Much closer now!

---

## ⚙️ ENVIRONMENT VARIABLES

### **Required (Already Set):**
```bash
✅ DATABASE_URL - Railway Postgres connection
✅ FLARE_RPC_URL - For on-chain data
✅ All other existing env vars
```

### **Optional (Can Add Later):**
```bash
COINGECKO_API_KEY - For higher rate limits (300 calls/min)
  
Current: Free tier (50 calls/min)
With caching: ~10 unique tokens × 12 API calls/hour = 120 calls/hour
Status: Well within free tier limits ✅
```

---

## 🛠️ ROLLBACK PLAN

If issues occur, rollback to previous deployment:

```bash
1. Go to Railway Dashboard → Liquilab service
2. Click "Deployments" tab
3. Find previous deployment (before a857ed5)
4. Click "..." menu → "Redeploy"
5. Confirm rollback
```

**Previous commit:** `0bedd0f` (before TVL fix)

---

## 📝 POST-DEPLOYMENT TASKS

### **Immediate (0-1 hour):**
- [ ] Verify deployment succeeded in Railway
- [ ] Check logs for [PRICE] and [VALUE] entries
- [ ] Test API endpoint with real wallet
- [ ] Verify no 500 errors

### **Short-term (1-24 hours):**
- [ ] Monitor CoinGecko API rate limits
- [ ] Check cache hit rate (should be >80%)
- [ ] Compare TVL with DefiLlama
- [ ] Verify stablecoin pools unchanged

### **Long-term (1-7 days):**
- [ ] Update `PROJECT_STATE.md` with changes
- [ ] Document any tokens needing CoinGecko ID verification
- [ ] Consider adding COINGECKO_API_KEY if needed
- [ ] Monitor user feedback on TVL accuracy

---

## 📚 RELATED DOCUMENTATION

- **Analysis:** `docs/research/TVL_DIFFERENCES_LIQUILAB_VS_DEFILLAMA.md`
- **Data Readiness:** `docs/DATA_READINESS_TVL_FIX.md`
- **Implementation Guide:** `docs/PROMPT_FOR_GPT_TVL_FIX.md`
- **Project State:** `PROJECT_STATE.md` (needs update)

---

## ✅ DEPLOYMENT CHECKLIST

- [x] Code implemented and tested locally
- [x] Dependencies installed (node-cache)
- [x] Linter errors fixed
- [x] Committed to main branch (a857ed5)
- [x] Pushed to GitHub
- [ ] Railway auto-deploy triggered
- [ ] Build logs verified
- [ ] Runtime logs monitored
- [ ] Production API tested
- [ ] Documentation updated

---

**🚀 DEPLOYMENT IN PROGRESS!**

**Next:** Monitor Railway dashboard for deployment status.

---

**File:** `DEPLOYMENT_TVL_FIX.md`  
**Created:** 2025-11-10  
**Commit:** a857ed5  
**Author:** LiquiLab Engineering Team

