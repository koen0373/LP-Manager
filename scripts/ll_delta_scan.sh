#!/usr/bin/env zsh
set -euo pipefail

echo "# Repo:"; pwd
echo

if command -v git >/dev/null 2>&1; then
  echo "# Laatste commit (met bestanden):"
  git log -1 --pretty=format:"%h %ad %s" --date=iso
  echo
  git log -1 --name-status
  echo

  echo "# Wijzigingen afgelopen 24 uur (bestanden):"
  git log --since="24 hours ago" --name-only --pretty=format: | sort -u
  echo

  echo "# Ongecommit (status kort):"
  git status -s || true
else
  echo "# Git niet gevonden. Toon bestanden gewijzigd in laatste 24 uur (mtime):"
  find . -type f -mtime -1 ! -path "./node_modules/*" ! -path "./.next/*" -print | sort
fi
echo

echo "# Controle achtergrond & assets:"
grep -R --line-number "/media/wave-hero" -- * 2>/dev/null || echo "Geen directe wave-hero referenties gevonden"
ls -l public/media/wave-hero.* 2>/dev/null || true
ls -l public/icons/rabby.webp  public/icons/bifrost.webp 2>/dev/null || true
echo

echo "# Kernbestanden aanwezig?"
for f in \
  pages/index.tsx \
  src/components/onboarding/ConnectWalletModal.tsx \
  pages/api/demo/pools.ts \
  src/components/demo/DemoPoolsTable.tsx \
  src/features/pools/PoolRow.tsx \
  src/components/pools/PoolRangeIndicator.tsx \
  src/styles/globals.css \
  PROJECT_STATE.md
do
  [ -f "$f" ] && echo "OK  - $f" || echo "MISS- $f"
done
