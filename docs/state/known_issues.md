# LiquiLab State — Known Issues

## Active limitations
- Cloud sandbox DNS issues against `flare-api.flare.network` / `rpc.ankr.com` (documented under Testing & Verification).
- Legacy Jest tests still exist without typings; `tsc --noEmit` surfaces warnings.
- `/admin/db` feature parity pending production verification.
- Pool attribution backfill still leaves `pool=unknown` rows that require ANKR enrichment.
- Pricing cache retention policy for ANKR-sourced data remains undocumented.

## Tracking
- Align with `docs/state/open_actions.md` for mitigations and owners.
- File incident reports under `docs/state/incidents/` when customer-visible impact occurs.
