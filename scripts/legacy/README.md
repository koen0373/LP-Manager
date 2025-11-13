# Legacy Scripts

This directory holds historical or ad-hoc scripts that still rely on CommonJS `require()` calls or unchecked assumptions (hard‑coded RPC URLs, deprecated NFPM targets, etc.). They are excluded from lint/CI runs so the modern ESM tooling can stay strict without blocking older one-off utilities.

If you need to revive one of these scripts for production use, move it back under `scripts/`, migrate it to ESM with the shared alias imports (`@lib/*`, `@/*`, etc.), and add tests/verification before re-enabling lint coverage. Until then, treat everything in here as “use at your own risk”.

Current contents:
- `backfill-sparkdex-safe.js`, `sparkdex-nfpm-direct.js`, `verify-railway-cron.js`
- tooling trees like `erc721/`, `seed/`, `state/`, and ad-hoc helpers such as `etl_wallet_discovery.mjs`
