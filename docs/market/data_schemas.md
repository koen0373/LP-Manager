# Collection Plan — Flare LP Markets (SparkDEX, Enosys, BlazeSwap)

## Global
- [ ] Normalize all timestamps to UTC; store `as_of_utc`.
- [ ] Use chain_id=14 (Flare) constants where needed. 
- [ ] Price source for USD normalization: prefer pool-side atomic quotes vs. stable (USDT₀/USDC.e). If missing, fallback to reference price (DEXScreener) flagged as `secondary`.
- [ ] Recency: 
      - platform_metrics refresh every 5 min
      - top_pairs_* refresh every 2–5 min
      - incentives_catalog refresh on change/cron daily
- [ ] Licensing/compliance:
      - Blockscout/Routescan REST: public, IP throttled (~10 rps); no redistribution limits on derived analytics; avoid bulk mirroring of raw API JSON beyond operational caches. 
      - Goldsky: requires API key; follow Goldsky ToS; may not redistribute endpoint. 
      - Protocol images/logos: exclude unless licensed.

---

## SparkDEX

### Primary path A (V1 metrics + pairs) — **Goldsky subgraph**
- [ ] Endpoint: `POST https://api.goldsky.com/api/public/subgraphs/ichi-org/flare-v1-sparkdex/gn` (GraphQL). 
- [ ] Example query (platform metrics):
{ factories: uniswapFactories(first:1){
totalLiquidityUSD totalVolumeUSD pairCount
}}
- [ ] Example query (pairs by TVL):
{ pairs(first:200, orderBy: reserveUSD, orderDirection: desc){
id token0{ id symbol decimals } token1{ id symbol decimals }
reserveUSD volumeUSD txCount
}}
- [ ] Compute `platform_metrics` and `top_pairs_*` from GraphQL entities.

### Primary path B (V3 pairs/metrics) — **Explorer logs + REST**
- [ ] Identify **Position Manager (SPARKDEX‑V3‑POS)**: e.g., NFT contract at `0xEE5F...527da` (from explorer). 
- [ ] Get **factory address** by reading `factory()` on PositionManager via JSON‑RPC (Tenderly or own node). Endpoint example: `POST https://flare.gateway.tenderly.co/<key>` with `eth_call` to `factory()` (ABI). 
- [ ] Use **Blockscout REST** on Flare Explorer to get pools:
- `GET /api?module=logs&action=getLogs&address=<V3_FACTORY>&topic0=keccak256("PoolCreated(address,address,uint24,int24,address)")` with block ranges (paginate). 
- [ ] For each pool, pull Swap events:
- `GET /api?module=logs&action=getLogs&address=<POOL>&topic0=keccak256("Swap(address,address,int256,int256,uint160,uint128,int24)")`
- [ ] Transform to volumes (token amounts → USD via stable‑routed quotes).
- [ ] Fallback pricing: pool spot to USDT₀/USDC.e pools or **secondary** DEXScreener endpoints.

**Fallbacks**
- [ ] If subgraph latency/outage: use REST logs only (slower).
- [ ] If explorer throttles: backoff + rolling windows; rotate to Routescan mirror. 

---

## Enosys (V3 CLMM)

### Primary path — **Explorer REST (instances → pools)**
- [ ] Enumerate V3 pools via Position NFT instances:
- Base: `tokens/{pos_nft}/instances` in Blockscout v2 (Swagger page lists under each explorer). Use the NFT at `0xD977...6657` (Enosys V3 Positions NFT). 
- Example (conceptual): `GET https://flare-explorer.flare.network/api/v2/tokens/0xD977...6657/instances?cursor=...`
- Each instance page includes “Pool Address”. (Verified by UI pages). 
- [ ] Optionally derive **V3_FACTORY** via PositionManager `factory()` using JSON‑RPC (Tenderly). 
- [ ] Pull per‑pool logs (Swap/Mint/Burn) to compute:
- TVL: from token reserves (slot0, liquidity); or approximate via Mint/Burn deltas.
- Volume 24h/7d: aggregate Swap amounts → USD.
- [ ] Pair metadata: token0/token1 via ERC‑20 `symbol/decimals` (`/api/v2/tokens/<addr>`).
- [ ] Incentives: scrape Ēnosys announcements & farms UI (flag **secondary** if only UI).

**Fallbacks**
- [ ] If instances REST is limited, switch to Factory PoolCreated logs.
- [ ] If explorer throttles: mirror with Routescan Etherscan‑like. 

---

## BlazeSwap (V2)

### Primary path — **Explorer Etherscan‑like (Routescan/Flarescan)**
- [ ] Factory (one labeled example): `0x292395792BCCf9440A8e7D4CEd495526a8C87065` (Blaze Swap Factory). 
- [ ] List pairs:
- `GET .../api?module=logs&action=getLogs&address=0x292395...&topic0=keccak256("PairCreated(address,address,address,uint256)")&fromBlock=<blk>&toBlock=latest`
- [ ] Then per‑pair:
- Swaps: `topic0=keccak256("Swap(address,uint256,uint256,uint256,uint256,address)")`
- Syncs: `topic0=keccak256("Sync(uint112,uint112)")` to reconstruct reserves/TVL.
- [ ] Token metadata via `/api/v2/tokens/<addr>` on Flare Explorer.

**Fallbacks**
- [ ] If log API constrained, use **secondary**: DEXScreener pool endpoints for current TVL/volume (mark secondary).

---

## Kinetic (reference only in Phase‑1)
- [ ] Use Kinetic docs addresses to query Compound‑style markets via explorer:
- Comptroller/Unitroller: read `getAllMarkets()`; markets (cTokens) → `supplyRatePerBlock`, `borrowRatePerBlock`, exchange rate, underlying. 
- [ ] Aggregate into venue overview (separate stream from AMMs).

---

## More Markets (reference only)
- [ ] Track Flare + MoreMarkets announcements for API/feeds; initial product routes XRP → FXRP → Flare DeFi strategies (monitor FXRP pools). 

---

## Firelight / stXRP
- [ ] What: XRP staking → FXRP on Flare → **stXRP** (LST) minted; used across DeFi. Sources: Firelight site + Flare explainer. 
- [ ] Data sources to monitor (once live):
- ERC‑20 stXRP token on Flare Explorer (`/api/v2/tokens/<stxrp>`).
- DEX pools (stXRP/*) via pool logs to compute liquidity, APRs.
- Protocol blog/announcements for reward rates/ESS fees. 