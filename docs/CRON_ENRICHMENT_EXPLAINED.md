# Hourly Enrichment Cron Job - Uitgebreide Uitleg

## Overzicht

Het hourly enrichment cron script (`/api/cron/enrichment-hourly`) draait **elk uur** en voert **10 verschillende enrichment processen** uit om de database up-to-date te houden met verrijkte data.

**Totaal volume:** ~6,650 items per uur

---

## 1. Pool Attribution (500 positions/hour)

**Wat doet het:**
- Lost `pool='unknown'` posities op door RPC calls naar NFPM contracts
- Vraagt position data op en zoekt pool address via factory `getPool()`
- Update PositionEvent met correcte pool address

**Waarom:**
- Veel posities hebben nog `pool='unknown'` in de database
- Zonder pool address kunnen we geen analytics doen
- 500 posities per uur = ~12,000 per dag = alle posities binnen ~50 dagen

**Output:** PositionEvent.pool wordt geüpdatet van 'unknown' naar echte pool address

---

## 2. Fees USD Calculation (5000 events/hour)

**Wat doet het:**
- Neemt COLLECT events die nog geen `feesUsd` hebben
- Haalt token prices op via CoinGecko API (batch processing, max 50 tokens per call)
- Berekent USD waarde: `(amount0 * price0) + (amount1 * price1)`
- Update PositionEvent.metadata met `feesUsd`

**Waarom:**
- COLLECT events hebben alleen `amount0` en `amount1` (in wei)
- Voor user engagement reports hebben we USD waarden nodig
- 5000 events per uur = ~120,000 per dag

**Output:** PositionEvent.metadata.feesUsd wordt gezet

**Rate Limiting:** CoinGecko free tier = 50 calls/min, script gebruikt batch processing + delays

---

## 3. Range Status (200 positions/hour)

**Wat doet het:**
- Leest `tickLower` en `tickUpper` uit NFPM.positions() via RPC
- Leest `currentTick` uit pool.slot0() via RPC
- Berekent: `IN_RANGE` als `tickLower <= currentTick < tickUpper`, anders `OUT_OF_RANGE`
- Update PositionEvent met tick data en rangeStatus

**Waarom:**
- User engagement report moet weten of posities in-range zijn
- In-range posities verdienen fees, out-of-range niet
- 200 posities per uur = ~4,800 per dag

**Output:** PositionEvent.tickLower, tickUpper, tick, metadata.rangeStatus

---

## 4. Position Snapshots (100 positions/hour)

**Wat doet het:**
- Maakt snapshot van actieve posities (TVL, fees, range status)
- Leest huidige position data via RPC (amounts, ticks)
- Berekent USD waarden
- Slaat op in analytics_position_snapshot (of PositionEvent metadata)

**Waarom:**
- Voor historische tracking en trends
- Kan gebruikt worden voor % tijd in-range berekeningen
- 100 posities per uur = ~2,400 per dag

**Output:** Position snapshots met TVL, fees, range status

---

## 5. APR Calculation (100 pools/hour)

**Wat doet het:**
- Berekent **Fees APR**: `(fees_24h / tvl) * 365 * 100`
- Berekent **Total APR**: `((fees_24h + incentives_24h + rflr_24h) / tvl) * 365 * 100`
- Haalt fees uit laatste 24h COLLECT events
- Haalt incentives uit PoolIncentive table
- Haalt rFLR uit position metadata (berekent daily rate)
- Update Pool.metadata met beide APR waarden

**Waarom:**
- Gebruikers willen weten wat de yield is per pool
- Total APR geeft volledig beeld (fees + rewards)
- 100 pools per uur = alle actieve pools binnen 1-2 dagen

**Output:** Pool.metadata.aprFees en Pool.metadata.aprTotal

---

## 6. Impermanent Loss (200 positions/hour)

**Wat doet het:**
- Berekent IL voor posities met initiële MINT events
- Formule: `IL = (current_value + incentives_value - hodl_value) / hodl_value * 100`
- Gebruikt **VESTED** rFLR (niet total, want dat is nog niet beschikbaar)
- Includeert alle incentives (pool incentives + rFLR vested)
- Update PositionEvent.metadata met IL data

**Waarom:**
- IL is belangrijk voor LP's om te weten hoeveel ze verliezen door prijsverandering
- Incentives compenseren IL (maken het minder negatief)
- 200 posities per uur = ~4,800 per dag

**Output:** PositionEvent.metadata.impermanentLoss, currentValueUsd, hodlValueUsd, totalIncentivesUsd

---

## 7. rFLR Vesting (200 positions/hour) ⭐ NIEUW

**Wat doet het:**
- Haalt rFLR rewards op via Enosys API: `https://v3.dex.enosys.global/api/flr/v2/stats/rflr/{tokenId}`
- Berekent **gevestigde hoeveelheid**: lineair over 12 maanden vanaf position creation
- Berekent **claimable waarde**: gevestigd + (unvested * 0.5) voor vroegtijdig claim met boete
- Update PositionEvent.metadata met rFLR vesting data

**Waarom:**
- rFLR rewards worden niet direct geclaimd maar gevest via Flare Portal
- Gebruikers moeten weten hoeveel ze kunnen claimen
- 200 posities per uur = ~4,800 per dag

**Output:** PositionEvent.metadata.rflrRewards met:
- totalRflr, vestedRflr, claimableRflr
- totalRflrUsd, vestedRflrUsd, claimableRflrUsd
- vestingProgress (%), vestingStartDate, vestingPeriodMonths (12)

---

## 8. Unclaimed Fees Tracking (100 positions/hour) ⭐ NIEUW

**Wat doet het:**
- Leest `tokensOwed0` en `tokensOwed1` uit NFPM.positions() via RPC
- Vergelijkt met laatste COLLECT event
- Berekent USD waarde van unclaimed fees
- Update PositionEvent.metadata met unclaimed fees data

**Waarom:**
- Direct actionable: "Claim $XX fees!"
- Gebruikers moeten weten hoeveel fees ze kunnen claimen
- 100 posities per uur = ~2,400 per dag

**Output:** PositionEvent.metadata.unclaimedFeesToken0, unclaimedFeesToken1, unclaimedFeesUsd

---

## 9. Position Health Metrics (200 positions/hour) ⭐ NIEUW

**Wat doet het:**
- Berekent % tijd in-range uit PositionEvent history (laatste 7 dagen)
- Berekent range efficiency (hoe goed gepositioneerd)
- Berekent gemiddelde tijd out-of-range
- Update PositionEvent.metadata met health metrics

**Waarom:**
- Voor "Position Health" sectie in user engagement report
- Gebruikers willen weten hoe efficiënt hun posities zijn
- 200 posities per uur = ~4,800 per dag

**Output:** PositionEvent.metadata.healthMetrics met:
- pctTimeInRange (%), rangeEfficiency (%), totalEvents7d, inRangeEvents7d, outOfRangeEvents7d

---

## 10. Pool Volume Metrics (50 pools/hour) ⭐ NIEUW

**Wat doet het:**
- Scant Swap events in PoolEvent table (laatste 24h)
- Aggregeert volume per pool (amount0 + amount1)
- Berekent USD volume via token prices
- Update Pool table met volume metrics

**Waarom:**
- Voor "Trending Pools" en market intelligence
- Volume is belangrijke metric voor pool performance
- 50 pools per uur = alle actieve pools binnen 1-2 dagen

**Output:** Pool.metadata.volume24h met volumeUsd, volumeToken0, volumeToken1, swapCount

---

## Tijdlijn per Uur

```
00:00 - Cron start
00:00 - 1. Pool Attribution (500 positions) - ~5 min
00:05 - 2. Fees USD Calculation (5000 events) - ~10 min (met rate limiting)
00:15 - 3. Range Status (200 positions) - ~5 min
00:20 - 4. Position Snapshots (100 positions) - ~5 min
00:25 - 5. APR Calculation (100 pools) - ~2 min
00:27 - 6. Impermanent Loss (200 positions) - ~5 min
00:32 - 7. rFLR Vesting (200 positions) - ~5 min
00:37 - 8. Unclaimed Fees (100 positions) - ~5 min
00:42 - 9. Position Health (200 positions) - ~3 min
00:45 - 10. Pool Volume (50 pools) - ~2 min
00:47 - Cron complete (~47 min totaal)
```

**Totaal:** ~47 minuten per uur (binnen 1 uur window ✅)

---

## Data Flow

```
[Indexer Follower] → [PositionEvent, PoolEvent] → [Raw Data]
                                                          ↓
[Enrichment Cron] → [10 Enrichment Scripts] → [Enriched Data]
                                                          ↓
[User Engagement Report] ← [PositionEvent.metadata, Pool.metadata]
```

---

## Belangrijke Notities

1. **rFLR Vesting:** Gebruikt VESTED amount voor IL (werkelijke waarde), maar TOTAL voor APR (potentiële yield)

2. **Rate Limiting:** CoinGecko API heeft 50 calls/min limiet, scripts gebruiken batch processing + delays

3. **Concurrency:** Meeste scripts gebruiken concurrency limiting (max 10-12 parallel) om RPC niet te overloaden

4. **Error Handling:** Elke script failure wordt gelogd maar stopt niet de hele cron job

5. **Authorization:** Cron job is beschermd met CRON_SECRET environment variable

---

## Monitoring

Check cron job status:
```bash
curl -X POST https://your-app.railway.app/api/cron/enrichment-hourly \
  -H "Authorization: Bearer $CRON_SECRET"
```

Response bevat:
- success: boolean
- results: object met stats per proces
- errors: array met eventuele errors
- elapsed: totale tijd in seconden
