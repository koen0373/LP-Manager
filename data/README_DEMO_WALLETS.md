# Demo Wallets Seed List

## Purpose
This file contains a curated list of **real wallet addresses** that hold active LP positions on Flare Network (Enosys, BlazeSwap, SparkDEX). The homepage demo uses these wallets to show **real-time pool data** without requiring users to connect their own wallet.

## Curation Rules

### Selection Criteria
1. **Multi-provider coverage**: Include wallets with positions across all three providers (Enosys v3, BlazeSwap v2/v3, SparkDEX v2)
2. **Recent activity**: Wallets should have positions created or modified in the last 30–90 days
3. **Non-empty positions**: Exclude wallets with zero-value or fully withdrawn positions
4. **Diversity**: Mix of different strategies (aggressive/balanced/conservative ranges) and statuses (in/near/out of range)
5. **Size variety**: Include both small ($500–$5K TVL) and larger ($10K+) positions for representative mix

### How to Add Wallets
1. **Discovery**: Use `npm run seed:demo-wallets` (see `scripts/seed_demo_wallets.mjs`) to scan recent PositionManager events
2. **Verification**: For each candidate wallet:
   - Check active position count via `/api/positions?address=<wallet>`
   - Verify TVL > $100 total
   - Confirm at least 1 position from each provider if possible
3. **Privacy**: Only use publicly visible on-chain addresses; never add addresses from private sources

### How to Remove Wallets
- Remove wallets that:
  - Have withdrawn all positions (TVL < $10)
  - Show suspicious activity
  - Explicitly request removal (via support)

### Maintenance Schedule
- **Weekly**: Spot-check 5 random wallets for activity
- **Monthly**: Refresh full list by re-running discovery script and pruning inactive wallets
- **Quarterly**: Add 20–30 new wallets to maintain 100+ total

## Privacy & Security Notes
- ✅ **Public data only**: All wallet addresses are publicly visible on-chain via Flare Explorer
- ✅ **No PII**: Wallet addresses alone contain no personally identifiable information
- ✅ **Read-only**: Demo endpoint only reads position data; never initiates transactions
- ✅ **Not exposed**: The full seed list is never returned to clients; only aggregated pool-level data

## Current Status
- **Total wallets**: 5 (starter set)
- **Target**: 100+ for production
- **Last updated**: 2025-10-30
- **Next review**: TODO (set quarterly schedule)

## Expansion TODO
- [ ] Add 20 more Enosys v3 LP wallets (target: 30 total)
- [ ] Add 15 more BlazeSwap v2/v3 LP wallets (target: 20 total)
- [ ] Add 10 more SparkDEX v2 LP wallets (target: 15 total)
- [ ] Implement automated discovery script (`scripts/seed_demo_wallets.mjs`)
- [ ] Set up monthly cron job to refresh and prune

