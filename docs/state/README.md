# LiquiLab State Docs

Central index for the state documentation split out of `PROJECT_STATE.md`. Each file captures the living details while the root document only keeps a daily snapshot.

## Layout
- `overview.md` — Architecture, components, analytics, testing posture, brand context.
- `stack_hosting.md` — Environment variables, configs, runbooks, and hosting guides.
- `directory.md` — High-level repo map and editing workflow.
- `known_issues.md` — Current limitations and mitigation tracking hooks.
- `open_actions.md` — Full backlog beyond the top-10 snapshot.
- `decisions/` — ADR templates and signed records (ADR-0001+).
- `incidents/` — Post-incident templates and reports.
- `changelog/YYYY-MM.md` — Archived changelog entries older than the rotation window.

## Editing rules
1. Update the dedicated file first; avoid embedding long text back into `PROJECT_STATE.md`.
2. Keep public assets referenced with leading slashes (e.g., `/media/hero.png`).
3. When shipping structural changes, add an ADR under `docs/state/decisions/`.
4. Rotate `PROJECT_STATE.md` with `npm run state:rotate` (or `--dry-run`).