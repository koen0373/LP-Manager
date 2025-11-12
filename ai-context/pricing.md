# LiquiLab Pricing Configuration

**As of 2025-11-10**

## Current Pricing Structure

- **Bundles**: Sold in bundles of 5 pools each
- **Alerts**: Priced per bundle (scales with pool bundles)
- **Trial**: 14-day free trial available for PREMIUM and PRO plans
- **Enterprise**: Available on request

## Plans

### VISITOR (Free)
- Price: $0
- Bundles included: 0
- Features: Public info, Demos

### PREMIUM
- Price: $14.95/month
- Bundles included: 1 (5 pools)
- Extra bundle: $9.95 per additional bundle
- Alerts bundle: $2.49 per bundle
- Trial: 14 days
- Features:
  - Unified dashboard
  - Pool details
  - Claim signals
  - RangeBand™ visualization
  - Email alerts (if Alerts add-on is taken)

### PRO
- Price: $24.95/month
- Bundles included: 1 (5 pools)
- Extra bundle: $14.95 per additional bundle
- Alerts bundle: $2.49 per bundle
- Trial: 14 days
- Features:
  - All Premium features
  - Analytics suite
  - Weekly V3 market summary

## Pricing Rules

- Billing cycle: Monthly
- Cancel anytime: Yes
- Alerts scale per bundle
- Enterprise pricing: On request

## Examples

- PREMIUM, 5 pools, no alerts: $14.95
- PREMIUM, 10 pools, with alerts: $29.88
- PRO, 15 pools, with alerts: $62.32

## Important Note for AI Agents

**Agents must read `config/pricing.json` at runtime; do not rely on memory.**

The pricing configuration is maintained as a Single Source of Truth in `config/pricing.json`. Always fetch the latest pricing data from `/api/public/pricing` or import `lib/pricing.ts` rather than hardcoding values.

