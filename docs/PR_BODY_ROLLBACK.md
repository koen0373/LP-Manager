# Rollback to UI snapshot ui-2025-11-10-1000

## Advisory

**Advies:** Prefer a rollback PR over force-pushing main; keep history intact and allow staged fixes.

---

## Summary

This PR rolls back the UI to the approved snapshot `ui-2025-11-10-1000` (commit `0ab99aa2f4250b1bbd5ea39e724513d23800a564`) to restore a stable baseline after recent changes.

**Rollback details:**
- **Tag:** `ui-2025-11-10-1000`
- **Commit:** `0ab99aa2f4250b1bbd5ea39e724513d23800a564`
- **Rollback branch:** `<fill with your rollback branch name>`
- **Backup branch:** `<fill with your backup branch name>` (contains current WIP)

**Reason:** Restore UI to known-good state; follow-up fixes will be applied via small, focused PRs.

---

## Scope

**UI only** — This rollback affects:
- `pages/**`
- `src/components/**`
- `styles/globals.css`
- `public/media/**`

**No backend/indexer changes** — All API routes, database schemas, and indexer scripts remain unchanged.

---

## Risk Assessment

**Risk:** Minimal
- History preserved (no force-push)
- Backend/indexer unaffected
- Follow-up fixes can be staged incrementally
- Backup branch contains current WIP for reference

---

## Post-Merge Checks

After merging, verify:

1. **Build:** `npm run build` succeeds
2. **Visual smoke test:**
   - `/` — Homepage loads with WaterWave hero visible
   - `/pricing` — Pricing page renders correctly
   - `/dashboard` — Dashboard displays without errors
3. **Lint:** `npm run lint` passes
4. **Typecheck:** `npm run typecheck` passes

---

## Merge Method

**Recommended:** Squash & merge (creates a single commit on main)

**Alternative:** Merge commit (preserves branch history)

---

## Question for Owner

**Follow advisory path (merge rollback PR)?** → **yes** (default: yes)

If **yes:** Merge this PR and apply follow-up fixes via small PRs.

If **no:** Force-push main to rollback commit (not recommended; loses history).

---

## Follow-Up Actions

After merge:
1. Create small PRs for any necessary fixes
2. Reference this rollback PR in follow-up PRs
3. Keep backup branch until follow-up PRs are merged


