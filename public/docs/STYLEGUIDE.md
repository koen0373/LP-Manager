# LiquiLab Style Guide

## Logo & Wordmark (Quicksand-Based Placeholder)

**Status:** CSS-based placeholder implementation  
**Future:** Will be replaced with custom SVG assets with outlined paths

---

### Brand Assets

All logo assets are located in `/public/brand/`:

```
/public/brand/
  ├── liquilab-mark.svg              # Water droplet mark only
  ├── liquilab-wordmark.svg          # (To be created: custom Quicksand wordmark)
  ├── liquilab-lockup-dark.svg       # (To be created: full lockup for dark backgrounds)
  ├── liquilab-lockup-light.svg      # (To be created: full lockup for light backgrounds)
  └── favicon/
      ├── favicon.svg                # (To be created)
      ├── favicon-32.png             # (To be created)
      └── favicon-180.png            # (To be created)
```

---

### Current Implementation

#### Component Usage

```tsx
import { LiquiLabLogo, LiquiLabLogoLockup } from '@/components/LiquiLabLogo';

// Logo only (mark + wordmark)
<LiquiLabLogo variant="full" size="sm" theme="dark" />

// Mark only (water droplet)
<LiquiLabLogo variant="mark-only" size="md" theme="dark" />

// Wordmark only (LiquiLab text)
<LiquiLabLogo variant="wordmark-only" size="lg" theme="light" />

// Logo with tagline lockup
<LiquiLabLogoLockup size="md" theme="dark" />
```

#### Sizes

| Size | Use Case | Mark Width | Wordmark Size |
|------|----------|------------|---------------|
| `sm` | Navbar, compact headers | 24px | text-xl (20px) |
| `md` | Default, content blocks | 32px | text-2xl (24px) |
| `lg` | Hero, landing pages | 48px | text-4xl (36px) |

---

### Color Specifications

#### Dark Mode (Default)
- **Wordmark:** `#E6E9EF` (light gray-white)
- **Droplet:** `#6EA8FF` (LiquiLab aqua)
- **Droplet Reflection:** `#78B5FF` (lighter aqua, 40% opacity)
- **Tagline:** `#9FA8B6` (muted gray)

#### Light Mode
- **Wordmark:** `#0A0F1C` (LiquiLab navy)
- **Droplet:** `#3F8FFF` (darker aqua for contrast)
- **Tagline:** `#2D3642` (dark gray)

#### Contrast Requirements
- All logo variations maintain **≥ 4.5:1** contrast ratio with background
- Tested for WCAG AA compliance

---

### Typography

#### Wordmark
- **Font Family:** Quicksand (Google Fonts)
- **Weight:** SemiBold (600)
- **Letter Spacing:** `-0.015em` (-1.5%)
- **Case:** CamelCase (`LiquiLab`)

#### Tagline
- **Font Family:** Inter (Google Fonts)
- **Weight:** Medium (500)
- **Size:** 14px (default), 16px (large lockup)
- **Color:** `#9FA8B6` (dark mode), `#2D3642` (light mode)
- **Line Height:** 1.4
- **Max Width:** 280px
- **Text:** "The easy way to manage your liquidity pools."

---

### Clear Space & Minimum Size

#### Clear Space
- **Minimum clear space:** 1× droplet width on all sides
- **Recommended:** 1.5× droplet width for comfortable breathing room

#### Minimum Sizes
- **Desktop/Tablet:** 24px height (sm size) — safe for all use cases
- **Mobile (≥16px):** Use mark-only variant for very small spaces
- **Favicon:** 32px × 38px minimum (mark only)

#### Size Breakpoints
```css
/* Desktop */
@media (min-width: 1024px) {
  logo-size: sm (24px) or md (32px)
}

/* Mobile */
@media (max-width: 640px) {
  logo-size: sm (24px)
  variant: mark-only (if space < 120px width)
}
```

---

### Lockup Specifications

#### Logo + Tagline Lockup

**Spacing:**
- Gap between logo and tagline: Equal to capital "L" height
- Tagline positioned below logo baseline
- Tagline centered horizontally with logo

**Usage:**
- Hero sections
- Landing pages
- Footer (when space permits)
- Marketing materials

**Do NOT use lockup when:**
- Height < 80px
- Width < 240px
- In navigation bars

---

### Forbidden Usage

❌ **DO NOT:**

1. **Rotate, skew, or distort** the logo or wordmark
2. **Apply drop shadows, outlines, or stroke effects**
3. **Use color gradients** in the wordmark (solid colors only)
4. **Combine with other icons** next to the droplet
5. **Adjust letter spacing** beyond `-3%` to `+2%`
6. **Rewrite or shorten** the tagline
7. **Place logo on low-contrast backgrounds** (contrast must be ≥ 4.5:1)
8. **Use bitmap logos** where vector (SVG) is available
9. **Animate the wordmark** (droplet may animate subtly)
10. **Use outdated logo files** (always use `/public/brand/` assets)

---

### Future Custom Wordmark Specifications

When custom SVG assets are created, the following modifications will be applied to the Quicksand base:

#### Unique Customizations
1. **'q' tail:** Subtly curved, flowing downward (water reference)
2. **'i' dots:** Rounded, slightly larger (1.2× standard dot size)
3. **'L' capitals:** Optical kerning adjustment for L-i and L-a pairs
4. **'b' tail:** Consistent curve with 'q' for visual harmony

#### Technical Requirements
- **Format:** SVG with outlined paths (no font dependencies)
- **Accessibility:** `aria-label="LiquiLab logo"` and `role="img"`
- **Optimization:** Minified with svgo, no hidden layers
- **ViewBox:** Optimized for 1:1 aspect ratio (square mark, ~4:1 wordmark)

---

### Export Checklist (For Future Designer)

When creating custom assets, deliver:

- [ ] `liquilab-wordmark.svg` (outlined paths)
- [ ] `liquilab-mark.svg` (droplet only, updated if needed)
- [ ] `liquilab-lockup-dark.svg` (logo + tagline, dark bg)
- [ ] `liquilab-lockup-light.svg` (logo + tagline, light bg)
- [ ] `liquilab-wordmark@2x.png` (2× retina PNG fallback)
- [ ] `liquilab-lockup-dark@2x.png`
- [ ] `liquilab-lockup-light@2x.png`
- [ ] `social-card-lockup.png` (1200×630px for X/LinkedIn)
- [ ] `favicon.svg` (mark only, optimized)
- [ ] `favicon-32.png` (32×38px)
- [ ] `favicon-180.png` (180×216px for Apple touch icon)
- [ ] Preview renders (navbar, hero usage)

---

### Related Documentation

- **Brand Foundation:** `/docs/PROJECT_STATE.md` — Brand Definition section
- **Implementation:** `/src/components/LiquiLabLogo.tsx`
- **Assets:** `/public/brand/`

---

## Color System

### Primary Brand Colors

| Color Name | HEX | RGB | Usage |
|------------|-----|-----|-------|
| **Signal Aqua** | `#1BE8D2` | `27, 232, 210` | Checkmarks, success signals, decorative accents |
| **LiquiLab Navy** | `#0A0F1C` | `10, 15, 28` | Background, depth |
| **Slate Grey** | `#1E2533` | `30, 37, 51` | Cards, UI surfaces |
| **Electric Blue** | `#3B82F6` | `59, 130, 246` | Primary actions, links, hover/focus states |
| **Accent Green** | `#00C66B` | `0, 198, 107` | Success, In Range status |
| **Accent Orange** | `#FFA500` | `255, 165, 0` | Warning, Near Band status |
| **Accent Red** | `#E74C3C` | `231, 76, 60` | Error, Out of Range status |
| **LiquiLab Mist** | `#9CA3AF` | `156, 163, 175` | Secondary text, muted UI |

### Semantic Colors

- **Success / In Range:** `#00C66B` (green)
- **Warning / Near Band:** `#FFA500` (orange)  
- **Error / Out of Range:** `#E74C3C` (red)
- **Info / Neutral:** `#3B82F6` (electric blue)

---

## Typography

### Font Families

```css
/* Brand Typography (Quicksand) */
--font-brand: 'Quicksand', system-ui, sans-serif;

/* UI Typography (Inter) */
--font-ui: 'Inter', system-ui, sans-serif;

/* Code/Monospace (JetBrains Mono) */
--font-mono: 'JetBrains Mono', 'Courier New', monospace;
```

### Usage Guidelines

| Element | Font | Weight | Size | Usage |
|---------|------|--------|------|-------|
| **Logo** | Quicksand | 600 (SemiBold) | Variable | Brand wordmark |
| **Hero Headlines** | Quicksand | 600-700 | 36-48px | Landing pages |
| **Section Titles** | Quicksand | 600 | 24-32px | Page sections |
| **Body Text** | Inter | 400-500 | 14-16px | Paragraphs, UI copy |
| **Data Tables** | Inter | 400-600 | 14-17px | Pool tables, metrics |
| **Labels** | Inter | 500-600 | 10-12px | Form labels, tags |
| **Buttons** | Inter | 500-600 | 14-16px | CTAs, actions |
| **Code** | JetBrains Mono | 400 | 13-14px | Technical text |

### Tabular Numbers

```css
.tnum {
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

Apply `.tnum` to all numeric columns in tables (TVL, fees, APY, etc.) for perfect alignment.

---

## Spacing & Layout

### Baseline Grid
- **Grid unit:** 8px
- All vertical spacing should be multiples of 8px: `gap-2` (8px), `gap-4` (16px), `gap-6` (24px), etc.

### Container Widths (Responsive)

| Breakpoint | Container Width | Usage |
|------------|-----------------|-------|
| Mobile (<1024px) | 94vw | Full-width content |
| Tablet (1024-1279px) | 88vw | Moderate breathing room |
| Desktop (1280-1599px) | 75vw | Centered, balanced |
| Ultrawide (≥1600px) | 70vw | Prevents overstretching |

### Common Spacing Values

```css
/* Tight grouping */
gap-0.5: 2px
gap-1: 4px

/* Standard spacing */
gap-2: 8px
gap-3: 12px
gap-4: 16px

/* Section separation */
gap-6: 24px
gap-8: 32px
gap-12: 48px
```

---

## "Water Under Glass" Aesthetic

### Glassmorphism Specifications

```css
.glass-block {
  background: rgba(10, 15, 26, 0.88);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}
```

### Background Layer

```css
.page-bg {
  position: fixed;
  inset: 0;
  z-index: -1;
  background: linear-gradient(
    180deg, 
    #0A0F1A 0%, 
    #0A0F1A 40%, 
    rgba(10, 15, 26, 0.5) 50%, 
    transparent 100%
  ),
  url('/wave-hero.png');
  background-size: cover;
  background-position: center bottom;
  background-attachment: fixed;
}
```

### Design Principles
1. **Transparency:** Content overlays are 85-92% opaque
2. **Blur:** 10-12px backdrop blur for depth
3. **Borders:** Subtle 1px borders at 5% white opacity
4. **Background:** Always visible water texture beneath content

---

## Motion & Animation

### Animation Principles
- **Duration:** 200-300ms for micro-interactions, 2-3s for ambient animations
- **Easing:** `ease-in-out` for smooth, calm transitions
- **Keyframes:** Defined in `tailwind.config.js`

### Status Indicator Animations

```css
/* Green (In Range) */
@keyframes pulse-green {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}

/* Orange (Near Band) */
@keyframes glow-orange {
  0%, 100% { 
    opacity: 0.6; 
    box-shadow: 0 0 8px rgba(249,115,22,0.3); 
  }
  50% { 
    opacity: 1; 
    box-shadow: 0 0 16px rgba(249,115,22,0.6); 
  }
}
```

### Usage
- **In Range (green):** Pulsing heartbeat (2s infinite)
- **Near Band (orange):** Slow glow (3s infinite, no scale)
- **Out of Range (red):** Static, no animation

---

## Accessibility

### Contrast Requirements
- **Body text:** ≥ 4.5:1 (WCAG AA)
- **Large text (≥18px):** ≥ 3:1 (WCAG AA)
- **Interactive elements:** ≥ 4.5:1

### Focus States
```css
.focus-visible {
  outline: 2px solid #6EA8FF;
  outline-offset: 2px;
}
```

### Screen Reader Support
- All logos include `aria-label` and `role="img"`
- Decorative images marked with `aria-hidden="true"`
- Interactive elements have clear labels

---

**Last Updated:** October 26, 2025  
**Version:** 1.0.0  
**Maintained by:** LiquiLab Design System
