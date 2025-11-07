# Liqui Blockchain Indexer

## Overview

The Liqui Blockchain Indexer is a production-grade, fault-tolerant system for indexing Uniswap V3-compatible NonfungiblePositionManager events on Flare mainnet. It provides:

- **Fast RPC-based scanning** with adaptive concurrency and exponential backoff
- **Resumable syncing** via checkpoints for both global and per-tokenId operations
- **Batch processing** with configurable chunk sizes and database transactions
- **Continuous following** (tail mode) for real-time event ingestion
- **Dry-run mode** for testing without database writes

## Architecture

```
┌─────────────────┐
│  RPC Scanner    │  ← Fetches logs via viem getLogs
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Event Decoder   │  ← Decodes raw logs into typed events
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  DB Writer      │  ← Batch writes to PostgreSQL
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Checkpoint Mgr  │  ← Tracks sync progress
└─────────────────┘
```

## Configuration

All configuration lives in `indexer.config.ts`:

```typescript
export const indexerConfig = {
  rpc: {
    url: process.env.FLARE_RPC_URL,
    batchSize: 5000,                // Blocks per getLogs call
    maxConcurrency: 4,              // Max parallel requests
    minConcurrency: 1,              // Min when throttled
  },
  contracts: {
    npm: process.env.NPM_ADDRESS,  // Position manager address
    startBlock: 48000000,           // NPM deployment block
  },
  retry: {
    maxAttempts: 5,
    initialDelayMs: 250,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    failureThreshold: 3,            // Failures before reducing concurrency
    successThreshold: 20,           // Successes before increasing concurrency
  },
  db: {
    batchSize: 200,                 // Events per transaction
    checkpointInterval: 50,         // Update checkpoint every N batches
  },
  follower: {
    pollIntervalMs: 12000,          // Check for new blocks every 12s
    confirmationBlocks: 2,          // Wait N blocks before considering finalized
  },
  events: {
    transfer: true,                 // ERC721 Transfer
    increaseLiquidity: true,
    decreaseLiquidity: true,
    collect: true,
  },
};
```

### Environment Variables

Required `.env` variables:

```bash
# Flare RPC endpoint (must have archive capability for getLogs)
FLARE_RPC_URL=https://flare-api.flare.network/ext/bc/C/rpc

# NonfungiblePositionManager contract address
NPM_ADDRESS=0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657

# (Optional) Override start block
START_BLOCK=48000000

# PostgreSQL connection (for Prisma)
DATABASE_URL=postgresql://user:pass@host:5432/liqui
```

## Usage

### 1. Database Setup

First, create the database tables:

```bash
# Development: create migration + apply
npm run migrate:dev --name add_indexer_tables

# Production: apply existing migrations
npm run migrate:deploy
```

### 2. Backfill Historical Data

#### Global Backfill (All Events)

Backfill all events from genesis (or last checkpoint):

```bash
npm run indexer:backfill
```

This will:
- Resume from the last `NPM:global` checkpoint
- Scan from checkpoint to latest block (minus confirmation buffer)
- Decode and store all Transfer, IncreaseLiquidity, DecreaseLiquidity, and Collect events
- Save checkpoint every N batches

**Dry Run (no database writes):**

```bash
npm run indexer:backfill -- --dry
```

#### TokenId-Specific Backfill

Backfill events for specific tokenIds:

```bash
# Single tokenId
npm run indexer:backfill 22003

# Multiple tokenIds
npm run indexer:backfill 22003 22326 20445

# With dry run
npm run indexer:backfill 22003 --dry
```

Each tokenId gets its own checkpoint (`NPM:tokenId:22003`) for resumability.

### 3. Continuous Following (Tail Mode)

Run a persistent worker that follows the blockchain head:

```bash
npm run indexer:follow
```

This will:
- Poll RPC every N seconds for new blocks
- Sync any blocks behind the checkpoint
- Apply a confirmation buffer to avoid reorgs
- Automatically restart on errors (with backoff)
- Gracefully shut down on SIGINT/SIGTERM

**Recommended for production:** Run with a process manager (PM2, systemd, Docker):

```bash
# PM2 example
pm2 start npm --name "liqui-indexer" -- run indexer:follow
pm2 logs liqui-indexer
pm2 stop liqui-indexer
```

### 4. Sanity Checks

Validate indexed data:

```bash
# Global stats
npm run indexer:sanity

# TokenId-specific stats
npm run indexer:sanity 22003
```

Prints:
- Event counts by type
- Block range (first/last event)
- Current owner (from last transfer)
- Recent events
- Checkpoint status

## Database Schema

### PositionEvent

Stores IncreaseLiquidity, DecreaseLiquidity, and Collect events:

```prisma
model PositionEvent {
  id             String             @id // txHash:logIndex
  tokenId        String
  pool           String
  blockNumber    Int
  txHash         String
  logIndex       Int
  timestamp      Int
  eventType      PositionEventType  // INCREASE | DECREASE | COLLECT
  recipient      String?
  amount0        String?
  amount1        String?
  liquidityDelta String?
  
  @@unique([txHash, logIndex])
  @@index([tokenId, blockNumber])
  @@index([pool, blockNumber])
}
```

### PositionTransfer

Stores ERC721 Transfer events:

```prisma
model PositionTransfer {
  id          String @id // txHash:logIndex
  tokenId     String
  from        String
  to          String
  blockNumber Int
  txHash      String
  logIndex    Int
  timestamp   Int

  @@unique([txHash, logIndex])
  @@index([tokenId, blockNumber])
}
```

### SyncCheckpoint

Tracks indexer progress:

```prisma
model SyncCheckpoint {
  id             String   @id // source:key (e.g., "NPM:global")
  source         String   // "NPM"
  key            String   // "global" | "tokenId:22003"
  lastBlock      Int
  lastTimestamp  Int?
  eventsCount    Int
  updatedAt      DateTime
  createdAt      DateTime

  @@unique([source, key])
  @@index([source, lastBlock])
}
```

## Event Types

The indexer captures these Uniswap V3 events:

### Transfer (ERC721)

```solidity
event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
```

**Captured when:**
- Position minted (from = 0x0)
- Position transferred between addresses
- Position burned (to = 0x0)

### IncreaseLiquidity

```solidity
event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
```

**Captured when:** User adds liquidity to an existing position

### DecreaseLiquidity

```solidity
event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1);
```

**Captured when:** User removes liquidity from a position

### Collect

```solidity
event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1);
```

**Captured when:** User collects accrued fees from a position

## Performance Tuning

### RPC Rate Limits

If you hit rate limits, adjust:

```typescript
rpc: {
  batchSize: 2000,        // Smaller chunks
  maxConcurrency: 2,      // Fewer parallel requests
}
```

The indexer will **auto-adapt**: it reduces concurrency on repeated failures and increases on sustained success.

### Database Performance

For large backfills:

```typescript
db: {
  batchSize: 500,         // Larger transactions
  checkpointInterval: 100, // Less frequent checkpoint updates
}
```

### Memory Usage

Memory scales with:
- `rpc.batchSize × rpc.maxConcurrency` (in-flight logs)
- `db.batchSize` (in-flight writes)

Typical usage: 100-500 MB for default settings.

## Deployment

### Docker Example

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npx prisma generate

CMD ["npm", "run", "indexer:follow"]
```

### Railway/Fly.io

1. Add `DATABASE_URL` and `FLARE_RPC_URL` to environment
2. Set start command: `npm run indexer:follow`
3. Enable auto-restart on failure
4. Monitor logs for errors

### Monitoring

Key metrics to track:

- **Blocks behind**: `checkpoint - latest_block`
- **Events/sec**: logged every 60s in follower mode
- **Error rate**: consecutive failures trigger backoff
- **Database size**: grows with historical depth

## Troubleshooting

### "Error code 14: Unable to open the database file"

**Cause:** SQLite provider in Prisma schema (should be PostgreSQL)

**Fix:**
```prisma
datasource db {
  provider = "postgresql"  // Not "sqlite"
  url      = env("DATABASE_URL")
}
```

### "getaddrinfo ENOTFOUND"

**Cause:** Invalid or unreachable RPC URL

**Fix:** Verify `FLARE_RPC_URL` in `.env` and test with `curl`:

```bash
curl -X POST $FLARE_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### "Too many consecutive errors"

**Cause:** RPC node down or rate-limited

**Fix:**
1. Switch to a different RPC endpoint
2. Reduce `maxConcurrency` and `batchSize`
3. Check RPC node status/health

### Duplicate Events

**Cause:** Re-running same block range without checkpoints

**Fix:** Database unique constraints (`txHash, logIndex`) auto-dedupe. Duplicates are logged but don't fail the sync.

## Adding New Event Types

1. **Add event signature** in `src/indexer/abis.ts`:

```typescript
export const MY_EVENT_TOPIC = keccak256(toHex('MyEvent(uint256,address)'));

export const MY_EVENT_ABI = {
  anonymous: false,
  inputs: [
    { indexed: true, name: 'tokenId', type: 'uint256' },
    { indexed: false, name: 'recipient', type: 'address' },
  ],
  name: 'MyEvent',
  type: 'event',
} as const;
```

2. **Add to decoder** in `src/indexer/eventDecoder.ts`:

```typescript
private decodeMyEvent(log: Log): DecodedPositionEvent {
  const decoded = decodeEventLog({
    abi: [MY_EVENT_ABI],
    data: log.data,
    topics: log.topics as [Hex, ...Hex[]],
  });

  return {
    type: PositionEventType.OTHER,
    tokenId: decoded.args.tokenId.toString(),
    // ... map other fields
  };
}
```

3. **Enable in config**:

```typescript
events: {
  myEvent: true,
}
```

## Roadmap

- [ ] Pool-level event indexing (Mint, Burn, Swap from pool contracts)
- [ ] GraphQL API for indexed data
- [ ] Webhooks for real-time event notifications
- [ ] Multi-chain support (Songbird, Coston2)
- [ ] Event replay/reprocessing on schema changes

## Support

For issues or questions:
- Check logs: `npm run indexer:sanity`
- Review config: `indexer.config.ts`
- Test RPC: verify `FLARE_RPC_URL` is reachable
- Database: ensure `DATABASE_URL` is valid PostgreSQL

---

**Built with:** TypeScript, viem, Prisma, p-limit
**License:** MIT

