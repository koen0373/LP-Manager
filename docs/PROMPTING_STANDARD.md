# Prompting Standard

> Standard for Codex/Composer prompts and AI interactions in the LiquiLab codebase.

---

## Overview

This document defines the working agreements and standards for prompts, AI interactions, and response formats used throughout the LiquiLab project.

---

## Advisory Requirement

Always include a brief **Advies** line in every response when a clearly better/safer/faster/cheaper option exists; add a one-line rationale + suggested next step. If none: "Advies: geen betere optie — doorgaan zoals voorgesteld."

### Template

```
Advies: <one-line recommendation> • Next: <one-line action> • Impact: <time/cost/risk>
```

### Examples

**When a better option exists:**
```
Advies: Use materialized view instead of script-based calculation for 100x speed improvement • Next: Replace enrich-range-status.ts with mv_position_range_status refresh • Impact: Reduces cron time from 5min to 3s
```

**When no better option:**
```
Advies: geen betere optie — doorgaan zoals voorgesteld.
```

### Codex/Composer Results Block Requirement

For Codex/Composer prompts, always include an "Advisory/next_suggested_step" line in **[PASTE BLOCK — RESULTS FOR GPT]**:

```
[PASTE BLOCK — RESULTS FOR GPT]

date: YYYY-MM-DD
changed_files: [...]
notes: ...
errors: null
next_suggested_step: <one-line action with rationale>
```

---

## Working Agreements

- Always add an 'Advies' line when a better option exists (see this document).
- Use alias imports only (`@/components/*`, `@/lib/*`, etc.); no parent-relative imports.
- Public assets under `/media/...` prefix.
- External copy in English inside docs; founder chat is Dutch.
- SILENT mode: do not return full PROJECT_STATE.md; append Changelog entries only.

---

## Changelog

- 2025-11-12 — Added Advisory Requirement section; mandated 'Advisory/next_suggested_step' in results blocks.


