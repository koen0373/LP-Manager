# LiquiLab Brand Usage Guidelines

**Version:** 1.0  
**Last Updated:** October 30, 2025  
**Applies To:** All LiquiLab materials, platforms, and partner integrations

---

## 1. Trademark Notice

The following marks are trademarks or registered trademarks of LiquiLab:

- **LiquiLab™** — The Liquidity Pool Intelligence Platform
- **RangeBand™** — Proprietary liquidity pool range visualization and strategy classification system

All rights reserved. Unauthorized use of these marks is prohibited.

---

## 2. LiquiLab™ Brand Mark

### 2.1 Correct Usage

**Wordmark:**
- Always capitalize both "L" letters: "LiquiLab" (never "Liquilab," "liquilab," or "LIQUILAB")
- Maintain proper spacing (no hyphen: ~~"Liqui-Lab"~~)
- Include ™ symbol in the first prominent use on any page or document

**Logo:**
- Use the official water droplet mark paired with Quicksand wordmark
- Maintain minimum clear space of 0.5× mark height on all sides
- Do not modify colors, proportions, or arrangements without written approval

**Tagline:**
- Always use complete phrase: **"The easy way to manage your liquidity pools."**
- Never abbreviate or paraphrase (~~"Easy pool management"~~ is incorrect)
- Position tagline below or adjacent to logo, never above

### 2.2 Prohibited Uses

- Do not use LiquiLab marks as a generic term for liquidity management software
- Do not incorporate LiquiLab marks into your product, company, or domain name without written permission
- Do not create confusingly similar marks
- Do not use LiquiLab marks in a way that implies endorsement without a formal partnership agreement

---

## 3. RangeBand™ Proprietary Credit

### 3.1 Mandatory Attribution

Whenever the RangeBand visualization component is displayed, include the credit:

**"Powered by RangeBand™"**

**Placement:**
- Footer of the RangeBand component (bottom-right corner in current UI design)
- Small, subtle font (11px or text-xs in Tailwind)
- Gray/muted color: `#9CA3AF` (Mist) or `text-mist`
- Include 21×21px RangeBand icon between "Powered by" and "RangeBand™"

**Format:**
```
Powered by [icon] RangeBand™
```

### 3.2 Usage in UI

- RangeBand™ mark must appear with ™ symbol in the first prominent use per page/view
- Subsequent uses on the same page may omit ™ symbol for visual cleanliness
- Never use "RangeBand" as a standalone headline without proper context

### 3.3 Prohibited Uses

- Do not rebrand RangeBand under a different name
- Do not claim to have developed or invented the RangeBand system
- Do not remove or obscure the "Powered by RangeBand™" attribution
- Do not modify the visualization methodology and claim it as RangeBand

---

## 4. Partner and Provider Names

### 4.1 Text-Only Policy

**Default Rule:** Use DEX/protocol names as **text only**, not logos.

**Approved Text Formats:**
- "Enosys v3" or "ENOSYS V3"
- "SparkDEX v2" or "SPARKDEX V2"
- "BlazeSwap v3" or "BLAZESWAP V3"

**Contextual Use:**
- Pool origin: "via Enosys v3" / "on SparkDEX"
- Provider subline: "ENOSYS V3 · #22003 · 0.3%"
- Deep links: "Claim rewards on Enosys v3"

### 4.2 Logo Usage (Opt-In Only)

Third-party logos may **only** be used with explicit written permission from the respective platform.

**Requirements:**
1. Signed permission form or email confirmation
2. Copy stored in `/docs/brand-approvals/[partner-name]_logo_approval.pdf`
3. Usage limited to contexts specified in permission grant
4. Periodic renewal (recommend annual review)

**Current Status:** *(As of October 2025)*
- Enosys: No logo permission granted — use text only
- SparkDEX: No logo permission granted — use text only
- BlazeSwap: No logo permission granted — use text only

### 4.3 No Endorsement Implication

**Disclaimer Required:** In any marketing materials, public statements, or investor communications, clarify:

> "LiquiLab is an independent analytics platform. References to Enosys, SparkDEX, BlazeSwap, and other protocols do not imply endorsement, affiliation, or partnership unless expressly stated under a formal agreement."

---

## 5. Social Media and Share Cards

### 5.1 Share Card Branding

**Required Elements:**
- LiquiLab™ mark or logo (top or bottom)
- "Powered by RangeBand™" credit when RangeBand visualization is included
- Pool data with provider attribution as text: "via Enosys v3"

**Prohibited Elements:**
- Third-party protocol logos (unless written permission granted)
- Misleading claims of partnership or endorsement
- Screenshots that imply official collaboration without contractual basis

### 5.2 Social Media Posts

**Best Practices:**
- Tag official accounts (@EnosysDEX, @SparkDEX_io, @BlazeSwap, etc.) when appropriate
- Use neutral language: "Tracking pools on Enosys" not "Partnered with Enosys"
- Clearly distinguish user testimonials from official statements

### 5.3 UTM Parameters

All deep links to partner platforms must include UTM tracking:

```
utm_source=liquilab
utm_medium=app
utm_campaign=[claim_flow|pool_details|share_card]
utm_content=[providerSlug]-[marketId]-[action]
```

**Example:**
```
https://enosys.global/pool/22003?utm_source=liquilab&utm_medium=app&utm_campaign=claim_flow&utm_content=enosys-v3-22003-claim
```

---

## 6. Legal Disclaimers

### 6.1 Financial Disclaimer

Include on all pages with financial data or APY projections:

> "LiquiLab provides analytics and information tools. Past performance does not guarantee future results. Cryptocurrency investments carry significant risk. Always conduct your own research and consult qualified financial advisors before making investment decisions."

### 6.2 No Investment Advice

> "LiquiLab does not provide investment advice, tax advice, or legal advice. The information presented is for informational and educational purposes only."

### 6.3 Data Accuracy

> "While LiquiLab strives for accuracy, we do not guarantee that all data displayed is error-free or up-to-date. Always verify critical information on the respective blockchain or protocol interface."

---

## 7. Employee and Contractor Guidelines

### 7.1 Presentations and Demos

- Use official slide templates with correct branding
- Include LiquiLab™ and RangeBand™ marks with proper attribution
- Do not make claims about protocol partnerships without authorization

### 7.2 Code Comments and Documentation

- Maintain brand consistency in user-facing messages
- Use official product names: "LiquiLab" not "liquilab app"
- Include trademark symbols in customer-facing documentation

### 7.3 Open Source Contributions

- Do not disclose proprietary algorithms or methodologies (e.g., RangeBand calculations) in public repositories without approval
- Brand any public-facing libraries or tools appropriately
- Include license notices and attribution as required

---

## 8. Enforcement and Compliance

### 8.1 Reporting Misuse

If you observe unauthorized use of LiquiLab trademarks, report to: [legal@liquilab.io]

Include:
- URL or location of misuse
- Screenshots or examples
- Date observed

### 8.2 Takedown Process

LiquiLab reserves the right to:
- Issue cease and desist notices for trademark infringement
- File DMCA takedowns for copyrighted materials
- Pursue legal action for material misrepresentation or brand dilution

### 8.3 Periodic Audits

LiquiLab will conduct periodic audits of:
- Partner integrations and co-branding
- Social media usage of brand marks
- Third-party references in reviews, articles, and platforms

---

## 9. Permissions and Licensing

### 9.1 Media Inquiries

Press and media may use LiquiLab marks for news coverage and factual reporting without prior permission, subject to:
- Fair use principles
- Accurate representation of facts
- No implication of endorsement

### 9.2 Educational Use

Educators, researchers, and non-commercial users may use LiquiLab marks for educational purposes, provided:
- Usage is non-commercial
- Proper attribution is provided
- No modification of marks

### 9.3 Commercial Licensing

For commercial use, partnerships, or co-branding arrangements, contact: [partnerships@liquilab.io]

---

## 10. Updates and Amendments

This document may be updated periodically. The latest version is authoritative. Check:
- `/docs/legal/BRAND_USAGE.md` (codebase)
- https://liquilab.io/legal/brand-usage (public site, when available)

**Notification:** Material changes will be communicated via:
- Email to registered partners
- Changelog in PROJECT_STATE.md
- Public announcement on official channels

---

## Contact

**Brand and Trademark Inquiries:**  
[legal@liquilab.io]

**Partnership and Licensing:**  
[partnerships@liquilab.io]

**General Support:**  
[support@liquilab.io]

---

**Last Reviewed By:** [Name]  
**Approved By:** [Founder/Legal Counsel]  
**Next Review Date:** [6 months from last update]
