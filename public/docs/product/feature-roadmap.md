# LiquiLab — Feature Roadmap
Advanced Liquidity Provider Dashboard for Flare & EVM Chains
_(Generated from LP feature-planning prompt, 2025-11-07)_

## 🧩 Portfolio & Core Actions
| Feature | Priority | Job-to-be-done | Visual Detail / UX Hook | Reference / Differentiation |
|----------|-----------|----------------|--------------------------|------------------------------|
| Instant Portfolio Overview | Must-have | “I want to see my LP positions, value, and yield immediately after connecting.” | Dark-blue TVL tiles with aqua token icons, live USD value | Gamma-style dashboard, faster refresh (real-time API) |
| RangeBand™ Status | Must-have | “I need to know if I’m in or out of range instantly.” | Green/Red band overlay with animated gradient | Proprietary RangeBand™ algorithm |
| Fee & Incentive Tracker | Must-have | “I want to know what I’ve earned and can claim now.” | Dual token/fiat chip display + ‘Claim’ CTA | Faster API sync than DeBank |
| One-Click Claim/Rebalance | Must-have | “I want to rebalance or claim without switching DEX.” | Slide-up action drawer with DEX links | Integrates partner DEX actions inline |
| Trust Indicators | Must-have | “I want to verify this contract is safe.” | Verified check, explorer link, audit badge | Unique ‘verified pool’ label |

## 🔔 Alerts & Notifications
| Feature | Priority | Job-to-be-done | Visual Detail / UX Hook | Reference / Differentiation |
|----------|-----------|----------------|--------------------------|------------------------------|
| Near-Band Alert | Must-have | “Warn me before I go out of range.” | Orange pulse icon in header | RangeBand™ predictive trigger |
| Out-of-Range Alert | Must-have | “Let me know when to rebalance.” | Red RangeBand flash | In-range analytics accuracy ±1 tick |
| APY Drop Alert | Nice-to-have | “Notify me when performance drops.” | Trend-down icon, email/push | Based on hourly indexer feed |
| Incentive Expiry Alert | Nice-to-have | “Remind me when incentives expire.” | Timer badge | Calendar-integrated expiry feed |

## 📊 Analytics & Peer Benchmarking
| Feature | Priority | Job-to-be-done | Visual Detail / UX Hook | Reference / Differentiation |
|----------|-----------|----------------|--------------------------|------------------------------|
| Peer Benchmark (“You vs Others”) | Must-have | “I want to know how my performance compares.” | “Top 10%” badge, percentile chart | Nansen-like ranking + anonymity |
| Strategy Insight (Range Width) | Must-have | “Am I too aggressive or conservative?” | Gauge meter visual | Unique RangeBand™ percentile scale |
| Fee Capture Timeline | Nice-to-have | “How often do top LPs claim?” | Horizontal claim bars | Peer-normalized visualization |
| Diversification Score | Nice-to-have | “How balanced is my portfolio?” | Pie dispersion score + peer median line | Uses LiquiLab Analytics pool index |
| Entry/Exit Benchmark | Must-have | “Did I enter at a good time?” | Time-based pool join scatter | Combines position index & whale data |
| Leaderboard (Optional Anon) | Nice-to-have | “I want recognition without losing privacy.” | Avatarless rank cards | Anonymous default with opt-in reveal |
| Whale Monitoring | Must-have | “Alert me when big LPs move in/out.” | Whale icon pulse + “Follow” toggle | Cross-DEX tracking on Flare |
| Strategy Simulator (“What-If”) | Nice-to-have | “Estimate gains from different ranges.” | Interactive sliders with projected APY | Gamma-inspired but faster |
| Claim Frequency Impact | Nice-to-have | “Show if frequent claims improve APY.” | Line overlay chart | Derived from LiquiLab position index |

## 💬 UX, Reporting & Feedback
| Feature | Priority | Job-to-be-done | Visual Detail / UX Hook | Reference / Differentiation |
|----------|-----------|----------------|--------------------------|------------------------------|
| CSV/PDF/Tax Export | Must-have | “I need my data for accounting.” | Download icons, export toast | Built-in historical schema |
| Performance Report (Peer) | Nice-to-have | “Show my monthly rank progress.” | Peer percentile ribbon chart | Uses analytics_position_flat |
| In-App Feedback | Must-have | “Give feedback quickly.” | Floating ‘?’ button with mini form | Embedded context in UI |

---

### Summary
LiquiLab unifies **core LP visibility (RangeBand™, Fee & Claim)** with **analytics-driven insights** (Peer Benchmarking, Strategy Analysis, Alerts). Dark-blue shells with aqua accents keep the RangeBand™ identity consistent while staying investor-ready.
