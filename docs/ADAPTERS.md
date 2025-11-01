# LiquiLab Adapter Catalog

LiquiLab’s data layer is built around lightweight adapters that standardize how we ingest on-chain state across different DEX standards. Each adapter exposes a consistent shape for downstream enrichment services and analytics.

## FlareScan Adapter (Blockscout/Etherscan)
- **Type:** REST (Blockscout) + fallback to JSON-RPC
- **Purpose:** Contract creation dates, transfer history, collect events
- **Key endpoints:** `/api`, `/api/v2/logs`, `eth_getLogs`
- **Output:** Canonicalized log objects consumed by the ledger sync layer

## Enosys Adapter (v3 NFT)
- **Standard:** Uniswap v3-style NonFungiblePositionManager
- **Calls:**
  - `positions(tokenId)` for tick ranges, liquidity, tokens owed
  - Pool `slot0()` for price/tick
  - ERC20 `decimals()` for scaling amounts
- **Result:** Rich position view including min/max range, amounts, unclaimed fees, rFLR rewards

## BlazeSwap Adapter (v3 NFT)
- **Standard:** Uniswap v3 clone (NFT positions)
- **Calls:** Identical to Enosys adapter, but pointed at BlazeSwap contracts (position manager + pools)
- **Result:** Harmonized dataset so UI can compare BlazeSwap ranges/fees directly with Enosys

## SparkDEX Adapter (v2 ERC20)
- **Standard:** Uniswap v2-style LP tokens (ERC-20)
- **Calls:**
  - `getReserves()`
  - `token0()`, `token1()`
  - `totalSupply()`
  - `balanceOf(user)`
- **Computation:**
  - User share = `balanceOf / totalSupply`
  - Token amounts = share × reserves
  - TVL = amounts × token prices
- **Characteristics:** No NonFungiblePositionManager, so fees and share are inferred from LP token math.
- **Transport:** viem HTTP JSON-RPC (uses the same RPC_URL as other adapters)

## Adapter Summary
| DEX        | Standard | Key Entities                  | Notes                             |
|------------|----------|-------------------------------|-----------------------------------|
| Enosys     | v3 NFT   | Position NFT, Pool contract   | Range-aware analytics, rFLR data  |
| BlazeSwap  | v3 NFT   | Position NFT, Pool contract   | Same flow as Enosys               |
| SparkDEX   | v2 ERC20 | Pair contract, LP token       | ERC-20 LP share math (no NFTs)    |

All adapters return normalized records so downstream services (ledger, billing, analytics) can treat v2 and v3 pools uniformly.

## Adapter Data Contract v0.1

**Goal:** Normalize all provider data (DEX v3, staking, perps) so LiquiLab can analyse, advise, and demo wallets across platforms.

### Required Entities
- **Provider**: `{ slug, name, type, apiDocsUrl?, rateLimits }`
- **Market (Pool)**: `{ providerSlug, marketId, feeTierBps, token0{symbol,decimals,address}, token1{...}, poolAddress?, createdAt }`
- **MarketSnapshot (≤ hourly)**: `{ marketId, ts, price, tvlUsd, volume24hUsd?, incentiveUsd?, apyPct? }`
- **Position**: `{ onchainId, owner, marketId, status, lowerPrice, upperPrice, feeTierBps, createdAt }`
- **PositionSnapshot (≤ hourly)**: `{ positionId, ts, amount0, amount1, tvlUsd, unclaimedFees{token0,token1,usd}, incentivesUsd?, inRange }`
- **Computed (server-side allowed)**: IL, APY breakdown, range status, `staleSeconds`.

### Links (deep-link builders)
- `link.pool({ providerSlug, marketId })`
- `link.position({ providerSlug, positionId })`
- `link.claim({ providerSlug, positionId|marketId })`
- UTM schema: `utm_source=liquilab&utm_medium=app&utm_campaign=<flow>&utm_content=<providerSlug>-<id>-<action>`

### Error & Caching Rules
- Backoff on 429/5xx, per-host RPS caps, circuit breaker after 3 fails.
- Cache TTLs: price ≤60s, fees/incentives 60–300s, static 24h.
- Always return `staleSeconds`.

---

## Observability (Adapters)

**SLO:** 99.5% success (7-day), p95 latency ≤1200ms cached / ≤3000ms uncached.

**Metrics to emit**
- `adapter_requests_total{provider,route,status}`
- `adapter_latency_ms_p50/p95{provider,route}`
- `cache_hit_ratio{provider,route}`
- `stale_seconds{provider,entity}` (gauge)
- `errors_total{provider,kind}`

**Alerts**
- High error rate: `errors_total > 1% of adapter_requests_total` for 10m
- Staleness: `stale_seconds > TTL*3` for 15m
- Latency: `p95 > SLO` for 15m

---

## Simulated Live Demo

**Purpose:** Provide deterministic “live-looking” demo pools without querying user wallets.

### Mode Toggle
- `DEMO_MODE=sim` *(default)* → use simulated generator (`src/lib/demo/generator.ts`).
- `DEMO_MODE=live` → reserved; currently falls back to simulated data with warning.

### Price Anchors
- Anchors derived from `src/lib/prices/oracles.ts`.
- Override via env: `DEMO_PRICE_<SYMBOL>=1.23` or `DEMO_PRICE_<TOKEN0>_<TOKEN1>=0.045`.
- Symbols auto-normalised (`USD₮0` → `USDT0`).

### Generator Characteristics
- Seeded RNG by UTC hour ⇒ stable set for 60 minutes, subtle drift on next hour.
- Predefined provider mix (Enosys, SparkDEX, BlazeSwap) with max 3 BlazeSwap entries and ≤1 `flaro.org`.
- Diversity guardrails enforced:
  - ≥3 strategies (Aggressive/Balanced/Conservative).
  - ≥3 range statuses (In Range/Near Band/Out of Range).
  - Min TVL per pool ≥ requested `minTvl` (default `$150`).
  - APR = `((fees + incentives) / tvl) * 365 * 100`.
- Fees/incentives scaled by strategy + status; out-of-range pools show minimal accrual.

### API Contract
- `GET /api/demo/pools?limit=9&minTvl=150&providers=enosys,sparkdex,blazeswap`.
- 60s in-memory cache inside the route handler.
- Response payload includes `badgeLabel`, `legal.disclaimer`, `diversity` diagnostics, and token icons resolved via `src/services/tokenIconService.ts`.

### UI Labelling
- Badge: “Demo · generated from live prices”.
- Legal micro-copy: “Not financial advice.”
- Demo table lives in `src/components/demo/DemoPoolsTable.tsx` and maps API output to `PositionsTable`.
