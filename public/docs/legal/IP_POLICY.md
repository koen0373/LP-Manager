---
title: LiquiLab Intellectual Property Policy
version: 2025-10-30
---

# Intellectual Property Policy

LiquiLab B.V. (“LiquiLab”) maintains this policy to ensure all intellectual property (IP) generated within the organisation is properly owned, tracked, and enforceable.

## 1. Ownership & Assignment

1. All work created by LiquiLab employees, contractors, advisors, or contributors (“Personnel”) in the course of their engagement is considered **work-for-hire**. Full rights are assigned to LiquiLab upon creation.
2. Personnel must execute an IP assignment agreement before contributing to repositories, documentation, design systems, or product strategy artefacts.
3. Contributions made using LiquiLab resources (devices, accounts, subscriptions, cloud environments) are presumed to be LiquiLab property unless explicitly waived in writing.

## 2. Source Control Requirements

1. All code and design assets must reside in LiquiLab-managed source control (Git) with audited access.
2. Repositories must enforce:
   - Commit templates containing an `IP-CLAIM: yes/no` line.
   - Hooks that reject empty commit messages and prompt for the IP declaration.
   - Git LFS for large binary assets (design exports, high-resolution media, fonts).
3. Tags, branches, and release candidates must be timestamped. Major releases require a signed tag referencing related evidence logs.

## 3. Third-Party Dependencies

1. Third-party libraries must be sourced from reputable registries (npm, PyPI, crates.io, etc.) and tracked in `docs/legal/THIRD_PARTY_NOTICES.md`.
2. Any dependency with a copyleft, viral, or non-commercial clause requires Legal review before adoption.
3. Forks or patches of third-party code must document provenance, license compatibility, and the rationale for changes.

## 4. Evidence & Record Keeping

1. Product managers and tech leads must maintain an IP evidence trail in `docs/ip/IP_EVIDENCE_LOG.md`, including proofs of creation, first public use, and external disclosures.
2. Hashes of key binaries, design exports, and datasets must be recorded using `shasum -a 256 <file>` or equivalent.
3. Legal holds or external disputes should reference relevant evidence entries by timestamp and Git commit hash.

## 5. Confidential Information

1. Proprietary documents, investor decks, internal strategy memos, and RangeBand™ specifications are confidential. Do not share outside LiquiLab without a CDA/NDA.
2. Use access-controlled storage (e.g., encrypted drives, secure cloud folders) for sensitive artefacts.

## 6. External Contributions

1. Contributions from third parties require a Contributor License Agreement (CLA) or separate assignment contract.
2. Open-source releases must undergo legal review, include correct licensing headers, and avoid disclosing trade secrets.

## 7. Reporting & Compliance

1. Suspected IP infringement or leakage must be reported immediately to legal@liquilab.io.
2. Legal audits may request commit histories, design exports, or evidence log entries. Personnel must comply promptly.
3. Violations of this policy may result in disciplinary action, termination of contracts, or legal enforcement.

---

For questions about this policy or requests for exceptions, contact legal@liquilab.io.
