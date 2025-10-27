#!/usr/bin/env bash
set -euo pipefail
FILE="docs/IDEAS.md"
[ -f "$FILE" ] || { echo "Missing $FILE"; exit 1; }
title="${*:-Untitled idea}"
ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
id="$(date +"%Y%m%d%H%M%S")"
entry="- [ ] ${ts} — ${title}  <!-- id:${id} -->"
tmp="$(mktemp)"
awk -v e="$entry" '
  {print}
  /<!-- INBOX_END -->/ {print e}
' "$FILE" > "$tmp"
mv "$tmp" "$FILE"
echo "✅ Added to Inbox: ${title}"
