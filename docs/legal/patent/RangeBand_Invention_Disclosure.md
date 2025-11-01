---
title: RangeBand™ Invention Disclosure
version: 2025-10-30
confidential: true
---

# RangeBand™ Invention Disclosure

## Title
RangeBand™ – Adaptive Liquidity Band Visualisation and Alerting System for Automated Market Makers.

## Problem
Liquidity providers lack a concise way to monitor concentrated-liquidity positions across protocols. Existing dashboards expose raw tick data, but they do not convey band width, current-price proximity, or risk status in a scannable format. LPs must perform manual calculations to know when to rebalance.

## Prior Art
- **Uniswap v3 UI** – Shows min/max ticks but no status or strategy classification.
- **Third-party dashboards (APY Vision, Revert, DeBank)** – Offer historical analytics yet no real-time range visualisation or cross-pool comparability.
- **Traditional range indicators (e.g., Bollinger Bands)** – Designed for price charts, not liquidity provisioning; none combine range width heuristics with status and strategy labelling.

## Core Idea
RangeBand™ ingests position metadata, computes range width and current-price proximity, classifies the strategy (Aggressive/Balanced/Conservative), and renders a horizontal band with an animated marker. The component simultaneously communicates status (In Range / Near Band / Out of Range) and strategy, enabling rapid triage of positions across wallets.

## Detailed Algorithm
1. **Input:** `lowerPrice`, `upperPrice`, `currentPrice`, TVL, unclaimed fees, incentives.
2. **Range width:** `widthPct = ((upper - lower) / ((upper + lower) / 2)) * 100`.
3. **Strategy classification:**
   - Aggressive `< 12%`
   - Balanced `12–35%`
   - Conservative `> 35%`
4. **Status detection:**
   - In Range: `lower <= current <= upper`
   - Near Band: within ±3% of either boundary
   - Out of Range: outside boundary ±3%
5. **Yield metric:** `apr24h = ((dailyFees + dailyIncentives) / TVL) * 365 * 100`.
6. **Rendering:** Draw proportional band, gradient track, and marker positioned by `(current - lower) / (upper - lower)`. Tooltips and aria labels include strategy, status, min/current/max values.

## Variants
- Compact mobile card stacked vertically.
- Portfolio heatmap showing multiple RangeBand™ micro-cards.
- Exported share card for social media.
- API endpoint returning JSON payload for partner dashboards.

## Edge Cases
- Zero TVL: display placeholder and disable APR.
- Domain-style token symbols: sanitise via labelSanitizer to avoid spoofing.
- Missing price feeds: fall back to midpoint and label data as unavailable.
- Extremely wide ranges: clamp track width for visual balance.

## Implementation Notes
- Front-end: `src/components/pools/PoolRangeIndicator.tsx` (React + Tailwind).
- Utilities: `src/lib/rangeUtils.ts` for strategy/status logic, `src/lib/metrics.ts` for APR.
- Token icons resolved via `tokenIconService` with local fallbacks.
- Accessibility: aria-label summarises product name, strategy, status, min/current/max.

## Claims Draft
1. **Method claim:** Calculating range width, classifying strategy, determining status, and rendering a graphical band with marker indicating current price.
2. **Dependent:** Band width proportional to strategy classification thresholds.
3. **Dependent:** Status transitions trigger alerts and annotations (In Range, Near Band, Out of Range).
4. **Dependent:** APR derived from combined fees and incentives for display alongside the band.
5. **Dependent:** Wallet discovery service feeds candidate positions for demo sampling using the same visualisation.

## Figures List
1. Desktop dashboard row featuring RangeBand™ card.
2. Wallet-connect modal with RangeBand™ inline.
3. Mobile layout of RangeBand™.
4. Annotated diagram labelling min/max/current markers.
5. Flowchart of strategy/status detection.

## Enablement Notes
- Codebase contains full implementation; cloning repo and running `npm run dev` reproduces UI.
- Include screenshots and design specs in Appendix when sending to counsel.
- Provide CSV dataset of sample pools with computed metrics for verification.

## Public Disclosures
- Internal investor demo (NDA) – 2025-10-25.
- Public website preview (https://liquilab.io/demo) – 2025-10-29.
- No open-source release of RangeBand™ algorithms to date.

## Inventor(s)
- [Primary inventor name] — Product & Engineering Lead.
- [Additional inventors, if any] — confirm before filing.

## Contact
- Legal: legal@liquilab.io
- Technical: [inventor email]

---

_Prepared for patent counsel. Update placeholder names/dates and attach supporting exhibits before submission._
