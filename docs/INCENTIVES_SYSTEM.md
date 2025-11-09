# LiquiLab Incentives Tracking System

**Status:** Infrastructure Ready, Awaiting Staking Contract Addresses

## Overview

Automatisch on-chain systeem voor het tracken van LP incentives (staking rewards) van Enosys V3 en SparkDEX V3.

## Architectuur

```
[Staking Contracts] → [StakingScanner] → [StakingEvent Table]
                                              ↓
                                     [IncentivesAggregator]
                                              ↓
                                    [PoolIncentive Table]
                                              ↓
                                    [API: /api/positions]
```

## Database Schema

### `StakingEvent` (Raw Events)
- Deposit/Withdraw events
- RewardPaid/Harvest events
- Per staking contract + pool

### `PoolIncentive` (Computed Metrics)
- Rewards per day (tokens + USD)
- Active/Ended programs
- On-chain verified data

## Setup

### 1. Configure Staking Contracts

Edit `src/indexer/config/stakingContracts.ts`:

```typescript
export const STAKING_CONTRACTS: StakingContractConfig[] = [
  {
    address: '0x...', // Enosys MasterChef address
    dex: 'enosys-v3',
    type: 'masterchef',
    rewardToken: '0x...', // ENOSYS token
    rewardTokenSymbol: 'ENOSYS',
    startBlock: 29_837_200,
    poolMapping: {
      '0': '0x686f53F0950Ef193C887527eC027E6A574A4DbE1', // PID → Pool address
      // ... meer pools
    }
  },
  // ... SparkDEX config
];
```

### 2. Run Prisma Migration

```bash
npx prisma migrate dev --name add_incentives_tables
```

### 3. Index Staking Events

```bash
# Backfill historical data
npm run indexer:staking

# Or specify range:
npx tsx scripts/indexer-staking.mts --from=29837200 --to=latest
```

### 4. Compute Incentives

```bash
# Analyze last 7 days of staking events → compute rewards per day
npm run indexer:incentives
```

### 5. Setup Cron (Daily Updates)

Railway Cron Job:
```bash
# Schedule: 0 9 * * * (9:00 AM CET daily, after pool indexer)
npm run indexer:staking && npm run indexer:incentives
```

## API Integration

### Query Incentives per Pool

```typescript
// GET /api/positions?wallet=0x...
{
  positions: [
    {
      poolAddress: "0x686f...",
      tvlUsd: 50000,
      incentives: {
        token: "ENOSYS",
        usdPerDay: 25.50,  // From PoolIncentive table
        apr: 18.6          // Computed: (usdPerDay * 365 / tvlUsd) * 100
      }
    }
  ]
}
```

### Query All Active Incentives

```sql
SELECT 
  pi.poolAddress,
  pi.dex,
  p.token0Symbol || '-' || p.token1Symbol AS pair,
  pi.rewardTokenSymbol,
  pi.rewardPerDay,
  pi.rewardUsdPerDay,
  pi.startDate,
  pi.endDate
FROM "PoolIncentive" pi
JOIN "Pool" p ON p.address = pi.poolAddress
WHERE pi.isActive = true
ORDER BY pi.rewardUsdPerDay DESC;
```

## Contract Discovery Guide

### Enosys V3

**Methode 1: FlareScan**
1. Ga naar https://flarescan.com
2. Zoek: "Enosys staking" of "Enosys farm"
3. Filter: Contract Creation (laatste 6 maanden)
4. Check contract code voor MasterChef pattern

**Methode 2: Enosys Docs/Website**
- https://enosys.global (check docs/whitepaper)
- Look for "Liquidity Mining" or "Staking" section
- Contract addresses usually listed

**Methode 3: On-Chain Analyse**
```bash
# Find contracts that HOLD veel ENOSYS tokens (= reward pool)
# Via FlareScan: Token Holders voor ENOSYS token
```

### SparkDEX V3

Zelfde strategie:
1. https://sparkdex.com → Docs/Farms
2. FlareScan search: "SparkDEX farm" / "SparkDEX staking"
3. Token holders analyse voor SPARK token

### Verwachte Contract Patterns

**MasterChef (Uniswap V2 style):**
- `poolInfo(uint256 pid)` functie
- `Deposit(user, pid, amount)` event
- `Withdraw(user, pid, amount)` event
- `RewardPaid(user, reward)` event

**Gauge (Curve/Velodrome style):**
- `Staked(user, amount)` event
- `Withdrawn(user, amount)` event
- `RewardPaid(user, rewardsToken, reward)` event

## Verification Checklist

Na configuratie:

- [ ] Staking contract addresses toegevoegd aan config
- [ ] Prisma migration succesvol
- [ ] Test run: `npm run indexer:staking` (kleine range)
- [ ] Check `StakingEvent` tabel: > 0 rijen
- [ ] Run: `npm run indexer:incentives`
- [ ] Check `PoolIncentive` tabel: computed rewards kloppen
- [ ] Test API: incentives zichtbaar in `/api/positions`

## Monitoring

```bash
# Check laatste staking events
psql $DATABASE_URL -c "SELECT eventName, COUNT(*) FROM \"StakingEvent\" GROUP BY eventName;"

# Check active incentives
psql $DATABASE_URL -c "SELECT dex, COUNT(*), SUM(rewardUsdPerDay::numeric) FROM \"PoolIncentive\" WHERE \"isActive\" = true GROUP BY dex;"

# Check data freshness
psql $DATABASE_URL -c "SELECT MAX(timestamp) FROM \"StakingEvent\";"
```

## Fallback: Manual Entry

Als staking contracts niet gevonden worden:

```sql
-- Manual insert (bijv. uit announcement/docs)
INSERT INTO "PoolIncentive" (
  "poolAddress", "dex", "rewardToken", "rewardTokenSymbol",
  "rewardPerDay", "rewardUsdPerDay", "startDate", 
  "sourceType", "isActive"
) VALUES (
  '0x686f53F0950Ef193C887527eC027E6A574A4DbE1', -- FXRP-USDT pool
  'enosys-v3',
  '0x...', -- ENOSYS token
  'ENOSYS',
  1000, -- 1000 ENOSYS/day
  500,  -- $500/day (at $0.50/ENOSYS)
  '2025-01-01',
  'manual',
  true
);
```

## Next Steps

1. **Vind contract addresses** (hoogste prioriteit)
2. Update `stakingContracts.ts`
3. Run migration + backfill
4. Integreer in `/api/positions` endpoint
5. Display in frontend (PoolsTable)

## Support

Voor vragen of hulp bij contract discovery:
- Check PROJECT_STATE.md
- Review FlareScan explorer
- Contact Enosys/SparkDEX support

---

**Status:** 2025-11-09  
**Ready for:** Contract address input → immediate deployment

