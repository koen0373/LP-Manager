df["fee_rate"] = df["fee_tier"].astype(float)/100 if df["fee_tier"].notna().all() else 0.003
df["daily_fees_usd"] = df["fee_rate"] * df["vol_24h_usd"]
df["apr24h_pct"] = (df["daily_fees_usd"] / df["tvl_usd"])*365*100