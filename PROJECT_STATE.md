
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

**Brand Name:** LiquiLab  
**Category:** DeFi Liquidity Pool Intelligence Platform  
**Tagline:** "The Liquidity Pool Intelligence Platform"  
**Essence:** Precision • Transparency • Control  

LiquiLab helps DeFi liquidity providers monitor, manage, and optimize their Uniswap v3-style positions across multiple DEXes (currently Enosys, SparkDEX, and BlazeFlare).  

LiquiLab simplifies complex liquidity data into human-readable insights and AI-assisted strategies.

---

## 3. PRODUCT FUNCTION & VISION

**Core Vision:**  
Empower liquidity providers with clear, actionable intelligence.

**Key Functions:**
- Connect wallet → discover all LP positions across supported DEXes.
- Visualize price ranges, liquidity distribution, rewards, and yield history.
- Manage positions: add/remove liquidity, claim rewards, and analyze trends.
- Support multi-DEX aggregation with unified analytics.
- Deliver AI-powered insights for optimizing position strategies.

**DEX Adapters:**  
- Enosys (v3 NFT positions)  
- SparkDEX (v2 LP ERC20)  
- BlazeFlare (v3 NFT positions)

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
**URL:** https://liquilab.up.railway.app  
**Environment:** Node.js 20  
**Database:** PostgreSQL (Railway managed)  
**Deployment:** Git push to `main` → auto-deploy  

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
| Primary Aqua | `#1BE8D2` | Liqui core identity color |
| Deep Navy | `#0A0F1C` | Background / depth tone |
| Slate Grey | `#1E2533` | Cards, UI base |
| Electric Blue | `#3B82F6` | Charts, actions, highlights |
| Accent Green | `#3DEE88` | Success / Active state |
| Accent Orange | `#F6A723` | Pending / Attention state |
| Neutral Grey | `#9CA3AF` | Text / Muted states |

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
- **Container max width:** 1440px
- **Card radius:** 16px–24px
- **Primary buttons:** Aqua background → white text → hover = darker aqua
- **Divider:** Matches tagline color `#1BE8D2`

---

## 6. COMPONENT MAPPING (UI + BEHAVIOR)

### Global
- **Header:** Logo (72px) + Tagline + Nav links (Portfolio, Pools, Activity)
- **Footer:** Version info + DEX partners

### Home Page
- Hero banner with key metric cards (TVL, APR, Pools managed)
- CTA button → "Connect Wallet"

### Portfolio Page
- Grid view of user's LP positions (active + inactive)
- Filters: DEX (Enosys / SparkDEX / BlazeFlare), status, range strategy
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

## 9. AI COLLABORATION GUIDELINES

| AI | Role | Responsibilities |
|----|------|------------------|
| **Cursor** | Primary dev environment | Executes code, linting, builds features |
| **Codex** | Code reasoning & integration | Ensures structural correctness, data flow logic |
| **Claude** | Documentation & architecture | Maintains clarity and project memory |
| **ChatGPT** | Product, brand, and UX director | Oversees design alignment and conceptual clarity |

**Workflow Principle:**  
> All agents collaborate through a shared understanding of this document before performing edits.

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

**LiquiLab — DeFi Liquidity Intelligence**  
_The Liquidity Pool Intelligence Platform_

**Last Updated:** October 24, 2025  
**Version:** 0.1.3  
**Production URL:** https://liquilab.up.railway.app  
**Domain:** https://liquilab.io
