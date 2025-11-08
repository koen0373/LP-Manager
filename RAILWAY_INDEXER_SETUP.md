# Railway Indexer Follower Setup

**Status**: ✅ Ready to Deploy  
**Date**: 2025-11-08  
**RPC**: Flare Public (FREE)  
**Database**: Railway Postgres (yamabiko)

---

## 📊 Current Database Status

- ✅ **41,777 Position Transfers** indexed
- ✅ **24,432 Unique NFT Positions** (Enosys + SparkDEX)
- ✅ **40,195 MINT events**
- ✅ **532 BURN events**
- ✅ **Blocks**: 29,989,866 → 50,289,944 (up-to-date!)

---

## 🚀 Railway Service Configuration

### Service Name
**Indexer Follower**

### Dockerfile Path
`Dockerfile.worker`

### Custom Start Command
```bash
npm run indexer:follow:railway
```

---

## 🔧 Environment Variables

Set these in Railway's **Indexer Follower** service:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://postgres:tFXzfPtgqJpXOKbGBEiYeAstRdRdqAVF@yamabiko.railway.internal:5432/railway` |
| `FLARE_RPC_URL` | `https://flare-api.flare.network/ext/bc/C/rpc` |
| `NPM_ADDRESS` | `0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657` |
| `ENOSYS_V3_FACTORY` | `0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de` |
| `SPARKDEX_V3_FACTORY` | `0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652` |
| `ENOSYS_NFPM` | `0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657` |
| `SPARKDEX_NFPM` | `0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da` |

**Note**: `NPM_ADDRESS` is used by the indexer config for scanning. We set it to Enosys, but the follower will need to be enhanced to scan both NFPMs.

---

## 🔄 How It Works

The Indexer Follower runs continuously and:
1. Checks for new blocks every 12 seconds (configurable)
2. Fetches new ERC-721 Transfer events from both NFPMs
3. Writes them to the Railway Postgres database
4. Uses **Flare Public RPC** (FREE, no ANKR costs)

### Flare Public RPC Limits
- Max 30 blocks per `eth_getLogs` request
- That's why we use `--blockWindow=25` in the follower script

---

## 📝 Deployment Steps

### 1. Update Railway Service Settings

Go to Railway Dashboard → **Indexer Follower** service:

1. **Dockerfile Path**: `Dockerfile.worker`
2. **Custom Start Command**: `npm run indexer:follow:railway`
3. **Environment Variables**: Copy all from the table above

### 2. Deploy

The service will automatically rebuild and restart with the new settings.

### 3. Monitor Logs

Watch the Railway logs for:
```
[2025-11-08T...] ✓ Up to date at block 50289944
[2025-11-08T...] ✅ Synced 100 blocks, 5 events in 2s
```

---

## 🛠️ Troubleshooting

### "No new blocks to sync"
✅ **Good!** The follower is up-to-date.

### "Too many requests" or "429 error"
⚠️ Flare Public RPC has rate limits. The follower will automatically retry with exponential backoff.

### "Connection refused"
Check that `DATABASE_URL` uses the **internal** Railway hostname: `yamabiko.railway.internal`

---

## 🔍 Verification

After deployment, check the database:

```sql
-- Check latest block
SELECT MAX("blockNumber") as latest_block 
FROM "PositionTransfer";

-- Check recent activity (last hour)
SELECT COUNT(*) as recent_transfers
FROM "PositionTransfer"
WHERE "timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '1 hour');
```

---

## 💰 Cost

- **RPC**: $0 (Flare Public RPC is FREE)
- **Railway Compute**: Included in your Railway plan
- **Database**: Included in your Railway plan

---

## 🚨 Known Issues

### Only Scans One NFPM at a Time

The current indexer architecture scans one NFT Position Manager contract at a time (controlled by `NPM_ADDRESS`).

**Current Workaround**: We manually set `NPM_ADDRESS` to scan either Enosys or SparkDEX. To scan both, we need to:
- Run the follower twice (once for each NFPM), OR
- Enhance the indexer to support multiple contracts in a single run

**Recommended Fix**: Enhance `IndexerCore` to accept an array of `contractAddresses` and scan them all in parallel.

---

## 📚 Related Files

- `scripts/indexer-follower.ts` - Main follower script
- `src/indexer/indexerCore.ts` - Core indexer logic
- `indexer.config.ts` - Configuration (RPC, blocks, etc.)
- `Dockerfile.worker` - Worker service Dockerfile
- `package.json` - NPM scripts

---

## 🎯 Next Steps

1. ✅ Deploy the Indexer Follower to Railway
2. ⏳ Monitor logs for 1 hour to ensure stability
3. ✅ Verify new transfers are being indexed
4. 🔄 Consider enhancing the indexer to scan both NFPMs simultaneously

