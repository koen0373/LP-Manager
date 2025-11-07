# LiquiLab UI Export Template

Use this template whenever designs are handed off (Figma → Dev, Zeplin, Storybook, etc.). It keeps real pools, demo pools, and future components visually in sync.

## 1. File Naming & Structure
- **Artboards:** `ll-<feature>-<viewport>-v<ver>` (e.g., `ll-pools-table-desktop-v2`).
- **Exports:**
  - PNG (`@1x`, `@2x`) for quick previews.
  - SVG for vector icons & status indicators.
  - WebP (lossless) for token icons (28px desktop / 20px mobile).
- Group assets per state (`/states/in-range`, `/states/near-band`, `/states/out-range`).

## 2. Layout Specs (per artboard)
- Document grid: 5 columns × 2 rows (desktop), mobile stacked version.
- Padding: 16px horizontal, 10px vertical.
- Card radius: 20px desktop, 10px mobile sheet.
- Divider: 1px, `rgba(255,255,255,0.1)`.

Include a small table with:
| Token Pair | Status | Range | Notes |
|------------|--------|-------|-------|
| WFLR / USD₮0 | In Range | 0.01640 – 0.01895 | Live data example |

## 3. Typography & Color Tokens
- **Fonts:** Inter / Manrope — weights 500, 600.
- **Minimum size:** 15px desktop, 13px mobile.
- **Color palette:**
  - Primary text: `#E6E6E6`
  - Secondary text: `#9AA1AB`
  - Background: `#0A0F1A`
  - Accent aqua: gradients `#00E6FF → #007FFF`
  - Status colors: In Range `#00C66B`, Near Band `#FFA500`, Out of Range `#E74C3C`

Export a style guide page listing token names (`color/status/in-range`, `type/body/secondary`, etc.).

## 4. Status & Animation Notes
Provide JSON or markdown snippet with:
```json
{
  "status": "in-range",
  "animation": "heartbeat",
  "durationMs": 1500,
  "opacity": [0.7, 1]
}
```
- Document the gradient bar: `linear-gradient(90deg, #E74C3C, #FFA500, #00C66B, #FFA500, #E74C3C)`.
- Tooltip copy: “Share this pool on X” and aria labels for status dots.

## 5. Interaction States
- Hover overlay: `rgba(0,230,255,0.05)`.
- Focus ring: Aqua 2px.
- Share button hover → border/text `#1BE8D2`.
- Mobile status badge pinned top-right, include offsets in px.

## 6. Export Checklist
- [ ] Desktop + mobile variants exported.
- [ ] All text layers converted to shared styles.
- [ ] Icon exports optimized (no unnecessary metadata).
- [ ] Animation specs included.
- [ ] File version logged in `PROJECT_STATE.md` if major layout shifts occur.

## 7. Reference Links
- Live UI reference: `/features/pools/PoolRow.tsx`
- Demo preview: `/components/waitlist/DemoPoolsPreview.tsx`
- Design system: `PROJECT_STATE.md` (UI Structure & Visual Guidelines)

Keep this template updated whenever we add new statuses, metrics, or interaction patterns.
