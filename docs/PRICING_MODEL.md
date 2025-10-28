# LiquiLab Pricing Model

LiquiLab bills per pool with one simple rule set.

## Core Rules
- **First pool is always free.**
- Every additional pool costs **$1.99 per month**.
- Annual billing charges **10× the monthly amount** (two months free).
- Upgrades take effect instantly and are pro-rated to the end of the current cycle.
- Downgrades take effect at the next renewal.

## Cost Examples
| Pools followed | Free pools | Paid pools | Monthly | Annual |
| -------------- | ---------- | ---------- | ------- | ------ |
| 1              | 1          | 0          | $0.00   | $0.00  |
| 2              | 1          | 1          | $1.99   | $19.90 |
| 7              | 1          | 6          | $11.94  | $119.40 |
| 20             | 1          | 19         | $37.81  | $378.10 |

All monetary values are rounded to two decimals using standard currency rounding.

## Operational Notes
- Seat caps, waitlist, and Fast-Forward toggles remain unchanged.
- Billing previews accept either `activePools` or `desiredCapacity` and surface paid vs. free slots.
- Monthly invoices display the number of paid pools and the first-pool-free credit line.
- Annual invoices capture 10× the monthly total and label the effective monthly equivalent.
- When a user upgrades mid-cycle, only the additional paid pools are charged for the remaining days. Downgrades queue for the next renewal.

Keep all external copy in English. Founder-facing chat remains Dutch.

