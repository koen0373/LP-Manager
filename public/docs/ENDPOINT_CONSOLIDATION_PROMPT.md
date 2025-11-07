# 🎯 LiquiLab Endpoint Consolidation - Implementation Prompt

## Quick Summary

**Use this prompt when implementing the endpoint consolidation plan.**

LiquiLab heeft een kritiek probleem: **inconsistente data structuren** over meerdere API endpoints waardoor dezelfde pool verschillende waarden toont op verschillende pagina's.

## The Problem in One Sentence

Pool #22003 toont op de **pricing page** andere TVL/status/rewards dan op het **dashboard** omdat elk endpoint zijn eigen veldnamen (`dailyFeesUsd` vs `unclaimedFeesUsd`), eigen structuur (nested vs flat), en eigen categorization logic gebruikt.

## The Solution in One Sentence  

**Eén canonical endpoint** (`/api/positions`) met **één data structuur** (`PositionRow`) gebaseerd op **Position Manager contract** als single source of truth voor alle pagina's.

---

## 📋 Implementation Instructions

### Context Files to Read First
1. `docs/ENDPOINT_CONSOLIDATION_PLAN.md` - Full detailed plan
2. `src/lib/discovery/types.ts` - Current data types
3. `src/lib/discovery/normalize.ts` - Normalization logic
4. `pages/api/positions.ts` - Main endpoint

### Phase 2: Update `/api/positions` Response (START HERE)

**Goal**: Add response wrapper with summary

**File**: `pages/api/positions.ts`

**Current response** (line 150):
```typescript
res.status(200).json(serializedPositions);
```

**Change to**:
```typescript
const summary = summarizePositions(serializedPositions);

res.status(200).json({
  success: true,
  data: {
    positions: serializedPositions,
    summary: {
      total: serializedPositions.length,
      active: summary.active,
      inactive: summary.inactive,
      ended: summary.ended,
      byProvider: summary.byProvider,
      totals: {
        tvlUsd: summary.totalTvl,
        unclaimedFeesUsd: summary.totalFees,
        incentivesUsd: summary.totalIncentives,
        totalRewardsUsd: summary.totalRewards
      }
    },
    fetchedAt: new Date().toISOString(),
    staleSeconds: 60
  },
  duration: Date.now() - startTime
});
```

**Import needed**:
```typescript
import { summarizePositions } from '@/lib/positions';
```

---

### Phase 3: Audit Provider Adapters

**Goal**: Ensure all providers return consistent `PositionRow` structure

#### 1. Check Enosys (Viem)
**File**: `src/services/positions.ts` or `src/lib/onchain/*`

**What to verify**:
- ✅ Uses `enrichPosition()` → `normalizePosition()` pipeline
- ✅ Returns fields: `tvlUsd`, `unclaimedFeesUsd`, `rflrRewardsUsd`, `incentivesUsd`
- ✅ Status calculated as `tvlUsd > 0 ? 'Active' : 'Inactive'`

**Expected**: Already correct (uses normalize.ts)

#### 2. Check SparkDEX
**File**: `src/services/sparkdex.ts` or similar

**What to verify**:
- Returns same `PositionRow` structure as Enosys
- Has `unclaimedFeesUsd` (not `dailyFeesUsd`)
- Has `incentivesUsd` field
- Correct status calculation

**Action if inconsistent**: Update adapter to match `PositionRow` interface

#### 3. Check BlazeSwap
**File**: `src/services/blazeswap.ts` or similar

**What to verify**:
- Returns same `PositionRow` structure
- Correct field naming
- Correct status calculation

**Action if inconsistent**: Update adapter to match `PositionRow` interface

---

### Phase 4: Update Frontend Consumers

#### 1. Pricing Page ✅ DONE
**File**: `pages/pricing.tsx`
**Status**: Already uses `/api/positions` and flexible field names

#### 2. Dashboard
**File**: `pages/dashboard.tsx`

**Current** (probably):
```typescript
const response = await fetch(`/api/wallet/summary?address=${address}`);
```

**Change to**:
```typescript
const response = await fetch(`/api/positions?address=${address}`);
const { data } = await response.json();
const positions = data.positions;
const summary = data.summary;
```

**Remove**: Custom categorization logic (use `data.summary` instead)

#### 3. Header Wallet Display
**File**: `src/components/Header.tsx`

**Find**: Wallet balance/position display code

**Change**: Use `/api/positions` with summary data

#### 4. Demo Components
**File**: `src/components/demo/DemoPoolsTable.tsx` or similar

**Current**: Probably uses `/api/demo/pools` or `/api/demo/selection`

**Change to**: 
```typescript
// Use seed wallets
const DEMO_WALLETS = [
  '0x...wallet1',
  '0x...wallet2',
  // etc
];

// Fetch real positions
const allPositions = await Promise.all(
  DEMO_WALLETS.map(addr => 
    fetch(`/api/positions?address=${addr}`).then(r => r.json())
  )
);

// Flatten and dedupe
const positions = allPositions
  .flatMap(resp => resp.data.positions)
  .filter((p, i, arr) => 
    arr.findIndex(x => x.poolId === p.poolId) === i
  );

// Client-side selection logic
const selectedPools = selectDemoPools(positions, {
  count: 9,
  providers: ['enosys-v3', 'sparkdex-v3', 'blazeswap-v2'],
  minTvl: 150,
  // ... diversity rules
});
```

---

### Phase 5: Create Client Utilities

**File**: `src/lib/positions/client.ts` (NEW)

```typescript
import type { PositionRow } from '@/types/positions';

/**
 * Calculate total rewards (fees + incentives)
 * ALWAYS use this function, never calculate manually
 */
export function calculateRewards(position: PositionRow): number {
  const fees = position.unclaimedFeesUsd || 0;
  const incentives = position.incentivesUsd || 
                    position.rflrRewardsUsd || 
                    position.rflrUsd || 
                    0;
  return fees + incentives;
}

/**
 * Categorize position by CANONICAL rules
 * Active: TVL > 0
 * Inactive: TVL = 0 AND Rewards > 0
 * Ended: TVL = 0 AND Rewards = 0
 */
export function categorizePosition(
  position: PositionRow
): 'Active' | 'Inactive' | 'Ended' {
  const tvl = position.tvlUsd || 0;
  const rewards = calculateRewards(position);
  
  if (tvl > 0) return 'Active';
  if (rewards > 0) return 'Inactive';
  return 'Ended';
}

/**
 * Sort positions by category and value
 */
export function sortPositions(positions: PositionRow[]): PositionRow[] {
  return [...positions].sort((a, b) => {
    const catA = categorizePosition(a);
    const catB = categorizePosition(b);
    
    // Active first, then Inactive, then Ended
    if (catA !== catB) {
      if (catA === 'Active') return -1;
      if (catB === 'Active') return 1;
      if (catA === 'Inactive') return -1;
      return 1;
    }
    
    // Within same category: sort by value
    if (catA === 'Active') {
      return (b.tvlUsd || 0) - (a.tvlUsd || 0);
    }
    return calculateRewards(b) - calculateRewards(a);
  });
}

/**
 * Format position for display (add derived fields)
 */
export function formatPositionForDisplay(position: PositionRow) {
  return {
    ...position,
    rewardsUsd: calculateRewards(position),
    category: categorizePosition(position),
    rangeWidthPct: calculateRangeWidth(position),
    strategy: classifyStrategy(position.lowerPrice, position.upperPrice)
  };
}

function calculateRangeWidth(p: PositionRow): number {
  if (!p.lowerPrice || !p.upperPrice) return 0;
  const mid = (p.lowerPrice + p.upperPrice) / 2;
  return ((p.upperPrice - p.lowerPrice) / mid) * 100;
}

function classifyStrategy(min: number, max: number): string {
  const width = calculateRangeWidth({ lowerPrice: min, upperPrice: max } as PositionRow);
  if (width < 12) return 'Aggressive';
  if (width <= 35) return 'Balanced';
  return 'Conservative';
}
```

**Usage in components**:
```typescript
import { calculateRewards, categorizePosition, sortPositions } from '@/lib/positions/client';

// In component
const positions = data.positions.map(formatPositionForDisplay);
const sorted = sortPositions(positions);

// Display
{sorted.filter(p => p.category === 'Active').map(pos => (
  <PoolRow 
    key={pos.id}
    tvl={pos.tvlUsd}
    rewards={pos.rewardsUsd}  // Always use this, never calculate manually
    status={pos.category}
  />
))}
```

---

### Phase 6: Deprecate Old Endpoints

#### Mark for deprecation (add to each file):

**`pages/api/positions-v2.ts`**:
```typescript
console.warn('[DEPRECATED] /api/positions-v2 is deprecated. Use /api/positions instead.');
// Redirect to new endpoint
return res.redirect(307, `/api/positions?${new URLSearchParams(req.query as Record<string, string>)}`);
```

**`pages/api/wallet/summary.ts`**:
```typescript
console.warn('[DEPRECATED] /api/wallet/summary is deprecated. Use /api/positions instead.');
// Option A: Redirect
return res.redirect(307, `/api/positions?address=${address}`);

// Option B: Keep as thin wrapper (if needed for backward compat)
const positionsResponse = await fetch(`${baseUrl}/api/positions?address=${address}`);
const { data } = await positionsResponse.json();
// Transform to old structure for compatibility
return res.json(transformToLegacyFormat(data));
```

**`pages/api/demo/*.ts`**: Add deprecation warnings, plan for removal

---

### Testing Checklist

After implementation, verify:

1. **Pricing page**:
   - [ ] Shows correct Active/Inactive/Ended counts
   - [ ] Pool #22003 appears under Active (if TVL > 0)
   - [ ] Pool #22699 appears under Inactive (if TVL=0 but has rewards)

2. **Dashboard**:
   - [ ] Shows same position data as pricing page
   - [ ] Summary numbers match `/api/positions` response

3. **Header**:
   - [ ] Wallet display shows correct position count
   - [ ] Numbers match dashboard

4. **Demo**:
   - [ ] Shows realistic pools from real wallets
   - [ ] No more mock data

5. **API Response**:
   - [ ] `/api/positions` returns wrapped response with summary
   - [ ] All providers return consistent `PositionRow` structure
   - [ ] Field names are consistent: `unclaimedFeesUsd`, `incentivesUsd`, `rewardsUsd`

---

## 🚨 Critical Rules

1. **NEVER** create custom categorization logic in components
2. **ALWAYS** use `calculateRewards()` from client utils
3. **NEVER** use field names like `dailyFeesUsd` (use `unclaimedFeesUsd`)
4. **ALWAYS** check TVL first, range status never affects categorization
5. **NEVER** create new position endpoints without updating this plan

---

## Success = One Source of Truth

When done, these should ALL return the same data:
- Pricing page pool list
- Dashboard pool list  
- Header wallet display
- Demo pool table
- Any future feature using position data

**All data flows through `/api/positions` → All use same `PositionRow` structure → All apply same categorization rules**

---

## Questions to Ask During Implementation

1. Does this component need position data?
   - ✅ YES → Use `/api/positions`
   - ❌ NO → Don't add custom endpoint

2. Do I need to calculate rewards?
   - ✅ YES → Import `calculateRewards()` from client utils
   - ❌ NO → Don't write custom calculation

3. Do I need to categorize Active/Inactive/Ended?
   - ✅ YES → Import `categorizePosition()` from client utils
   - ❌ NO → Don't write custom logic

4. Am I seeing inconsistent data?
   - 🔴 STOP → Check which endpoint you're using
   - 🔴 STOP → Check which fields you're reading
   - ✅ FIX → Use `/api/positions` with canonical field names

---

**Read full plan**: `docs/ENDPOINT_CONSOLIDATION_PLAN.md`
**Last updated**: 2025-10-30






