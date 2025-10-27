# LiquiLab Brand Assets

This folder contains all official LiquiLab logo and branding assets.

## Current Status

**Implementation:** CSS-based placeholder  
**Ready for production:** Yes (placeholder)  
**Custom assets:** To be created by designer

---

## Available Assets

### Logos

- **`liquilab-mark.svg`** — Water droplet icon (24-48px)
  - Used standalone in compact spaces
  - Colors: `#6EA8FF` (aqua) with `#78B5FF` reflection

### Coming Soon

The following assets will be created when custom SVG designs are available:

- `liquilab-wordmark.svg` — LiquiLab text only
- `liquilab-lockup-dark.svg` — Full logo + tagline (dark backgrounds)
- `liquilab-lockup-light.svg` — Full logo + tagline (light backgrounds)
- `liquilab-wordmark@2x.png` — Retina PNG fallback
- `social-card-lockup.png` — 1200×630px for social media

### Favicons (Coming Soon)

- `favicon/favicon.svg` — SVG favicon
- `favicon/favicon-32.png` — 32×38px PNG
- `favicon/favicon-180.png` — 180×216px Apple touch icon

---

## Usage

### In Code

```tsx
import { LiquiLabLogo, LiquiLabLogoLockup } from '@/components/LiquiLabLogo';

// Small navbar logo (mark + wordmark)
<LiquiLabLogo variant="full" size="sm" theme="dark" />

// Mark only (compact spaces)
<LiquiLabLogo variant="mark-only" size="md" theme="dark" />

// Hero with tagline
<LiquiLabLogoLockup size="lg" theme="dark" />
```

### Sizes

| Size | Use Case | Mark Width |
|------|----------|------------|
| `sm` | Navbar, headers | 24px |
| `md` | Default, content | 32px |
| `lg` | Hero, landing | 48px |

### Themes

- **Dark mode (default):** Wordmark `#E6E9EF`, droplet `#6EA8FF`
- **Light mode:** Wordmark `#0A0F1C`, droplet `#3F8FFF`

---

## Design Guidelines

See `/docs/STYLEGUIDE.md` for complete specifications:

- Clear space & minimum sizes
- Color specifications (dark/light)
- Typography (Quicksand SemiBold, -1.5% tracking)
- Lockup rules (logo + tagline)
- Forbidden usage (no rotation, gradients, etc.)

---

## For Designers

When creating custom SVG assets:

1. **Base font:** Quicksand SemiBold (Google Fonts)
2. **Customizations:**
   - Unique 'q' tail (flowing, water-like curve)
   - Larger i-dots (1.2× standard size, rounded)
   - Optical kerning for L-i, i-q, L-a pairs
3. **Export requirements:**
   - SVG with outlined paths (no font dependencies)
   - Optimized with svgo, no hidden layers
   - Include `aria-label` and `role="img"`
4. **Deliverables:** See export checklist in `/docs/STYLEGUIDE.md`

---

## Version History

- **v1.0 (Oct 26, 2025):** Initial placeholder implementation
  - CSS-based wordmark using Quicksand font
  - SVG water droplet icon
  - Component system with variants & themes

---

**Questions?** See `/docs/STYLEGUIDE.md` or `/docs/PROJECT_STATE.md`

