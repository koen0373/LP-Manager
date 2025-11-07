# LiquiLab — Product & Growth Ideas Log
_Last updated: 2025-10-27_

> Canonical ideas backlog used by Admin → Ideas. Keep this file terse, actionable, and brand-aligned.
> Each card lists: **What**, **Why**, **Next action**, **Owner**, **Status**, **Links/Deps**.

---

## NOW (Keep focus on billing; execute later)
- Keep engineering attention on **pricing & checkout** until v1 is live. Everything below is queued.

---

## INBOX (new, unprioritized)

### B2B Analytics Subscription (Design Partner first)
**What**: Paid B2B plan with a real-time analytics dashboard (wallet & market rollups, cross-DEX insights).  
**Why**: High willingness to pay from professional LPs, desks, DAOs; leverages our unique normalized data.  
**Next action**: Recruit 3–5 design partners; define MVP metrics/queries; set success KPIs.  
**Owner**: Product (Human) + Codex (backend/data) + Claude (UI copy).  
**Status**: Proposed (prompt drafted).  
**Links/Deps**: Analytics schema (below), Warehouse plan, Privacy note.

### Design Partner Program
**What**: Invite a small cohort to co-shape the B2B dashboard (early access, roadmap input).  
**Why**: Increases solution-fit and credible references.  
**Next action**: Draft 1-pager (benefits/scope), outreach list, simple MOU.  
**Owner**: Human (+ Claude for copy).  
**Status**: Proposed (playbook drafted).  

### Community-driven Provider Additions (farms/staking/perps)
**What**: Add provider adapters beyond LP v3 (staking, farms, perps) **phase-by-phase** based on user votes.  
**Why**: Grows coverage where demand is real; controls scope & cost.  
**Next action**: Lightweight voting pipeline (GitHub issue label + /ideas), adapter shortlist, effort sizing.  
**Owner**: Product (Human), Codex (adapters), Claude (UI).  
**Status**: Proposed.

### Investor Demo Mode (Wallet Showcase)
**What**: A demo page that renders **any** wallet’s pools across providers (read-only), for pitches/investors.  
**Why**: High “wow” factor; shows normalization + insights quickly.  
**Next action**: /api/demo/portfolio harden; create simple UI route `/demo?address=…`.  
**Owner**: Codex (API), Claude (UI).  
**Status**: Draft API exists (placeholder).  

---

## NEXT (scoped, ready after billing v1)

### Analytics Foundation (Data Catalog + Warehouse)
**What**: Persist normalized market/position snapshots + rollups using `analytics_*` tables.  
**Why**: Enables B2B dashboard, cohort analysis, pricing benchmarks.  
**Next action**: Wire ETL placeholders to real scanners; schedule hourly snapshots & daily rollups.  
**Owner**: Codex.  
**Status**: Schema/docs added; ETL placeholder present.  
**Links/Deps**: `docs/DATA_CATALOG.md`, `docs/ANALYTICS_WAREHOUSE.md`.

### Adapter Data Contract v0.1
**What**: Unified entities (Provider, Market, Position, Snapshots), deep-link builders, TTL/staleness rules.  
**Why**: Consistent UI and analytics across Enosys/SparkDEX/BlazeSwap/etc.  
**Next action**: Lock the contract; implement per-provider mappers.  
**Owner**: Codex.  
**Status**: Draft spec in `docs/ADAPTERS.md`.

### Observability for Adapters & ETL
**What**: Metrics: requests/latency/cache hits/staleness; alerts on error budget/lag.  
**Why**: SLOs and reliability for investor-grade analytics.  
**Next action**: Instrument adapters; add basic counters/timers; dev dashboard.  
**Owner**: Codex.  
**Status**: Draft in `docs/OBSERVABILITY_ADAPTERS.md`.

### Admin → Ideas (viewer) polish
**What**: Brand-aligned admin board reading this file; sections (Inbox/Next/In Progress/Done), counts, empty states.  
**Why**: Single source of truth for product discovery; avoids tool sprawl.  
**Next action**: Claude pass on UI (chips, headings, a11y); API fallback states.  
**Owner**: Claude.  
**Status**: Prompt drafted.

### Waitlist + Fastforward Controls
**What**: Seat cap (e.g., 100). When reached → “Join the priority list” with optional **Fastforward** ($50) gate; admin toggleable.  
**Why**: Controls ops cost, keeps experience great.  
**Next action**: Ensure admin settings reflected in UI; email templates; approval flow.  
**Owner**: Codex (API), Claude (UI/copy).  
**Status**: Partially implemented (admin/settings API, early endpoints).

### Pricing Suggestions in UI
**What**: After wallet connect, show “Active pools: N → Recommend bundles: (N rounded up to /5), capacity incl. free bonus (1st free + 1 per +10)”.  
**Why**: Converts faster; removes math friction.  
**Next action**: Inline component + plan selector; reflect monthly/yearly logic.  
**Owner**: Claude.  
**Status**: Scoped.

### Wallet Connect Expansion (Bifrost, Xaman)
**What**: Add Bifrost & Xaman to connect modal; LiquiLab-branded sheet.  
**Why**: Better reach across the Flare ecosystem.  
**Next action**: Add connectors behind feature flags; QA flows.  
**Owner**: Codex (connectors), Claude (modal UX).  
**Status**: Planned.

### Invoicing & Tax (GetGekko)
**What**: Issue invoices in EUR incl. VAT; accept USDC/Flare-supported assets; map to bookkeeping.  
**Why**: Clean compliance; investor-grade ops.  
**Next action**: Confirm field set at signup, FX note; webhook → invoice creation; mailer template.  
**Owner**: Codex (plumbing), Human (ops).  
**Status**: Planned.

---

## IN PROGRESS (actively being worked on)

### Pricing Model v1.1 (current focus)
**What**: $1.99 per pool / month, purchasable in **bundles of 5**; **first pool always free**; for each extra **+10 paid pools → +1 free**.  
**Why**: Simple, elastic; aligns value with usage; avoids proration complexity (we give free capacity, not price cuts).  
**Next action**: Finish checkout → account → invoice → access gating; suggest plan post-connect.  
**Owner**: Codex (backend) + Claude (UI) + Human (ops).  
**Status**: In progress (billing preview + admin settings live).

---

## DONE (recently completed)

### Admin Settings & Billing Preview APIs
**What**: `/api/admin/settings` toggles (WAITLIST_ENABLED, FASTFORWARD_ENABLED); `/api/billing/preview` returns price/capacity math.  
**Why**: Unblocks UI; enables waitlist/fastforward ops.  
**Status**: Live.

### Health Route
**What**: `/api/health` JSON ping.  
**Status**: Live.

---

## NOTES / DECISIONS
- External communications in **English**; founder chat/support in **Dutch**.  
- Social share card provider-mention requirement: **removed** (kept neutral).  
- Quicklaunch remains separate (branch `quicklaunch`, subdomain `beta.liquilab.xyz`).  
- macOS/zsh safety in all shell snippets (no `== … ==` headings).

---

## LINKS
- Data Contract: `docs/ADAPTERS.md`  
- Data Catalog: `docs/DATA_CATALOG.md`  
- Warehouse Plan: `docs/ANALYTICS_WAREHOUSE.md`  
- Observability: `docs/OBSERVABILITY_ADAPTERS.md`

