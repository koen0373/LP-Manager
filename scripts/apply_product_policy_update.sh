#!/usr/bin/env bash
set -euo pipefail

PS="PROJECT_STATE.md"
touch "$PS"

# 1) Verwijder oude social-share regel(s) als die er staan
# (ruime match; beide varianten verwijderen stilletjes)
sed -i '' '/Social share cards.*provider/d' "$PS" 2>/dev/null || true
sed -i '' '/social share.*provider/d' "$PS" 2>/dev/null || true
sed -i '' '/provider name as text/d' "$PS" 2>/dev/null || true

# 2) Pricing & Entitlements blok toevoegen als het nog niet bestaat
if ! grep -q '^## Pricing & Entitlements$' "$PS" 2>/dev/null; then
  cat >> "$PS" <<'MD'

## Pricing & Entitlements
- Unit price: **$1.99** per pool per **30 days**, billed in **bundles of 5** (5, 10, 15, …).
- **Allowed slots** (capacity bonus, no price reduction):
  - Let **U** = number of **paid** pools (multiple of 5).
  - If **U = 0** → **1 free slot** (trial).
  - Else **allowed = U + floor(U/10) + (U == 5 ? 1 : 0)**.
    Examples: 5→6, 10→11, 15→16, 20→22, 30→33.
- **Yearly** = fees for **10 months** → access for **12 months**.
- **Upgrades**: pro-rated for days left in period. **Downgrades**: at next period only.
MD
fi

# 3) Waitlist & FastForward policy + toggles (toevoegen als nieuw)
if ! grep -q '^## Waitlist & FastForward Policy$' "$PS" 2>/dev/null; then
  cat >> "$PS" <<'MD'

## Waitlist & FastForward Policy
- **Seat cap** via `LL_SEAT_CAP`. Bij cap bereikt: checkout uit; prospect mag wallet connecten & verkennen.
- Primaire CTA: **“Join the waiting list”**; optioneel **“FastForward”** (bijv. $50) als `LL_FASTFORWARD_ENABLED=1`.
- **FastForward** kan door Admin worden uitgezet; bij uit -> alleen wachtlijst.
- Heropenen van FastForward communiceren we via e-mail naar de wachtlijst en via social kanalen.
MD
fi

# 4) Env toggles zetten/actualiseren in .env.local
touch .env.local
if grep -q '^LL_FASTFORWARD_ENABLED=' .env.local; then
  sed -i '' 's/^LL_FASTFORWARD_ENABLED=.*/LL_FASTFORWARD_ENABLED="1"/' .env.local
else
  echo 'LL_FASTFORWARD_ENABLED="1"' >> .env.local
fi
if grep -q '^LL_SEAT_CAP=' .env.local; then
  sed -i '' 's/^LL_SEAT_CAP=.*/LL_SEAT_CAP="100"/' .env.local
else
  echo 'LL_SEAT_CAP="100"' >> .env.local
fi

# 5) Commit (als git aanwezig is)
if command -v git >/dev/null 2>&1; then
  git add "$PS" .env.local >/dev/null 2>&1 || true
  git commit -m "policy: waitlist/fastforward toggles + entitlements; remove old social-share rule" >/dev/null 2>&1 || true
fi

echo "✅ Policy patch klaar."
echo "→ Check: grep -n 'Pricing & Entitlements' PROJECT_STATE.md"
echo "→ Env : grep -E '^LL_(FASTFORWARD_ENABLED|SEAT_CAP)=' .env.local"
