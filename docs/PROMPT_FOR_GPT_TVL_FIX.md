# 🔧 PROMPT FOR GPT: Fix TVL Calculation for Non-Stablecoin Pools

**Date:** 2025-11-10  
**Priority:** 🔥 **P0 - CRITICAL**  
**Estimated Time:** 2-3 hours  
**Files to Modify:** 2-3 files

---

## 📋 CONTEXT

**Problem:**  
LiquiLab currently calculates TVL (Total Value Locked) incorrectly for non-stablecoin pools by using the pool price ratio as USD prices, resulting in 50-5000% overestimations.

**Example of Current Bug:**
```typescript
// Pool: FLR/SFLR with 100 FLR + 100 SFLR
// Pool price: 1 FLR = 1.05 SFLR

// ❌ CURRENT (WRONG):
price0Usd = 1.05   // This is the pool ratio, NOT USD price!
price1Usd = 1.00   // Arbitrary value, NOT USD price!
tvlUsd = (100 × 1.05) + (100 × 1.00) = $205

// ✅ CORRECT (SHOULD BE):
price0Usd = 0.024  // Real FLR price from CoinGecko
price1Usd = 0.023  // Real SFLR price from oracle
tvlUsd = (100 × 0.024) + (100 × 0.023) = $4.70

// Result: 43x overestimation! 😱
```

**Current Implementation Location:**  
`src/utils/poolHelpers.ts`, function `calculatePositionValue()` (lines 808-878)

**Impact:**
- ✅ **Stablecoin pairs** (WFLR/USDT): Correct (~5% error)
- ⚠️ **Partial stablecoin** (WFLR/APS): Moderate error (~50-100%)
- ❌ **Non-stablecoin** (FLR/SFLR, SPX/APS): **Extreme error (50-5000%)**

---

## 🎯 YOUR TASK

**Objective:**  
Implement real USD price fetching for all tokens using CoinGecko API with proper fallback strategies.

**Requirements:**

1. ✅ **Create a new price service** (`src/services/tokenPriceService.ts`)
   - Fetch real-time USD prices from CoinGecko API
   - Implement caching (5-10 min TTL) to avoid rate limits
   - Handle all Flare Network tokens (FLR, SFLR, USDT, USDC, SPX, APS, etc.)
   - Provide fallback strategies for unknown tokens

2. ✅ **Update `calculatePositionValue()`** in `src/utils/poolHelpers.ts`
   - Replace current price logic with real USD price fetching
   - Remove the "fake USD" logic (lines 846-861)
   - Keep pool price calculation for ratio/range display

3. ✅ **Add proper error handling**
   - Log warnings when prices cannot be fetched
   - Fallback to pool price with clear console warning
   - Never crash, always return a value (even if approximate)

4. ✅ **Update environment variables**
   - Add `COINGECKO_API_KEY` (optional, for Pro tier)
   - Document in `.env.example`

5. ✅ **Test with real data**
   - Test stablecoin pairs (should remain ~same)
   - Test non-stablecoin pairs (should drop significantly)
   - Verify against DefiLlama TVL as sanity check

---

## 🛠️ IMPLEMENTATION GUIDE

### **Step 1: Create Token Price Service**

**File:** `src/services/tokenPriceService.ts`

```typescript
/**
 * Token Price Service
 * 
 * Fetches real-time USD prices for Flare Network tokens
 * Uses CoinGecko API with caching to avoid rate limits
 */

import NodeCache from 'node-cache';

// Cache prices for 5 minutes
const priceCache = new NodeCache({ stdTTL: 300 });

/**
 * Map token symbols to CoinGecko IDs
 * Source: https://www.coingecko.com/en/coins/flare-network
 */
const SYMBOL_TO_COINGECKO_ID: Record<string, string> = {
  // Native tokens
  'FLR': 'flare-networks',
  'WFLR': 'flare-networks',
  'SFLR': 'sflr',
  
  // Stablecoins
  'USDT': 'tether',
  'USDC': 'usd-coin',
  'DAI': 'dai',
  
  // DEX tokens
  'SPX': 'sparkdex', // SparkDEX native token
  'EFLR': 'enosys-flare', // Enosys wrapped FLR
  
  // Wrapped BTC/ETH
  'WBTC': 'wrapped-bitcoin',
  'WETH': 'weth',
  
  // Add more as needed
};

/**
 * Fetch USD price for a single token from CoinGecko
 */
export async function getTokenPriceUsd(symbol: string): Promise<number | null> {
  // Normalize symbol (uppercase, remove leading 0x if present)
  const normalizedSymbol = symbol.toUpperCase().replace(/^0X/, '');
  
  // Check cache first
  const cached = priceCache.get<number>(normalizedSymbol);
  if (cached !== undefined) {
    console.log(`[PRICE] Cache hit for ${normalizedSymbol}: $${cached}`);
    return cached;
  }
  
  // Get CoinGecko ID
  const coingeckoId = SYMBOL_TO_COINGECKO_ID[normalizedSymbol];
  if (!coingeckoId) {
    console.warn(`[PRICE] No CoinGecko ID for ${normalizedSymbol}`);
    return null;
  }
  
  try {
    // Call CoinGecko API
    const apiKey = process.env.COINGECKO_API_KEY;
    const baseUrl = apiKey 
      ? 'https://pro-api.coingecko.com/api/v3'  // Pro tier (300 calls/min)
      : 'https://api.coingecko.com/api/v3';     // Free tier (50 calls/min)
    
    const url = `${baseUrl}/simple/price?ids=${coingeckoId}&vs_currencies=usd`;
    const headers = apiKey ? { 'x-cg-pro-api-key': apiKey } : {};
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const price = data[coingeckoId]?.usd;
    
    if (typeof price !== 'number') {
      throw new Error(`Invalid price data for ${coingeckoId}`);
    }
    
    // Cache the result
    priceCache.set(normalizedSymbol, price);
    console.log(`[PRICE] Fetched ${normalizedSymbol}: $${price}`);
    
    return price;
  } catch (error) {
    console.error(`[PRICE] Error fetching price for ${normalizedSymbol}:`, error);
    return null;
  }
}

/**
 * Fetch USD prices for multiple tokens in a single batch call
 * More efficient than calling getTokenPriceUsd() multiple times
 */
export async function getTokenPricesBatch(symbols: string[]): Promise<Record<string, number>> {
  const normalizedSymbols = symbols.map(s => s.toUpperCase().replace(/^0X/, ''));
  const uncachedSymbols: string[] = [];
  const result: Record<string, number> = {};
  
  // Check cache first
  for (const symbol of normalizedSymbols) {
    const cached = priceCache.get<number>(symbol);
    if (cached !== undefined) {
      result[symbol] = cached;
    } else {
      uncachedSymbols.push(symbol);
    }
  }
  
  if (uncachedSymbols.length === 0) {
    console.log(`[PRICE] Batch cache hit for all ${symbols.length} tokens`);
    return result;
  }
  
  // Get CoinGecko IDs for uncached symbols
  const coingeckoIds = uncachedSymbols
    .map(s => SYMBOL_TO_COINGECKO_ID[s])
    .filter(id => id !== undefined);
  
  if (coingeckoIds.length === 0) {
    console.warn(`[PRICE] No CoinGecko IDs found for uncached symbols`);
    return result;
  }
  
  try {
    // Call CoinGecko API (batch)
    const apiKey = process.env.COINGECKO_API_KEY;
    const baseUrl = apiKey 
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3';
    
    const idsParam = coingeckoIds.join(',');
    const url = `${baseUrl}/simple/price?ids=${idsParam}&vs_currencies=usd`;
    const headers = apiKey ? { 'x-cg-pro-api-key': apiKey } : {};
    
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Map CoinGecko IDs back to symbols
    for (const symbol of uncachedSymbols) {
      const coingeckoId = SYMBOL_TO_COINGECKO_ID[symbol];
      const price = data[coingeckoId]?.usd;
      
      if (typeof price === 'number') {
        result[symbol] = price;
        priceCache.set(symbol, price);
      }
    }
    
    console.log(`[PRICE] Batch fetched ${Object.keys(result).length}/${symbols.length} prices`);
    return result;
  } catch (error) {
    console.error(`[PRICE] Error fetching batch prices:`, error);
    return result;
  }
}

/**
 * Get token price with fallback strategies
 * 
 * Fallback order:
 * 1. CoinGecko API
 * 2. Stablecoin assumption ($1.00 for USDT/USDC/DAI)
 * 3. Pool price (with warning)
 */
export async function getTokenPriceWithFallback(
  symbol: string,
  poolPriceRatio: number
): Promise<{ price: number; source: 'coingecko' | 'stablecoin' | 'pool_ratio' | 'unknown' }> {
  // Try CoinGecko first
  const coingeckoPrice = await getTokenPriceUsd(symbol);
  if (coingeckoPrice !== null) {
    return { price: coingeckoPrice, source: 'coingecko' };
  }
  
  // Fallback: Stablecoin assumption
  const normalizedSymbol = symbol.toUpperCase();
  if (['USDT', 'USDC', 'DAI', 'USDS', 'USDD'].includes(normalizedSymbol)) {
    console.log(`[PRICE] Using stablecoin assumption for ${symbol}: $1.00`);
    return { price: 1.00, source: 'stablecoin' };
  }
  
  // Fallback: Use pool ratio (NOT ACCURATE, but better than nothing)
  console.warn(
    `[PRICE] ⚠️ WARNING: Using pool price ratio for ${symbol}: ${poolPriceRatio}. ` +
    `This is NOT a real USD price and may be inaccurate!`
  );
  return { price: poolPriceRatio, source: 'pool_ratio' };
}
```

---

### **Step 2: Update `calculatePositionValue()`**

**File:** `src/utils/poolHelpers.ts`

**Changes:**

1. **Import the new service:**
```typescript
import { getTokenPriceWithFallback } from '@/services/tokenPriceService';
```

2. **Replace lines 846-861** with:
```typescript
// Calculate prices in USD using real price feeds
const poolPrice = sqrtRatioToPrice(sqrtPriceX96, token0Decimals, token1Decimals);

// Fetch real USD prices (with fallback)
const { price: price0Usd, source: source0 } = await getTokenPriceWithFallback(
  token0Symbol, 
  poolPrice
);
const { price: price1Usd, source: source1 } = await getTokenPriceWithFallback(
  token1Symbol, 
  isStableSymbol(token0Symbol) ? 1 / poolPrice : 1.0
);

console.log(`[VALUE] Prices: ${token0Symbol}=$${price0Usd} (${source0}), ${token1Symbol}=$${price1Usd} (${source1})`);
```

3. **Add logging for data quality:**
```typescript
// After calculating tvlUsd (line 872)
if (source0 === 'pool_ratio' || source1 === 'pool_ratio') {
  console.warn(`[VALUE] ⚠️ TVL may be inaccurate due to missing price data`);
}
```

---

### **Step 3: Install Dependencies**

```bash
npm install node-cache
```

---

### **Step 4: Update Environment Variables**

**File:** `.env.example`

```bash
# CoinGecko API (optional, for higher rate limits)
# Free tier: 50 calls/min
# Pro tier: 300 calls/min (requires API key)
COINGECKO_API_KEY=your_api_key_here_optional
```

---

### **Step 5: Add Token Mappings**

**Important:** Update `SYMBOL_TO_COINGECKO_ID` in `tokenPriceService.ts` with all relevant Flare tokens.

**Where to find CoinGecko IDs:**
1. Go to https://www.coingecko.com/
2. Search for token (e.g., "Flare Network")
3. URL will be: `https://www.coingecko.com/en/coins/flare-networks`
4. The ID is `flare-networks`

**Common Flare tokens to add:**
- FLR/WFLR → `flare-networks`
- SFLR → `sflr` (check if exists, otherwise use on-chain oracle)
- SPX → `sparkdex` (check if exists)
- APS → Check on CoinGecko
- HLN → Check on CoinGecko

**If token not on CoinGecko:**
- Consider adding on-chain oracle integration (Chainlink, Pyth)
- Or DEX TWAP price calculation
- Document in `SYMBOL_TO_COINGECKO_ID` as `// Not on CoinGecko - using pool ratio`

---

## 🧪 TESTING CHECKLIST

After implementation, verify:

### **1. Stablecoin Pools (Should Remain Similar)**
```bash
# Test: WFLR/USDT pool
# Expected: TVL should be ~same as before (±5%)
curl http://localhost:3000/api/positions?wallet=0xYourWallet
```

### **2. Non-Stablecoin Pools (Should Drop Significantly)**
```bash
# Test: FLR/SFLR pool
# Expected: TVL should DROP by 10-100x
# Example: $205 → $4.70 (43x drop)
```

### **3. Price Service Logs**
```bash
# Should see in console:
[PRICE] Fetched FLR: $0.024
[PRICE] Fetched SFLR: $0.023
[VALUE] Prices: FLR=$0.024 (coingecko), SFLR=$0.023 (coingecko)
[VALUE] TVL: $4.70
```

### **4. Fallback Handling**
```bash
# Test with unknown token (should fallback gracefully)
[PRICE] No CoinGecko ID for UNKNOWNTOKEN
[PRICE] ⚠️ WARNING: Using pool price ratio for UNKNOWNTOKEN
```

### **5. Cache Performance**
```bash
# Call API twice in <5 min
# Second call should use cache:
[PRICE] Cache hit for FLR: $0.024
```

### **6. DefiLlama Comparison**
```bash
# Compare total TVL with DefiLlama
# Should be closer now (but still ~41% lower due to coverage gaps)

# Before fix:
LiquiLab: $150M (wrong!)
DefiLlama: $59M

# After fix:
LiquiLab: $59M ✅
DefiLlama: $100M (higher due to 100% pool coverage)
```

---

## 📊 EXPECTED RESULTS

### **Before (Current)**
| Pool | LiquiLab TVL | DefiLlama TVL | Error |
|------|--------------|---------------|-------|
| WFLR/USDT | $2.4k | $96k | 97% missing (coverage) ✅ |
| FLR/SFLR | $205 | $4.7 | **43x overestimation** ❌ |
| SPX/WFLR | $5.2M | $12k | **433x overestimation** ❌ |

### **After (Fixed)**
| Pool | LiquiLab TVL | DefiLlama TVL | Error |
|------|--------------|---------------|-------|
| WFLR/USDT | $2.4k | $96k | 97% missing (coverage) ✅ |
| FLR/SFLR | $4.7 | $4.7 | **Match!** ✅ |
| SPX/WFLR | $12k | $12k | **Match!** ✅ |

**Note:** Coverage gaps (41% missing) will remain until we implement P1 (pool reserves tracking).

---

## ⚠️ IMPORTANT CONSIDERATIONS

### **1. CoinGecko Rate Limits**
- **Free tier:** 50 calls/min (10-50 calls/second burst)
- **Solution:** 5-minute caching prevents rate limit issues
- **Monitoring:** Log cache hit rate in production

### **2. Unknown Tokens**
- Some Flare tokens may not be on CoinGecko yet
- Fallback to pool ratio with clear warning
- Document which tokens are missing

### **3. Stablecoin Detection**
- Current `isStableSymbol()` may be incomplete
- Verify it includes: USDT, USDC, DAI, USDS, USDD
- Consider adding EURC, EURT if used on Flare

### **4. Performance**
- Batch price fetching for multiple pools
- Consider pre-fetching common tokens on startup
- Monitor API latency (target: <500ms p95)

### **5. Error Handling**
- NEVER crash if price API fails
- Always return a value (even if approximate)
- Log warnings for manual investigation

---

## 🚀 DEPLOYMENT PLAN

### **Phase 1: Local Testing (Day 1)**
1. ✅ Implement `tokenPriceService.ts`
2. ✅ Update `calculatePositionValue()`
3. ✅ Test with real positions locally
4. ✅ Verify logs and fallback behavior

### **Phase 2: Staging (Day 1-2)**
1. ✅ Deploy to Railway staging environment
2. ✅ Monitor logs for 24 hours
3. ✅ Compare TVL with DefiLlama
4. ✅ Fix any token mapping issues

### **Phase 3: Production (Day 2-3)**
1. ✅ Deploy to production
2. ✅ Update `PROJECT_STATE.md` with changes
3. ✅ Communicate TVL drop to stakeholders (if significant)
4. ✅ Monitor for 48 hours

---

## 📝 DOCUMENTATION UPDATES

After completing the task, update:

1. **`PROJECT_STATE.md`:**
   - Add changelog entry: "Fixed TVL calculation using real USD prices via CoinGecko"
   - Update "Known Issues" section (remove TVL accuracy issue)

2. **`docs/research/TVL_DIFFERENCES_LIQUILAB_VS_DEFILLAMA.md`:**
   - Mark P0 as completed
   - Update "Before/After" comparison with real results

3. **`README.md` (if exists):**
   - Document `COINGECKO_API_KEY` environment variable

---

## ❓ QUESTIONS TO CLARIFY

Before starting, please clarify:

1. **CoinGecko API Key:**
   - Do we have a Pro API key? (300 calls/min)
   - Or should I use free tier? (50 calls/min)

2. **Token List:**
   - Are there any Flare-specific tokens not on CoinGecko?
   - Should I integrate on-chain oracles as backup?

3. **Backward Compatibility:**
   - Should old TVL values be recalculated in the database?
   - Or only new calculations use correct prices?

4. **Testing Data:**
   - Do you have a test wallet with diverse pools I can use?
   - What's a good position ID for testing non-stablecoin pairs?

---

## 📚 REFERENCE LINKS

- **CoinGecko API Docs:** https://www.coingecko.com/en/api/documentation
- **Flare Network on CoinGecko:** https://www.coingecko.com/en/coins/flare-networks
- **Current Implementation:** `src/utils/poolHelpers.ts` (lines 808-878)
- **Analysis Document:** `docs/research/TVL_DIFFERENCES_LIQUILAB_VS_DEFILLAMA.md`

---

## ✅ SUCCESS CRITERIA

Task is complete when:

1. ✅ All token prices use real USD values from CoinGecko
2. ✅ Stablecoin pools remain accurate (±5%)
3. ✅ Non-stablecoin pools match DefiLlama (within coverage limits)
4. ✅ Proper error handling and fallbacks implemented
5. ✅ Caching works (5-min TTL, >80% hit rate)
6. ✅ All tests pass (stablecoin, non-stablecoin, fallback, cache)
7. ✅ Documentation updated
8. ✅ Deployed to production with monitoring

---

**Estimated Time:** 2-3 hours  
**Complexity:** Medium (straightforward API integration)  
**Risk:** Low (fallback strategies prevent breakage)  
**Impact:** 🔥 **Critical** (fixes 50-5000% TVL errors)

---

**🚀 Ready to implement! Let me know if you have any questions or need clarifications.**

---

**File:** `docs/PROMPT_FOR_GPT_TVL_FIX.md`  
**Created:** 2025-11-10  
**Priority:** P0 - Critical  
**Author:** LiquiLab Engineering Team

