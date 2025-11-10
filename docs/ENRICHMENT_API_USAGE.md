# Enrichment API Endpoints - Gebruik

## Overzicht

De nieuwe `/api/enrich/*` endpoints bieden **on-demand enrichment** met caching. Dit vervangt de langzame bulk scripts voor veelvoorkomende queries.

## Endpoints

### 1. `/api/enrich/range-status` - Range Status Opvragen

**GET** `/api/enrich/range-status?tokenId=<tokenId>`
**GET** `/api/enrich/range-status?poolAddress=<poolAddress>`

Haalt range status op uit de materialized view (super snel!).

**Voorbeeld:**
```typescript
// Voor één position
const response = await fetch('/api/enrich/range-status?tokenId=12345');
const data = await response.json();
// {
//   tokenId: "12345",
//   pool: "0x...",
//   tickLower: -100,
//   tickUpper: 100,
//   current_tick: 50,
//   range_status: "IN_RANGE"
// }

// Voor alle positions in een pool
const response = await fetch('/api/enrich/range-status?poolAddress=0x...');
const data = await response.json();
// {
//   positions: [
//     { tokenId: "12345", range_status: "IN_RANGE", ... },
//     { tokenId: "12346", range_status: "OUT_OF_RANGE", ... }
//   ]
// }
```

**React Component Voorbeeld:**
```tsx
function PositionRangeStatus({ tokenId }: { tokenId: string }) {
  const [status, setStatus] = useState<'IN_RANGE' | 'OUT_OF_RANGE' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/enrich/range-status?tokenId=${tokenId}`)
      .then(res => res.json())
      .then(data => {
        setStatus(data.range_status);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch range status:', err);
        setLoading(false);
      });
  }, [tokenId]);

  if (loading) return <div>Loading...</div>;
  
  return (
    <div className={status === 'IN_RANGE' ? 'text-green-500' : 'text-red-500'}>
      {status === 'IN_RANGE' ? '✅ In Range' : '❌ Out of Range'}
    </div>
  );
}
```

---

### 2. `/api/enrich/price` - Token Price Opvragen

**GET** `/api/enrich/price?symbol=<TOKEN_SYMBOL>`

Haalt token price op van CoinGecko met 1-uur cache.

**Voorbeeld:**
```typescript
const response = await fetch('/api/enrich/price?symbol=FLR');
const data = await response.json();
// {
//   symbol: "FLR",
//   price: 0.0234,
//   cached: false  // true als uit cache
// }
```

**React Hook Voorbeeld:**
```tsx
function useTokenPrice(symbol: string) {
  const [price, setPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    
    fetch(`/api/enrich/price?symbol=${symbol}`)
      .then(res => res.json())
      .then(data => {
        setPrice(data.price);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch price:', err);
        setLoading(false);
      });
  }, [symbol]);

  return { price, loading };
}

// Gebruik:
function TokenPriceDisplay({ symbol }: { symbol: string }) {
  const { price, loading } = useTokenPrice(symbol);
  
  if (loading) return <span>...</span>;
  if (!price) return <span>N/A</span>;
  
  return <span>${price.toFixed(4)}</span>;
}
```

---

### 3. `/api/enrich/refresh-views` - Materialized Views Refreshen

**POST** `/api/enrich/refresh-views`
**Headers:** `Authorization: Bearer <CRON_SECRET>`

Refresht alle materialized views. Wordt automatisch aangeroepen door de cron job.

**Voorbeeld (Admin/Manual):**
```typescript
// Alleen met CRON_SECRET
const response = await fetch('/api/enrich/refresh-views', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.CRON_SECRET}`,
  },
});

const data = await response.json();
// {
//   success: true,
//   duration: 1234,
//   results: {
//     rangeStatus: { success: true, duration: 500 },
//     positionStats: { success: true, duration: 300 },
//     latestEvent: { success: true, duration: 434 }
//   }
// }
```

---

## Integratie in Bestaande Code

### Vervang Range Status Script Calls

**Voor (langzaam, script-based):**
```typescript
// Oude manier: wacht op cron job
// Data komt pas beschikbaar na hourly cron run
```

**Na (snel, on-demand):**
```typescript
// Nieuwe manier: direct opvragen
const status = await fetch(`/api/enrich/range-status?tokenId=${tokenId}`)
  .then(res => res.json());
```

### Vervang Price Lookups

**Voor (geen caching):**
```typescript
// Direct CoinGecko API call (rate limit issues)
const price = await tokenPriceService.getTokenPrice('FLR');
```

**Na (met caching):**
```typescript
// Via enrichment API (1-uur cache, geen rate limit issues)
const { price } = await fetch('/api/enrich/price?symbol=FLR')
  .then(res => res.json());
```

---

## Performance Voordelen

| Feature | Oude Methode | Nieuwe Methode |
|---------|-------------|----------------|
| **Range Status** | Script (200 pos/hour) | Materialized View (instant) |
| **Price Lookup** | Direct API (rate limits) | Cached API (1 hour) |
| **Response Time** | Seconds/minutes | Milliseconds |
| **502 Errors** | Vaak (bulk processing) | Zelden (on-demand) |

---

## Caching Details

- **Price Cache:** 1 uur (3600 seconden)
- **Vesting Cache:** 24 uur (86400 seconden)
- **APR Cache:** 1 uur (3600 seconden)
- **Range Status:** Materialized view (refresh elke 5-10 minuten)

---

## Error Handling

Alle endpoints retourneren standaard JSON:
```typescript
// Success
{ symbol: "FLR", price: 0.0234, cached: false }

// Error
{ error: "Token symbol required" }  // 400
{ error: "Price not found" }        // 404
{ error: "Internal server error" }  // 500
```

**Voorbeeld met error handling:**
```typescript
async function getPriceSafe(symbol: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/enrich/price?symbol=${symbol}`);
    if (!res.ok) {
      console.error(`Price API error: ${res.status}`);
      return null;
    }
    const data = await res.json();
    return data.price || null;
  } catch (error) {
    console.error('Failed to fetch price:', error);
    return null;
  }
}
```

---

## Best Practices

1. **Gebruik caching:** Check altijd eerst of data al beschikbaar is
2. **Error handling:** Altijd try-catch rond API calls
3. **Loading states:** Toon loading indicators tijdens fetch
4. **Fallbacks:** Gebruik oude data als nieuwe fetch faalt
5. **Rate limiting:** Niet te vaak refreshen (gebruik cache!)

---

## Migration Checklist

- [ ] Vervang range status queries met `/api/enrich/range-status`
- [ ] Vervang price lookups met `/api/enrich/price`
- [ ] Update cron job om views te refreshen (al gedaan ✅)
- [ ] Test endpoints lokaal
- [ ] Deploy en test in productie

