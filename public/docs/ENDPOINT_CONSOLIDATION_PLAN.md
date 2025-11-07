# 🚨 LiquiLab API Endpoint Consolidation Plan

## Problem Statement

**CRITICAL ISSUE**: LiquiLab heeft momenteel een gefragmenteerd endpoint landschap met inconsistente data structuren, veldnamen en business logic verspreid over meerdere API endpoints en services. Dit leidt tot:

1. **Data inconsistentie**: Dezelfde pool kan verschillende waarden hebben afhankelijk van welk endpoint wordt gebruikt
2. **Veldnaam chaos**: `dailyFeesUsd` vs `unclaimedFeesUsd`, `incentivesUsd` vs `rflrRewardsUsd`, `status` vs `isInRange`
3. **Dubbele logica**: Categorization rules zijn op 3+ plaatsen geïmplementeerd met subtiele verschillen
4. **Maintainability nightmare**: Elke bug fix moet op meerdere plekken worden doorgevoerd
5. **User confusion**: Pricing page toont andere data dan dashboard

## Current Endpoint Landscape

### 🔴 PRIMARY ENDPOINTS (Inconsistent)

#### `/api/positions`
**Current Usage**: Pricing page, header wallet info
**Method**: GET
**Query**: `?address=0x...&refresh=1`
**Data Source**: Aggregates 3 sources:
- `getLpPositionsOnChain()` - Viem/Enosys
- `getBlazeSwapPositions()` - BlazeSwap
- `getSparkdexPositions()` - SparkDEX

**Response Structure**:
```typescript
PositionRow[] {
  id: string
  tvlUsd: number
  rewardsUsd: number           // ❌ NOT used correctly
  unclaimedFeesUsd: number     // ✅ Actual unclaimed fees
  rflrRewardsUsd: number       // ✅ rFLR incentives
  rflrUsd: number              // ✅ Duplicate of above
  status: 'Active' | 'Inactive'  // ❌ Wrong threshold (> 1 instead of > 0)
  isInRange: boolean
  // ... 30+ other fields
}
```

**Issues**:
- ❌ Status calculated incorrectly in `normalize.ts` (was `tvlUsd > 1`)
- ❌ Missing `incentivesUsd` field
- ❌ `rewardsUsd` exists but not reliably calculated
- ❌ No distinction between fees and incentives in single field

---

#### `/api/positions-v2`
**Current Usage**: NOT USED (newer attempt)
**Method**: GET
**Query**: `?address=0x...&refresh=1&status=active|inactive`
**Data Source**: Uses `discoverWalletPositions()` → same underlying sources

**Response Structure**:
```typescript
{
  success: boolean
  data: {
    positions: PositionRow[]
    summary: {
      totalCount: number
      activeCount: number
      inactiveCount: number
      totalTvlUsd: number
      totalFeesUsd: number
      totalRewardsUsd: number
    }
    fetchedAt: string
  }
}
```

**Status**: Cleaner structure but abandoned halfway through migration

---

#### `/api/wallet/summary`
**Current Usage**: Dashboard summary widget (if used)
**Method**: GET
**Query**: `?address=0x...`

**Response Structure**:
```typescript
{
  wallet: string
  totals: {
    tvlUsd: number
    feesRealizedUsd: number
    rewardsUsd: number
    unclaimedFeesUsd: number
    rflrAmount: number
    rflrUsd: number
    capitalInvestedUsd: number
    roiPct: number
  }
  positions: Array<{
    tokenId: string
    status: 'active' | 'inactive'  // ✅ Uses tvlUsd > 0 threshold
    tvlUsd: number
    accruedFeesUsd: number
    realizedFeesUsd: number
    rflrAmount: number
    rflrUsd: number
  }>
}
```

**Issues**:
- ❌ Different field names than `/api/positions`
- ❌ Different position structure
- ❌ Uses its own categorization logic (line 171)

---

#### `/api/pool/[tokenId]`
**Current Usage**: Individual pool detail pages
**Method**: GET
**Query**: `/api/pool/22003`

**Response Structure**: Completely different!
```typescript
{
  pairLabel: string
  poolId: number
  tvl: {           // ❌ Nested object!
    tvlUsd: number
    amount0: number
    amount1: number
  }
  rewards: {       // ❌ Nested object!
    feesUsd: number
    rflrUsd: number
    totalUsd: number
  }
  // ... completely different structure
}
```

**Issues**:
- ❌ Incompatible structure with `/api/positions`
- ❌ Cannot be used interchangeably

---

### 🟡 DEMO/UTILITY ENDPOINTS (Should be removed/consolidated)

#### `/api/demo/pools` 
**Purpose**: Demo pool data for homepage
**Should use**: Real position data from Position Manager

#### `/api/demo/pool-live`
**Purpose**: Single pool lookup for demo
**Should use**: `/api/pool/[tokenId]`

#### `/api/demo/selection`
**Purpose**: Curated demo selection
**Should be**: Static seed list + `/api/positions`

#### `/api/demo/portfolio`
**Status**: Legacy, should be removed

---

### 🔵 ADMIN/SUPPORT ENDPOINTS (OK to keep separate)

- `/api/admin/*` - Admin functions
- `/api/analytics/*` - Analytics
- `/api/blazeswap/*` - BlazeSwap specific
- `/api/discovery/*` - Wallet discovery
- `/api/backfill/*` - Data backfilling
- `/api/health` - Health check
- `/api/notify` - Notifications

---

## Canonical Data Source: Position Manager

### What the Position Manager Contract Returns

**From NonfungiblePositionManager.positions(tokenId)**:
```solidity
struct PositionInfo {
  uint96 nonce;
  address operator;
  address token0;
  address token1;
  uint24 fee;              // Fee tier in hundredths of a bip (e.g., 3000 = 0.3%)
  int24 tickLower;
  int24 tickUpper;
  uint128 liquidity;
  uint256 feeGrowthInside0LastX128;
  uint256 feeGrowthInside1LastX128;
  uint128 tokensOwed0;     // Unclaimed fees in token0
  uint128 tokensOwed1;     // Unclaimed fees in token1
}
```

### Enrichment Flow

```
Position Manager Data (on-chain)
         ↓
  RawPositionData (src/lib/discovery/types.ts)
         ↓
  EnrichedPosition (+ token metadata, prices, pool state)
         ↓
  PositionRow (normalized DTO for UI)
```

---

## Proposed Solution: Single Source of Truth

### 🎯 ONE CANONICAL ENDPOINT: `/api/positions`

**Goal**: All position data flows through one well-defined endpoint

### Proposed Response Structure

```typescript
// GET /api/positions?address=0x...&refresh=1
{
  success: boolean
  data: {
    positions: PositionRow[]
    summary: {
      total: number
      active: number
      inactive: number
      ended: number
      byProvider: Record<string, number>
      totals: {
        tvlUsd: number
        unclaimedFeesUsd: number
        incentivesUsd: number        // rFLR + APS + others
        totalRewardsUsd: number      // fees + incentives (calculated)
      }
    }
    fetchedAt: string
    staleSeconds: number
  }
  duration: number
}

// PositionRow (canonical structure)
interface PositionRow {
  // Identity
  id: string                         // tokenId or provider-specific ID
  poolId: string                     // Human-readable pool ID
  poolAddress: Address
  walletAddress: Address
  provider: string                   // "enosys-v3" | "sparkdex-v3" | "blazeswap-v2"
  
  // Tokens
  token0: {
    address: Address
    symbol: string
    name: string
    decimals: number
    priceUsd: number
  }
  token1: {
    address: Address
    symbol: string
    name: string
    decimals: number
    priceUsd: number
  }
  pairLabel: string                  // "WFLR/USD₮0"
  
  // Position specifics
  feeTierBps: number                 // Fee tier in basis points (30 = 0.3%)
  tickLower: number
  tickUpper: number
  lowerPrice: number                 // Human-readable price
  upperPrice: number                 // Human-readable price
  currentPrice: number               // Current pool price
  liquidity: string                  // BigInt as string
  
  // Amounts
  amount0: number                    // Position amount in token0
  amount1: number                    // Position amount in token1
  
  // TVL
  tvlUsd: number                     // ✅ CANONICAL: Total Value Locked
  
  // FEES (unclaimed trading fees)
  fee0: number                       // Unclaimed fees in token0
  fee1: number                       // Unclaimed fees in token1
  unclaimedFeesUsd: number          // ✅ CANONICAL: Unclaimed fees in USD
  
  // INCENTIVES (protocol rewards: rFLR, APS, etc.)
  incentives: {
    rflr: {
      amount: number                 // rFLR amount
      usd: number                    // rFLR value in USD
    }
    aps?: {
      amount: number                 // APS amount (future)
      usd: number                    // APS value in USD
    }
    // Extensible for future reward tokens
  }
  incentivesUsd: number             // ✅ CANONICAL: Total incentives in USD
  
  // REWARDS (calculated, never stored)
  // rewardsUsd = unclaimedFeesUsd + incentivesUsd
  rewardsUsd: number                // ✅ CANONICAL: Always calculated
  
  // Range status
  inRange: boolean                  // Is current price within range?
  rangeStatus: 'in' | 'near' | 'out'  // Visual status for UI
  
  // Pool status (CANONICAL RULES)
  // Active: tvlUsd > 0
  // Inactive: tvlUsd === 0 AND rewardsUsd > 0
  // Ended: tvlUsd === 0 AND rewardsUsd === 0
  status: 'Active' | 'Inactive'     // Binary status from data layer
  
  // Timestamps
  createdAt?: string                // ISO timestamp
  lastUpdated: string               // ISO timestamp
  
  // Optional metadata
  poolSharePct?: number             // % of pool owned
  onchainId?: string                // Raw on-chain tokenId
}
```

---

## Implementation Plan

### Phase 1: Consolidate Data Layer ✅ DONE

- [x] Fix `normalize.ts` status threshold (`tvlUsd > 1` → `tvlUsd > 0`)
- [x] Add missing fields to `PositionRow` type
- [x] Implement flexible field name mapping in `summarizePositions()`
- [x] Document canonical data model in `PROJECT_STATE.md`

### Phase 2: Update `/api/positions` Endpoint

**File**: `pages/api/positions.ts`

1. Add wrapper response structure:
   ```typescript
   {
     success: true,
     data: {
       positions: PositionRow[],
       summary: summarizePositions(positions),
       fetchedAt: new Date().toISOString(),
       staleSeconds: 60
     },
     duration: Date.now() - startTime
   }
   ```

2. Ensure all providers return consistent `PositionRow` structure:
   - `getLpPositionsOnChain()` ✅ Uses normalize.ts
   - `getBlazeSwapPositions()` ❓ Needs audit
   - `getSparkdexPositions()` ❓ Needs audit

### Phase 3: Deprecate Inconsistent Endpoints

1. **Redirect `/api/positions-v2` → `/api/positions`**
   - Add deprecation warning
   - Keep as alias for 2 weeks
   - Remove after transition

2. **Remove `/api/wallet/summary`**
   - Migrate dashboard to use `/api/positions`
   - Dashboard should call `/api/positions` and calculate summary client-side
   - OR keep `/api/wallet/summary` as thin wrapper around `/api/positions`

3. **Consolidate Demo Endpoints**
   - `/api/demo/pools` should call `/api/positions` with seed wallets
   - Remove `/api/demo/pool-live` (use `/api/pool/[id]`)
   - Remove `/api/demo/selection` (client-side selection from `/api/positions`)
   - Remove `/api/demo/portfolio` (unused)

### Phase 4: Update All Consumers

**Priority 1 - User-Facing**:
- [ ] `pages/pricing.tsx` - Already uses `/api/positions` ✅
- [ ] `src/components/Header.tsx` - Wallet display
- [ ] `pages/dashboard.tsx` - Main dashboard

**Priority 2 - Demo**:
- [ ] `pages/index.tsx` - Homepage demo
- [ ] `src/components/demo/DemoPoolsTable.tsx`

**Priority 3 - Detail Pages**:
- [ ] Individual pool detail pages (keep using `/api/pool/[id]` for now)

### Phase 5: Frontend Data Utilities

Create reusable client-side utilities:

**File**: `src/lib/positions/client.ts`
```typescript
// Calculate rewards (always client-side)
export function calculateRewards(position: PositionRow): number {
  const fees = position.unclaimedFeesUsd || 0;
  const incentives = position.incentivesUsd || 0;
  return fees + incentives;
}

// Categorize position
export function categorizePosition(position: PositionRow): 'Active' | 'Inactive' | 'Ended' {
  const tvl = position.tvlUsd || 0;
  const rewards = calculateRewards(position);
  
  if (tvl > 0) return 'Active';
  if (rewards > 0) return 'Inactive';
  return 'Ended';
}

// Format position for display
export function formatPosition(position: PositionRow): DisplayPosition {
  return {
    ...position,
    rewardsUsd: calculateRewards(position),
    category: categorizePosition(position),
    // ... other derived fields
  };
}
```

---

## Migration Checklist

### Backend
- [ ] Audit `getBlazeSwapPositions()` - ensure it returns correct `PositionRow` structure
- [ ] Audit `getSparkdexPositions()` - ensure it returns correct `PositionRow` structure
- [ ] Update `/api/positions` response wrapper
- [ ] Add deprecation warnings to old endpoints
- [ ] Create `src/lib/positions/client.ts` utility library
- [ ] Update API documentation

### Frontend
- [ ] Update `pages/pricing.tsx` to use new response structure
- [ ] Update dashboard to use `/api/positions` instead of `/api/wallet/summary`
- [ ] Update header wallet display
- [ ] Update demo components to use `/api/positions` with seed wallets
- [ ] Remove all custom categorization logic from UI components
- [ ] Use client-side utilities for all derived calculations

### Testing
- [ ] Test `/api/positions` with multiple wallets
- [ ] Verify Active/Inactive/Ended categorization is consistent
- [ ] Test pricing page pool selection
- [ ] Test dashboard display
- [ ] Test demo pool rendering
- [ ] Verify all providers (Enosys/BlazeSwap/SparkDEX) return consistent data

### Documentation
- [ ] Update `README.md` with canonical endpoint documentation
- [ ] Update `PROJECT_STATE.md` with migration notes
- [ ] Document `PositionRow` structure in JSDoc
- [ ] Add examples to API documentation

### Cleanup (After 2 weeks)
- [ ] Remove `/api/positions-v2`
- [ ] Remove `/api/wallet/summary` (or keep as thin wrapper)
- [ ] Remove `/api/demo/pool-live`
- [ ] Remove `/api/demo/selection`
- [ ] Remove `/api/demo/portfolio`
- [ ] Remove old categorization logic from `src/lib/positions.ts` (if not used)

---

## Success Criteria

✅ **Single Source of Truth**: All position data comes from `/api/positions`
✅ **Consistent Data**: Same pool shows same values everywhere
✅ **Clear Categorization**: Active/Inactive/Ended rules applied consistently
✅ **Canonical Fields**: All components use `unclaimedFeesUsd` + `incentivesUsd` (never custom field names)
✅ **Maintainable**: Bug fixes in one place propagate everywhere
✅ **Extensible**: Easy to add new reward tokens (APS, etc.)
✅ **Documented**: Clear API documentation and TypeScript types

---

## Timeline

- **Week 1**: Phase 2-3 (Backend consolidation)
- **Week 2**: Phase 4 (Frontend migration)
- **Week 3**: Phase 5 (Testing & Documentation)
- **Week 4+**: Cleanup deprecated endpoints

---

## Notes

- Keep `/api/pool/[tokenId]` for detailed pool view (different use case)
- Admin endpoints remain separate
- Demo mode should use real data from `/api/positions` with curated seed wallets
- All new features must use `/api/positions` as primary data source
- No more custom endpoints without explicit approval

---

**Last Updated**: 2025-10-30
**Status**: 🔴 CRITICAL - Needs immediate attention
**Owner**: Development Team






