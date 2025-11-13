#!/bin/zsh
# macOS/zsh — Eénmalig: tokens verzamelen op Flare (Enosys/SparkDEX) en icons lokaal downloaden

set -e

setopt NO_BANG_HIST

# 0) Projectmap openen
PROJECT_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/Desktop/Liquilab"

[ -d "$PROJECT_DIR" ] || { echo "[ERR] $PROJECT_DIR niet gevonden"; setopt BANG_HIST; exit 1; }

cd "$PROJECT_DIR"; pwd

# 1) Werkbranch
git checkout -b ops/fetch-dex-icons-$(date +%Y%m%d) || git checkout ops/fetch-dex-icons-$(date +%Y%m%d)

# 2) Stel RPC + factory env (pas addresses aan jullie waarden!)
export FLARE_RPC_URLS="${FLARE_RPC_URLS:-https://rpc.ankr.com/flare/<YOUR_KEY>,https://flare-api.flare.network/ext/C/rpc}"
export ENOSYS_V3_FACTORY="${ENOSYS_V3_FACTORY:-0x17AA157AC8C54034381b840Cb8f6bf7Fc355f0de}"
export ENOSYS_FACTORY_START="${ENOSYS_FACTORY_START:-29925441}"
export SPARKDEX_V3_FACTORY="${SPARKDEX_V3_FACTORY:-0x8A2578d23d4C532cC9A98FaD91C0523f5efDE652}"
export SPARKDEX_FACTORY_START="${SPARKDEX_FACTORY_START:-30717263}"
export CHAIN_SLUG="${CHAIN_SLUG:-flare}"

# 3) Verzamel alle tokenadressen uit beide factories (scan in vensters van 50k blocks)
node scripts/icons/collect-flare-dex-tokens.mjs \
  --chain="$CHAIN_SLUG" \
  --rpc="${FLARE_RPC_URLS%%,*}" \
  --enosysFactory="$ENOSYS_V3_FACTORY" \
  --enosysStart="$ENOSYS_FACTORY_START" \
  --sparkdexFactory="$SPARKDEX_V3_FACTORY" \
  --sparkdexStart="$SPARKDEX_FACTORY_START" \
  --window=50000 \
  --headMargin=1000 \
  --out="data/flare.tokens.json"

# 4) Optioneel: snel testen welke remote icons bestaan
node scripts/verify-icons/remote-probe.mjs --chain "$CHAIN_SLUG" --in data/flare.tokens.json --limit 300 || true

# 5) Download alle beschikbare Dexscreener-icons (alleen ontbrekende lokaal)
mkdir -p public/media/tokens public/media/tokens/by-address

node scripts/icons/fetch-dex-icons.mjs \
  --chain="$CHAIN_SLUG" \
  --in="data/flare.tokens.json" \
  --out="public/media/tokens" \
  --only-missing \
  --concurrency=8

# 6) Build & deploy
npm run -s build

git add -A
git commit -m 'chore(icons): fetched Enosys/SparkDEX token icons into public/media/tokens + manifest' || true

command -v railway >/dev/null 2>&1 || brew install railway
railway link   # Workspace=Liquilab → Project=Liquilab → Environment=production
RW_WEB="${RW_WEB:-Liquilab}"
railway up -s "$RW_WEB"
railway logs -s "$RW_WEB" --lines 120 || true

setopt BANG_HIST

