#!/usr/bin/env bash

set -euo pipefail

HOST="${ICON_PROBE_HOST:-https://static.dexscreener.com/token-icons}"
CHAIN_SLUG="${ICON_CHAIN_SLUG:-${CHAIN_SLUG:-flare}}"

declare -a REPORT=()
FOUND_OK=0

while IFS='=' read -r name value; do
  if [[ "$name" == TOKEN_ADDR_* ]]; then
    ADDRESS=$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')
    if [[ ! "$ADDRESS" =~ ^0x[0-9a-f]{40}$ ]]; then
      REPORT+=("{\"var\":\"$name\",\"status\":\"invalid-address\"}")
      continue
    fi
    URL="$HOST/$CHAIN_SLUG/$ADDRESS.png"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || echo "000")
    REPORT+=("{\"var\":\"$name\",\"url\":\"$URL\",\"status\":\"$HTTP_CODE\"}")
    if [[ "$HTTP_CODE" == "200" ]]; then
      FOUND_OK=1
    fi
  fi
done < <(env)

if [[ "${#REPORT[@]}" -eq 0 ]]; then
  echo "No TOKEN_ADDR_* variables found" >&2
  exit 1
fi

printf '{\n  "chainSlug": "%s",\n  "results": [%s],\n  "ok": %s\n}\n' \
  "$CHAIN_SLUG" \
  "$(IFS=,; echo "${REPORT[*]}")" \
  "$([[ "$FOUND_OK" -eq 1 ]] && echo true || echo false)"

if [[ "$FOUND_OK" -eq 1 ]]; then
  exit 0
fi

exit 1
