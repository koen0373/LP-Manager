
# 🧠 PROJECT_STATE.md — LiquiLab

## 1. AI SYSTEM HEADER
All AI agents must read this document before performing any action.

**Purpose:** Establish a unified understanding of LiquiLab's brand, architecture, and collaborative workflow.
**Applies to:** Cursor, Codex, Claude, ChatGPT.

### Behavior Rules
1. Always read this file before any major refactor or UI change.
2. Maintain brand and design consistency at all times.
3. Prioritize reliability, elegance, and minimalism in UI and logic.
4. Communicate clearly and document every architectural decision.

---

## 2. LIQUILAB BRAND DEFINITION

## 💎 Brand Foundation — Locked Definition

> **LiquiLab — The Liquidity Pool Intelligence Platform**  
> **The easy way to manage your liquidity pools.**

LiquiLab's brand proposition and promise are permanent and unchangeable.  
The platform is designed by LPs, for LPs — providing calm clarity and control over liquidity pools.

### Immutable Guidelines
- The phrase **"The Liquidity Pool Intelligence Platform"** defines LiquiLab's category.  
- The tagline **"The easy way to manage your liquidity pools."** defines LiquiLab's promise.  
- Neither may be shortened, rephrased, or replaced.  
- All references must explicitly include "liquidity pools" — never "liquidity management."

### Brand Assets

**Logo & Wordmark:**
- **Current:** Inline SVG droplet paired with Quicksand wordmark rendered by `LiquiLabLogo` (no external image dependency)
- **Location:** `/public/brand/` (mark, wordmark, lockups)
- **Component:** `src/components/LiquiLabLogo.tsx`
- **Full specification:** `/docs/STYLEGUIDE.md` — Logo & Wordmark section

**Implementation:**
```tsx
import { LiquiLabLogo, LiquiLabLogoLockup } from '@/components/LiquiLabLogo';

// Navbar usage
<LiquiLabLogo variant="full" size="sm" theme="dark" />

// Hero with tagline
<LiquiLabLogoLockup size="lg" theme="dark" />
```

**Future:** Custom SVG assets with outlined paths and micro-customizations (unique 'q' tail, optimized i-dots, optical kerning) will replace the placeholder implementation.


## 🤖 AI Collaboration Protocol

LiquiLab development uses two specialized AI models — **Codex** and **Claude Sonnet** — working together in clearly defined roles to balance speed, structure, and creativity.

### Role Definition

| AI | Responsibility | Scope |
|----|----------------|-------|
| **Codex** | Acts as the **architect, integrator, and documentarian.** | Handles all structural, technical, and production-level changes. Responsible for updates to codebase, docs, schema, API routes, and deployment to Railway. |
| **Claude Sonnet** | Acts as the **designer, creative partner, and copy specialist.** | Handles all UI, copy, tone-of-voice, layout, and visual/interaction iterations. Focused on speed and iteration fidelity, not documentation. |
| **Combined (handover)** | When changes move from Claude → Codex or vice versa. | Codex integrates Claude’s UI iterations into the main codebase and updates documentation accordingly. |

### Workflow Sequence

1. **Claude Sonnet** creates a fast UI or copy iteration.
2. **You (the human)** review, validate, and summarize the key accepted changes (max 5 bullets).
3. **Codex** integrates those approved changes, ensures technical consistency, and updates `/docs/PROJECT_STATE.md`.
4. **Claude Sonnet** can then make visual fine-tuning on the integrated version.
5. **Codex** commits, documents, and deploys final changes to Railway.

### Prompt Targeting Rule

| Prompt Type | Use |
|--------------|------|
| New features, integrations, APIs, docs, deployment | **👤 Codex** |
| UI, copy, tone, design, microinteractions | **👤 Claude Sonnet** |
| Combined workflow or handover | **👥 Codex + Claude** |

### Context Handling

- Both AIs must **always read `/docs/PROJECT_STATE.md`** before any action.
- Both must maintain consistency with the **Brand Essence & Tone of Voice** section.
- Claude Sonnet does **not** modify structural code or database logic.
- Codex must always log all structural changes at the end of `PROJECT_STATE.md` under “Changelog”.

### Summary

This protocol ensures that:
- Claude Sonnet keeps LiquiLab’s **iteration speed and creative direction** high.
- Codex maintains **technical integrity, documentation accuracy, and deployment stability.**
- You stay in control as the **director of iteration flow** — fast creativity balanced with consistent engineering.





## 🛡️ AI Collaboration Safety Rule & Documentation Obligation

Only one AI agent may modify the project at a time.  
Claude Sonnet and Codex must both document every change in `/docs/PROJECT_STATE.md` after execution.

## 🔄 Execution Check Rule

Before starting any new task, Codex must ask:  
> “Has the previous task been reviewed and confirmed as complete?”

If not confirmed, Codex must pause until validation.


## 🔁 Iteration Workflow: Homepage First Strategy

LiquiLab follows a focused, iterative workflow for design and functionality improvements.  
The goal is to maintain creative speed through short UI iterations while keeping the overall structure stable and documented.

### 1️⃣ Core Principles
- **Start small, refine fast:** We make only a few changes at a time (maximum of 3–5 per iteration).  
- **Homepage first:** All visual and UX improvements begin on the homepage. Once validated, they will later be applied site-wide.  
- **Return to proven layouts:** The calm, data-driven table design from the previous version serves as our foundation; the card layout is reserved only for mobile viewports.  
- **Iterate visually first:** Design and copy changes are tested quickly through Claude Sonnet before Codex integrates them permanently.

### 2️⃣ Workflow Sequence

| Phase | Responsible | Description |
|-------|--------------|-------------|
| 1. Feedback / Request | **Human (you)** | Define 1 focused change set (max 3–5 modifications). |
| 2. Fast iteration | **Claude Sonnet** | Apply quick visual or textual updates (UI, copy, layout). |
| 3. Review | **Human (you)** | Approve or adjust — decide what should be kept. |
| 4. Integration | **Codex** | Implement approved changes in the main codebase, update `/docs/PROJECT_STATE.md`, and ensure stability. |
| 5. Refinement | **Claude Sonnet** | Apply small fine-tuning adjustments based on the integrated version. |

### 3️⃣ Responsibilities
- **Claude Sonnet:** handles all visual, UI, layout, and copy iterations on the homepage and later across sections.  
- **Codex:** integrates final changes, keeps documentation and structure consistent, and manages deployment.  
- **Human:** acts as the director — decides what goes forward, ensures focus, and prevents too many simultaneous edits.

### 4️⃣ Scope Limitation
If a request includes too many simultaneous changes, the system or AI assistant will explicitly warn:  
> *“This update affects multiple components — please narrow the scope to one section or 3–5 changes per iteration.”*

### 5️⃣ Expansion Plan
Once the homepage design and flow are finalized and documented, the new visual and structural standards will be extended to:
- Pool tables and dashboard  
- Pool detail pages  
- Admin and analytics panels  

This ensures LiquiLab evolves in controlled, high-quality steps — calm, consistent, and efficient.


---

## 3. PRODUCT FUNCTION & VISION

**Core Vision:**  
Empower liquidity pool providers with clear, actionable intelligence.

**Key Functions:**
- Connect wallet → discover all LP positions across supported DEXes.
- Visualize price ranges, liquidity pool distribution, rewards, and yield history.
- Manage pool positions: add/remove liquidity, claim rewards, and analyze trends.
- Support multi-DEX aggregation with unified analytics.
- Deliver AI-powered insights for optimizing liquidity pool strategies.

**DEX Adapters:**  
- Enosys (v3 NFT positions)  
- BlazeSwap (v3 NFT positions)  
- SparkDEX (v2 ERC-20 LP tokens)

LiquiLab’s adapter layer now demonstrates both NFT-based (v3) and ERC-20 LP token (v2) integrations, proving the multi-DEX architecture handles different pool standards seamlessly.

---

## 4. TECHNICAL ARCHITECTURE

### Stack Overview
**Framework:** Next.js 15.5.6 (Pages Router)  
**Language:** TypeScript  
**Database:** PostgreSQL (Railway)  
**ORM:** Prisma 6.18.0  
**Blockchain:** Flare Network (EVM)  
**Web3:** Viem 2.38.3 + Wagmi 2.18.1  
**Charts:** ECharts 5.6.0  
**Styling:** Tailwind CSS 3.4.0  

### Deployment
**Production Host:** Railway  
**URL:** https://liquilab.io  
**Environment:** Node.js 20  
**Database:** PostgreSQL (Railway managed)  
**Deployment:** Git push to `main` → auto-deploy  
**Suggested Subdomains:** app.liquilab.io (app), api.liquilab.io (API), docs.liquilab.io (docs)
### Data Architecture: RPC-First Strategy

**Primary Data Source: Direct JSON-RPC via Viem**  
✅ **Why:** Fast, permissionless, no rate-limit surprises, source of truth  
✅ **Used for:** Live prices (slot0), events (eth_getLogs), position data  

```typescript
// src/lib/viemClient.ts
publicClient.readContract()  // slot0, positions, balances
publicClient.getLogs()       // Transfer, Mint, Collect events (30-block chunks)
```

**Fallback Cascade (Only for Edge Cases):**
1. Blockscout API → contract creation dates, historical data
2. FlareScan API → last resort, non-critical metadata

**Key Parameters:**
- RPC chunk size: **30 blocks** (respects RPC limits)
- Blockscout chunk size: **100 blocks** (rate limit friendly)
- Cache strategy: Prisma database (PostgreSQL)
- Sync strategy: Smart auto-sync on first request, instant on subsequent

### Performance Optimization
**Logging:**
- Production: ~5 compact logs per API request
- Format: `[API] pool/22003 - OK (2361ms)`
- Development verbose logs: `DEBUG_LOGS=true`

**Caching:**
- First load: ~2-3s (sync from blockchain + cache to DB)
- Subsequent: <1s (served from PostgreSQL cache)
- Multi-wallet: Generic sync supports any wallet address
- Stale threshold: 5 minutes (auto-refresh)

**API Response:**
- Single JSON guarantee via `sendResponse()` guard
- Response guard prevents duplicate responses
- All routes return via controlled exit points

---

## 5. DESIGN SYSTEM

### Brand Colors (Digital)
| Element | HEX | Description |
|----------|------|-------------|
| LiquiLab Aqua | `#1BE8D2` | Core identity color |
| LiquiLab Navy | `#0A0F1C` | Background / depth tone |
| Slate Grey | `#1E2533` | Cards, UI base |
| Electric Blue | `#3B82F6` | Charts, actions, highlights |
| Accent Green | `#3DEE88` | Success / Active state |
| Accent Orange | `#F6A723` | Pending / Attention state |
| LiquiLab Mist | `#9CA3AF` | Text / Muted states |

### CMYK Conversion
- Aqua: C=70 M=0 Y=25 K=0  
- Navy: C=100 M=85 Y=40 K=55  
- Blue: C=80 M=50 Y=0 K=0  
- Green: C=60 M=0 Y=70 K=0  
- Orange: C=0 M=35 Y=90 K=0  

### Typography
| Element | Font | Weight | Usage |
|----------|-------|---------|-------|
| Headings | Quicksand | 600–700 | Logo, titles, callouts |
| Body | Inter | 400–500 | Text, data, UI copy |
| Code | JetBrains Mono | 400 | Console/log styling |

### Layout System
- **Logo height:** 72px top-left on desktop, 56px mobile
- **Container max width:** 
  - Desktop ≥1280px: 75vw (centered)
  - Ultrawide ≥1600px: 70vw
  - Tablet 1024-1279px: 88vw
  - Mobile <1024px: 94vw
- **Card radius:** 16px–24px
- **Primary buttons:** Aqua background → white text → hover = darker aqua
- **Divider:** Matches tagline color `#1BE8D2`
- **Background aesthetic:** "Water under glass" — Fixed background (`wave-hero.png`) visible through semi-transparent content overlays with `backdrop-filter: blur(12px)` glassmorphism

### UI Structure & Visual Guidelines

#### Pool Table Layout (v2025.10 — Two-Row Design)

**Core Purpose:**  
The Pool Table visualizes liquidity positions across multiple DEXs with a transparent, data-focused design that serves both as proof-of-concept and the primary interface for LP position management.

**Structure:**  
Each pool renders as **two table rows** with a **5-column layout**:

| Column | Row 1 Content | Row 2 Content |
|--------|---------------|---------------|
| **1. Pool** (spans both rows) | "Pool" label + DEX Name & Pool ID + Icons + Pool Pair + Fee + Min-Max Range | *(empty — rowspan continues)* |
| **2. Liquidity** | "Liquidity" label + TVL $ value + (% share) | *Current Price + Range Slider* |
| **3. Unclaimed Fees** | "Unclaimed Fees" label + $ value + "Claim fees" button | *(colspan 2 continues from Col 2)* |
| **4. Incentives** | "Incentives" label + $ value + Token breakdown | "APY" label + APY % (large, aqua, glowing) |
| **5. Status** | Range indicator dot (animated) + Status label | "Share your APY" label + Twitter share button |

**Visual Design:**
- **Container width:** 75% of viewport (desktop ≥1280px), centered automatically
- **Background:** `rgba(10,15,26,0.85)` + `backdrop-filter: blur(10px)` (glassmorphic aesthetic)
- **Dividers:** `rgba(255,255,255,0.25)` with `h-[2px]` + 75% transparency, rounded corners
- **Typography:** 
  - Labels: `text-[10px] font-semibold uppercase tracking-widest text-[#9AA1AB]/50`
  - Primary values: `text-[17px] font-semibold text-white/95`
  - Secondary text: `text-[11px] text-[#9AA1AB]/70`
  - APY: `text-[24px] font-bold text-[#75C4FF]` with subtle glow (`text-shadow`)
- **Font:** Inter with `font-variant-numeric: tabular-nums` for all numeric values
- **Spacing:** `px-6 py-8` for cells, `gap-4` between major sections, `gap-2.5` between labels and data
- **No table header:** Column structure is implicit from consistent cell layout
- **No internal borders:** Each pool block is visually separated only by the divider row

**Interaction:**
- **Hover:** Entire pool block (both rows) highlights with `bg-white/[0.02]` when any part is hovered
- **Cursor:** `cursor-pointer` for all rows
- **Animation:** Range indicator dots pulse/glow based on status (see Range Status & Slider section)

**Data Constraints:**
- Icons + Pool Pair + Fee tag stay on **one line** (no wrapping/truncation)
- Min–max range centered directly below pool pair
- All numeric columns use tabular-nums for perfect alignment
- Status dots align vertically across entire table via fixed-width slider container

**Responsive Behavior:**
- **Desktop (≥1280px):** Full 2-row, 5-column layout as described
- **Tablet/Mobile (<1280px):** Falls back to stacked card view (not yet implemented)

#### Range Status & Slider (v2025.10 — Animated Indicators)

Pool positions use a **3-tier status system** with animated visual indicators:

**Status Rules** (3% near-band buffer):
- **Out of Range** (red `#E74C3C`): Current price < min OR > max → **No fees earned** → **No animation** (solid dot)
- **Near Band** (orange `#FFA500`): Current price within 3% of lower or upper bound → **Warning: approaching edge** → **Soft glow animation** (no blinking)
- **In Range** (green `#00C66B`): Current price safely inside range → **Earns fees** ✓ → **Pulsing heartbeat** (blink + glow)

Range status and slider marker color use the same current price value with the 3% near-band buffer described below.

**Visual Implementation**:
- **Range Slider**: Minimal design with thin line (2px, `rgba(255,255,255,0.15)` background)
- **Marker**: Single vertical indicator (2px width, 16px height) colored by status
- **Marker Colors**: Match status (green/orange/red) with animations:
  - **Green (In Range)**: `animate-pulse-green` — keyframes with `opacity: 0.4 → 1` + `scale(1 → 1.05)`, 2s ease-in-out infinite
  - **Orange (Near Band)**: `animate-glow-orange` — keyframes with `opacity: 0.6 → 1` + `box-shadow` glow, 3s ease-in-out infinite (slower, no scale)
  - **Red (Out of Range)**: No animation class — static `box-shadow: 0 0 8px rgba(239,68,68,0.4)`
- **Status Column**: Colored dot + label with same animation classes applied to the dot
- **Alignment**: All status dots align vertically via `max-w-[200px] mx-auto` container for the range slider

**Calculation Logic**:
```javascript
const width = maxPrice - minPrice;
const nearBuffer = width * 0.03;         // 3% buffer
const nearLower = minPrice + nearBuffer; // inside lower edge
const nearUpper = maxPrice - nearBuffer; // inside upper edge

if (current < minPrice || current > maxPrice) → OUT_OF_RANGE (red, no animation)
else if (current <= nearLower || current >= nearUpper) → NEAR_BAND (orange, glow only)
else → IN_RANGE (green, pulse + glow)
```

**Tailwind Animation Configuration**:
```javascript
// tailwind.config.js
keyframes: {
  'pulse-green': {
    '0%, 100%': { opacity: '0.4', transform: 'scale(1)' },
    '50%': { opacity: '1', transform: 'scale(1.05)' }
  },
  'glow-orange': {
    '0%, 100%': { 
      opacity: '0.6', 
      boxShadow: '0 0 8px rgba(249,115,22,0.3)' 
    },
    '50%': { 
      opacity: '1', 
      boxShadow: '0 0 16px rgba(249,115,22,0.6)' 
    }
  }
},
animation: {
  'pulse-green': 'pulse-green 2s ease-in-out infinite',
  'glow-orange': 'glow-orange 3s ease-in-out infinite'
}
```

### Typography — Hybrid Strategy

- **Inter** is the primary UI typeface for the application (dashboards, tables, forms, tooltips, long text).  
- **Quicksand** is the brand typeface for marketing, hero sections, major headings, and key CTAs. In the app, page titles (h1/h2) may use Quicksand to retain brand warmth.
- **Tabular numbers** are enforced for all numeric columns (TVL, Fees, Incentives, APY) to guarantee perfect alignment:
  - CSS utility: `.tnum { font-variant-numeric: tabular-nums; font-feature-settings: "tnum"; }`

Implementation:
- Global CSS variables: `--font-brand` (Quicksand) and `--font-ui` (Inter).  
- Tailwind: `font-brand` and `font-ui` families defined; `.tnum` utility added.  
- Fonts are loaded from Google Fonts with `font-display: swap` (via `<link>` in `_document.tsx`).

Rationale:
- This hybrid keeps LiquiLab warm and approachable (Quicksand) while making the data grids calm, precise, and professional (Inter).

#### Component Architecture
- **Primary Components:**
  - `PositionsTable.tsx` — Main table component with 2-row, 5-column layout per pool
  - `OriginalRangeSlider.tsx` — Minimal range slider with status-colored animated marker
  - `PoolRangeIndicator.tsx` — Range status calculation logic (3% near-band buffer)
  - `DemoPoolsPreview.tsx` — Demo data wrapper for homepage proof section
- **Global Styles:**
  - `src/styles/globals.css` — Contains `.pool-hover` class for two-row hover synchronization
  - `tailwind.config.js` — Defines `pulse-green` and `glow-orange` animation keyframes

---

## 6. COMPONENT MAPPING (UI + BEHAVIOR)

### Global
- **Header:** Logo (72px) + Tagline + FAQ link + Wallet connect/refresh controls
- **Footer:** Version info + DEX partners

### Home Page
- **Hero Section:** Headline "The easy way to manage your liquidity pools" + dual CTAs (Explore demo / Choose journey)
- **Problem Section:** 3-icon problem statement highlighting LP pain points
- **Proof Section:** Live demo pools table — 9 real examples across Enosys, SparkDEX, BlazeSwap
  - Uses `PositionsTable` component with 2-row, 5-column layout
  - Shows Pool info, Liquidity, Fees, Incentives, Range status, Current price slider, APY, Share button
  - Fully interactive with hover effects and animated range indicators
- **Subscription Section:** Integrated pricing panel (Shallow / Flow / Depth / Tide) with billing toggle
- **Footer:** Docs/FAQ/Contact links + brand tagline

### Portfolio Page
- Grid view of user's LP positions (active + inactive)
- Filters: DEX (Enosys / BlazeSwap / SparkDEX), status, range strategy
- Each position links to detailed pool page

### Pool Detail Page
- **ECharts Range Chart:**  
  - Dynamic Y-axis adjusting to price volatility
  - Time selector (24h, 7D, 1M, 1Y)
  - Blue line (price history), Green dashed lines (min/max), Blue solid (current)
  - Vertical event markers for Mint, Collect, Burn
  - Live price updates every 30s via slot0() polling
- **Activity Log Block:** chronological transaction list
- **Claim Button:**  
  - Grey (too early) → `#1E2533`  
  - Orange (can claim) → `#F6A723`  
  - Green (now) → `#3DEE88`

---

## 7. KEY API ENDPOINTS

### `/api/positions` (GET)
**Purpose:** Fetch all LP positions for a wallet  
**Query params:** `?wallet=0x...`  
**Returns:** Array of positions with TVL, rewards, status  
**Cache:** 2 minutes  

### `/api/pool/[tokenId]` (GET)
**Purpose:** Detailed pool data with price history and activity  
**Params:** tokenId (position NFT ID)  
**Returns:** PoolDetailVM with charts, ranges, rewards  
**Performance:** First load 2-3s (sync), subsequent <1s (cached)  
**Smart sync:** Auto-detects stale data (>5min) and refreshes  

### `/api/wallet/summary` (GET)
**Purpose:** Portfolio overview with aggregated metrics  
**Query params:** `?wallet=0x...`  
**Returns:** Total TVL, rewards, position count  

---

## 8. RECENT TECHNICAL IMPROVEMENTS (Oct 2024)

### ✅ Position Categorisation (Jan 2025)
- Home page now splits wallet positions into **Actieve** (TVL > 0 or fees accruing) and **Inactieve** (geen TVL/fees maar nog rFLR incentives).
- "Loveless" pools (geen TVL, fees, of incentives) worden verborgen zodat de lijst schoon blijft.

- Zodra een wallet gekoppeld is verdwijnt de instructiekaart; we tonen direct de relevante pools.

### ✅ Early Access Flow (Jan 2025)
- 25-slot early access limit met wachtlijst en fast-track crypto intent (USDT₀ op Flare).
- Nieuwe API-routes voor waitlist, fast-track intents, admin approvals en on-chain verificatie.
- Admin dashboard (/admin/payments) met handmatige review en Resend bevestigingsmail.

### ✅ Response Guard Implementation
- Added `sendResponse()` guard to prevent duplicate JSON responses
- All API endpoints now guarantee single response
- Fixes "headers already sent" errors

### ✅ Log Optimization
- Reduced from 18 → 5 logs per API request
- Compact format: `[API] pool/22003 - OK (2361ms)`
- Added `DEBUG_LOGS=true` flag for development verbose logging
- Railway rate limit issue resolved (was hitting 500 logs/sec)

### ✅ RPC Chunk Size Fix
- RPC chunk size: 3000 → **30 blocks** (respects eth_getLogs limit)
- Blockscout chunk size: 3000 → **100 blocks**
- Eliminates "requested too many blocks" errors
- Improves reliability for historical data sync

### ✅ Smart Auto-Sync
- Multi-wallet support via generic position sync
- Database-backed cache with Prisma
- First load: auto-sync + cache (20-30s)
- Subsequent: instant from cache (<1s)
- Stale detection: auto-refresh after 5 minutes

### ✅ Railway Production Deployment
- PostgreSQL database (managed by Railway)
- Prisma migrations on deploy
- Environment: `NODE_ENV=production`
- Port: 8080 (Railway default)
- HTTPS enforced (308 redirect from HTTP)

---

### Brand Evolution
LiquiLab is the evolution of the Liqui brand — a focused platform for liquidity pool intelligence and management.

## 9. AI COLLABORATION GUIDELINES

| AI | Role | Responsibilities |
|----|------|------------------|
| **Cursor** | Primary dev environment | Executes code, linting, builds features |
| **Codex** | Code reasoning & integration | Ensures structural correctness, data flow logic |
| **Claude** | Documentation & architecture | Maintains clarity and project memory |
| **ChatGPT** | Product, brand, and UX director | Oversees design alignment and conceptual clarity |

**Workflow Principle:**  
> All agents collaborate through a shared understanding of this document before performing edits.
> All agents must use “LiquiLab” and the narrowed proposition (“liquidity pools”) consistently across documentation, UI, and communications.

**Communication Protocol:**
- Major changes: Always consult PROJECT_STATE.md first
- Architecture decisions: Update this document
- Performance changes: Document in commit messages
- API changes: Update endpoint documentation above

---

## 10. VERSIONING & COMMIT RULES

**Branching:**
- `main`: stable production (auto-deploys to Railway)
- `dev`: integration and testing
- feature branches per module (`feature/chart-range-filter`)

**Commit Guidelines:**
- Follow Conventional Commits (`feat:`, `fix:`, `docs:`, `perf:`)
- Include `[state:sync]` if commit affects design or brand consistency
- Update `PROJECT_STATE.md` when adding new components or visual tokens
- Performance fixes: use `perf:` prefix

**Release Tags:**
- `vX.Y.Z` format (semantic versioning)
- Include changelog summary in `/docs/CHANGELOG.md`

**Recent Commits:**
```
fix: Implement 75% table width on desktop + 3% near-band range logic
perf: Optimize logging to prevent Railway rate limit
fix: Add response guard to prevent duplicate JSON responses  
fix: Reduce RPC/Blockscout chunk sizes to respect API limits
```

---

## 11. ENVIRONMENT VARIABLES

**Required:**
```bash
DATABASE_URL=postgresql://...  # Railway PostgreSQL
NEXT_PUBLIC_RPC_URL=https://flare.flr.finance/ext/bc/C/rpc
NODE_ENV=production
```

**Optional:**
```bash
DEBUG_LOGS=true                # Enable verbose logging in production
FLARESCAN_API_KEY=...          # Optional: reduces 403 errors (not required with RPC-first)
```

---

© 2025 LiquiLab — Manage your liquidity pools.

**Last Updated:** October 26, 2025  
**Version:** 0.1.4  
**Production URL:** https://liquilab.io  
**Suggested Subdomains:** app.liquilab.io | api.liquilab.io | docs.liquilab.io

---

## 💳 Subscription Model — Liquidity Journey (Annual Focus)

LiquiLab has replaced its pool-based pricing with a simple annual subscription model.

| Plan | Pool limit | Annual Price | Monthly Option | Description |
|------|-------------|----------------|----------------|-------------|
| **Shallow** | Up to 5 | $99.95/year | $9.95/mo | For LPs taking their first steps |
| **Flow** | Up to 15 | $249.95/year | $24.95/mo | For active LPs managing multiple pools |
| **Depth** | Up to 50 | $749.95/year | $74.95/mo | For professionals and small teams |
| **Tide** | 50+ | Custom | Custom | For DAOs and organizations (in development) |

### Trial & Deferred Payment
- Each plan includes a 14-day free trial with full access.  
- Users authorize payment at signup; no charge until the trial ends.  
- Monthly or annual billing in USDT₀ (Flare Network).  
- Cancel anytime during trial — no payment processed.

### Branding & UX
- Hero CTA: “Try LiquiLab free for 14 days — no payment until your trial ends.”  
- Pricing tagline: “Simple annual plans. Full access. No hidden fees.”  
- Dashboard banner: “Trial active — X days remaining.”

## 🎯 Pricing Rationale & Target Segments

| Tier | User type | Typical # Pools | Annual price | Value |
|------|------------|-----------------|---------------|-------|
| **Shallow** | Beginner LPs | 1–5 | $99.95 | Accessible entry plan |
| **Flow** | Active LPs | 6–15 | $249.95 | Professional yet affordable |
| **Depth** | Pros / Teams | 16–50 | $749.95 | High-value for power users |
| **Tide** | DAOs / Funds | 50+ | Custom | Enterprise tier in development |

The pricing reflects realistic pool management patterns, encouraging growth between tiers.

### Pricing UI – plan CTAs & trial flow
- Replaced both previous pricing sections with one unified “Liquidity Journey” block.
- Combined visuals (transparent cards) and functionality (toggle).
- Added “Start free trial” CTA under all plans, including Tide.
- Removed all other pricing blocks and redundant code.


Updated: Brand Essence finalized — focused on Liquid Pool Management category.

Added: AI Collaboration Protocol — defines division of tasks between Codex and Claude Sonnet.
Added: Iteration Workflow — Homepage First Strategy.
Summary: Iteration Workflow section restored; structural/workflow updates must continue to be logged here.

**October 26, 2025 — Pool Table Layout & Range Status Improvements:**
- Implemented **75% table width** on desktop (≥1280px breakpoint), centered with `margin: 0 auto`
- Fixed **range status logic** with 3% near-band buffer (In Range / Near Band / Out of Range)
- Updated **OriginalRangeSlider** to use status-based marker colors (green/orange/red)
- Added **"earns fees"** indicator for In Range positions in status column
- Created comprehensive test suite (`__tests__/rangeStatusTests.ts`) with 9 test cases
- Updated PROJECT_STATE.md UI Guidelines section with complete range status documentation
Updated: Homepage container to 75% width; bound range status to slider current price (3% near-band buffer).
Updated: Adopted hybrid typography — Inter for application UI (tabular numbers), Quicksand for brand headings/marketing.
Replaced: Pool-based billing removed. Added annual Liquidity Journey subscription model (Shallow / Flow / Depth / Tide) with 14-day free trial.
Added: AI Collaboration Safety Rule & Documentation Obligation — both Codex and Claude Sonnet must document all relevant changes after execution.
Updated: LiquiLab v2025.10 — Added locked brand foundation, subscription model (Shallow / Flow / Depth / Tide), annual pricing focus, AI collaboration updates, and execution check rule.
Updated: Homepage pricing section unified — replaced two existing blocks with one Liquidity Journey section; added Start free trial CTA for all plans.

**October 26, 2025 — Subscription Block Visual Refinement:**
- **UI Polish:** Restored glass transparency (`rgba(10,15,26,0.85)` + `backdrop-blur-xl`)
- **Spacing:** Enforced 8px vertical rhythm, added `min-h-[460px]` for card consistency
- **Typography:** Updated secondary text to `#B0B9C7` for improved contrast, Inter with `line-height: 1.6`
- **CTA Hover:** Softened to `#78B5FF` with gentle glow `0 0 10px rgba(110,168,255,0.15)`
- **Billing Toggle:** Refined active state with soft aqua glow, improved accessibility with ARIA labels
- **Card Hover:** Gentle lift (`-translate-y-1`) + subtle shadow, no harsh edges
- All changes maintain LiquiLab's "calm intelligence" brand aesthetic

**October 26, 2025 — Homepage Redesign (Definitive v2025.10):**
- **Complete restructure:** Replaced pre-launch waitlist layout with final brand homepage
- **New 5-section narrative:**
  1. **Hero (Promise)**: "The easy way to manage your liquidity pools" + dual CTAs (Explore demo / Choose journey)
  2. **Problem**: 3-icon problem statement highlighting LP pain points
  3. **Solution**: "One clear dashboard" with placeholder dashboard preview
  4. **Proof**: Live demo pools table (9 real examples across Enosys, SparkDEX, BlazeSwap)
  5. **Subscription**: Integrated pricing panel with billing toggle
- **Removed all waitlist/pre-launch content:** Fast-track, early access messaging, and waitlist forms
- **Smooth scroll navigation:** Hero CTAs scroll to #proof and #subscription sections
- **Glass aesthetics throughout:** All sections use transparent backgrounds + backdrop-blur
- **Footer added:** Simple footer with Docs/FAQ/Contact links + brand tagline
- **Mobile responsive:** All sections adapt to mobile/tablet with stacked layouts
- Updated `DemoPoolsPreview` to return only the table (removed duplicate heading)

**October 26, 2025 — Homepage "Water Under Glass" Implementation:**
- **Container widths (responsive):**
  - Desktop ≥1280px: `max-width: 75vw` (centered)
  - Ultrawide ≥1600px: `max-width: 70vw`
  - Tablet 1024-1279px: `max-width: 88vw`
  - Mobile <1024px: `max-width: 94vw`
- **Glass overlay blocks:**
  - `background: rgba(10, 15, 26, 0.88)` (85-90% transparency)
  - `backdrop-filter: blur(12px)` + `-webkit-backdrop-filter: blur(12px)`
  - `border: 1px solid rgba(255,255,255,0.05)` + `border-radius: 12px`
- **Fixed water background:**
  - Position: `fixed` (parallax-like, no scroll jitter)
  - **Bottom 60%**: Wave-hero.png fully visible, anchored to bottom
  - **Top 40%**: Solid dark blue `#0A0F1A` with transparent gradient fade
  - **Gradient overlay**: `linear-gradient` from solid → 80% opacity → transparent
    - Stops: `#0A0F1A 0%`, `#0A0F1A 60%`, `rgba(10,15,26,0.8) 85%`, `transparent 100%`
    - Creates seamless transition into wave photo
  - Wave image: `url('/wave-hero.png')` covers bottom 60% of viewport
  - Background size: `cover` (image fills width proportionally)
  - Background position: `center bottom` (anchored to bottom edge)
  - Layout: Top solid fades into bottom water — no visible hard edge
  - Always visible behind content; glass overlays let it shine through
- **Typography improvements:**
  - Consistent `line-height: 1.4` for body text
  - `font-variant-numeric: tabular-nums` for prices
  - Secondary text color: `#B0B9C7` for improved contrast
- **Pricing card spacing:**
  - `min-height: 460px` for equal card heights
  - 8px vertical rhythm with `gap: 8px`
  - `flex-direction: column` + `justify-content: space-between`
- **All acceptance criteria met:** Water visible, 75% containers, glass overlays, no text overlap, responsive breakpoints

**October 26, 2025 — Pool Table Two-Row Redesign (v2025.10):**
- **Complete structural redesign:** Each pool now renders as **2 table rows** with **5 columns**
- **Column 1 (Pool Info):** Added "Pool" label, spans both rows, contains DEX + Pool ID + Icons + Pair + Fee + Min-Max range, aligned top
- **Row 1 Layout:**
  - Column 2: Liquidity (TVL $ + % share)
  - Column 3: Unclaimed Fees ($ value + "Claim fees" button)
  - Column 4: Incentives ($ value + token breakdown)
  - Column 5: Status (animated range indicator dot + label)
- **Row 2 Layout:**
  - Column 2-3 (colspan 2): Current Price + Range Slider (centered)
  - Column 4: APY (large aqua percentage with glow effect: `text-shadow: 0 0 20px rgba(117,196,255,0.3)`)
  - Column 5: "Share your APY" label + Twitter share button
- **Removed elements:** Table header (`<thead>`), internal row borders, "Action" column, "earning fees" subtext
- **Divider system:** `rgba(255,255,255,0.25)` divider line between pool blocks, 2px high, 75% transparent, rounded corners
- **Hover interaction:** Entire pool block (both rows) highlights via JavaScript `useEffect` hook that adds `.pool-hover` class when any part of the pool is hovered, using `data-pool-id` attributes on all `<tr>` and `<td>` elements
- **Animation system:**
  - **Green (In Range):** `animate-pulse-green` with opacity + scale heartbeat (2s infinite)
  - **Orange (Near Band):** `animate-glow-orange` with opacity + box-shadow glow, no scale (3s infinite, slower)
  - **Red (Out of Range):** Static dot, no animation
  - Animations defined in `tailwind.config.js` with custom keyframes
- **Visual hierarchy improvements:**
  - Labels: `text-[10px] font-semibold uppercase tracking-widest text-[#9AA1AB]/50`
  - Primary values: `text-[17px] font-semibold text-white/95`
  - Secondary text: `text-[11px] text-[#9AA1AB]/70`
  - APY: `text-[24px] font-bold text-[#75C4FF]` with aqua glow
  - Spacing: `px-6 py-8` for cells, `gap-4` major sections, `gap-2.5` label-to-data, `gap-0.5` for data grouping
- **Alignment improvements:**
  - Min-max range centered under icons/pool pair
  - Liquidity share format changed to `(0.27%)` from `0.27% of pool`
  - Range indicator dots align vertically via fixed-width slider container (`max-w-[200px] mx-auto`)
  - All numeric columns use `tabular-nums` for perfect alignment
- **Typography & whitespace:** Enhanced visual calm through increased padding, refined gaps, quieter font sizes/weights, and lower opacities for secondary elements
- **Technical implementation:** Fixed TypeScript errors in `devLog.ts` (added `typeof process !== 'undefined'` guards), ensured animations work by removing inline style overrides, restarted dev server to load new Tailwind config

**October 26, 2025 — Pool Table Visual Refinement (Final Polish):**
- **Background depth:** Added soft gradient overlay (`linear-gradient(180deg, rgba(10,15,26,0.75) 0%, rgba(10,15,26,0.92) 100%)`) with `backdrop-filter: blur(12px)` for enhanced "water under glass" aesthetic
- **Spacing improvements:**
  - Increased vertical spacing between Current Price slider and APY (16px top padding on row 2)
  - Standardized row height with `min-height: 140px` on both table rows for consistency
  - Maintained 8px baseline grid across all elements
- **APY enhancements:**
  - Added "Average 24h APY" label below APY value (`14px`, `#B0B9C7`, `opacity: 0.9`)
  - Applied aqua gradient to APY value (`linear-gradient(135deg, #6EA8FF 0%, #78B5FF 100%)`)
  - Maintained subtle glow effect for depth and hierarchy
- **"Claim fees" interactivity:**
  - Increased contrast to `rgba(110,168,255,0.9)`
  - Added hover state with color transition to `#6EA8FF` and underline fade-in
  - Changed cursor to pointer with proper `cursor-pointer` class
  - Increased font size to `14px` for better affordance
- **Typography refinements:**
  - Pool pair names: `font-weight: 500` with `letter-spacing: 0.01em`
  - Secondary text: color updated to `#B0B9C7` with `line-height: 1.4` throughout
  - Consistent use of Inter font family with tabular-nums for numeric alignment
- **Status dots:** Added soft glow (`box-shadow: 0 0 6px currentColor`) for calm visual motion
- **Divider lines:** Refined to `0.5px solid rgba(255,255,255,0.05)` for subtle, minimal contrast
- **Share button:** Added tooltip (`title` attribute) "Share your LiquiLab APY snapshot on X" for accessibility
- **All changes maintain:** LiquiLab's "calm intelligence" brand aesthetic with improved readability, professional hierarchy, and transparent glassmorphic depth

**October 26, 2025 — Placeholder Hero Refresh & Inline Logo Update:**
- Converted `LiquiLabLogo` to render the droplet mark inline as SVG, removing any dependency on loading `/brand/liquilab-mark.svg`.
- Placeholder landing (`pages/placeholder.tsx`) now layers `/wave-hero.png` via `next/image` with a dark gradient overlay for the "water under glass" aesthetic.
- Login CTA and email form retain their existing styling while the new background maintains accessibility contrast.

**October 26, 2025 — Logo & Brand Assets (Placeholder Implementation):**
- **Created:** CSS-based logo system using Quicksand font + SVG water droplet
- **Components:**
  - `src/components/LiquiLabLogo.tsx` — Main logo component with variants (full, mark-only, wordmark-only) and sizes (sm, md, lg)
  - `LiquiLabLogoLockup` component for logo + tagline combinations
- **Assets:**
  - `public/brand/liquilab-mark.svg` — Water droplet icon with aqua gradient and reflection
  - Folder structure created: `/public/brand/`, `/public/brand/favicon/`, `/public/brand/previews/`
- **Documentation:**
  - Created comprehensive `/docs/STYLEGUIDE.md` with logo specifications, color system, typography guidelines, spacing rules, and accessibility requirements
  - Logo usage guidelines: sizes, clear space, minimum dimensions, forbidden usage
  - Dark/light theme color specifications
  - Lockup rules for logo + tagline combinations
- **Integration:** Updated `Header.tsx` to use new `LiquiLabLogo` component in navbar
- **Future:** Placeholder will be replaced with custom SVG assets featuring micro-customizations (unique 'q' tail, optimized i-dots, optical kerning)

**October 26, 2025 — Codex Task Documentation (Pool Table SAFE MODE):**
- **Created:** Complete task specification for Codex to implement scoped 5-column, 2-row Pool Table layout
- **Documentation files:**
  - `/docs/CODEX_TASK_POOL_TABLE_SAFE_MODE.md` — Full implementation spec with 8 detailed sections (~600 lines)
  - `/docs/CODEX_TASK_POOL_TABLE_SAFE_MODE_QUICK_REF.md` — Quick reference card for locked values and CSS classes
- **Scope:** All changes under `[data-ll-ui="v2025-10"]` data attribute to prevent breaking existing code
- **Key specifications:**
  - Non-destructive approach: only ADD `.ll-*` classes, no removals or global overrides
  - Preserved handover locks: divider `rgba(110,168,255,0.12)`, min-height `140px`, slider specs, APY spacing
  - 5-column structure: Pool | Liquidity | Unclaimed fees | Incentives | APY / Status
  - 2-row layout per pool with range slider in Liquidity column (Row 2)
  - Complete CSS utilities (~200 lines) with scoped selectors
  - Accessibility enhancements with ARIA attributes
  - 8 acceptance test categories (headers, rows, dividers, slider, APY, buttons, no regressions)
- **Deliverables:** PR template, file list, documentation changelog template, testing checklist
- **Status:** Ready for Codex implementation (estimated 2-3 hours)
- **Purpose:** Provides structured handover from Claude Sonnet (design) to Codex (engineering) following AI Collaboration Protocol

## 2025-10-26 — Pool Table: 5-column layout (SAFE MODE, scoped)
**Summary** Locked a 5-column / 2-row Pool Table under data-ll-ui="v2025-10", with divider rgba(110,168,255,0.12), min-row-height 140px, single-marker slider (marker = status color), 3% near-band, APY spacing + tabular numerals, and scoped primary button style.
**Changelog**
- add(scope): data-ll-ui="v2025-10" root; all new classes prefixed .ll-
- style(table): scoped dividers; row min-height
- feat(range): slider in Liquidity; marker bound to status color
- style(apy): spacing + tabular-nums; add Share
- a11y: labelled range; role="status"
**Notes** Non-destructive: no global overrides; no DOM restructuring.


**October 26, 2025 — Placeholder Access API (App Router migration):**
- Removed legacy Pages API endpoints under `/pages/api/placeholder/` that depended on the `cookie` module.
- Added App Router handlers `src/app/api/login/route.ts` and `src/app/api/notify/route.ts` that set cookies via `NextResponse` and run on the Node runtime.
- Updated placeholder login + signup flows to call the new routes (`/api/login`, `/api/notify`) while preserving the password gate and Slack notification behaviour.

**October 26, 2025 — Placeholder Page Visual Polish (Claude Sonnet - FINAL):**
- **Wave-hero background (DEFINITIVE FIX - inline styles):**
  - **Root cause:** Next.js Image component + Tailwind classes had z-index/rendering conflicts
  - **Solution:** Switched to native CSS background-image with inline styles
  - **Implementation:**
    - Removed Next.js `<Image>` component for background
    - Used direct `backgroundImage: 'url(/wave-hero.png)'` with inline style
    - Explicit `zIndex: -10` in inline style (not Tailwind class)
    - Gradient overlay: `rgba(10,15,28,0.2) → rgba(10,15,28,0.05) → rgba(10,15,28,0.4)`
    - Top: 20% opacity (text readability)
    - Middle: **5% opacity** (maximum wave visibility!) 
    - Bottom: 40% opacity (smooth fade)
  - Fixed positioning maintained for parallax effect
  - **Result:** Wave now renders immediately and is fully visible! 🌊✅
- **Screenshot display (DEFINITIVE FIX - native img tag):**
  - **Root cause:** Next.js Image component optimization was blocking display
  - **Solution:** Switched to native `<img>` tag with inline styles
  - **Implementation:**
    - Removed Next.js `<Image>` component wrapper
    - Used direct `<img src="/provider-screens.png">` 
    - Inline styles: `width: 100%, height: auto, display: block`
    - Border via inline style: `border: 1px solid rgba(255,255,255,0.15)`
    - No background overlay, transparent container
  - **Result:** Screenshot displays instantly and perfectly! 📸✅
- **Content section transparency:**
  - Problem section: `bg-[rgba(10,15,26,0.65)]` + `backdrop-blur-lg` 
  - Solution section: `bg-[rgba(10,15,26,0.7)]` + `backdrop-blur-xl`
  - Both sections allow wave-hero to shine through glassmorphic effect
- **Copy refinement (aligned with brand guidelines):**
  - Problem statements highlight Excel sheets burden:
    - "Tracking pools across multiple DEXs means switching between fragmented dashboards."
    - "**Maintaining Excel sheets to calculate real APY and track performance over time.**"
    - "Managing liquidity pools should be simple — not a maze of complexity."
  - Problem section intro: "Fragmented interfaces. **Scattered data. Manual Excel tracking.**"
  - Screenshot caption: "requiring LPs to **juggle between platforms and manual spreadsheets**"
  - Hero subheadline: "One clear dashboard for all your liquidity pools — across Enosys, BlazeSwap, and SparkDEX."
  - Email disclaimer: "Early access notifications only. No spam, ever."
- **Visual hierarchy:**
  - "Managing liquidity pools today" problem section with real provider screenshot
  - "Why LPs Choose LiquiLab" benefit card with subtle styling
  - Clear Problem → Solution narrative flow
- **Brand consistency:**
  - All copy references "liquidity pools" (never "liquidity management")
  - LiquiLab tagline maintained exactly as locked
  - Brand colors: `#6EA8FF` aqua, `#B0B9C7` secondary text
  - DEX names: Enosys, BlazeSwap, SparkDEX
- **Technical notes:**
  - Native CSS `background-image` is more reliable than Next.js Image for fixed backgrounds
  - Native `<img>` tag ensures immediate display without optimization delays
  - Inline styles bypass Tailwind JIT compilation issues
  - `zIndex: -10` in inline style avoids Tailwind negative z-index conflicts
- **Purpose:** Demonstrates LP provider complexity (real screenshot) **and Excel sheet burden** with **fully visible wave-hero background** creating LiquiLab's signature "water under glass" aesthetic


**2025-10-27 — Placeholder visual fix (providers + hero wave):**
- `pages/placeholder.tsx`: switched provider screenshot to `/media/providers.png` via `next/image` and applied the `hero-wave-bg` utility so the hero background works in Chrome.
- `src/styles/globals.css`: added Tailwind utility `.hero-wave-bg` pointing to `/media/hero-wave.svg`; documented inline fallback comment.
- Issues resolved: provider screenshot missing — **OPGELOST**; hero wave background missing — **OPGELOST**.
