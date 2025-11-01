import requests, pandas as pd, math
DEX = "sparkdex-v3-1"  # of "enosys-v3", "blazeswap-flare"
url = f"https://api.geckoterminal.com/api/v2/networks/flare/dexes/{DEX}/pools?page=1&include=base_token,quote_token"
j = requests.get(url, timeout=30).json()
rows = []
for p in j["data"]:
    attrs = p["attributes"]
    rows.append({
      "pool": attrs["address"],
      "fee_tier": attrs.get("fee_tier"), 
      "tvl_usd": attrs["reserve_in_usd"],
      "vol_24h_usd": attrs["volume_usd"]["h24"],
      "vol_30d_usd": attrs["volume_usd"]["d30"],
      "base": j["included"][0]["attributes"]["symbol"]
    })
df = pd.DataFrame(rows)