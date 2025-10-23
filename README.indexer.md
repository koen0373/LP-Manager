# 🚀 Liqui Blockchain Indexer - Quick Start

## What is this?

A **production-ready blockchain indexer** that:
- ✅ Scans Flare mainnet RPC for LP position events
- ✅ Stores all Transfer, IncreaseLiquidity, DecreaseLiquidity, and Collect events
- ✅ Resumes from checkpoints (never re-scans)
- ✅ Runs continuously or one-off backfills
- ✅ Self-adapts concurrency on RPC throttling
- ✅ Batch writes with deduplication

## Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Create .env with required vars
FLARE_RPC_URL=https://flare-api.flare.network/ext/bc/C/rpc
NPM_ADDRESS=0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657
DATABASE_URL=postgresql://user:pass@host:5432/liqui
```

## Usage

### 1. Database Setup

```bash
# Production (Vercel/Railway): auto-push schema
npm run build

# Development: create migration
npm run migrate:dev --name add_indexer
```

### 2. Backfill Historical Data

```bash
# Backfill all events from genesis
npm run indexer:backfill

# Backfill specific tokenIds
npm run indexer:backfill 22003 22326

# Dry run (test without writing)
npm run indexer:backfill -- --dry
```

### 3. Run Continuous Follower

```bash
# Follow blockchain head (runs forever)
npm run indexer:follow

# With PM2 (recommended for production)
pm2 start npm --name "liqui-indexer" -- run indexer:follow
pm2 logs liqui-indexer
```

### 4. Sanity Check

```bash
# Global stats
npm run indexer:sanity

# TokenId stats
npm run indexer:sanity 22003
```

## Quick Test

Test the indexer without database writes:

```bash
npm run indexer:backfill 22003 -- --dry
```

Expected output:
```
🎯 Backfilling tokenId: 22003
[RPC] Scanning 48000000→49485085 (287 chunks, concurrency=4)
[RPC] ✓ Scanned 1485086 blocks → 3 logs (5138 blocks/s, 0 retries)
[INDEXER] ✓ Decoded 3/3 events
✅ TokenId 22003 complete:
   - Blocks scanned: 1,485,086
   - Events found: 3
   - Time: 289s
```

## Configuration

Edit `indexer.config.ts` to tune performance:

```typescript
export const indexerConfig = {
  rpc: {
    batchSize: 5000,        // Blocks per RPC call
    maxConcurrency: 4,      // Parallel requests
  },
  db: {
    batchSize: 200,         // Events per transaction
  },
  follower: {
    pollIntervalMs: 12000,  // Check every 12s
  },
};
```

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
CMD ["npm", "run", "indexer:follow"]
```

### Railway/Fly.io

1. Add environment variables: `DATABASE_URL`, `FLARE_RPC_URL`, `NPM_ADDRESS`
2. Set start command: `npm run indexer:follow`
3. Enable auto-restart

## Troubleshooting

**"Unable to open database file"**
→ Use PostgreSQL, not SQLite. Check `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

**"getaddrinfo ENOTFOUND"**
→ Invalid RPC URL. Test with:

```bash
curl -X POST $FLARE_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Rate limits (429 errors)**
→ Reduce concurrency in `indexer.config.ts`:

```typescript
rpc: {
  batchSize: 2000,
  maxConcurrency: 2,
}
```

## Documentation

Full docs: [docs/INDEXER.md](./docs/INDEXER.md)

Topics:
- Architecture & design
- Event types & schemas
- Performance tuning
- Adding new events
- Monitoring & metrics

## Status

- ✅ Transfer events (ERC721)
- ✅ IncreaseLiquidity events
- ✅ DecreaseLiquidity events
- ✅ Collect events
- ✅ Global & per-tokenId checkpoints
- ✅ Dry-run mode
- ✅ Sanity checks
- 🚧 Pool-level events (Mint, Burn, Swap) - planned
- 🚧 GraphQL API - planned
- 🚧 Webhooks - planned

## Performance

Typical throughput:
- **Backfill**: 3,000-10,000 blocks/sec (depends on RPC & log density)
- **Following**: <5s lag from blockchain head
- **Memory**: 100-500 MB
- **Database**: ~100 KB per 1,000 events

## Support

Issues? Check:
1. `npm run indexer:sanity` for database stats
2. `indexer.config.ts` for settings
3. `.env` for correct RPC URL
4. [docs/INDEXER.md](./docs/INDEXER.md) for full docs

---

**Built by:** Liqui Team
**License:** MIT

