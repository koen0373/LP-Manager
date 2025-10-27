# Data Catalog (Analytics)

All analytics tables use a safe prefix (`analytics_`) to avoid clashes with app tables.

## Tables
- **analytics_provider**: providers (slug, name, type)
- **analytics_market**: normalized pools/markets per provider
- **analytics_market_snapshot**: hourly market KPIs (price, TVL, volume, incentives, APY)
- **analytics_wallet**: discovered wallets (first_seen, last_seen)
- **analytics_position**: normalized positions (owner -> wallet FK)
- **analytics_position_snapshot**: hourly position KPIs (tvl, fees, incentives, range state)
- **analytics_wallet_metrics_daily**: daily rollups per wallet (counts, tvl_usd, realized_fees_usd, avg_range_width, avg_apy)
- **analytics_market_metrics_daily**: daily rollups per market (tvl, active_positions, avg_apy)
- **analytics_discovery_log**: provenance of wallet discovery (source, provider, txHash, block, ts)

## Retention
- Snapshots: 13 months (hourly) then downsample to daily.
- Rollups: 3+ years.

## Privacy
- On-chain is public; we do **not** join with PII. Provide opt-out mechanism for inclusion in demos if a wallet owner requests.

