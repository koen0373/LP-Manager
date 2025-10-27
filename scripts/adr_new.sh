#!/usr/bin/env bash
set -euo pipefail
mkdir -p docs/ADRs
title="${*:-Untitled decision}"
date_tag="$(date +%Y%m%d)"
slug="$(printf "%s" "$title" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9 -' | tr ' ' '-')"
file="docs/ADRs/ADR-${date_tag}-${slug}.md"
[ -f "$file" ] && { echo "File exists: $file"; exit 1; }
cat > "$file" <<EOF
# ADR: ${title}

- Date: $(date -u +"%Y-%m-%d")
- Status: Proposed

## Context
(Tell the story; constraints, goals, risks.)

## Decision
(The decision in one clear paragraph.)

## Consequences
(+ and - outcomes, operational impact.)

## Alternatives considered
(Why not the others?)

## Links
(PRs, issues, experiments)
EOF
echo "✅ Created $file"
