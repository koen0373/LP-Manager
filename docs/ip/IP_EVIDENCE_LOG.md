---
title: LiquiLab IP Evidence Log
version: 2025-10-30
---

# IP Evidence Log

Use this log to capture provenance for LiquiLab intellectual property. Each entry should provide enough information to recreate or verify the evidence. Append new entries chronologically (newest first).

## Template

```
## YYYY-MM-DD — <Asset / Event Name>
- Owner(s):
- Description:
- Repository reference: <branch / tag / commit SHA>
- Evidence type: <design export | screenshot | dataset | contract | email thread | domain registration | filing receipt | other>
- Evidence location: <secure URL / path / hash>
- Hash (if applicable): `shasum -a 256 <file>`
- Notes:
```

## Seed Entries

### 2025-10-30 — Domain Registration Proofs
- Owner(s): LiquiLab B.V.
- Description: Registration receipts for `liquilab.io` and `rangeband.io`.
- Repository reference: _pending_ (attach PDFs under secure storage; reference commit once added).
- Evidence type: domain registration confirmation.
- Evidence location: _placeholder — upload receipts to secure drive and link here_.
- Hash: _attach receipt hash (e.g., `shasum -a 256 liquilab-io-receipt.pdf`)_.
- Notes: Capture registrar, registration date/time (UTC), renewal schedule.

### 2025-10-30 — RangeBand™ Public Debut
- Owner(s): Product & Design team.
- Description: First public demo of RangeBand™ visualization inside LiquiLab app.
- Repository reference: _pending_ (add release tag and design export commit).
- Evidence type: screenshots + video demo.
- Evidence location: _placeholder — store in secure asset vault; include signed hash_.
- Hash: _record on upload_.
- Notes: Include event name, audience, and link to demo recording.

### 2025-10-30 — Investor Deck v1
- Owner(s): Founding team.
- Description: Investor deck featuring LiquiLab® positioning and RangeBand™ patent notice.
- Repository reference: _pending_ (reference doc in secure folder with version control).
- Evidence type: PDF deck.
- Evidence location: _placeholder — shared drive folder with restricted access_.
- Hash: _pending_.
- Notes: document every distribution (list recipients, NDA status).

### 2025-10-30 — Automated IP Snapshot Anchor
- Owner(s): LiquiLab B.V.
- Description: Repository snapshot tagged `IP-ANCHOR-2025-10-30` prior to trademark and patent filings.
- Repository reference: tag `IP-ANCHOR-2025-10-30` / commit `_pending_` (update post-run).
- Evidence type: git tag + asset hash (`scripts/ip_snapshot.sh`).
- Evidence location: LiquiLab Git repository.
- Hash: _pending — run `scripts/ip_snapshot.sh` to capture wave-hero.png checksum_.
- Notes: Script appends executed hash output directly to this log.

---

Add new sections below this line. Never overwrite prior entries; strike-through superseded items instead.
