# DEBUG LOG - Internal Server Error Investigation

## Problem Summary
- **Symptom**: Pool detail pages (`/pool/22003`) return Internal Server Error or timeout (408)
- **First Discovery**: 2025-10-24 after implementing chart improvements (live price polling, type fixes, APS removal)
- **Environment**: Dev server (localhost:3000), macOS, Next.js 15.5.6

## Network Test Results

### Homepage Test ✅
```bash
curl http://127.0.0.1:3000
# Status: 200 OK
# Full HTML rendered, all assets loaded correctly
```

### API Endpoint Test ❌
```bash
curl "http://127.0.0.1:3000/api/pool/22003"
# Status: 408 Request Timeout
# Response: Empty
```

## Build Trace Analysis

From `.next/trace`:
- `/api/pool/[tokenId]` compilation takes **~43 seconds**
- Initial page load includes **552.js** bundle (541s minification)
- ECharts + viem causing massive bundle size

## Suspected Root Causes

### 1. API Route Performance (PRIMARY)
- `/api/pool/[tokenId].ts` is making **multiple slow calls**:
  - `getPositionById()` - RPC call to Flare network
  - `getTokenPriceForRewards()` - Multiple token price fetches
  - `syncPositionLedger()` - Can take 10-30s for first call
  - `getContractCreationDate()` - Flarescan API call
  
### 2. Live Price Polling (NEW CODE)
- `getLivePoolPrice()` calls `readPoolSlot0()` - another RPC call
- Adds 1-3s per request

### 3. Missing Environment Variables?
- Potential: `DATABASE_URL`, `RPC_URL` not set locally
- Would cause connection timeout

## Next Steps

1. ✅ Fix dev server network binding (`--hostname 127.0.0.1`) - **DONE**
2. ⏳ Add API route instrumentation to capture exact error
3. ⏳ Check .env file for missing variables
4. ⏳ Add timeout guards to slow RPC/API calls
5. ⏳ Consider caching for pool detail data

## Timeline
- 2025-10-24 19:00: Network fix applied
- 2025-10-24 19:05: Homepage loads successfully
- 2025-10-24 19:10: API endpoint times out (408)

