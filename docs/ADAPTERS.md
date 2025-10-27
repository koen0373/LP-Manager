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
