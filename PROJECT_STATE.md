# PROJECT_STATE (Concise)

> This file is a **living status page**. It stays intentionally short.  
> Full historical context, detailed runbooks, and retired configuration live in the archive:  
> `docs/ops/STATE_ARCHIVE/PROJECT_STATE_2025-11-02.md` (and future snapshots).

## TL;DR
- V3-only scope (Ēnosys + SparkDEX); BlazeSwap V2 remains archived behind `NEXT_PUBLIC_FEATURE_BLZ`.
- Freemium v2 live: free tier shows 3 pools; Premium/Pro sold in 5-pool bundles with alerts packs.
- Pricing funnel is wallet-connect-first and analytics-only; all execution stays on partner DEXs.
- Alerts monetisation hinges on email latency/SLA; transactional provider (Mailgun vs Postmark vs SES) pending.
- Workspace mail + SMTP bundle v1 shipped (order/invoice templates, preview endpoint, dry-run support).
- Stripe 14-day money-back trial planned; entitlements will mask data beyond free tier.
- Dune mini-set will benchmark FXRP growth; RangeBand UX + alerts remain differentiators.
- Cursor cost guardrails enforced; “done means deployed” micro-ship cadence continues.
- Pricing selector respects `NEXT_PUBLIC_LL_PRICING_PLAN` (Plan A/B) and formats USD via shared helpers.

## Overview
LiquiLab delivers a V3-only liquidity-pool manager for the Flare network:
- **Active DEX adapters:** Ēnosys V3 and SparkDEX V3 (concentrated liquidity / NFPM flows).
- **Deprecated:** BlazeSwap V2 (API responds 410; UI hidden unless `NEXT_PUBLIC_FEATURE_BLZ=true`).
- **Messaging:** SMTP mailer with order/invoice templates (v1) plus dry-run mode; Mail provider decision pending.
- **Near-term focus:** Notifications for range breaches, transactional mail provider rollout, and Stripe-ready basket flow.

## Brand Colors (Quick Reference)
**CRITICAL:** Aqua is accent-only. Electric Blue is primary brand color.
- **Electric Blue** (`#3B82F6`) — PRIMARY: buttons, cards, labels, large surfaces, interactive elements
- **Aqua** (`#1BE8D2`) — ACCENT ONLY: icons, bullets, checkboxes (small decorative elements)
- **Rule:** NEVER use Aqua for backgrounds, buttons, or large interactive areas
- **Background Rule:** Hero/background images (e.g., `/water-splash.webp`) must NEVER have opacity layers. Show at 100% opacity for "water under glass" effect with glassmorphism on content cards.
- **Full style guide:** `docs/ops/STATE_ARCHIVE/PROJECT_STATE_2025-11-02.md` (line 239)

## Stack & Hosting
- Next.js 15 (Pages Router) · TypeScript · Tailwind CSS · viem + wagmi v2.
- Backend runtime: Railway (Node listens on `$PORT`, `next start -p $PORT`).
- Data: RPC-first (Flare mainnet); Prisma/PostgreSQL used for caching/persistence.
- Docs live in `/docs`; email templates & validation in `src/emails/`.

## Providers & Integrations (current)
- **Ēnosys V3 (Flare):** Enumerate via NFPM `positions(tokenId)` → Factory `getPool` → Pool `slot0`.
- **SparkDEX V3 (Flare):** Same CLMM flow as Ēnosys (NFPM → Factory → slot0).
- **BlazeSwap V2:** Archived; provider stubs return empty arrays; debug route returns 410.

## Mail Integration (Current)

**Status**  
- ✅ Workspace (Google): MX to Google, SPF (`v=spf1 include:_spf.google.com -all`), DKIM **in progress**, DMARC `p=none`.  
- ✅ App SMTP mailer: `src/lib/mail.ts` with **dry-run** and live via Gmail App Password.  
- ✅ Test endpoints: `POST /api/mail/test`, `POST /api/mail/order`, `POST /api/mail/invoice`; **dev-only** preview: `GET /api/mail/preview?type=order|invoice`.  
- ✅ Health: `GET /api/health` includes `mail: { configured, provider: 'smtp', dryRun }`.  
- ⏩ Next: Transactional provider (Mailgun EU or Postmark), inbound route for replies.

**APIs & Contracts (Mail)**  
- `POST /api/mail/test` → body `{ to, subject?, text?, html? }` → `{ ok:true,id } | { ok:false,error }`.  
- `POST /api/mail/order` → minimal order confirmation HTML (inline CSS).  
- `POST /api/mail/invoice` → simple invoice HTML (table), optional `pdfUrl`.  
- `GET /api/mail/preview?type=order|invoice&...` (dev-only) → returns HTML.  
- `GET /api/health` → `mail: { configured:boolean, provider:'smtp'|'mailgun'|..., dryRun:boolean }`.

**Environment & Configuration**  
- `MAIL_FROM` — e.g. `LiquiLab <no-reply@liquilab.io>`  
- `SMTP_HOST` — e.g. `smtp.gmail.com`  
- `SMTP_PORT` — `465` (SSL) or `587` (STARTTLS)  
- `SMTP_USER` — e.g. `hello@liquilab.io`  
- `SMTP_PASS` — **App Password** (never committed; rotate on incident)  
- `MAIL_DRY_RUN` — `true|false` (prefer `true` in dev)  
- *(Stripe placeholders for pricing are documented elsewhere).*

**Runbook (Ops) — Mail**  
- **Dry-run vs Live**: set `MAIL_DRY_RUN=true` (no send, logs `[mail:dry-run]`); set `false` to send.  
- **Rotate credentials**: create a new Google **App Password** → update `.env.local: SMTP_PASS` → restart.  
- **Test from CLI**:  
  - `curl -X POST /api/mail/test -d '{"to":"you@…","subject":"Test","text":"Hi"}'`  
  - Preview templates at `/api/mail/preview?type=order|invoice` (dev only).  
- **Incident (smtp auth failed / blocked)**: switch to dry-run, rotate `SMTP_PASS`, retry; if provider downgrade needed, temporarily route via Gmail SMTP while deciding Mailgun/Postmark.

**Open Actions (Mail)**  
- Decide transactional provider: **Mailgun EU** (EU + inbound) vs **Postmark** (deliverability) vs **SES** (cheapest).  
- Implement **Alerts** (near-band/out-of-range) enqueue → mail send pipeline.  
- Template branding v2 (React Email/MJML), invoice PDF generator.  
- DKIM: confirm **Authenticated** → move **DMARC** to `p=quarantine`, later `p=reject`.

## Decisions (last 10)
- **D6 · 2025-11-03** — Free plan reveals Pair, TVL, Unclaimed fee, Min–Max, Current price, In-Range.
- **D7 · 2025-11-03** — Pricing requires wallet connect and auto slot recommendation.
- **D8 · 2025-11-03** — Alerts priced via $2.49 per 5-pool packs.
- **D9 · 2025-11-03** — LiquiLab remains analytics-only; all financial actions deep-link to partner DEXs.
- **D10 · 2025-11-03** — Build Dune mini-set (4 queries) to track post-FXRP growth.
- **D11 · 2025-11-03** — Sprint-1 scope: All Pools, Health score, OOR alerts, Weekly digest, QuickFacts, RangeBand Insights, What-if, FXRP info.
- **D12 · 2025-11-03** — Ship public pages first (Home, Pricing, RangeBand, Checkout); defer account/billing/dashboard.
- **D13 · 2025-11-03** — Adopt hardened API baseline (LRU cache, 502/503 handling, no PII, no server signing).
- **D14 · 2025-11-03** — Continue Freemium v2 rollout with workspace mail and Cursor cost guardrails.
- **D15 · 2025-11-03** — Keep alerts add-on roadmap email-first before expanding channels.

## Current Backlog
### P1
- Decide Premium base price ($9.95 vs $14.95) and update Stripe items — Owner: Koen — Due: 2025-11-05.
- Approve Pro Unlimited + Fair-Use pack inclusion — Owner: Koen — Due: 2025-11-05.
- Launch Dune mini-set dashboard with export — Owner: Koen — Due: 2025-11-05.
- Implement pricing funnel copy and auto slotting — Owner: Frontend — Due: 2025-11-10.
- Ship entitlements masking (Free=3 pools) plus alerts toggle — Owner: Backend — Due: 2025-11-10.
- Document alert SLAs and channel choice — Owner: Ops — Due: 2025-11-07.

### P2
- Select transactional mail provider (Mailgun EU vs Postmark vs SES) — Owner: Ops — Due: 2025-11-08.
- Finalise checkout v1 payment path (mailto invoice vs external link) — Owner: Koen — Due: 2025-11-04.
- Evaluate `/api/status` badge for marketing pages — Owner: Frontend — Due: 2025-11-06.
- Draft Stripe refunds/VAT policy — Owner: Ops — Due: 2025-11-08.
- Polish RangeBand/tooltips copy (“peace of mind” tone) — Owner: Content — Due: 2025-11-07.
- Verify DKIM (liqui1 workspace) after DNS propagation — Owner: Ops — Due: 2025-11-06.

**Metrics**  
- Deliverability % (accepted/bounced), DKIM/SPF pass rates, Open/Click (for alerts), Error rate.

## Product & UX (snapshot)
- Homepage ("Water under glass") with proof table + subscription narrative.
- Pricing page with Liquidity Journey plans (Shallow/Flow/Depth/Tide) & 14-day trial copy.
- Wallet connect modal (MetaMask/Rabby/WalletConnect) → Sales Offer onboarding.
- Sales Offer page summarises wallet positions (V3 only) and directs to Pricing.
- **`/koen` test dashboard**: Personal test page for Koen's wallet (env: `NEXT_PUBLIC_KOEN_WALLET`). **Updated 2025-11-03:**
  - ✅ **Demo table layout**: Exact same design as homepage demo table (two-row system: metrics + RangeBand visualization)
  - ✅ **Premium features enabled** (all APR, Incentives, RangeBand data visible)
  - ✅ **Clickable rows**: Each pool row links to detail page (`/pool/[tokenId]` or `/pool/[poolAddress]`)
  - ✅ **Column structure**: Pool (icons + pair + provider info), Liquidity, Unclaimed Fees (with token breakdown), Incentives (with token amount), 24H APR
  - ✅ **RangeBand row**: Full-width visualization centered under columns 2-5, showing strategy label, range slider, and current price
  - ✅ **Hover states**: Synchronized hover effect across both rows per pool (`.pool-hover` class)
  - ✅ **Sorted by TVL** (high → low) within each section
  - ✅ **Full background**: Hero image at 100% opacity (NO transparency layer) for authentic "water under glass" effect
  - ✅ **Brand compliant**: Gradient background with glassmorphism (`backdrop-filter: blur(12px)`), proper text hierarchy, Aqua accent for RangeBand™ footer
  - ✅ **Mobile responsive**: Simplified card layout for mobile, full table for desktop (lg breakpoint)
  - ✅ **Debug tools**: Console logging with `[KOEN]` prefix, improved empty state with provider list and API test button, `KOEN_DEBUG_GUIDE.md`, `KOEN_QUICK_DEBUG.md`, `scripts/test-koen-api.sh`
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
- Test dashboard: `NEXT_PUBLIC_KOEN_WALLET` (default wallet for `/koen` page).
- Feature flags: `NEXT_PUBLIC_FEATURE_BLZ` (default off; gates residual BlazeSwap UI).  
- Pricing toggle: `NEXT_PUBLIC_LL_PRICING_PLAN` (`A` default; set `B` to enable Plan B pricing copy).  
- Historical keys & deprecated envs (e.g., BlazeSwap V2 factory) are preserved in `docs/ops/STATE_ARCHIVE/PROJECT_STATE_2025-11-02.md`.

## Known Issues
- Flat ESLint config migration logs benign warnings (tracked remediation task).
- Turbopack emits "mixed Webpack config" warning during dev – non-blocking.
- DKIM propagation for outbound mail can lag; monitor DNS before flipping to live send.

## Open Actions (current sprint)
- Design + implement notifications (near-band/out-of-range) and tie into mailer.
- Decide transactional provider (Mailgun EU vs Postmark vs SES) + integrate webhooks.
- Upgrade email templates to React Email/MJML and introduce invoice PDF attachment/link flow.
- Finalise basket flow (email gate + Stripe hand-off) before public trial invite.

## Changelog (last 10 entries)
- **2025-11-05** – Pool Intel adds Flare domain whitelist and Day/Week toggle with fallback logging.
- **2025-11-05** – Pool Intel canonicalization wired to actual pool tokens with upstream error mapping and improved UI messaging.
- **2025-11-05** – Pool detail pages now surface “Pool Intel — Web Signals” with Perplexity-backed insights and caching.
- **2025-11-05** – PremiumCard “What you get” deck expanded to cover all Pool Detail features; card remains DS single source with single CTA.
- **2025-11-05** – PremiumCard refactored to two-column layout with updated pricing copy, single CTA, and shared width alignment across Home/Brand.
- **2025-11-03** – RangeBand variant system: Added `'stacked'` (+) and `'inline'` (−) display modes. Stacked (default) shows strategy above, band in middle, current price below. Inline shows all elements (band + indicator, current price, strategy) on one horizontal row. Added toggles to `/koen` dashboard header and `/rangeband` page. Users can switch between variants with sliding pill toggle (+ / −).
- **2025-11-03** – FREE masking + optional 402 in `/api/positions`; Sales Offer shows Premium paywall badges.
- **2025-11-03** – Pricing selector now reads `NEXT_PUBLIC_LL_PRICING_PLAN` (Plan A/B) and formats USD via shared Intl helper.
- **2025-11-03** – `/koen` Premium/Freemium toggle added to switch between masked and full dataset views.
- **2025-11-03** – Token breakdowns added to `/api/positions` (amount0/1, fee0/1, incentives token + amount).
- **2025-11-03** – `/koen` token breakdowns surfaced beneath dollar amounts on desktop/mobile layouts.
- **2025-11-03** – Strategy KB consolidated (sources, conflict log) and PROJECT_STATE refreshed.
- **2025-11-03** – Current price wired into RangeBand data paths to stabilise markers.
- **2025-11-03** – `/koen` dashboard RangeBand logic aligned with shared helper.
- **2025-11-03** – `/koen` dashboard redesign to mirror homepage demo table layout.

### Changelog — 2025-11-05 (Pool intel synonym rescue + empty state)
- `src/lib/intel/canonicalize.ts` — Preserved on-page symbols (e.g. USDT0) while emitting richer synonym groups for intel queries.
- `src/lib/perplexity/client.ts` — Built OR-grouped query strings, treated upstream 404s as empty sets, and kept chat→search fallback.
- `pages/api/intel/news.ts` — Stopped renaming tokens, surfaced `empty:true` on no results, and honoured `allow=any` for whitelist bypass.
- `src/components/PoolIntelCard.tsx` — Added empty-state copy with “Broaden sources,” refined error strings, and kept Day/Week toggle.
- `src/components/pool/PoolIntelSection.tsx` — Passed raw pool symbols into the card while warning once when identifiers are missing.
- `PROJECT_STATE.md` — Logged the synonym preservation and empty-state adjustments.

### Changelog — 2025-11-05 (Brand pools shortlist + resolver)
- `config/brand_pools.csv` — Added curated shortlist of 12 Ēnosys/SparkDEX pairs with priority tags for the DS snapshot.
- `config/token_registry.json` — Seeded token metadata for pool resolution (placeholders log TODOs until filled).
- `scripts/data/resolve-brand-pools.ts` — Script reads shortlist, resolves pool addresses via factory getPool or FlareScan URL, and writes `public/brand.pools.json`.
- `public/brand.pools.json` — Initial snapshot stub so /brand renders calmly even before running the resolver.
- `pages/brand.tsx` — DS Pools table now consumes the snapshot, shows updated timestamps, and offers a refresh button.
- `PROJECT_STATE.md` — Documented the brand shortlist ingest and design system wiring.
- 2025-11-05 — Resolver uitgebreid met Flarescan-enrichment (TVL/fees/incentives) + minted-only filter op minTvlUsd; /brand laadt `public/brand.pools.json` en toont “Data via Flarescan snapshot · Updated …”.
- 2025-11-05 — Resolver switched naar on-chain TVL (ERC20 balances + DefiLlama prijzen); minted-only filter via minTvlUsd; /brand toont “Data via on-chain snapshot • Updated …”.

### Changelog — 2025-11-05 (Pool intel whitelist + recency toggle)
- `src/lib/intel/domainWhitelist.ts` — Added curated Flare ecosystem host allowlist for Perplexity intel queries.
- `src/lib/perplexity/client.ts` — Enforced domain filtering, recency-aware caching, and precise host matching for search results.
- `pages/api/intel/news.ts` — Accepted day/week recency, domain overrides, and fallback logging when whitelist returns nothing.
- `src/components/PoolIntelCard.tsx` — Introduced Day/Week toggle, fallback notice, and recency-driven fetch cycle in the intel card.
- `src/components/pool/PoolIntelSection.tsx` — Passed default weekly recency into the Pool Intel card wrapper.
- `PROJECT_STATE.md` — Logged the domain whitelist and recency toggle rollout.

### Changelog — 2025-11-05 (Pool intel dual-path search fallback)
- `src/lib/perplexity/client.ts` — Implemented chat-first Perplexity lookup with search fallback and post-filtered allowlist to prevent upstream 400s.
- `pages/api/intel/news.ts` — Wired new client response (items + fallback), removed request-time domain filters, and refined logging.
- `src/components/PoolIntelCard.tsx` — Updated 400-state copy to highlight automatic fallback and polished empty-state messaging.
- `PROJECT_STATE.md` — Recorded the dual-path intel update in the live changelog.

### Changelog — 2025-11-05 (Demo network metrics baseline)
- `src/components/demo/NetworkMetrics.tsx` — Extracted the home network metrics logic into a tint-only card with unchanged logging.
- `pages/demo.tsx` — Added the `/demo` page with calm hero copy and reused network metrics block.
- `PROJECT_STATE.md` — Documented the demo network metrics extraction.

### Changelog — 2025-11-05 (Pool intel canonical pair fix)
- `src/lib/intel/canonicalize.ts` — Normalised token symbols and synonyms so intel queries resolve the real pool pair.
- `src/lib/perplexity/client.ts` — Added cached Perplexity client with search/impact helpers and upstream error classification.
- `pages/api/intel/news.ts` — Hardened intel endpoint to canonicalise inputs, resolve pool ids, and map precise status codes.
- `src/components/PoolIntelCard.tsx` — Updated DS card to prefer canonical tokens, surface status-specific errors, and support chain/recency.
- `src/components/pool/PoolIntelSection.tsx` — Derives canonical tokens from pool detail data with graceful fallback logging.
- `pages/pool/[tokenId].tsx` — Wires Pool Intel section with pool context so detail pages always query the correct pair.
- `PROJECT_STATE.md` — Logged the Pool Intel canonicalisation and error-path updates.

### Changelog — 2025-11-05 (Pool intel integration)
- `src/components/PoolIntelCard.tsx` — New DS card fetching Perplexity-backed web signals with skeletons, risk badge, and retry.
- `src/components/pool/PoolIntelSection.tsx` — Wrapper section with calm spacing plus warn-once guard when identifiers missing.
- `pages/api/intel/news.ts` — Added cached Perplexity proxy with token-bucket rate limiting and structured logging.
- `pages/pool/[tokenId].tsx` — Mounted Pool Intel section beneath overview via dynamic import and token/pair wiring.
- `PROJECT_STATE.md` — Recorded Pool Intel rollout in the live changelog.

### Changelog — 2025-11-03
- **pages/api/positions.ts** — Added FREE masking, entitlements metadata, and optional 402 enforcement for over-cap wallets.
- **src/components/paywall/Paywall.tsx** — Introduced reusable premium badge/overlay for locked features.
- **pages/sales/offer.tsx** — Surfaced premium indicators on APR, incentives, and RangeBand visuals in the sales funnel.

### Changelog — 2025-11-03
- **pages/koen.tsx** — Applied FREE entitlements masking with premium badges and RangeBand overlay on the personal dashboard.
- **PROJECT_STATE.md** — Documented the /koen masking update in the changelog.

---

### Maintainer Note (rollover rule)
- Keep this file under ~50 KB.  
- At month end **or** when the file exceeds that size:  
  1. Archive the full current state to `docs/ops/STATE_ARCHIVE/PROJECT_STATE_YYYY-MM-DD.md`.  
  2. Reset this file to the active-sprint snapshot with only the latest ~10 changelog entries.

### Changelog — 2025-11-03
- **pages/api/entitlements.ts** — Added public preview endpoint for entitlements and pricing breakdowns.
- **pages/pricing.tsx** — Wired Stripe checkout payload builder with dev-only entitlements preview panel.
- **.env.example** — Documented required Stripe price ID variables for checkout.

### Changelog — 2025-11-03
- **pages/api/blazeswap/positions.ts** — Restored 410 Gone stub signalling BlazeSwap V2 deprecation.
- **pages/api/positions.ts** — Trimmed aggregator back to V3-only providers (Ēnosys, SparkDEX).
- **pages/api/health.ts** — Marked BlazeSwap as archived in health output.
- **.env.example** — Noted BlazeSwap V2 deprecation and removed legacy toggle.

### Changelog — 2025-11-03
- **pages/pricing.tsx** — Rebuilt pricing experience with wallet-driven pool preview, plan recommendation, and aligned glass styling.
- **src/components/pricing/PricingSelector.tsx** — Added recommendedSlots support and preserved user overrides for slot/alerts selection.
- **src/components/pricing/PoolsPreview.tsx** — New compact pools preview component used on Pricing.

### Changelog — 2025-11-03
- **src/lib/providers/blazeswapV2.ts** — Reinstated BlazeSwap V2 adapter with pair enumeration, caching, and share/amount calculations.
- **pages/api/blazeswap/positions.ts** — Exposed live BlazeSwap V2 debug endpoint returning normalized positions.
- **pages/api/positions.ts** — Included BlazeSwap V2 in the canonical aggregator with tolerant failure handling.
- **pages/api/health.ts** — Reported BlazeSwap configuration/ready state and total pair count.
- **types/ambient.d.ts** — Declared `BLAZESWAP_FACTORY` environment variable.
- **.env.example** — Documented BlazeSwap V2 factory address for configuration.

### Changelog — 2025-11-03
- **pages/pricing.tsx** — Restored water-wave hero, wallet-driven preview, and trial-first CTA funnel on Pricing.
- **src/components/pricing/PricingSelector.tsx** — Honoured recommended slots while preserving manual overrides.
- **src/components/pricing/PoolsPreview.tsx** — Updated preview to top-three pools with DEX fallback links.

### Changelog — 2025-11-03
- **pages/pricing.tsx** — Simplified pricing funnel with premium card, personal plan stepper, and alerts guidance.
- **src/components/pricing/PackStepper.tsx** — Added ±5 pack selector for personalised plans.
- **src/lib/billing/pricing.ts** — Tuned RangeBand™ alerts pack pricing to $2.45 for accurate totals.

### Changelog — 2025-11-03
- **pages/pricing.tsx** — Refined pricing with USP chips, dark-blue premium card, and full personal plan overview with ±10 selector.
- **src/components/pricing/PackStepper.tsx** — Updated to dark-blue styling and ±10 adjustments for personalised plans.
- **src/components/pricing/PoolsPreview.tsx** — Reworked to two-row pool layout with full list support.

### Changelog — 2025-11-03
- **pages/pricing.tsx** — Applied visual QA calm fixes (dark-blue cards, CTA focus rings, tabular numerals, hover/focus polish).
- **src/components/pricing/PackStepper.tsx** — Added brand-compliant focus rings and aria labels for ±10 controls.
- **src/components/pricing/PoolsPreview.tsx** — Smoothed two-row layout spacing, hover states, and tabular numerals for pool list.

### Changelog — 2025-11-03
- **pages/pricing.tsx** — Integrated calm, conversion-first copy into existing Pricing layout: Hero H1 changed to "The easy way to manage your liquidity pools." with trial-first subheader, replaced 4 Benefits cards with 3 USP mini-cards (Non-custodial / V3-only insights / Cancel anytime), added calm "what you get + PLUS" list to Personal plan section (5 bullet points with checkmarks, including detailed pool pages explanation), updated capacity feedback to "Recommended: Manage X active pool(s) with Y-pool plan" format, updated Alerts toggle copy to "+ $2.45 / 5 pools (email when near-band or out-of-range)", improved fallback copy for no-pools state, added aria-label to WalletConnect, updated meta description. No structural or logic changes; kept existing pool selector, stepper, and checkout flow intact.

### Changelog — 2025-11-03 (update)
- **pages/pricing.tsx** — Reverted Benefits section to original 4-card layout (user preference). Hero copy and Personal plan "what you get + PLUS" list remain updated as per conversion optimization.

### Changelog — 2025-11-03 (pricing simplification)
- **pages/pricing.tsx** — Drastically simplified pricing page per user request: Created clear Premium card ($14.95/mo, 5 pools included) with 5 benefit bullets and Subscribe CTA, added simple Personal Plan card with "Based on the pools you currently manage" and Connect Wallet CTA. Fixed Benefits section cards background from `bg-white/[0.02]` to `bg-[#0B1530]` with `border-white/10` and `backdrop-blur` for much better readability. Hidden old complex pool selector section. Result: clean, conversion-focused pricing with two clear options.

### Changelog — 2025-11-03 (wallet flow restored)
- **pages/pricing.tsx** — Restored full wallet-driven flow in Personal Plan card: After connecting wallet, users see pools summary (Active/Inactive/Ended counts), personalized recommendation, plan selector with ±5 stepper (min 5, max 100 pools), RangeBand™ Alerts toggle ($2.49 per 5 pools), price breakdown showing pools cost + alerts cost + total, and Continue to checkout CTA. Fallback message for wallets with no pools includes Ēnosys & SparkDEX links. Premium card ($14.95/mo, 5 pools) remains as primary option above Personal Plan.

### Changelog — 2025-11-03 (pricing correction + pool selector)
- **src/lib/pricing.ts** — Corrected pricing logic: Base plan $14.95 for first 5 pools, then +$9.95 per additional 5-pool pack. RangeBand™ Alerts remain $2.49 per 5 pools.
- **pages/pricing.tsx** — Restored full pool selector with individual checkboxes for each pool, grouped by Active (sorted by TVL high→low), Inactive (sorted by Rewards high→low), and Ended (collapsible section). Price breakdown now clearly shows: "Base plan (first 5 pools) $14.95" + "Additional X pack(s) of 5 pools × $9.95" + optional alerts. Users can select exactly which pools to manage, and the plan auto-adjusts to recommended tier based on selection.

### Changelog — 2025-11-03 (final pricing fix)
- **src/lib/pricing.ts** — Corrected pricing logic to user's specification: Base plan $14.95 for first 5 pools, then +$9.95 per additional 5-pool pack (not per pool). RangeBand™ Alerts remain $2.49 per 5 pools. Changed currency display from EUR (€) to USD ($) throughout. Original pricing page UI preserved with full pool selector (Active/Inactive/Ended sections), stepper (±5), alerts toggle, and price breakdown showing correct amounts.

### Changelog — 2025-11-03 (complete pricing page restoration)
- **pages/pricing.tsx** — COMPLETE restoration of all marketing/UX improvements: (1) Hero: "The easy way to manage your liquidity pools" + "Start your 14-day trial. Cancel anytime. Non-custodial", (2) Benefits cards: Fixed background to `bg-[#0B1530]` with `border-white/10` and `backdrop-blur` for readability, (3) Premium card: Added $14.95/mo standard offer with 5 benefits and Subscribe CTA, positioned before Personal Plan, (4) Personal Plan: Retitled to "Or create a personal plan" with "Based on the pools you currently manage" subheader, (5) Capacity feedback: All messages use "Recommended: Manage X active pool(s) with Y-pool plan" format. Personal Plan retains full functionality: wallet connect → pools display (Active/Inactive/Ended with checkboxes) → recommendation → ±5 stepper → alerts toggle → price breakdown → checkout CTA.
- **src/lib/pricing.ts** — Pricing logic: $14.95 base (first 5 pools) + $9.95 per additional 5-pool pack + $2.49 alerts per 5 pools. Currency: USD ($).

### Changelog — 2025-11-03 (homepage wallet connect)
- **pages/index.tsx** — Added wallet connect + pools overview section between hero and provider stats. When user connects wallet: fetches positions via `/api/positions`, displays summary (Active/Inactive/Total counts), shows personalized CTA "Continue to pricing" that routes to `/pricing?address=...`, includes fallback for wallets with no pools (Ēnosys/SparkDEX links). Loading state with spinner, error handling included. Positioned strategically to capture wallet connections early in the funnel before users see network stats or demo table.

### Changelog — 2025-11-03 (pricing visual QA polish)
- **pages/pricing.tsx** — Enforced dark-blue surfaces, hero USP chip styling, and CTA focus treatments for the pricing funnel.
- **src/components/pricing/PackStepper.tsx** — Updated ±10 controls to brand-compliant dark-blue chips with refined focus rings.
- **src/components/pricing/PoolsPreview.tsx** — Harmonised pool list hover states and tabular numerals within dark-blue cards.

### Changelog — 2025-11-03
- **src/styles/globals.css** — Restored Electric Blue primary button utility with branded hover/focus states.
- **src/components/LiquiLabLogo.tsx** — Updated droplet mark fill to Electric Blue for logo consistency.
- **pages/pricing.tsx** — Repointed pricing CTAs and alerts toggle to the shared Electric Blue `.btn-primary`.

### Changelog — 2025-11-03
- **src/components/Header.tsx** — Header CTAs now use the shared `.btn-primary` and tabular-number spans for counts.
- **src/components/WalletConnect.tsx** — WalletConnect defaults to `.btn-primary` (Electric Blue) and accepts class overrides while keeping branded focus styles.
### Changelog — 2025-11-03
- **tailwind.config.js** — Extended brand and UI font stacks to Quicksand + Inter for consistent typography tokens.
- **src/styles/globals.css** — Imported Quicksand/Inter webfonts and defined the shared `.btn-primary` utility in logo blue.
- **pages/pricing.tsx** — Swapped pricing CTAs to `.btn-primary` and enforced tabular-mono numerals on monetary values.

### Changelog — 2025-11-03 (pricing lab comparison)
- **pages/pricing-lab.tsx** — Added brand-compliant A/B comparison page to toggle between Option A (Trial-first Minimal) and Option B (Two-column Calm) using live pricing data.
- **PROJECT_STATE.md** — Recorded the new pricing lab comparison page in the project changelog.

### Changelog — 2025-11-03 (pricing lab visual alignment)
- **pages/pricing-lab.tsx** — Matched /pricing-lab styling to Home (wave hero, dark-blue cards, Electric-Blue CTAs, Inter numerics, single RangeBand toggle).
- **src/components/pricing/VariantToggle.tsx** — Added reusable segmented control for the A/B switch with brand-compliant focus/hover states.
- **PROJECT_STATE.md** — Logged the /pricing-lab visual alignment update.

### Changelog — 2025-11-03 (pricing lab calm pass)
- **src/styles/globals.css** — Added shared `.card`, `.card--quiet`, `.divider`, and segmented toggle utilities to mirror Home’s calm surfaces.
- **src/components/pools/PoolsTable.tsx** — Simplified pools list to a single dark card with dividers, right-aligned numerics, and stacked RangeBand view.
- **src/components/pricing/VariantToggle.tsx** — Switched the A/B toggle to the new segmented-pill styling with brand focus states.
- **pages/pricing-lab.tsx** — Applied the new card utilities, minimal segmented toggle, and content-width CTAs for full Home parity.
- **PROJECT_STATE.md** — Logged the pricing lab Home-style alignment update.

### Changelog — 2025-11-03 (pools table calm polish)
- **src/components/pools/PoolsTable.tsx** — Added header tint with compact labels, uniform row rhythm, overlapped token icons, and subtle stacked-row hover matching the Home demo.
- **src/components/pricing/VariantToggle.tsx** — Softened the segmented toggle (btn-primary on selection, ghost off-state) to keep the preference switch visually quiet.
- **PROJECT_STATE.md** — Documented the calm polish pass across PoolsTable and VariantToggle.

### Changelog — 2025-11-03 (compact pools table rollout)
- **src/components/pools/PoolsTable.tsx** — Stripped inner cards, removed row borders, added thin dividers, and reduced stacked view to band + range micro-line.
- **pages/sales/offer.tsx** — Adopted the compact PoolsTable; summaries use `.font-num` and local chrome removed.
- **pages/koen.tsx** — Mirrored the compact table styling for Koen’s dashboard summaries.
- **PROJECT_STATE.md** — Logged the compact PoolsTable rollout across Sales Offer and Koen.

### Changelog — 2025-11-03 (brand system page)
- **pages/brand.tsx** — Introduced the living design system page with theme toggle (v2-dark / v2-blond), tokens, typography, primitives, PoolsTable sample, and pricing skeletons.
- **src/components/pricing/VariantToggle.tsx** — Reused for theme switching with quiet segmented styling.
- **PROJECT_STATE.md** — Logged the new /brand design system entry.

### Changelog — 2025-11-03 (corner radius tokens)
- **src/styles/globals.css** — Added radius tokens (`--radius-card`, `--radius-ctrl`, `--radius-pill`) and wired them into cards, buttons, segmented controls, and pills.
- **src/components/pools/PoolsTable.tsx** — Adopted the shared radius utilities for rows, header, and pills; removed oversized rounding.
- **src/components/pricing/VariantToggle.tsx** — Updated segmented buttons to use the control radius token.
- **pages/sales/offer.tsx** — Applied radius-card/pill utilities for summaries, links, and controls.
- **pages/koen.tsx** — Swapped legacy rounded classes for the new radius tokens on controls and cards.

### Changelog — 2025-11-03 (tint-only cards & status dots)
- **docs/design/BRAND_STYLE_CONTRACT.md** — Captured non-negotiables for tint-only surfaces, divider-only tables, and single status-dot placement.
- **docs/design/POOLS_TABLE_SPEC.md** — Recorded the updated PoolsTable structure, dot-only indicator behaviour, and divider-only row guidance.
- **src/styles/globals.css** — Converted shared `.card` surfaces to borderless tint fills, added status-dot helpers, and standardised table header labels.
- **src/components/pools/PoolsTable.tsx** — Replaced status pills with the dot indicator, removed nested borders, and aligned header/toggle behaviour with the contract.
- **pages/sales/offer.tsx** — Removed ad-hoc borders, shifted fallback links to tint-only tiles, and ensured summaries rely on `.font-num`.
- **pages/koen.tsx** — Mirrored the tint-only treatment, softened error states, and aligned CTA buttons with the borderless spec.

### Changelog — 2025-11-03 (product + pricing refresh)
- **src/styles/globals.css** — Added `.icon-accent` utility for Material Symbols (accent-only icons), keeping tokens intact.
- **pages/product.tsx** — New product marketing page with hero, Aqua USPs, and wallet-connect prompt.
- **src/components/pricing/PremiumCard.tsx** — Upgraded Premium card to reusable component with optional extras (PackStepper + alerts + price breakdown).
- **pages/pricing.tsx** — Simplified pricing to the Premium card experience with extras; removed legacy personal plan UI.
- **PROJECT_STATE.md** — Recorded the /product launch and pricing simplification.

### Changelog — 2025-11-03 (home funnel simplification)
- **pages/index.tsx** — Rebuilt home into a three-step funnel (Hero, clarity card, pricing teaser) with tint-only cards and Aqua Material icons.
- **PROJECT_STATE.md** — Logged the simplified home funnel update.

### Changelog — 2025-11-03 (home DS blocks)
- **pages/index.tsx** — Rebuilt Home into hero + DS PoolsTable + RangeBand explainer + Premium card (tint-only cards, DS components).
- **PROJECT_STATE.md** — Logged the updated Home funnel structure.

### Changelog — 2025-11-03 (pricing micro-updates)
- **pages/index.tsx** — Updated Pools table & RangeBand headings/subcopy per funnel spec.
- **src/components/pricing/PremiumCard.tsx** — Made card full-width, moved CTA below breakdown, wired optional snippets.
- **src/components/pricing/PackStepper.tsx** — Simplified labels to –/+ (5-pool steps).
- **src/lib/billing/pricing.ts** — Adjusted pricing math (+$9.95 per 5 pools; alerts $2.49 per 5).
- **PROJECT_STATE.md** — Logged home/pricing funnel tweaks.

## Changelog — 2025-11-05
- “Your liquidity (demo)” block: on-chain NFPM positie-snapshot + voorbeeldwallet, renderer op `/brand`. Nieuwe script: `scripts/data/snapshot-brand-user-positions.ts` schrijft `public/brand.userPositions.json`. Geen zware scans; alleen enumeraties per demo-wallet.
2025-11-05 — NFPM positions snapshot hardened: DefiLlama price fetch fixed (?coins=flare:...), status via tick (no sqrt), amounts temporarily null-safe; avoids BigInt mix. /brand shows demo positions without errors.
2025-11-05 — Pools indexer toegevoegd: scripts/indexers/sync-v3-pools.ts (Flare Enosys/SparkDEX). Schrijft data/pools.ndjson + data/pools.state.json, klaar voor daily refresh en metrics.
2025-11-05 — Hardened user-positions snapshot: DefiLlama endpoint gefixt, USD-prijs fallback, include-filter op registry-sleutels, amounts null-safe, status via tick. Geen crashes meer bij prijsfouten; demo-posities zichtbaar ook zonder USD-prijs.
2025-11-05 — Hardened NFPM user-positions snapshot: DefiLlama ?coins= endpoint, null-safe amount logic, status via tick (no sqrt math), include-filter op registry-sleutels en aliases, geen drop bij ontbrekende prijs. Demo-posities renderen zonder crashes.
2025-11-05 — Hardened NFPM user-positions snapshot (DefiLlama ?coins=…, null-safe amounts, status via tick, include by registry key). Upserted sFLR & USDC.e in token registry.
2025-11-05 — Exact amounts (TickMath) wired in user-positions snapshot; uncollected fees exact (feeGrowthInside). 24h fees via baseline-diff (exact na volgende run).
2025-11-05 — Amounts v2: exact Uniswap v3 amounts (TickMath) in user-positions snapshot; BigInt-safe. Status/fees logic unchanged; 24h fees via baseline.
### Changelog — 2025-11-05 (live demo selector revamp)
- `src/lib/demoLiveSelector.ts` vernieuwd: strategie-drempels vastgezet op <12% (Aggressive) / 12–35% (Balanced) / >35% (Conservative) en BlazeSwap `flaro.org` beperkt tot 1 item.
- `src/services/demoPoolsLive.ts` + `pages/api/demo/pools.ts` schakelen nu live candidates in met fallbacks; test `src/components/demo/__tests__/diversity.test.ts` waarborgt providers/status/strategie diversiteit ≥3.

2025-11-05 — GitHub Actions workflow 'brand-snapshot.yml' toegevoegd: ververst dagelijks om 08:00 UTC (en handmatig) de bestanden public/brand.pools.json en public/brand.userPositions.json. Lokale helper: 'pnpm run snapshot:brand'.
2025-11-05 — sync-v3-pools indexer herschreven naar async main (geen top-level await) zodat pnpm dlx tsx werkt onder Node 24.
2025-11-05 — Brand workflow draait nu eerst de pool-indexer (data/pools*) vóór resolve/snapshot en commit deze artefacten mee.
