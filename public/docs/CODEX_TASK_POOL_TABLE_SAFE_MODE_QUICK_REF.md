# 🎯 Quick Reference: Pool Table SAFE MODE

**Task:** `/docs/CODEX_TASK_POOL_TABLE_SAFE_MODE.md`  
**Scope:** `[data-ll-ui="v2025-10"]`  
**Type:** Non-destructive, scoped enhancement

---

## ⚡ TL;DR

Add scoped 5-column, 2-row Pool Table layout without breaking existing code.

**Key Rule:** Only add `.ll-*` classes under `[data-ll-ui="v2025-10"]` scope.

---

## 🔑 Locked Values

```css
--ll-divider: rgba(110,168,255,0.12);
--ll-min-row-height: 140px;
--ll-aqua: #6EA8FF;
--ll-near-band-buffer: 3%;
```

---

## 📐 Column Structure

| # | Name | Row 1 | Row 2 |
|---|------|-------|-------|
| 1 | Pool | DEX + Icons + Pair + Fee + Range | *(rowspan)* |
| 2 | Liquidity | TVL $ + % | **Slider** + Current price |
| 3 | Unclaimed fees | $ + Button | *(minimal)* |
| 4 | Incentives | $ + Tokens | *(minimal)* |
| 5 | APY / Status | Status dot + label | **APY %** + Share |

---

## 🎨 CSS Classes to Add

```css
.ll-grid              /* Grid container */
.ll-row               /* Row wrapper (min-height 140px) */
.ll-divider           /* Divider between pools */
.ll-specifics-line    /* No-wrap for Pool column */
.ll-minmax            /* Centered range min-max */
.ll-price-slider      /* Range input in Liquidity */
.ll-apy               /* APY block wrapper */
.ll-apy-value         /* APY percentage */
.ll-apy-label         /* "Average 24h APY" */
.ll-btn-primary       /* Share button */
.ll-status-dot        /* Status indicator dot */
.ll-tabular           /* Tabular numerals */
```

---

## ✅ Acceptance Checklist

- [ ] Headers: Pool | Liquidity | Unclaimed fees | Incentives | APY / Status
- [ ] Rows: min-height 140px
- [ ] Dividers: rgba(110,168,255,0.12)
- [ ] Slider: Only in Liquidity, marker = status color
- [ ] APY: Spacing 12-16px, tabular-nums, Share button
- [ ] No global overrides outside scope

---

## 🚀 Quick Start

1. Add `data-ll-ui="v2025-10"` to table root
2. Copy CSS from main task doc
3. Add `.ll-*` classes to markup
4. Test all acceptance criteria
5. Create PR: `feat/pooltable-5col-safe-mode`

---

**Full Spec:** `/docs/CODEX_TASK_POOL_TABLE_SAFE_MODE.md`

