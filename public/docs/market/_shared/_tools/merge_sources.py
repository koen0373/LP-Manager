import csv, os, sys, glob
INBOX = "docs/market/_shared/_inbox"
OUT   = "docs/market/_shared/SOURCES.csv"

SCHEMA = ["item","value","source_url","publisher","publish_date","accessed_date","notes"]

def normalize_row(r: dict) -> dict:
    # Map veelvoorkomende alternatieve kolomnamen naar schema
    aliases = {
        "title":"item","name":"item",
        "data":"value","amount":"value","metric":"value","value_usd":"value",
        "url":"source_url","link":"source_url","source":"source_url",
        "org":"publisher","vendor":"publisher","platform":"publisher",
        "date":"publish_date","published":"publish_date",
        "seen":"accessed_date","accessed":"accessed_date",
        "comment":"notes","note":"notes","remarks":"notes",
    }
    out = {k:"" for k in SCHEMA}
    # normaliseer keys lower-case zonder spaties/underscores
    def norm(k): return k.strip().lower().replace(" ", "_")
    for k,v in r.items():
        if k is None: 
            continue
        nk = norm(k)
        target = aliases.get(nk, nk)
        if target in out:
            out[target] = (v or "").strip()
    # minimale sanity
    out["item"] = out["item"] or "(unknown)"
    return out

rows = []
for path in sorted(glob.glob(os.path.join(INBOX, "*.csv"))):
    with open(path, newline='', encoding="utf-8") as f:
        rd = csv.DictReader(f)
        for r in rd:
            rows.append(normalize_row(r))

# de-dupe op (item, source_url, value) om ruis te beperken
seen = set()
dedup = []
for r in rows:
    key = (r["item"], r["source_url"], r["value"])
    if key in seen: 
        continue
    seen.add(key)
    dedup.append(r)

# sorteer: item asc, publisher asc, publish_date desc
def sort_key(r):
    return (r["item"].lower(), r["publisher"].lower(), r["publish_date"][::-1])
dedup.sort(key=sort_key)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", newline='', encoding="utf-8") as f:
    wr = csv.DictWriter(f, fieldnames=SCHEMA)
    wr.writeheader()
    wr.writerows(dedup)

print(f"✅ Wrote {len(dedup)} rows → {OUT}")
