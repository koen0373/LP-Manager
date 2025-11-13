#!/bin/zsh
set -e
echo "# Preflight…"
node scripts/erc721/preflight.mjs
echo "# Start refresher…"
pnpm dlx tsx scripts/erc721/refresh-erc721.ts
echo "# Verify non-empty…"
node scripts/erc721/verify.mjs
