# ANKR Integration (Advanced API)

## Benefits
- ✅ **Faster RPC calls**: Dedicated endpoint eliminates public rate limits  
- ✅ **Real-time token prices**: Sub-100ms response times vs 200–500ms on-chain reads  
- ✅ **Multi-chain support**: Query balances across Flare, Ethereum, BSC, Polygon, etc.  
- ✅ **Historical data**: Price charts with custom intervals  
- ✅ **Whale watching**: Token transfer history for market intelligence  
- ✅ **WebSocket ready**: Infrastructure for real-time price updates (future)  
- ✅ **Reliable infrastructure**: Professional-grade uptime and performance  

## Endpoints & Auth
- Base URL: `https://rpc.ankr.com/multichain`
- Header: `X-API-Key: $ANKR_ADV_API_KEY`
- Default chain: `flare` (EVM chainId = 14)

## Environment

```
ANKR_ADV_API_URL=https://rpc.ankr.com/multichain
ANKR_ADV_API_KEY=YOUR_KEY
FLARE_CHAIN_ID=14
```

## Query Examples
```bash
# NFTs by owner
curl -sX POST "$ANKR_ADV_API_URL" \
  -H "Content-Type: application/json" -H "X-API-Key: $ANKR_ADV_API_KEY" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ankr_getNFTsByOwner","params":{"walletAddress":"0x000000000000000000000000000000000000dEaD","pageSize":10,"blockchain":"flare"}}'

# NFT metadata
curl -sX POST "$ANKR_ADV_API_URL" \
  -H "Content-Type: application/json" -H "X-API-Key: $ANKR_ADV_API_KEY" \
  -d '{"jsonrpc":"2.0","id":2,"method":"ankr_getNFTMetadata","params":{"blockchain":"flare","contractAddress":"0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da","tokenId":"1"}}'
```

## Usage in Repo
- Client helper: `src/lib/ankr/advancedClient.ts`
- Smoke script: `scripts/dev/ankr-smoke.mts`
- Concurrency: ≤ 6; retry on 429/5xx with backoff.

## Roadmap
- Enrich unknown pools/owners from ANKR when on-chain link is missing.
- Nightly validation vs `PositionTransfer` owners (sampled).
