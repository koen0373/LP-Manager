# Indexer — Architecture & Runbook

**Goal.** Single resumable indexer that (A) writes lossless raw, (B) enriches where possible, (C) prepares analytics-ready aggregations. Append-only with idempotent upserts.

## 1) Streams & State
- **Factories → Pools.** Scan *PoolCreated|CreatePool* for Enosys/SparkDEX → `raw.logs`, `core.pools`.
- **Blocks/Txs/Logs.** Per window: headers, tx summaries, raw logs for factories, NFPM, pools.
- **NFPM events.** Decode v3 (mint/increase/decrease/collect/burn) + ERC721 (transfer/approval) → `raw.logs` + normalized `raw.nfpm_*`.
- **Pool state snapshots.** Periodic/each window: `slot0, liquidity, feeGrowth*` → `raw.pool_state`.
- **Position storage reads.** Hooked to NFPM events → `raw.position_reads`.
- **Cursors.** `data/cursors.json`: `{stream,lastProcessedBlock,safeConfirmations,updatedAt}`.
- **Confirm depth.** Default 16 (reorg-safe).
- **Windowing.** Default 1,000 blocks; dynamic backoff & RPC rotation.

## 2) Storage layout
**RAW (lossless)**
- `data/raw/blocks.ndjson` • `data/raw/txs.ndjson` • `data/raw/logs.ndjson`
- `data/core/tokens.json` • `data/core/factories.json` • `data/core/pools.ndjson` • `data/core/nfpm.json`
- `data/raw/nfpm_*.ndjson` (mint/increase/decrease/collect/burn, erc721_transfer/approval/approval_for_all)
- `data/raw/pool_state.ndjson` • `data/raw/position_reads.ndjson`

**ENRICHED**
- `data/enriched/positions.json` (latest per tokenId)
- `data/enriched/position_events.ndjson` (normalized)
- `data/enriched/pool_runtime.json`
- `data/prices/prices_token.ndjson` (placeholder)

**ANALYTICS (prepared)**
- `data/analytics/daily/*.ndjson` (pool/wallet/tokenId cohorts; tvl, feesAccrued/Collected, IL_est, utilization, …)

## 3) Idempotency & Integrity
- PKs: raw logs (`txHash,logIndex`), pools (`factory,pool`), pool_state (`pool,block`), position_reads (`tokenId,block`).
- Atomic writes: tmp+rename, file locks; small `.idx` maps for seen keys.

## 4) Robust Decoding & Fallback
- Supports both `PoolCreated` and `CreatePool`.
- NFPM ABI = Uniswap v3-compatible + ERC721.
- If decode fails → keep raw intact; enriched records `reason`.

## 5) Observability
- `data/indexer.progress.json` live status.
- JSON logs to `logs/indexer-*.log`.
- API: `/api/indexer/progress` (simple JSON).

## 6) Commands (Mac/zsh)
```zsh
# Enosys
pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts \
  --factory=enosys --from=29837200 \
  --streams=factories,pools,logs,nfpm,pool_state,position_reads \
  --rps=8 --confirmations=16 --reset

# SparkDEX
pnpm exec tsx -r dotenv/config scripts/indexer-backfill.ts \
  --factory=sparkdex --from=30617263 \
  --streams=factories,pools,logs,nfpm,pool_state,position_reads \
  --rps=8 --confirmations=16
```
