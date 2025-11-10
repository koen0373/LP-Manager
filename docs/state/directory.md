# LiquiLab State — Directory Layout

## Top-level system map
- `pages/` — Next.js Pages Router APIs (`pages/api/*`) and admin/public views.
- `src/indexer/` — IndexerCore, scanners, mappers, abis.
- `scripts/` — Operational scripts (backfill, enrichment, diagnostics).
- `docs/` — Product, ops, and research references (now includes `/state`).
- `config/` — Pool/token registries and brand pool lists.
- `lib/` + `src/lib/` — Shared services (db, pricing, RPC helpers).
- `prisma/` — Database schema migrations + analytics SQL helpers.
- `public/` — Brand-approved marketing assets (served with leading `/media/...`).

## Operational artefacts
- `data/` — Raw NDJSON exports, enriched JSON, and indexer progress snapshots.
- `logs/` — Timestamped ingestion logs per day.
- `ai-context/` — Prompting assets for pricing/visitor context (used by assistants).
- `docs/ops/STATE_ARCHIVE/` — Historical snapshots of PROJECT_STATE.md before rotation.

## Editing workflow
1. Update the relevant file under `docs/state/*` (overview, stack, actions, etc.).
2. Mirror any customer-facing summary inside `PROJECT_STATE.md` (snapshot only).
3. Run `npm run state:rotate` before commits or deploys to enforce size limits.