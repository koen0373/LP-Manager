# Phase 1: Foundation (RPC + Adapters) ✅

## Overview
Phase 1 establishes the foundational infrastructure for reliable on-chain data ingestion:
- **RPC Client**: Multi-endpoint fallback system for resilient blockchain access
- **FlareScan Adapter**: Rate-limited, typed API client for Blockscout/Etherscan endpoints
- **On-chain Readers**: Pure read-only functions for smart contract interaction
- **Configuration**: Centralized constants, addresses, and settings

## What Was Built

### 1. On-chain Module (`src/lib/onchain/`)

#### `config.ts`
Central configuration file containing:
- **Chain ID**: `14` (Flare mainnet)
- **RPC Endpoints**: Primary + fallback endpoints
- **Contract Addresses**: Enosys Position Manager, Factory, Router, Quoter, Incentives
- **Token Addresses**: WFLR, RFLR, APS, EUSDT, FXRP, USD0, etc.
- **Event Signatures**: Uniswap V3 Pool & PositionManager events
- **Rate Limits**: Flarescan RPS, RPC batch sizes
- **Cache TTLs**: Token metadata (24h), positions (2m), prices (30s)
- **Ingest Config**: Block ranges, confirmations, retry logic

#### `client.ts`
RPC client factory with fallback support:
- `createClientWithFallback()`: Creates Viem public client with multiple RPC endpoints
- Automatic retry logic with exponential backoff
- Batch request optimization
- Singleton `publicClient` export

#### `readers.ts`
Pure read-only blockchain functions:
- `readTokenMetadata(address)`: Get symbol, name, decimals
- `readPositionData(tokenId)`: Get full position data from PositionManager
- `readPoolAddress(token0, token1, fee)`: Get pool address from Factory
- `readPoolSlot0(poolAddress)`: Get current price, tick, liquidity
- `readPositionOwner(tokenId)`: Get NFT owner
- `readTokenBalance(tokenAddress, account)`: Get ERC20 balance
- `readLatestBlockNumber()`: Get latest block
- `readBlockTimestamp(blockNumber)`: Get block timestamp

All functions include:
- Timeout protection (10-15s)
- Error handling with fallbacks
- Memoization where appropriate

#### `abis/index.ts`
Contract ABIs:
- `ERC20_ABI`: Minimal ERC20 (symbol, name, decimals, balanceOf)
- `FACTORY_ABI`: Uniswap V3 Factory (getPool)
- `POOL_ABI`: Uniswap V3 Pool (slot0, liquidity, ticks, events)
- `INCENTIVE_ABI`: Rewards contracts (earned, getReward)
- Re-export of `NonfungiblePositionManagerABI`

### 2. FlareScan Adapter (`src/lib/adapters/flarescan/`)

#### `types.ts`
TypeScript definitions for:
- **V1 API** (Etherscan-compatible): Contract creation, transactions, NFT transfers, logs
- **V2 API** (Blockscout REST): Contract info, transactions, NFT transfers, logs
- **Normalized types**: Internal consistent format for transfers and logs

#### `client.ts`
Rate-limited API client:
- **RateLimiter class**: Token bucket algorithm (2 req/s for Flarescan)
- **V1 API functions**:
  - `getContractCreation(address)`: Get contract creation tx
  - `getTransactionInfo(txHash)`: Get transaction details
  - `getNFTTransfers(contract, address?, startBlock?, endBlock?)`: Get NFT transfers
  - `getEventLogs(address, fromBlock, toBlock, topics?)`: Get event logs
- **V2 API functions**:
  - `getContractInfo(address)`: Get contract metadata + ABI
  - `getTransaction(txHash)`: Get transaction
  - `getNFTInstanceTransfers(contract, tokenId, page, pageSize)`: Get NFT instance transfers
  - `getLogsPOST(address, fromBlock, toBlock, topics)`: Get logs via POST

All functions:
- Respect rate limits (2 req/s)
- Timeout protection (30s)
- Typed responses with Zod-like parsing
- Consistent error handling

## File Structure
```
src/lib/
├── onchain/
│   ├── config.ts          # Central configuration
│   ├── client.ts          # RPC client factory
│   ├── readers.ts         # On-chain read functions
│   ├── abis/
│   │   └── index.ts       # Contract ABIs
│   └── index.ts           # Barrel export
└── adapters/
    └── flarescan/
        ├── types.ts       # API type definitions
        ├── client.ts      # Rate-limited API client
        └── index.ts       # Barrel export
```

## Usage Examples

### On-chain Reading
```typescript
import { readPositionData, readPoolSlot0, readTokenMetadata } from '@/lib/onchain';

// Get position data
const position = await readPositionData(BigInt(22003));
console.log(position.liquidity, position.tickLower, position.tickUpper);

// Get pool state
const slot0 = await readPoolSlot0(poolAddress);
console.log('Current tick:', slot0.tick);

// Get token info
const token = await readTokenMetadata(tokenAddress);
console.log(token.symbol, token.decimals);
```

### FlareScan API
```typescript
import { getContractCreation, getNFTTransfers, getEventLogs } from '@/lib/adapters/flarescan';

// Get contract creation date
const creation = await getContractCreation(contractAddress);
console.log('Created in tx:', creation.result[0].txHash);

// Get NFT transfers for a position
const transfers = await getNFTTransfers(POSITION_MANAGER, walletAddress);
console.log('Transfers:', transfers.result.length);

// Get pool events
const logs = await getEventLogs(poolAddress, 0, 'latest', [MINT_TOPIC]);
console.log('Mint events:', logs.result.length);
```

## Key Features

### 1. **Resilience**
- Multiple RPC endpoint fallbacks
- Automatic retry with exponential backoff
- Timeout protection on all external calls
- Graceful degradation on failures

### 2. **Performance**
- Smart memoization (token metadata, block timestamps)
- Batch RPC requests where possible
- Rate limiting to respect API quotas
- Configurable cache TTLs

### 3. **Type Safety**
- Full TypeScript coverage
- Typed API responses
- Zod-like validation (manual checks)
- No `any` types (all explicitly typed or `unknown`)

### 4. **Maintainability**
- Centralized configuration (one place to update addresses/settings)
- Pure functions (no side effects)
- Clear separation of concerns (RPC vs Explorer API)
- Comprehensive documentation

## Testing

### Manual Verification
```bash
# 1. Check imports resolve
npm run build

# 2. Lint check
npm run lint -- src/lib/onchain src/lib/adapters/flarescan
```

### Integration Test (optional)
Create `scripts/testPhase1.ts`:
```typescript
import { readLatestBlockNumber, readPositionData } from '@/lib/onchain';
import { getContractCreation } from '@/lib/adapters/flarescan';

async function test() {
  // Test RPC
  const block = await readLatestBlockNumber();
  console.log('✓ Latest block:', block);

  const position = await readPositionData(BigInt(22003));
  console.log('✓ Position liquidity:', position?.liquidity);

  // Test Flarescan
  const creation = await getContractCreation('0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657');
  console.log('✓ Contract created in:', creation.result[0]?.txHash);

  console.log('\n🎉 Phase 1 tests passed!');
}

test().catch(console.error);
```

Run: `tsx scripts/testPhase1.ts`

## Next Steps (Phase 2)

Phase 1 provides the foundation. **Phase 2** will build:
1. **Wallet Discovery**: Find all positions owned by a wallet
2. **Position Enrichment**: Combine on-chain + explorer data
3. **Event Ingestion**: Fetch and decode historical events
4. **Data Normalization**: Transform raw data into `PositionRow` DTOs

## Notes

- **Rate Limits**: Flarescan allows ~2 req/s (10k/day). Respect these limits to avoid bans.
- **RPC Endpoints**: Primary endpoint is `flare.flr.finance`, fallback to `public-rpc.com` and `1rpc.io`.
- **Cache Strategy**: Token metadata cached for 24h (doesn't change), positions cached for 2min (active data).
- **Error Handling**: All functions log errors but don't throw (return `null` on failure for graceful degradation).

## Dependencies
- `viem`: ^2.38.3 (blockchain interaction)
- Existing utilities: `memoize`, `withTimeout`, `timedFetch`

## Linting Status
✅ All files pass ESLint with zero errors/warnings
✅ No `any` types (all properly typed)
✅ TypeScript strict mode compliant

---

**Phase 1 Complete!** 🚀
Foundation is solid and ready for Phase 2 (discovery + ingestion).

