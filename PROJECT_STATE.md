
# 🧠 PROJECT_STATE.md — Liqui

## 1. AI SYSTEM HEADER
All AI agents must read this document before performing any action.

**Purpose:** Establish a unified understanding of Liqui’s brand, architecture, and collaborative workflow.
**Applies to:** Cursor, Codex, Claude, ChatGPT.

### Behavior Rules
1. Always read this file before any major refactor or UI change.
2. Maintain brand and design consistency at all times.
3. Prioritize reliability, elegance, and minimalism in UI and logic.
4. Communicate clearly and document every architectural decision.

---

## 2. LIQUI BRAND DEFINITION

**Brand Name:** Liqui  
**Category:** DeFi Liquidity Pool Intelligence Platform  
**Tagline:** “Master your liquidity.”  
**Essence:** Precision • Transparency • Control  

Liqui helps DeFi liquidity providers monitor, manage, and optimize their Uniswap v3-style positions across multiple DEXes (currently Enosys, SparkDEX, and BlazeFlare).  

Liqui simplifies complex liquidity data into human-readable insights and AI-assisted strategies.

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

## 4. DESIGN SYSTEM

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

## 5. COMPONENT MAPPING (UI + BEHAVIOR)

### Global
- **Header:** Logo (72px) + Tagline + Nav links (Portfolio, Pools, Activity)
- **Footer:** Version info + DEX partners

### Home Page
- Hero banner with key metric cards (TVL, APR, Pools managed)
- CTA button → “Connect Wallet”

### Portfolio Page
- Grid view of user’s LP positions (active + inactive)
- Filters: DEX (Enosys / SparkDEX / BlazeFlare), status, range strategy
- Each position links to detailed pool page

### Pool Detail Page
- **ECharts Range Chart:**  
  - Dynamic Y-axis adjusting to price volatility
  - Time selector (24h, 7D, 1M, 1Y)
  - Blue line (price history), Green dashed lines (min/max), Blue solid (current)
  - Vertical event markers for Mint, Collect, Burn
- **Activity Log Block:** chronological transaction list
- **Claim Button:**  
  - Grey (too early) → `#1E2533`  
  - Orange (can claim) → `#F6A723`  
  - Green (now) → `#3DEE88`

---

## 6. AI COLLABORATION GUIDELINES

| AI | Role | Responsibilities |
|----|------|------------------|
| **Cursor** | Primary dev environment | Executes code, linting, builds features |
| **Codex** | Code reasoning & integration | Ensures structural correctness, data flow logic |
| **Claude** | Documentation & architecture | Maintains clarity and project memory |
| **ChatGPT** | Product, brand, and UX director | Oversees design alignment and conceptual clarity |

**Workflow Principle:**  
> All agents collaborate through a shared understanding of this document before performing edits.

---

## 7. VERSIONING & COMMIT RULES

**Branching:**
- `main`: stable production
- `dev`: integration and testing
- feature branches per module (`feature/chart-range-filter`)

**Commit Guidelines:**
- Follow Conventional Commits (`feat:`, `fix:`, `docs:`)
- Include `[state:sync]` if commit affects design or brand consistency
- Update `PROJECT_STATE.md` when adding new components or visual tokens

**Release Tags:**
- `vX.Y.Z` format (semantic versioning)
- Include changelog summary in `/docs/CHANGELOG.md`

---

**Liqui — DeFi Liquidity Intelligence**  
_Precision • Transparency • Control_
