#!/bin/zsh
# LiquiLab Git hook installer (idempotent, macOS/zsh-safe)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
COMMIT_HOOK_SRC="$REPO_ROOT/scripts/git/commit-msg"
COMMIT_HOOK_DEST="$HOOKS_DIR/commit-msg"

if [ ! -d "$REPO_ROOT/.git" ]; then
  echo "⚠️  No .git directory found at $REPO_ROOT. Initialise Git before installing hooks."
  exit 0
fi

mkdir -p "$HOOKS_DIR"

if [ ! -x "$COMMIT_HOOK_SRC" ]; then
  echo "⚠️  Commit hook source is not executable: $COMMIT_HOOK_SRC"
  echo "    Run 'chmod +x $COMMIT_HOOK_SRC' and re-run this script."
  exit 1
fi

if [ -L "$COMMIT_HOOK_DEST" ] && [ "$(readlink "$COMMIT_HOOK_DEST")" = "$COMMIT_HOOK_SRC" ]; then
  echo "🔁 Commit hook already symlinked."
else
  ln -sf "$COMMIT_HOOK_SRC" "$COMMIT_HOOK_DEST"
  echo "✅ Installed commit-msg hook -> $COMMIT_HOOK_DEST"
fi

echo "Hooks ready."
