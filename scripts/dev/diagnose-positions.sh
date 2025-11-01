#!/bin/zsh
set -o pipefail

DEFAULT_ADDRESS="0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1"
BASE_URL="${BASE_URL:-http://localhost:3000}"

ADDRESS=""
SHOW_HELP=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h)
      SHOW_HELP=1
      ;;
    --address)
      shift
      ADDRESS="$1"
      ;;
    *)
      ADDRESS="$1"
      ;;
  esac
  shift
done

if [ "$SHOW_HELP" -eq 1 ]; then
  cat <<'EOF'
Usage: scripts/dev/diagnose-positions.sh [--address 0xWallet]

Hits the canonical /api/positions endpoint twice (headers + body preview) so you can
inspect the normalized PositionRow payload. Set BASE_URL to target a remote instance.
EOF
  exit 0
fi

if [ -z "$ADDRESS" ]; then
  ADDRESS="$DEFAULT_ADDRESS"
fi

echo "# GET $BASE_URL/api/positions --address=${ADDRESS}" >&2
curl -sS -i -G "$BASE_URL/api/positions" \
  --data-urlencode "address=$ADDRESS" \
  --max-time 30 | sed -n '1,80p'

echo >&2
curl -sS -G "$BASE_URL/api/positions" \
  --data-urlencode "address=$ADDRESS" \
  --max-time 30 \
  -w "\nHTTP %{http_code}\n" | sed -n '1,120p'
