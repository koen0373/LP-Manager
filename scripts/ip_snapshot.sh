#!/bin/zsh
# LiquiLab IP snapshot helper — creates a tagged anchor and appends evidence metadata.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "🔐 Creating IP snapshot anchor..."

git add -A
if git commit -m "IP snapshot: pre-filing anchor" >/dev/null 2>&1; then
  echo "✅ Snapshot commit recorded."
else
  echo "ℹ️  No new commit created (working tree unchanged)."
fi

TAG_NAME="IP-ANCHOR-$(date +%F)"
git tag -f "$TAG_NAME"
echo "🏷️  Tag $TAG_NAME updated."

HASH_OUTPUT=""
if [ -f "public/media/wave-hero.png" ]; then
  HASH_OUTPUT="$(shasum -a 256 public/media/wave-hero.png || true)"
  echo "🧾 wave-hero.png hash: $HASH_OUTPUT"
else
  echo "⚠️  public/media/wave-hero.png not found; skipping hash."
fi

CURRENT_COMMIT="$(git rev-parse HEAD)"
LOG_PATH="docs/ip/IP_EVIDENCE_LOG.md"

cat <<EOF >> "$LOG_PATH"

### $(date +%F) — Automated IP Snapshot
- Owner(s): LiquiLab B.V.
- Description: Daily pre-filing repository anchor (tag \`$TAG_NAME\`).
- Repository reference: tag \`$TAG_NAME\` / commit \`$CURRENT_COMMIT\`
- Evidence type: git tag + asset hash
- Evidence location: LiquiLab Git repository
- Hash: ${HASH_OUTPUT:-_not available_}
- Notes: Generated via scripts/ip_snapshot.sh.
EOF

echo "📝 Evidence entry appended to $LOG_PATH"
echo "Done."
