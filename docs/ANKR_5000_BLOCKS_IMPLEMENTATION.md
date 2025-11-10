# ANKR 5000 Blokken Implementatie Plan

## 🎯 Doel
Gebruik ANKR's 5000 blokken limiet om historische event scanning 166x sneller en 99.4% goedkoper te maken.

## 📊 Impact

### Kostenbesparing
- **Indexer backfill**: $0.33 → $0.002 (99.4% goedkoper)
- **Pool Volume**: $0.20 → $0.001 per 200 pools
- **Position Health**: $0.50 → $0.003 per 10K posities

### Snelheidswinst
- **166x minder API calls** voor event scanning
- Van dagen naar uren voor historische data

## 🔧 Implementatie Stappen

### 1. RpcScanner aanpassen (`src/indexer/rpcScanner.ts`)
- Detecteer of ANKR RPC wordt gebruikt (check URL voor `ankr.com`)
- Als ANKR: gebruik 5000 blokken limiet (ipv 30)
- Als gratis RPC: blijf bij 30 blokken limiet

### 2. Indexer Config aanpassen (`indexer.config.ts`)
- Voeg `ANKR_BLOCK_WINDOW` environment variable toe
- Default: 25 (voor gratis RPC)
- Met ANKR: 5000

### 3. Enrichment Scripts aanpassen
- **Pool Volume**: Gebruik ANKR voor Swap events scanning
- **Position Health**: Gebruik ANKR voor historische range status

## 💻 Code Changes

### RpcScanner.ts
```typescript
// Detect ANKR RPC
private static readonly ANKR_MAX_BLOCKS = 5000;
private static readonly FLARE_MAX_BLOCKS = 30;

private isAnkrRpc(): boolean {
  const url = this.config.rpc.url.toLowerCase();
  return url.includes('ankr.com') || url.includes('ankr');
}

private getMaxBlocks(): number {
  return this.isAnkrRpc() ? RpcScanner.ANKR_MAX_BLOCKS : RpcScanner.FLARE_MAX_BLOCKS;
}
```

### indexer.config.ts
```typescript
blockWindow: process.env.ANKR_HTTP_URL 
  ? parseInt(process.env.INDEXER_BLOCK_WINDOW || '5000', 10)
  : parseInt(process.env.INDEXER_BLOCK_WINDOW || '25', 10),
```

## ✅ Test Plan
1. Test met ANKR RPC URL
2. Verifieer dat 5000 blokken worden gebruikt
3. Test kosten tracking
4. Test snelheidswinst

## 📝 Environment Variables
```bash
# Voor ANKR met 5000 blokken:
ANKR_HTTP_URL=https://rpc.ankr.com/flare/YOUR_KEY
INDEXER_BLOCK_WINDOW=5000

# Voor gratis RPC (30 blokken):
FLARE_RPC_URL=https://flare-api.flare.network/ext/bc/C/rpc
INDEXER_BLOCK_WINDOW=25
```
