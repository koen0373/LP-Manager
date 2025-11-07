# LiquiLab Access Policy

LiquiLab is currently offered through a limited early-access program. This document outlines how seats are assigned, how crypto payments work, and which disclaimers apply.

## Early Access Slots
- Early access is capped at **100 activated users**.
- Every activated wallet receives **two pools for free**; additional pools require a paid subscription once public billing launches.
- When 100 accounts are active new applicants are placed on the waitlist. Slots reopen as accounts are deactivated.

## Waitlist
- Operators can join from `/waitlist` or the homepage CTA.
- Required fields: email (mandatory) and optional Flare wallet address.
- Entries are timestamped so the team can invite accounts in order.

## Fast-Track Access (Crypto)
- Supporters can skip the waitlist with a **one-time $50 USDT₀** payment on Flare (chainId 14).
- Payment parameters:
  - **Treasury address:** `TREASURY_ADDRESS` (see environment config).
  - **Token:** `ACCEPTED_TOKEN_ADDRESS_USDT0` (USDT₀ / eUSDT contract on Flare).
  - **Amount:** exactly `50.000000` tokens (6 decimals).
- The `/fastforward/pay` page issues an intent ID, displays QR instructions, and collects the submitted transaction hash.
- `/api/fastforward/confirm` verifies the payment on-chain (ERC-20 `Transfer` logs). Status changes to `PAID`, but the account remains on the waitlist until an admin approves the payment.

## Admin Approval
- Admins review payments at `/admin/payments` using `ADMIN_SECRET`.
- Only payments with status `PAID` can be approved.
- On approval:
  - `User.state` → `ACTIVATED`
  - `poolAllowance` → `2`
  - An approval email plus a CSV invoice is sent via Resend. The attachment is formatted for direct import into GetGekko.

## Disclaimers
LiquiLab is in early development. Features and pricing may change. Outages or data issues may occur and no refunds can be issued for early access or usage-based payments.

By paying or using the application you accept these conditions.

## Partner Access Checklist (DEXes / Staking / Perps)

**Scope:** Enosys, SparkDEX, BlazeSwap and comparable platforms (incl. staking & perps) where users hold positions visualised by LiquiLab.  
**Default posture:** LiquiLab is a neutral analytics & UX layer. We surface insights; execution (claim, swap, stake) happens on the **underlying platform** via deep links.

### 1) Brand & Naming (Logo Opt-In)
- Use **text brand names only** by default (e.g., “Enosys v3”, “SparkDEX v3”, “BlazeSwap v3”).  
- Third-party **logos are opt-in** and require written permission from the platform. Keep proof in `/docs/brand-approvals/`.
- No implication of endorsement/affiliation unless under contract. Phrasing examples: “via Enosys v3”, “open on SparkDEX”.
- Social share cards MUST include provider as text:  
  _“APY snapshot · WFLR/USD₮0 · via Enosys v3”_ (no 3rd-party logos).

### 2) Deep Links & UTM Schema
All outbound actions must open on the platform with UTMs for transparent attribution.

**UTM standard**

| param          | value                                         | notes                                  |
|----------------|-----------------------------------------------|----------------------------------------|
| `utm_source`   | `liquilab`                                    | constant                               |
| `utm_medium`   | `app`                                         | could be `email`/`x-card` in comms     |
| `utm_campaign` | `claim_flow` \| `pool_details` \| `share_card`| choose per context                     |
| `utm_content`  | `<providerSlug>-<marketId>-<action>`          | e.g., `enosys-v3-22003-claim`          |

**Adapter must expose deep-link builders**:
- `link.pool({ providerSlug, poolId })`
- `link.position({ providerSlug, positionId })`
- `link.claim({ providerSlug, poolId|positionId })`

### 3) Traffic, Caching & Robots
- Respect robots / public API ToS; **no gated scraping**.  
- Per-host concurrency & backoff with jitter; default `max 4 rps`, burst ≤ 8, tune per partner.  
- Cache TTLs: prices ≤ 60s; fees/incentives 60–300s; static metadata 24h.  
- Exponential backoff on 429/5xx; circuit-breakers after 3 consecutive failures.

### 4) Data Sources & Attributions
- Prefer official APIs/SDKs or CC-BY sources; document endpoints in `/docs/ADAPTERS.md`.  
- Show provider credit near data that depends on their markets (e.g., “prices/fees as tracked on SparkDEX pool #…”).

### 5) Security & Privacy
- No user credentials for partner platforms are stored.  
- No custody, no order routing.  
- Only aggregate, privacy-safe metrics shared with partners (click-outs, watchlist counts, claim initiations). No PII.

### 6) Observability & SLOs (Adapter Health)
- **SLO:** 99.5% successful responses per rolling 7 days; p95 latency ≤ 1200ms (cached), ≤ 3000ms (uncached).  
- **Error budget:** 0.5% total (4xx excl. 404 may count if due to our request).  
- **Staleness guard:** if source unavailable, show last value with `staleSeconds` and UI badge.  
- Metrics to emit: request count, 2xx/4xx/5xx rates, p50/p95 latency, cache hit ratio, `staleSeconds`.

### 7) Incident Handling (Severity & Response)
- Sev-1 (systemic data wrong/misleading): hotfix within 2h; temporarily disable surfaces; banner in UI.  
- Sev-2 (degraded/partial): fix within same business day; fallback to cached.  
- Sev-3 (minor): next scheduled release.  
- Partner comms (if needed): email **partners@liquilab.xyz** (update if different).

### 8) Legal & Takedowns
- Honour written requests to adjust naming/remove markets within **72h**.  
- Keep a change log of compliance actions in `/docs/ACCESS_POLICY.log`.

### 9) QA Gate Before Enabling a Provider
- ✅ Adapter unit tests (range math, fee accrual, incentives parser).  
- ✅ Deep links validated (pool/position/claim) with UTMs.  
- ✅ Rate-limit & caching verified in staging.  
- ✅ Brand usage check (text-only; no logos unless approved).  
- ✅ Empty-state & error banners present (`staleSeconds`, “open on platform”).  
- ✅ Share-card copy includes provider text credit.

### 10) Go-Live Checklist
1. Feature flag `provider.<slug>=on` set per environment.  
2. Observability dashboards created & alerts wired to on-call.  
3. `/api/health` exposes adapter status & cache freshness.  
4. Docs updated: `/docs/ADAPTERS.md`, `/PROJECT_STATE.md` (ecosystem posture).  
5. Optional co-marketing draft prepared (if partner agrees).

