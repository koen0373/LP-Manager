# 🔧 CODEX TASK — Pool Table SAFE MODE Patch (Non-Destructive)

**Task ID:** `POOL-TABLE-SAFE-MODE-v2025-10`  
**Assigned to:** Codex (Engineering & Integration)  
**Priority:** High  
**Type:** Feature + Scoped UI Enhancement  
**Status:** Ready for Implementation

---

## 📋 Executive Summary

Implement a **scoped, non-destructive** 5-column, 2-row Pool Table layout under a single data attribute (`data-ll-ui="v2025-10"`). This patch:

- ✅ **Locks the current structure** (no renames, no removals)
- ✅ **Adds scoped classes only** (`.ll-*` prefix)
- ✅ **Preserves existing styles** (no global overrides)
- ✅ **Maintains handover locks** (divider color, min-height, slider specs, APY spacing)

---

## 🎯 Intent (Non-Negotiable)

We **intentionally ship** a 5-column, 2-row Pool Table:

| Column | Row 1 | Row 2 |
|--------|-------|-------|
| **1. Pool** | DEX + Pool ID + Icons + Pair + Fee + Range | *(rowspan continues)* |
| **2. Liquidity** | TVL $ + % share | **Range slider** + Current price |
| **3. Unclaimed fees** | $ value + "Claim fees" button | *(empty or minimal)* |
| **4. Incentives** | $ value + token breakdown | *(empty or minimal)* |
| **5. APY / Status** | Range status (dot + label) | **APY %** + label + Share button |

---

## 🚨 SAFEGUARDS (Must Follow)

### 1. Scoping Rule
- **ALL new styles** must be scoped under `[data-ll-ui="v2025-10"]`
- **NO global selectors** (e.g., `button`, `input[type=range]`) outside this scope
- Only add `.ll-*` prefixed classes; **DO NOT** change existing class names

### 2. Layout Preservation
- **DO NOT** change column count or DOM structure
- **DO NOT** remove existing classes or elements
- **ONLY ADD** new classes, attributes, and scoped styles

### 3. Conflict Resolution
- If any selector conflict is detected, **prefer keeping the current look**
- This patch is **opt-in** via the data attribute

### 4. Handover Locks (From `PROJECT_STATE.md`)
These values are **locked** and must be preserved:

```css
/* Locked values from handover */
--ll-divider: rgba(110,168,255,0.12);    /* Divider color */
--ll-min-row-height: 140px;               /* Minimum row height */
--ll-aqua: #6EA8FF;                       /* Primary brand color */
--ll-near-band-buffer: 3%;                /* Range status calculation */
--ll-apy-spacing: 12px 16px;             /* APY block spacing */
```

**Slider specs:**
- Thin baseline (2px height)
- Single marker (12px diameter)
- Marker color = status color (green/orange/red)
- Background: `rgba(110,168,255,0.12)`

**Button specs:**
- Base: `#6EA8FF`
- Hover: Soft glow `0 0 24px rgba(110,168,255,0.35)`
- Focus: `2px solid #6EA8FF` outline with `2px` offset

---

## 🔨 Implementation Steps

### A) Add Data Attribute to Root

Locate the Pool Table root container and add the scoping attribute:

```tsx
<section 
  className="PoolTableRoot pool-table w-full overflow-x-auto rounded-lg"
  data-ll-ui="v2025-10"
  style={{
    background: 'linear-gradient(180deg, rgba(10, 15, 26, 0.75) 0%, rgba(10, 15, 26, 0.92) 100%)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
  }}
>
  {/* Table content */}
</section>
```

---

### B) Update Column Headers (Add-Only)

Ensure headers read **exactly**:

1. **Pool**
2. **Liquidity**
3. **Unclaimed fees**
4. **Incentives**
5. **APY / Status**

If using `<table>`:
```tsx
<thead>
  <tr>
    <th scope="col">Pool</th>
    <th scope="col">Liquidity</th>
    <th scope="col">Unclaimed fees</th>
    <th scope="col">Incentives</th>
    <th scope="col">APY / Status</th>
  </tr>
</thead>
```

If using `<div>` grid, add ARIA roles:
```tsx
<div role="table">
  <div role="row" className="ll-grid ll-header">
    <div role="columnheader">Pool</div>
    <div role="columnheader">Liquidity</div>
    <div role="columnheader">Unclaimed fees</div>
    <div role="columnheader">Incentives</div>
    <div role="columnheader">APY / Status</div>
  </div>
</div>
```

---

### C) Add Scoped CSS Utilities

**Location:** Add to `src/styles/globals.css` or create `src/styles/pool-table-safe-mode.css`

```css
/* ============================================
   POOL TABLE SAFE MODE v2025-10
   Scoped under [data-ll-ui="v2025-10"]
   ============================================ */

/* CSS Custom Properties */
[data-ll-ui="v2025-10"] {
  --ll-aqua: #6EA8FF;
  --ll-divider: rgba(110,168,255,0.12);
  --ll-min-row-height: 140px;
}

/* Grid Layout */
[data-ll-ui="v2025-10"] .ll-grid {
  display: grid;
  grid-template-columns: 1.6fr 1.2fr 1.1fr 1.2fr 1.1fr;
  column-gap: 24px;
}

@media (max-width: 1024px) {
  [data-ll-ui="v2025-10"] .ll-grid {
    grid-template-columns: 1.4fr 1.1fr 1fr 1.1fr 1fr;
  }
}

/* Row Styling */
[data-ll-ui="v2025-10"] .ll-row {
  min-height: var(--ll-min-row-height);
}

/* Divider */
[data-ll-ui="v2025-10"] .ll-divider {
  border-color: var(--ll-divider);
  height: 0.5px;
  width: 100%;
  background: var(--ll-divider);
  margin: 12px 0;
}

/* Pool Column (Specifics) */
[data-ll-ui="v2025-10"] .ll-specifics-line {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

[data-ll-ui="v2025-10"] .ll-minmax {
  text-align: center;
  font-size: 13px;
  color: #B0B9C7;
  line-height: 1.4;
}

/* Range Slider (Liquidity Col, Row 2) */
[data-ll-ui="v2025-10"] .ll-price-slider {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  height: 2px;
  background: var(--ll-divider);
  border-radius: 1px;
  outline: none;
  cursor: pointer;
}

[data-ll-ui="v2025-10"] .ll-price-slider:focus-visible {
  outline: 2px solid var(--ll-aqua);
  outline-offset: 2px;
}

/* Slider Thumb */
[data-ll-ui="v2025-10"] .ll-price-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--status-color);
  border: 0;
  box-shadow: 0 0 0 2px rgba(10,15,26,0.85);
  cursor: pointer;
}

[data-ll-ui="v2025-10"] .ll-price-slider::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--status-color);
  border: 0;
  box-shadow: 0 0 0 2px rgba(10,15,26,0.85);
  cursor: pointer;
}

/* APY Block */
[data-ll-ui="v2025-10"] .ll-apy {
  margin-top: 12px;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}

[data-ll-ui="v2025-10"] .ll-apy-value {
  font-size: 1.25rem; /* 20px */
  font-weight: 600;
  color: #E6E9EF;
}

[data-ll-ui="v2025-10"] .ll-apy-label {
  font-size: 0.875rem; /* 14px */
  color: #B0B9C7;
  opacity: 0.9;
  line-height: 1.4;
  margin-top: 4px;
}

/* Primary Button (Scoped) */
[data-ll-ui="v2025-10"] .ll-btn-primary {
  background: var(--ll-aqua);
  color: white;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  border: none;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.1s ease;
}

[data-ll-ui="v2025-10"] .ll-btn-primary:hover {
  box-shadow: 0 0 24px rgba(110,168,255,0.35);
  transform: translateY(-1px);
}

[data-ll-ui="v2025-10"] .ll-btn-primary:active {
  transform: translateY(0);
}

[data-ll-ui="v2025-10"] .ll-btn-primary:focus-visible {
  outline: 2px solid var(--ll-aqua);
  outline-offset: 2px;
}

/* Status Dot (Decorative) */
[data-ll-ui="v2025-10"] .ll-status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
}

/* Tabular Numbers Utility */
[data-ll-ui="v2025-10"] .ll-tabular {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

---

### D) Update Component Markup (Add Classes Only)

**Component:** `src/components/PositionsTable.tsx`

#### Grid Wrapper
```tsx
<div className="ll-grid" role="row">
  {/* Cell content */}
</div>
```

#### Row Structure
```tsx
{/* ROW 1 */}
<tr className="ll-row pool-row-1" data-pool-id={position.tokenId}>
  {/* Cells */}
</tr>

{/* ROW 2 */}
<tr className="ll-row pool-row-2" data-pool-id={position.tokenId}>
  {/* Cells */}
</tr>

{/* DIVIDER */}
<tr>
  <td colSpan={5}>
    <div className="ll-divider" />
  </td>
</tr>
```

#### Pool Column (Column 1)
```tsx
<td rowSpan={2} className="px-6 py-8 align-top">
  <div className="flex flex-col gap-4 font-ui">
    {/* Pool Label */}
    <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9AA1AB]/50">Pool</div>
    
    {/* DEX Name & Pool ID */}
    <div className="ll-specifics-line text-[11px] font-medium uppercase tracking-wider text-[#9AA1AB]/70">
      {position.dexName} <span className="text-white/20">•</span> {position.poolId}
    </div>

    {/* Icons + Pool Pair + Fee */}
    <div className="ll-specifics-line flex items-center gap-3">
      {/* Token icons */}
      <div className="flex flex-col gap-0.5">
        <span className="font-ui text-base font-medium text-white" style={{ letterSpacing: '0.01em' }}>
          {position.token0Symbol} / {position.token1Symbol}
        </span>
        <span className="font-ui text-[11px] text-[#B0B9C7]" style={{ lineHeight: '1.4' }}>
          Fee: {position.feeTier}
        </span>
      </div>
    </div>

    {/* Range (min–max) */}
    <div className="ll-minmax">
      {position.rangeMin !== undefined && position.rangeMax !== undefined
        ? `${position.rangeMin.toFixed(5)} – ${position.rangeMax.toFixed(5)}`
        : '—'}
    </div>
  </div>
</td>
```

#### Liquidity Column (Column 2)

**Row 1:**
```tsx
<td className="px-5 py-6" data-pool-id={position.tokenId}>
  <div className="flex flex-col gap-2.5 font-ui">
    <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9AA1AB]/50">Liquidity</div>
    <div className="flex flex-col gap-0.5">
      <div className="ll-tabular text-[17px] font-semibold text-white/95">
        {formatUsd(position.liquidityUsd)}
      </div>
      {position.liquidityShare !== undefined && (
        <div className="ll-tabular text-[11px] text-[#B0B9C7]" style={{ lineHeight: '1.4' }}>
          ({position.liquidityShare.toFixed(2)}%)
        </div>
      )}
    </div>
  </div>
</td>
```

**Row 2 (Range Slider):**
```tsx
<td colSpan={2} className="px-5" style={{ paddingTop: '16px', paddingBottom: '12px' }} data-pool-id={position.tokenId}>
  <div className="flex flex-col gap-2">
    <label 
      id={`price-label-${position.tokenId}`}
      className="text-[10px] font-semibold uppercase tracking-widest text-[#9AA1AB]/50 text-center"
    >
      Current Price
    </label>
    <input
      type="range"
      className="ll-price-slider"
      aria-labelledby={`price-label-${position.tokenId}`}
      min={position.rangeMin}
      max={position.rangeMax}
      value={position.currentPrice}
      disabled
      style={{ 
        '--status-color': STATUS_COLORS[position.status] 
      } as React.CSSProperties}
    />
    <div className="ll-tabular text-center text-sm text-white/90">
      {position.currentPrice?.toFixed(5) ?? '—'}
    </div>
  </div>
</td>
```

#### APY / Status Column (Column 5)

**Row 1 (Status):**
```tsx
<td className="px-5 py-6" data-pool-id={position.tokenId}>
  <div 
    role="status" 
    aria-live="polite"
    className="flex items-center justify-center gap-2 font-ui"
  >
    <span 
      className="ll-status-dot" 
      style={{ background: statusMeta.dotColor }}
      aria-hidden="true"
    />
    <span className="text-sm font-medium text-white">
      {statusMeta.label}
    </span>
  </div>
</td>
```

**Row 2 (APY):**
```tsx
<td className="px-5" style={{ paddingTop: '16px', paddingBottom: '12px' }} data-pool-id={position.tokenId}>
  <div className="ll-apy flex flex-col">
    <div className="text-[10px] font-semibold uppercase tracking-widest text-[#9AA1AB]/50">APY</div>
    <div className="ll-apy-value ll-tabular mt-2">
      {position.apy?.toFixed(1) ?? '12.4'}%
    </div>
    <div className="ll-apy-label">
      Average 24h APY
    </div>
    <div className="mt-3 flex justify-end">
      <button 
        className="ll-btn-primary"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          // TODO: Implement share functionality
          alert('Share to X - coming soon!');
        }}
        title="Share your LiquiLab APY snapshot on X"
      >
        Share
      </button>
    </div>
  </div>
</td>
```

---

### E) Accessibility Enhancements

#### Table Semantics
If using `<div>` grid instead of `<table>`:
```tsx
<div role="table" aria-label="Liquidity pool positions">
  <div role="rowgroup">
    <div role="row" className="ll-grid ll-header">
      <div role="columnheader">Pool</div>
      <div role="columnheader">Liquidity</div>
      <div role="columnheader">Unclaimed fees</div>
      <div role="columnheader">Incentives</div>
      <div role="columnheader">APY / Status</div>
    </div>
  </div>
  <div role="rowgroup">
    {/* Data rows */}
  </div>
</div>
```

#### Range Slider
- **Label association:** Use `aria-labelledby` to link slider to label
- **Value announcement:** Consider adding `aria-valuetext` for screen readers
- **Disabled state:** Add `disabled` attribute to prevent interaction

#### Status Indicator
- **Live region:** `role="status"` + `aria-live="polite"` for dynamic updates
- **Color independence:** Always pair colored dots with text labels

---

## ✅ Acceptance Tests

### Must Pass Before PR Approval

1. **Headers**
   - [ ] Headers read exactly: `Pool | Liquidity | Unclaimed fees | Incentives | APY / Status`
   - [ ] Headers use semantic `<th scope="col">` or `role="columnheader"`

2. **Row Heights**
   - [ ] Both visual rows per pool have `min-height ≥ 140px`
   - [ ] Row heights remain consistent across all pools

3. **Dividers**
   - [ ] All dividers compute to `rgba(110,168,255,0.12)`
   - [ ] Dividers are 0.5px high with rounded corners

4. **Range Slider**
   - [ ] Slider appears **only in Liquidity column, Row 2**
   - [ ] Slider baseline is 2px height, `rgba(110,168,255,0.12)` background
   - [ ] Marker is 12px diameter, rounded
   - [ ] Marker color equals status color (green/orange/red)
   - [ ] "Current Price" label above slider
   - [ ] Numeric value below slider with tabular-nums

5. **Pool Column (Specifics)**
   - [ ] First line (DEX + Pool ID + Pair + Fee) never wraps
   - [ ] Min–max range is centered below
   - [ ] Text uses `text-overflow: ellipsis` if too long

6. **APY Block**
   - [ ] Shows ≥12px spacing between elements
   - [ ] Numerals use `font-variant-numeric: tabular-nums`
   - [ ] "Average 24h APY" label is present and styled
   - [ ] Share button is visible and right-aligned

7. **Primary CTAs**
   - [ ] Use `#6EA8FF` base color
   - [ ] Hover shows glow: `0 0 24px rgba(110,168,255,0.35)`
   - [ ] Focus shows visible ring: `2px solid #6EA8FF` with `2px` offset
   - [ ] Only applies inside `[data-ll-ui="v2025-10"]` scope

8. **No Regressions**
   - [ ] No changes outside `[data-ll-ui="v2025-10"]` scope
   - [ ] Existing classes and styles remain intact
   - [ ] Glass/blur background still renders correctly
   - [ ] Hover effects on pool rows still work

---

## 📦 Deliverable

### PR Details
- **Branch name:** `feat/pooltable-5col-safe-mode`
- **PR title:** `feat: Pool Table 5-column SAFE MODE layout (scoped, non-destructive)`
- **Labels:** `enhancement`, `ui`, `safe-mode`, `scoped`

### Files Changed
- [ ] `src/components/PositionsTable.tsx` (add data attribute, classes)
- [ ] `src/styles/globals.css` or new `src/styles/pool-table-safe-mode.css`
- [ ] `src/types/positions.ts` (if adding `apy` field)
- [ ] `docs/PROJECT_STATE.md` (append changelog)

### PR Description Template
```markdown
## Summary
Implements a scoped, non-destructive 5-column Pool Table layout under `data-ll-ui="v2025-10"`.

## Changes
- ✅ Added scoped CSS utilities with `.ll-*` prefix
- ✅ Preserved all existing classes and styles
- ✅ Added data attribute to Pool Table root
- ✅ Implemented range slider in Liquidity column
- ✅ Added APY block with Share button
- ✅ Enhanced accessibility with ARIA attributes
- ✅ Maintained handover locks (divider color, min-height, slider specs)

## Testing
- [x] Headers match specification
- [x] Row heights ≥ 140px
- [x] Dividers render rgba(110,168,255,0.12)
- [x] Slider marker color = status color
- [x] APY spacing + tabular numerals
- [x] No regressions outside scope
- [x] Accessibility tests pass

## Screenshots
[Add before/after screenshots]

## Related
- Spec: `/docs/CODEX_TASK_POOL_TABLE_SAFE_MODE.md`
- Locks: `/docs/PROJECT_STATE.md` — Pool Table section
```

---

## 📝 Documentation Update

After PR merge, append to `/docs/PROJECT_STATE.md`:

```markdown
**October 26, 2025 — Pool Table: 5-column layout (SAFE MODE, scoped):**

**Summary:**  
Locked a 5-column / 2-row Pool Table under `data-ll-ui="v2025-10"`, with divider `rgba(110,168,255,0.12)`, `min-height: 140px`, single-marker slider (marker = status color), 3% near-band, APY spacing + tabular numerals, and scoped primary button style.

**Changes:**
- `add(scope)`: `data-ll-ui="v2025-10"` root attribute; all new classes prefixed `.ll-*`
- `style(table)`: Scoped dividers `rgba(110,168,255,0.12)`; row `min-height: 140px`
- `feat(range)`: Range slider in Liquidity column, Row 2; marker bound to status color
- `style(apy)`: APY block with 12-16px spacing + tabular-nums; Share button added
- `a11y`: Labeled range input with `aria-labelledby`; status with `role="status"`
- `style(buttons)`: Scoped primary button (`#6EA8FF` + hover glow + focus ring)

**Technical Details:**
- **Scope:** All styles under `[data-ll-ui="v2025-10"]` selector
- **Non-destructive:** No global overrides, no DOM restructuring, no class removals
- **Handover locks preserved:** Divider color, min-height, slider specs, APY spacing, button styles

**Files Modified:**
- `src/components/PositionsTable.tsx`
- `src/styles/pool-table-safe-mode.css` (new)
- `docs/CODEX_TASK_POOL_TABLE_SAFE_MODE.md` (new spec)

**Notes:**  
This implementation maintains backward compatibility while introducing the locked 5-column layout. The scoped approach allows for future iterations without breaking existing functionality.
```

---

## 🧪 Testing Checklist

### Visual Tests
- [ ] Run dev server: `npm run dev`
- [ ] Navigate to pool table page
- [ ] Verify 5 columns with correct headers
- [ ] Verify 2 rows per pool (min 140px each)
- [ ] Check divider color with DevTools: should be `rgba(110,168,255,0.12)`
- [ ] Verify slider appears only in Liquidity column, Row 2
- [ ] Check slider marker color matches status (green/orange/red)
- [ ] Verify APY block spacing and tabular-nums
- [ ] Test Share button hover and focus states

### Accessibility Tests
- [ ] Tab through table with keyboard
- [ ] Verify focus indicators are visible (2px aqua outline)
- [ ] Use screen reader to announce headers and status
- [ ] Verify slider is labeled correctly
- [ ] Check color contrast with WCAG tool (≥ 4.5:1)

### Responsive Tests
- [ ] Desktop (≥1280px): 5-column grid visible
- [ ] Tablet (1024px): Adjusted grid-template-columns
- [ ] Mobile (<768px): Consider fallback layout if needed

### Browser Tests
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

---

## 🔗 Related Documentation

- **Brand Guidelines:** `/docs/STYLEGUIDE.md`
- **Project State:** `/docs/PROJECT_STATE.md`
- **AI Protocol:** `/docs/PROJECT_STATE.md` — AI Collaboration Protocol
- **Component:** `src/components/PositionsTable.tsx`
- **Types:** `src/types/positions.ts`

---

## 🆘 Support & Questions

If you encounter issues during implementation:

1. **Check handover locks** in `/docs/PROJECT_STATE.md`
2. **Review existing styles** in `src/components/PositionsTable.tsx`
3. **Verify data attribute** is applied to root container
4. **Test scoped selectors** in browser DevTools
5. **Ask for clarification** if specs are unclear

---

**Task Created:** October 26, 2025  
**Last Updated:** October 26, 2025  
**Assigned to:** Codex (Engineering)  
**Estimated Time:** 2-3 hours  
**Priority:** High

