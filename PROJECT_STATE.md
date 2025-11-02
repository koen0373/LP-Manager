# PROJECT_STATE (Concise)

> This file is a **living status page**. It stays intentionally short.  
> Full historical context, detailed runbooks, and retired configuration live in the archive:  
> `docs/ops/STATE_ARCHIVE/PROJECT_STATE_2025-11-02.md` (and future snapshots).

## Overview
LiquiLab delivers a V3-only liquidity-pool manager for the Flare network:
- **Active DEX adapters:** Ēnosys V3 and SparkDEX V3 (concentrated liquidity / NFPM flows).
- **Deprecated:** BlazeSwap V2 (API responds 410; UI hidden unless `NEXT_PUBLIC_FEATURE_BLZ=true`).
- **Messaging:** SMTP mailer with order/invoice templates (v1) plus dry-run mode; Mail provider decision pending.
- **Near-term focus:** Notifications for range breaches, transactional mail provider rollout, and Stripe-ready basket flow.

## Stack & Hosting
- Next.js 15 (Pages Router) · TypeScript · Tailwind CSS · viem + wagmi v2.
- Backend runtime: Railway (Node listens on `$PORT`, `next start -p $PORT`).
- Data: RPC-first (Flare mainnet); Prisma/PostgreSQL used for caching/persistence.
- Docs live in `/docs`; email templates & validation in `src/emails/`.

## Providers & Integrations (current)
- **Ēnosys V3 (Flare):** Enumerate via NFPM `positions(tokenId)` → Factory `getPool` → Pool `slot0`.
- **SparkDEX V3 (Flare):** Same CLMM flow as Ēnosys (NFPM → Factory → slot0).
- **BlazeSwap V2:** Archived; provider stubs return empty arrays; debug route returns 410.

## Product & UX (snapshot)
- Homepage (“Water under glass”) with proof table + subscription narrative.
- Pricing page with Liquidity Journey plans (Shallow/Flow/Depth/Tide) & 14-day trial copy.
- Wallet connect modal (MetaMask/Rabby/WalletConnect) → Sales Offer onboarding.
- Sales Offer page summarises wallet positions (V3 only) and directs to Pricing.
- Basket (placeholder) queued for Stripe + email gate.
- Dashboard > Pools uses RangeBand™ visualization & tabular layout (V3 feeds).
- Mail bundle: `/api/mail/{order,invoice,test}` endpoints + dry-run flag.
- Admin waitlist/fast-forward routes remain for early-access operations.
- Docs: style guide, provider plans, endpoint consolidation in `/docs`.
- Debug endpoints retained under `/api/debug/*` for RPC troubleshooting.
- Security baseline: `.gitignore` hardened for secrets; `SECURITY.md` documents incident response.

## APIs & Runbooks (pointers)
- Positions: `GET /api/positions?address=0x…` – canonical V3 aggregation with soft-error handling.
- Health: `GET /api/health` – providers + mail configuration status.
- Mail templates: `POST /api/mail/order`, `POST /api/mail/invoice`, `POST /api/mail/test`.
- Debug: `/api/debug/*` (BlazeSwap scan stub, DefiLlama, cache clear).  
- Long-form procedures → see archive snapshot (STATE_ARCHIVE) and doc bundles in `/docs`.

## Environment & Configuration (current keys)
- SMTP: `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_DRY_RUN`.
- Feature flags: `NEXT_PUBLIC_FEATURE_BLZ` (default off; gates residual BlazeSwap UI).  
- Historical keys & deprecated envs (e.g., BlazeSwap V2 factory) are preserved in `docs/ops/STATE_ARCHIVE/PROJECT_STATE_2025-11-02.md`.

## Known Issues
- Flat ESLint config migration logs benign warnings (tracked remediation task).
- Turbopack emits “mixed Webpack config” warning during dev – non-blocking.
- DKIM propagation for outbound mail can lag; monitor DNS before flipping to live send.

## Open Actions (current sprint)
- Design + implement notifications (near-band/out-of-range) and tie into mailer.
- Decide transactional provider (Mailgun EU vs Postmark vs SES) + integrate webhooks.
- Upgrade email templates to React Email/MJML and introduce invoice PDF attachment/link flow.
- Finalise basket flow (email gate + Stripe hand-off) before public trial invite.

## Changelog (last 10 entries)
- **2025-11-02** – Archived BlazeSwap V2 (API 410 stub; Sales Offer card feature-flagged) and slimmed PROJECT_STATE.  
- **2025-11-02** – Mail templates v1 (order & invoice), validation helpers, and dev preview endpoint.  
- **2025-11-02** – SMTP mail bundle wired with dry-run mode; `/api/mail/test` + health flag for configuration checks.  
- **2025-11-01** – Router normalised to Pages Router (App directory archived; `appDir` disabled).  
- **2025-11-01** – BlazeSwap V2 adapter shipped (later archived) with debug endpoint, health probe, and tolerant aggregator.  
- **2025-11-01** – Security baseline tightened: `.gitignore` secrets rules, `SECURITY.md`, documented key rotation response.  
- **2025-10-31** – Wallet funnel polish: consistent button styling, Pricing page refactor, wallet connect fixes.  
- **2025-10-31** – RangeBand™ rollout & pool table two-row layout across demo/dashboard contexts.  
- **2025-10-30** – Positions API consolidation (`/api/positions` canonical response, legacy routes redirected).  
- **2025-10-26** – Homepage redesign (“Water under glass”), Liquidity Journey pricing narrative, updated brand assets.

---

### Maintainer Note (rollover rule)
- Keep this file under ~50 KB.  
- At month end **or** when the file exceeds that size:  
  1. Archive the full current state to `docs/ops/STATE_ARCHIVE/PROJECT_STATE_YYYY-MM-DD.md`.  
  2. Reset this file to the active-sprint snapshot with only the latest ~10 changelog entries.
