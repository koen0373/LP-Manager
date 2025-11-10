# LiquiLab Weekly Report - User Engagement Optimization
## Data-Driven LP Retention & Actionable Insights

---

## 1. BENODIGDE DATAVELDEN & QUERIES

### **A. Performance & Profitabiliteit (per gebruiker)**

```sql
-- 1. Week Performance Overview
SELECT 
  u.address,
  COUNT(DISTINCT p.tokenId) as active_positions,
  SUM(p.fee0 + p.fee1) as total_fees_week_usd,
  SUM(p.incentivesUsd) as total_rewards_week_usd,
  SUM(p.tvl) as total_tvl_usd,
  AVG(p.apr) as avg_apr,
  SUM(CASE WHEN p.rangeStatus = 'IN_RANGE' THEN 1 ELSE 0 END) as positions_in_range,
  (total_fees_week_usd + total_rewards_week_usd) as total_earnings_week
FROM users u
JOIN positions p ON p.owner = u.address
WHERE p.lastUpdated BETWEEN NOW() - INTERVAL '7 days' AND NOW()
GROUP BY u.address;

-- 2. P&L Breakdown per Pool
SELECT 
  p.pool,
  p.token0Symbol || '/' || p.token1Symbol as pair,
  p.fee0 + p.fee1 as fees_earned,
  p.incentivesUsd as rewards_earned,
  p.impermanentLoss as il_usd,
  (p.fee0 + p.fee1 + p.incentivesUsd - ABS(p.impermanentLoss)) as net_profit,
  p.apr as current_apr
FROM positions p
WHERE p.owner = :user_address
ORDER BY net_profit DESC;

-- 3. Unclaimed Rewards (Actionable!)
SELECT 
  p.tokenId,
  p.pool,
  p.pair,
  COALESCE(p.unclaimedFee0, 0) + COALESCE(p.unclaimedFee1, 0) as unclaimed_fees_usd,
  p.incentivesTokenAmount as unclaimed_rewards_amount,
  p.incentivesToken as reward_token,
  p.incentivesUsd as unclaimed_rewards_usd,
  (unclaimed_fees_usd + unclaimed_rewards_usd) as total_claimable_usd
FROM positions p
WHERE p.owner = :user_address
  AND (unclaimed_fees_usd > 1 OR unclaimed_rewards_usd > 1)
ORDER BY total_claimable_usd DESC;
```

**📊 VISUAL/TEXT:**
- **"Week Performance"** - Card met grote cijfers:
  - `💰 $XX earned this week (+YY% vs last week)`
  - `📈 Average APR: XX%`
  - `💎 $XX claimable rewards (Action required!)`
- **"P&L per Pool"** - Tabel met groene/rode badges:
  - `WFLR/USDT: +$450 profit (APR 32%)`
  - `FLR/SFLR: -$12 IL, +$89 fees = +$77 net`
- **"💰 Claim Alert"** - Highlighted box:
  - `You have $127 in unclaimed fees! Claim now to compound.`

---

### **B. Position Health & Range Status**

```sql
-- 4. Range Status & Efficiency
SELECT 
  p.tokenId,
  p.pair,
  p.rangeStatus,
  p.tickLower,
  p.tickUpper,
  p.currentTick,
  -- Calculate % of time in range (last 7 days)
  (SELECT COUNT(*) FROM position_snapshots ps 
   WHERE ps.tokenId = p.tokenId 
     AND ps.timestamp > NOW() - INTERVAL '7 days'
     AND ps.inRange = true
  ) * 100.0 / (SELECT COUNT(*) FROM position_snapshots ps WHERE ps.tokenId = p.tokenId AND ps.timestamp > NOW() - INTERVAL '7 days') as pct_time_in_range,
  CASE 
    WHEN p.rangeStatus = 'OUT_OF_RANGE' THEN 
      (SELECT SUM(fees_lost_estimate) FROM missed_opportunities mo WHERE mo.tokenId = p.tokenId AND mo.date > NOW() - INTERVAL '7 days')
    ELSE 0
  END as missed_fees_week_usd
FROM positions p
WHERE p.owner = :user_address;

-- 5. Alert Log (Out-of-range events)
SELECT 
  a.tokenId,
  a.pool,
  a.pair,
  a.alertType,
  a.timestamp,
  a.metadata->>'missedFeesEstimate' as missed_fees_usd,
  EXTRACT(EPOCH FROM (NOW() - a.timestamp)) / 3600 as hours_ago
FROM alerts a
WHERE a.userAddress = :user_address
  AND a.timestamp > NOW() - INTERVAL '7 days'
  AND a.alertType IN ('OUT_OF_RANGE', 'NEAR_RANGE', 'HIGH_IL')
ORDER BY a.timestamp DESC;
```

**📊 VISUAL/TEXT:**
- **"Position Health"** - Traffic light badges:
  - `🟢 WFLR/USDT: 98% in-range (excellent!)`
  - `🟡 FLR/SFLR: 76% in-range (consider rebalancing)`
  - `🔴 USDT/USDC: 12% in-range - $45 missed fees!`
- **"⚠️ Missed Opportunities"** - Alert cards:
  - `Position #12345 was out-of-range for 18 hours. Est. $23 in missed fees. → Rebalance now`

---

### **C. Peer Benchmarking**

```sql
-- 6. User Ranking per Pool
WITH pool_stats AS (
  SELECT 
    p.pool,
    p.owner,
    SUM(p.fee0 + p.fee1) as total_fees,
    AVG(p.apr) as avg_apr,
    PERCENT_RANK() OVER (PARTITION BY p.pool ORDER BY SUM(p.fee0 + p.fee1) DESC) as percentile_rank
  FROM positions p
  WHERE p.lastUpdated > NOW() - INTERVAL '30 days'
  GROUP BY p.pool, p.owner
)
SELECT 
  ps.pool,
  ps.total_fees,
  ps.avg_apr,
  CASE 
    WHEN ps.percentile_rank <= 0.10 THEN 'Top 10%'
    WHEN ps.percentile_rank <= 0.20 THEN 'Top 20%'
    WHEN ps.percentile_rank <= 0.50 THEN 'Top 50%'
    ELSE 'Below average'
  END as ranking,
  (SELECT AVG(total_fees) FROM pool_stats WHERE pool = ps.pool) as pool_avg_fees
FROM pool_stats ps
WHERE ps.owner = :user_address;

-- 7. Cross-DEX Comparison
SELECT 
  CASE 
    WHEN p.nfpmAddress = '0xD9770b1C7A6ccd33C75b5bcB1c0078f46bE46657' THEN 'Enosys'
    WHEN p.nfpmAddress = '0xEE5FF5Bc5F852764b5584d92A4d592A53DC527da' THEN 'SparkDEX'
  END as dex,
  COUNT(*) as positions_count,
  SUM(p.fee0 + p.fee1) as total_fees,
  AVG(p.apr) as avg_apr
FROM positions p
WHERE p.owner = :user_address
GROUP BY dex;
```

**📊 VISUAL/TEXT:**
- **"Your Ranking"** - Badge system:
  - `🏆 WFLR/USDT: You're in the TOP 12% of LPs! (Earning $XX/week vs $YY pool avg)`
  - `📊 FLR/SFLR: Top 45% - Increase range efficiency to climb higher`
- **"Cross-DEX Performance"** - Comparison chart:
  - `Enosys: $450 fees (avg APR 28%)`
  - `SparkDEX: $890 fees (avg APR 42%) ← Your best performer!`

---

### **D. Trends & Progress**

```sql
-- 8. Week-over-Week Growth
WITH this_week AS (
  SELECT 
    SUM(p.fee0 + p.fee1) as fees,
    SUM(p.incentivesUsd) as rewards,
    AVG(p.apr) as apr
  FROM positions p
  WHERE p.owner = :user_address
    AND p.lastUpdated BETWEEN NOW() - INTERVAL '7 days' AND NOW()
),
last_week AS (
  SELECT 
    SUM(p.fee0 + p.fee1) as fees,
    SUM(p.incentivesUsd) as rewards,
    AVG(p.apr) as apr
  FROM positions p
  WHERE p.owner = :user_address
    AND p.lastUpdated BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
)
SELECT 
  tw.fees as fees_this_week,
  lw.fees as fees_last_week,
  ((tw.fees - lw.fees) / NULLIF(lw.fees, 0)) * 100 as fees_growth_pct,
  tw.rewards as rewards_this_week,
  lw.rewards as rewards_last_week,
  ((tw.rewards - lw.rewards) / NULLIF(lw.rewards, 0)) * 100 as rewards_growth_pct,
  tw.apr as apr_this_week,
  lw.apr as apr_last_week
FROM this_week tw, last_week lw;

-- 9. Milestones & Achievements
SELECT 
  u.address,
  -- Total fees milestone
  CASE 
    WHEN u.total_fees_earned >= 10000 THEN 'Diamond LP 💎'
    WHEN u.total_fees_earned >= 5000 THEN 'Platinum LP 🏆'
    WHEN u.total_fees_earned >= 1000 THEN 'Gold LP 🥇'
    WHEN u.total_fees_earned >= 100 THEN 'Silver LP 🥈'
    ELSE 'Bronze LP 🥉'
  END as tier,
  -- Days active
  EXTRACT(DAY FROM (NOW() - u.first_position_date)) as days_active,
  -- Position count milestone
  (SELECT COUNT(*) FROM positions WHERE owner = u.address) as total_positions,
  -- Cross-DEX badge
  CASE WHEN 
    (SELECT COUNT(DISTINCT nfpmAddress) FROM positions WHERE owner = u.address) >= 2 
    THEN '🌐 Multi-DEX Master'
    ELSE NULL
  END as cross_dex_badge
FROM users u
WHERE u.address = :user_address;
```

**📊 VISUAL/TEXT:**
- **"📈 This Week's Progress"** - Trend cards:
  - `Fees: $127 (+23% vs last week) 📈`
  - `Rewards: $89 (+5% vs last week)`
  - `Your APR improved from 28% → 32%! 🚀`
- **"🏅 Achievements"** - Badge display:
  - `Gold LP 🥇 - You've earned $1,240 total!`
  - `67 days active - Keep it up! (33 days to Platinum)`
  - `🌐 Multi-DEX Master - Using Enosys + SparkDEX`

---

### **E. Market Intelligence & Opportunities**

```sql
-- 10. Trending Pools (High APR, growing TVL)
SELECT 
  p.address as pool,
  p.token0Symbol || '/' || p.token1Symbol as pair,
  p.factory,
  -- Current metrics
  (SELECT AVG(apr) FROM positions WHERE pool = p.address AND lastUpdated > NOW() - INTERVAL '7 days') as avg_apr,
  (SELECT SUM(tvl) FROM positions WHERE pool = p.address) as total_tvl,
  -- Growth metrics
  (SELECT COUNT(*) FROM positions WHERE pool = p.address AND createdAt > NOW() - INTERVAL '7 days') as new_positions_week,
  -- User already in this pool?
  CASE WHEN EXISTS(SELECT 1 FROM positions WHERE owner = :user_address AND pool = p.address) 
    THEN true ELSE false 
  END as user_has_position
FROM pools p
WHERE 
  -- High APR
  (SELECT AVG(apr) FROM positions WHERE pool = p.address) > 25
  -- Growing activity
  AND (SELECT COUNT(*) FROM positions WHERE pool = p.address AND createdAt > NOW() - INTERVAL '7 days') > 5
  -- Not already in
  AND NOT EXISTS(SELECT 1 FROM positions WHERE owner = :user_address AND pool = p.address)
ORDER BY avg_apr DESC
LIMIT 5;

-- 11. Similar LP Strategies (What are peers doing?)
WITH user_pools AS (
  SELECT DISTINCT pool FROM positions WHERE owner = :user_address
),
similar_lps AS (
  SELECT 
    p.owner,
    COUNT(*) as shared_pools
  FROM positions p
  WHERE p.pool IN (SELECT pool FROM user_pools)
    AND p.owner != :user_address
  GROUP BY p.owner
  HAVING COUNT(*) >= 2
  ORDER BY shared_pools DESC
  LIMIT 10
)
SELECT 
  p.pool,
  p.token0Symbol || '/' || p.token1Symbol as pair,
  COUNT(DISTINCT p.owner) as similar_lps_in_pool,
  AVG(p.apr) as avg_apr
FROM positions p
WHERE p.owner IN (SELECT owner FROM similar_lps)
  AND p.pool NOT IN (SELECT pool FROM user_pools)
GROUP BY p.pool, pair
ORDER BY similar_lps_in_pool DESC
LIMIT 3;
```

**📊 VISUAL/TEXT:**
- **"🔥 Trending Pools"** - Opportunity cards:
  - `WFLR/HLN: 67% APR, +12 new LPs this week → Explore pool`
  - `FLR/SPRK: 42% APR, $450K TVL growing → Add liquidity`
- **"👥 What Similar LPs Are Doing"** - Social proof:
  - `8 LPs like you also provide in USDT/USDC (avg APR 18%)`
  - `Consider diversifying into trending pools`

---

## 2. KERN MOTIVATORS (in elk rapport)

### **🎯 Motivator 1: Progress & Achievement**
**Doel:** Gebruiker laten zien hoeveel ze al bereikt hebben + volgende mijlpaal binnen handbereik maken

**Implementatie:**
```
"🏅 You've Earned $1,240 This Month!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Progress to Platinum LP (🏆 $5,000 total):
[████████░░░░░░░░░░] 24.8% → Only $3,760 to go!

Your rank in WFLR/USDT: TOP 12% of 847 LPs 🚀
You're outperforming 88% of liquidity providers!"
```

---

### **🎯 Motivator 2: Social Proof & Comparison**
**Doel:** FOMO creëren door te laten zien wat anderen verdienen

**Implementatie:**
```
"📊 How You Compare:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Your weekly earnings: $127
Average LP earnings:  $89  (+42% above average! 🎯)
Top 10% earns:        $340 (Potential: +$213/week)

💡 Top LPs use 3-5 positions across both DEXes.
   You currently have 2. Consider diversifying!"
```

---

### **🎯 Motivator 3: Missed Opportunity Alert**
**Doel:** Urgentie creëren door gemiste inkomsten te tonen

**Implementatie:**
```
"⚠️ You Left Money on the Table
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This week you missed out on ~$45 in fees:

• Position #12345 was out-of-range for 18 hrs → -$23
• Unclaimed fees for 5 days → -$12 (gas costs)
• Missed SPRK rewards drop → -$10

→ Enable RangeBand™ Alerts to prevent this! ($2.49/mo)"
```

---

## 3. STANDAARD CALL-TO-ACTIONS

### **🎬 CTA 1: Claim Rewards (High-Value, Low-Effort)**
**Wanneer:** Altijd als `total_claimable_usd > $5`

**Implementatie:**
```
┌────────────────────────────────────────────┐
│ 💰 YOU HAVE $127 IN CLAIMABLE REWARDS     │
│                                            │
│ Breakdown:                                 │
│ • Unclaimed fees:    $89                   │
│ • rFLR rewards:      $38                   │
│                                            │
│ ⚡ Est. gas cost: $0.12                    │
│                                            │
│ [Claim All Now →]  [Schedule Auto-Claim]  │
└────────────────────────────────────────────┘
```

---

### **🎬 CTA 2: Rebalance Out-of-Range Positions**
**Wanneer:** `rangeStatus = 'OUT_OF_RANGE'` EN `missed_fees_week_usd > $10`

**Implementatie:**
```
┌────────────────────────────────────────────┐
│ 🔴 URGENT: Position Out of Range          │
│                                            │
│ Pool: WFLR/USDT (#12345)                   │
│ Status: Out-of-range for 6 hours          │
│ Missed fees: ~$12 and counting...         │
│                                            │
│ Recommended action:                        │
│ → Rebalance to range: 0.85 - 1.15         │
│                                            │
│ [Auto-Rebalance →]  [View Details]        │
└────────────────────────────────────────────┘
```

---

### **🎬 CTA 3: Explore High-APR Opportunities**
**Wanneer:** User heeft < 5 posities OF avg_apr < 20%

**Implementatie:**
```
┌────────────────────────────────────────────┐
│ 🚀 BOOST YOUR EARNINGS                     │
│                                            │
│ Your current APR: 18%                      │
│ Trending pools with 40%+ APR:             │
│                                            │
│ 1. WFLR/HLN   (67% APR, $12K TVL) 🔥       │
│ 2. FLR/SPRK   (42% APR, $450K TVL)         │
│ 3. USDT/SFLR  (38% APR, $89K TVL)          │
│                                            │
│ Potential earnings: +$89/week              │
│                                            │
│ [Explore Pools →]  [Compare APRs]         │
└────────────────────────────────────────────┘
```

---

## 4. VISUELE ELEMENTEN & HEATMAPS

### **A. Position Health Heatmap**
```
Your Positions Health Map:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

WFLR/USDT  [🟢🟢🟢🟢🟢🟢🟢🟢🟢🟢] 98% in-range (excellent)
FLR/SFLR   [🟢🟢🟢🟢🟢🟢🟢🟡🟡🔴] 76% in-range (good)
USDT/USDC  [🔴🔴🔴🔴🟡🟡🟢🟢🟢🟢] 42% in-range (needs attention)

Legend: 🟢 In-range  🟡 Near edge  🔴 Out-of-range
```

---

### **B. Earnings Trend Chart (7-day)**
```
Weekly Earnings Trend:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
$150│                         ╱╲
    │                    ╱╲  ╱  ╲
$100│              ╱╲   ╱  ╲╱    ╲
    │         ╱╲  ╱  ╲ ╱
 $50│    ╱╲  ╱  ╲╱    ╲
    │   ╱  ╲╱
  $0└────────────────────────────
    Mon Tue Wed Thu Fri Sat Sun

📈 +23% vs last week | Avg: $127/week
```

---

### **C. Pool Diversification Radar**
```
Your Portfolio Diversification:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        Stablecoins
             │
             │ 20%
     ────────┼────────
    │        │        │
45% │        │        │ 15%
    │        │        │
Major│        │        │Alts
Pairs│        ●        │
    │                 │
     ─────────────────
      Exotic Pairs: 20%

💡 Recommended: Increase Major Pairs to 60%
```

---

## 5. EMAIL/RAPPORT STRUCTUUR

### **📧 Subject Lines (dynamisch)**
- `Week 45: You earned $127 (+23%!) 💰`
- `⚠️ $45 in unclaimed rewards waiting for you`
- `🏆 You're now in the TOP 12% of LPs!`
- `New 67% APR pool trending - Don't miss out! 🚀`

### **📄 Rapport Sectie Volgorde**
```
1. Hero Stats (grote cijfers)
   ↓
2. Week Performance (fees, rewards, APR)
   ↓
3. 🎯 KEY ACTIONS (claims, rebalancing)
   ↓
4. Position Health (heatmap)
   ↓
5. Peer Comparison (ranking, benchmarks)
   ↓
6. Progress & Achievements (badges, milestones)
   ↓
7. Market Opportunities (trending pools)
   ↓
8. Next Week Goals (personalized)
```

---

## 6. IMPLEMENTATIE ROADMAP

### **Phase 1: MVP (Week 1-2)**
- [ ] Basic performance metrics (fees, rewards, TVL)
- [ ] Unclaimed rewards CTA
- [ ] Position health status
- [ ] Week-over-week growth

### **Phase 2: Engagement (Week 3-4)**
- [ ] Peer benchmarking
- [ ] Achievement badges
- [ ] Missed opportunity alerts
- [ ] Trending pools

### **Phase 3: Advanced (Week 5-6)**
- [ ] Predictive alerts (out-of-range forecasting)
- [ ] Auto-rebalancing suggestions
- [ ] Portfolio optimization AI
- [ ] Social features (LP leaderboards)

---

## 7. SUCCESS METRICS

Track deze KPIs per rapport:

- **Engagement Rate**: % users die rapport openen
- **CTA Click Rate**: % users die op claims/rebalance klikken
- **Action Completion**: % users die daadwerkelijk claimen/rebalancen
- **Position Growth**: Nieuwe posities na rapport
- **Retention**: % users nog actief na 4 weken

**Target:**
- Open rate: >60%
- CTA click rate: >25%
- Action completion: >40%
- Week-4 retention: >80%

---

**🎯 KERN PRINCIPE:**

> "Elke gebruiker moet na het rapport denken:  
> (1) Ik doe het goed (motivatie)  
> (2) Ik kan het beter doen (actie)  
> (3) Het is makkelijk om te verbeteren (CTA)"


