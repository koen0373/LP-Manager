#!/bin/zsh
# LiquiLab IP repository bootstrap
# macOS/zsh-safe helper to enforce IP hygiene, commit templates, and Git LFS setup.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "🔐 LiquiLab IP bootstrap starting…"

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "✅ Git repository detected at $REPO_ROOT"
else
  echo "📁 Initialising Git repository…"
  git init
fi

# Core Git configuration
echo "⚙️  Configuring Git defaults…"
git config core.autocrlf input
git config core.safecrlf true
git config --local init.defaultBranch main

# Commit template for IP declarations
COMMIT_TEMPLATE_PATH="$REPO_ROOT/.gitmessage"
if [ -f "$COMMIT_TEMPLATE_PATH" ]; then
  git config commit.template "$COMMIT_TEMPLATE_PATH"
  echo "📝 Commit template set to $COMMIT_TEMPLATE_PATH"
else
  echo "⚠️  Commit template $COMMIT_TEMPLATE_PATH not found. Please create it before committing."
fi

# Git LFS enablement
if command -v git-lfs >/dev/null 2>&1; then
  echo "📦 Enabling Git LFS hooks…"
  git lfs install --local --force
  echo "📁 Tracking patterns ensured via .gitattributes"
else
  echo "⚠️  git-lfs not installed. Install via 'brew install git-lfs' and re-run this script."
fi

# Install commit hooks
HOOK_SETUP="$REPO_ROOT/scripts/git/setup_hooks.sh"
if [ -x "$HOOK_SETUP" ]; then
  "$HOOK_SETUP"
else
  echo "⚠️  Hook setup script missing or not executable: $HOOK_SETUP"
fi

# Commit signing reminder (optional)
if git config user.signingkey >/dev/null 2>&1; then
  echo "✍️  Git signing key detected."
else
  echo "ℹ️  Consider configuring 'git config user.signingkey <GPG-or-SSH-key>' for signed commits."
fi

# Establish IP anchor tag if possible
if git rev-parse --verify ip-anchor >/dev/null 2>&1; then
  echo "🏷️  Tag 'ip-anchor' already exists."
else
  if git rev-parse --verify HEAD >/dev/null 2>&1; then
    TAG_MESSAGE="IP baseline anchor $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    git tag -a ip-anchor -m "$TAG_MESSAGE"
    echo "🏷️  Created annotated tag 'ip-anchor' on current HEAD."
  else
    echo "⚠️  No commits yet; skipping 'ip-anchor' tag. Create an initial commit and re-run if needed."
  fi
fi

cat <<'INFO'

Optional next steps:
  • Review docs/legal/*.md for accuracy and update attribution tables.
  • Update docs/ip/IP_EVIDENCE_LOG.md with current artefacts.
  • (Optional) Initialise a private remote:
      # gh repo create liquilab/labs --private --source=. --push   # uncomment and adjust as needed

All done.
INFO
