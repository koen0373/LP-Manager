# ANKR Integration Guide

## Overview

LiquiLab now uses **ANKR's Advanced API** for fast, reliable token price data on Flare network.

### Key Benefits
- ✅ **Faster**: Dedicated RPC endpoint (no rate limiting)
- ✅ **More reliable**: Professional-grade infrastructure
- ✅ **Historical data**: `ankr_getTokenPriceHistory` for charts
- ✅ **Real-time**: WebSocket support for live updates

---

## 1. RPC Endpoints

### HTTPS (Standard blockchain calls)
```
https://rpc.ankr.com/flare/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01
```

**Used by**:
- Indexer (`indexer.config.ts`)
- API routes (`/api/positions`, `/api/pool/[tokenId]`)
- Frontend wallet (Wagmi/Viem)

### WebSocket (Real-time subscriptions)
```
wss://rpc.ankr.com/flare/ws/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01
```

**Future use**:
- Live pool swap events
- Real-time price updates
- Position change notifications

### Advanced API (Token prices & history)
```
https://rpc.ankr.com/multichain/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01
```

**Used by**:
- `src/lib/ankr/tokenPrice.ts` - Price fetching
- `pages/api/prices/ankr.ts` - Price API endpoint
- `src/services/tokenRegistry.ts` - Token price resolution

---

## 2. Environment Variables

### `.env.local` (Local development)
```bash
# RPC endpoints
FLARE_RPC_URL="https://rpc.ankr.com/flare/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01"
FLARE_WSS_URL="wss://rpc.ankr.com/flare/ws/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01"
NEXT_PUBLIC_FLARE_RPC_URL="https://rpc.ankr.com/flare/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01"

# Advanced API
ANKR_API_KEY="cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01"
ANKR_ADVANCED_API_URL="https://rpc.ankr.com/multichain/cee6b4f8866b7f8afa826f378953ae26eaa74fd174d1d282460e0fbad2b35b01"
```

### Railway (Production)
```bash
railway variables set FLARE_RPC_URL="https://rpc.ankr.com/flare/cee6b4f8..."
railway variables set NEXT_PUBLIC_FLARE_RPC_URL="https://rpc.ankr.com/flare/cee6b4f8..."
railway variables set ANKR_API_KEY="cee6b4f8..."
railway variables set ANKR_ADVANCED_API_URL="https://rpc.ankr.com/multichain/cee6b4f8..."
```

---

## 3. Ankr.js SDK (Recommended)

### Installation
```bash
npm install @ankr.com/ankr.js
```

### Get Wallet Balances with USD Values

```typescript
import { getWalletBalances, FLARE_TOKENS } from '@/lib/ankr/provider';

// Get all token balances for a wallet
const balances = await getWalletBalances(
  '0x57d294d815968f0efa722f1e8094da65402cd951',
  ['flare'] // Can query multiple chains: ['flare', 'eth', 'bsc', 'polygon']
);

console.log(balances);
// {
//   totalBalanceUsd: "123.45",
//   assets: [
//     {
//       blockchain: "flare",
//       tokenName: "Flare",
//       tokenSymbol: "FLR",
//       tokenDecimals: 18,
//       tokenType: "NATIVE",
//       holderAddress: "0x57d294...",
//       balance: "1000.5",
//       balanceRawInteger: "1000500000000000000000",
//       balanceUsd: "17.58",
//       tokenPrice: "0.01758"
//     },
//     // ... more tokens
//   ]
// }
```

### Get Token Price

```typescript
import { getTokenPrice, FLARE_TOKENS } from '@/lib/ankr/provider';

// Get FXRP price
const fxrpPrice = await getTokenPrice('flare', FLARE_TOKENS.FXRP);

// Get native FLR price
const flrPrice = await getTokenPrice('flare');

console.log(`FXRP: $${fxrpPrice.usdPrice}`);
console.log(`FLR: $${flrPrice.usdPrice}`);
```

### Get Historical Prices

```typescript
import { getTokenPriceHistory, FLARE_TOKENS } from '@/lib/ankr/provider';

const history = await getTokenPriceHistory(
  'flare',
  FLARE_TOKENS.FXRP,
  {
    fromTimestamp: Math.floor(Date.now() / 1000) - 86400, // 24h ago
    toTimestamp: Math.floor(Date.now() / 1000),
    interval: 3600, // 1 hour intervals
    limit: 24,
  }
);

history.quotes.forEach(point => {
  console.log(`${new Date(point.timestamp * 1000)}: $${point.usdPrice}`);
});
```

### Get Token Transfers (Whale Watching)

```typescript
import { getTokenTransfers, FLARE_TOKENS } from '@/lib/ankr/provider';

// Get recent FXRP transfers
const transfers = await getTokenTransfers(
  FLARE_TOKENS.FXRP,
  'flare',
  {
    fromTimestamp: Math.floor(Date.now() / 1000) - 86400, // Last 24h
    pageSize: 100,
  }
);

console.log(`Found ${transfers.transfers.length} transfers`);
transfers.transfers.forEach(tx => {
  console.log(`${tx.fromAddress} → ${tx.toAddress}: ${tx.value} ${tx.tokenSymbol}`);
});
```

### HTTP API Endpoints

```bash
# Get wallet balances with USD values
curl 'http://localhost:3000/api/wallet/balances?address=0x57d294d815968f0efa722f1e8094da65402cd951'

# Multi-chain query
curl 'http://localhost:3000/api/wallet/balances?address=0x...&chains=flare,eth,bsc'
```

**Response**:
```json
{
  "success": true,
  "address": "0x57d294...",
  "blockchains": ["flare"],
  "balances": {
    "totalBalanceUsd": "123.45",
    "assets": [
      {
        "blockchain": "flare",
        "tokenSymbol": "FLR",
        "balance": "1000.5",
        "balanceUsd": "17.58",
        "tokenPrice": "0.01758"
      }
    ]
  }
}
```

---

## 4. Legacy Token Price API (Fallback)

const history = await getAnkrTokenPriceHistory(
  '0xAd552A648C74D49E10027AB8a618A3ad4901c5bE', // FXRP
  {
    fromTimestamp: Math.floor(Date.now() / 1000) - 86400, // 24h ago
    toTimestamp: Math.floor(Date.now() / 1000),
    interval: 3600, // 1 hour intervals
    limit: 24,
  }
);

history.forEach(point => {
  console.log(`${new Date(point.timestamp * 1000)}: $${point.usdPrice}`);
});
```

### HTTP API Endpoint

```bash
# Get FXRP price
curl http://localhost:3000/api/prices/ankr?symbol=FXRP

# Get by address
curl http://localhost:3000/api/prices/ankr?address=0xAd552A648C74D49E10027AB8a618A3ad4901c5bE

# Get native FLR
curl http://localhost:3000/api/prices/ankr
```

**Response**:
```json
{
  "success": true,
  "price": 2.46,
  "symbol": "FXRP",
  "address": "0xAd552A648C74D49E10027AB8a618A3ad4901c5bE",
  "timestamp": 1699999999000
}
```

---

## 4. Token Registry Integration

The `tokenRegistry.ts` now supports ANKR as a price source with automatic fallback:

```typescript
price: [
  { kind: 'ankr' },                    // Try ANKR first
  { kind: 'onchainPool', ... },        // Fallback to on-chain
  { kind: 'coingecko', ... },          // Final fallback
]
```

**Example (FXRP)**:
```typescript
'0xad552a648c74d49e10027ab8a618a3ad4901c5be': {
  symbol: 'FXRP',
  decimals: 6,
  price: [
    { kind: 'ankr' },                             // Primary
    {                                              // Fallback
      kind: 'onchainPool',
      pool: '0x686f53f0950ef193c887527ec027e6a574a4dbe1',
      base: '0xad552a648c74d49e10027ab8a618a3ad4901c5be',
      quote: '0xe7cd86e13ac4309349f30b3435a9d337750fc82d'
    }
  ]
}
```

---

## 5. Supported Tokens

### Flare Ecosystem
| Symbol | Address | ANKR Support |
|--------|---------|--------------|
| FLR    | (native) | ✅ |
| WFLR   | `0x1D80c49BbBCd1C0911346656B529DF9E5c2F783d` | ✅ |
| FXRP   | `0xAd552A648C74D49E10027AB8a618A3ad4901c5bE` | ✅ |
| USD₀   | `0xe7cd86e13AC4309349F30B3435a9d337750fC82D` | ✅ (stable) |
| eUSDT  | `0x96B41289D90444B8adD57e6F265DB5aE8651DF29` | ✅ (stable) |
| APS    | `0xfF56Eb5b1a7FAa972291117E5E9565dA29bc808d` | ✅ |
| SFLR   | `0x12e605bc104e93B45e1aD99F9e555f659051c2BB` | ✅ |

---

## 6. Testing

### Test Price Fetching
```bash
# Start dev server
npm run dev

# Test API endpoint
curl http://localhost:3000/api/prices/ankr?symbol=FXRP

# Check logs for ANKR source
# Should see: [PRICE-REGISTRY] FXRP: $2.46 (source: ankr)
```

### Test in Browser Console
```javascript
// Fetch FXRP price
fetch('/api/prices/ankr?symbol=FXRP')
  .then(r => r.json())
  .then(console.log);
```

---

## 7. Monitoring

### Check RPC Health
```bash
curl -X POST https://rpc.ankr.com/flare/cee6b4f8... \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Check Price API Health
```bash
curl -X POST https://rpc.ankr.com/multichain/cee6b4f8... \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "ankr_getTokenPrice",
    "params": {
      "blockchain": "flare"
    },
    "id": 1
  }'
```

---

## 8. Rate Limits & Costs

### Free Tier (Public Plan)
- ✅ Currently active
- No rate limits (dedicated endpoint)
- No cost

### Premium Plan (if needed)
- Higher throughput
- SLA guarantees
- Priority support

**Docs**: https://www.ankr.com/docs/advanced-api/token-methods/

---

## 9. Troubleshooting

### Error: "ANKR API error: 401"
- Check `ANKR_API_KEY` is set correctly
- Verify API key in URL matches your account

### Error: "No price data returned"
- Token might not be indexed by ANKR yet
- Falls back to on-chain pool pricing
- Check `tokenRegistry.ts` for fallback sources

### Slow Price Fetching
- Check network connectivity
- Verify `ANKR_ADVANCED_API_URL` is set
- Monitor Railway logs for timeout errors

---

## 10. Next Steps

### Immediate
- ✅ RPC configured
- ✅ Token price API integrated
- ✅ FXRP using ANKR as primary source

### Future Enhancements
- [ ] WebSocket integration for live prices
- [ ] Historical price charts via `ankr_getTokenPriceHistory`
- [ ] Token transfer tracking via `ankr_getTokenTransfers`
- [ ] NFT position metadata via ANKR NFT API

---

## Documentation
- **ANKR Docs**: https://www.ankr.com/docs/advanced-api/token-methods/
- **Flare RPC**: https://www.ankr.com/rpc/flare/
- **Advanced API Reference**: https://www.ankr.com/docs/advanced-api/

---

**Last Updated**: 2025-11-06

