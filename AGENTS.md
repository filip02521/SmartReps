# SmartReps — guide for AI agents

## Quick start

1. Read `docs/ux-guidelines.md` and `docs/product.md`
2. Follow rules in `.cursor/rules/*.mdc`
3. User-facing text → `src/i18n/pl.ts` AND `src/i18n/en.ts` (both, always)

## i18n rules (MANDATORY)

- **Every new translation key must be added to BOTH `pl.ts` and `en.ts` in the same commit.** No exceptions. Test `i18n-parity.test.ts` will fail otherwise.
- **Zero hardcoded user-facing strings in `src/`.** All visible text must go through `pl.*` / `en.*` via the proxy. This includes:
  - JSX text content
  - Toast messages
  - Error messages (including `throw new Error(...)`)
  - `aria-label`, `placeholder`, `alt`, `title` attributes
  - Fallback names (e.g. `'Ćwiczenie'` → `pl.exerciseFallbackName`)
  - Legal page content (Privacy, Terms)
  - AI prompts sent to the model (`RESEARCH_CONTEXT`, plan/analysis builders)
  - Service worker push notification body (use language-neutral fallback)
- **Comments are OK in Polish** — they're not user-facing.
- **Function signatures must match** between pl and en for parameterized keys (same param names, same types, same order). Test `i18n-parity.test.ts` verifies this.
- **Key naming**: `camelCase`, grouped by feature prefix (e.g. `community*`, `ai*`, `cycle*`).
- **Never use `as const`** in en.ts — it breaks the `Translation` type contract. en.ts is typed as `Translation` imported from pl.ts.
- **Use helpers for data-file strings**: `getCycleName()` / `getCycleDescription()` from `plan-resolver.ts` for cycle names/descriptions; `pl.progressWeekdayLabels` for weekday abbreviations; `pl.muscleGroupFull_*` for muscle group labels.
- **Before committing i18n changes**, verify key parity:
  ```bash
  diff <(grep -E "^\s+[a-zA-Z_]+:" src/i18n/pl.ts | sed -E 's/^\s+//; s/:.*//' | sort) \
       <(grep -E "^\s+[a-zA-Z_]+:" src/i18n/en.ts | sed -E 's/^\s+//; s/:.*//' | sort)
  # No output = perfect parity
  ```

## Sync rules (MANDATORY)

### Core principle: cross-device consistency

**Every piece of user data must be identical across all devices after sync.** No exceptions. If a user deletes a workout on their phone, it must disappear on their tablet. If they change a setting on their tablet, it must update on their phone.

### What must sync

- **All user-owned data entities** must sync to Supabase. If you add a new field to a synced entity (session, plan, exercise, profile, settings), you MUST:
  1. Add it to the Supabase upsert/pull in `src/lib/sync.ts` or the relevant sync file
  2. Add it to the local Dexie schema if needed (`src/lib/db.ts`)
  3. Ensure it survives `clearAllLocalData()` if it's a setting (`src/lib/local-data.ts`)
  4. Add it to profile sync if it's a profile/settings field (`src/lib/enabled-programs-sync.ts`)
  5. Create a Supabase migration (`supabase/migrations/NNN_*.sql`) if a new column/table is needed

### What must NOT sync

- **`aiApiKey` is LOCAL-ONLY.** Never sync the API key to Supabase — it's a security risk. Each device must enter its own key.
- **`aiModel` and `aiBaseUrl` DO sync** — they're not secrets and users expect the same AI configuration across devices. This is the intentional policy (confirmed with product owner).

### Deletion sync (tombstone pattern)

**Hard deletes are forbidden for synced entities.** When a user deletes a session, plan, or other synced data:
1. Store a **tombstone** locally (`db.sessionTombstones` for sessions) — this persists across syncs
2. Enqueue a sync delete (cloud row is removed)
3. Delete the local row

**Why tombstones?** Without them, device B (which still has the session locally) will push it back to the cloud on its next sync. Device A then pulls and the deleted session is resurrected. Tombstones prevent this:
- `mergeSessionRemote()` checks tombstones before inserting
- `syncAllLocalData()` skips tombstoned sessions when pushing
- Tombstones are pulled from cloud so deletions propagate to all devices

**When adding a new deletable synced entity:**
1. Add a tombstone table to Dexie (`db.{entity}Tombstones`)
2. Add a tombstone table to Supabase (migration)
3. On delete: store tombstone + enqueue sync delete + delete local
4. On pull: check tombstones before merging remote rows
5. On push: skip tombstoned rows
6. Pull tombstones from cloud and apply locally

### New settings fields

Must be added to:
1. `defaultSettings` in `src/stores/app-store.ts`
2. `UI_SYNC_KEYS` array if it should sync to cloud
3. `mergeUiSettingsFromProfile()` in `src/lib/enabled-programs-sync.ts`
4. `upsertProfile` in `src/lib/sync.ts` (push to cloud)
5. `pullProfileEnabledPrograms` in `src/lib/sync.ts` (pull from cloud)
6. Preserved in `clearAllLocalData()` in `src/lib/local-data.ts`
7. Test `local-data-preservation.test.ts` must pass

### Before shipping sync changes

Verify:
- The field persists across reload
- The field survives logout/clear-local-data (if it's a setting)
- The field syncs to cloud when logged in
- The field pulls from cloud on a fresh device
- **Deletions propagate**: delete on device A → sync → check device B → session is gone
- **No resurrection**: after deletion + sync, a subsequent pull does NOT bring the data back

## Recurring pitfalls (from project history)

These issues have occurred multiple times and must be actively avoided:

- **Hardcoded strings in lib/ files** — not just JSX. Error messages in `ai-client.ts`, muscle labels in `workout-analyzer.ts`, cycle names in data files, toast messages in pages — all must use `pl.*`.
- **Legal pages with hardcoded content** — Privacy.tsx and Terms.tsx had fully hardcoded Polish paragraphs. All legal text must go through i18n.
- **AI prompts hardcoded in Polish** — `prompts.ts` had RESEARCH_CONTEXT and plan/analysis templates as Polish string literals. These must use `pl.aiPrompt*` keys.
- **Map/picker without default selection** — plan map and cycle picker showed only buttons with empty details area. Always default to current day or day 1.
- **Production-only crashes** — lucide icons undefined in production build (Progress page). Always run `npm run build`, not just `tsc --noEmit`.
- **Commit message shell errors** — use `git commit -m "$(cat <<'EOF' ... EOF)"` with `'EOF'` (quoted) to prevent variable expansion. Avoid nested single quotes.
- **`.gitignore` blocking cursor rules** — `.cursor/` is gitignored; use `git add -f` to force-add rule files.

## Verify before "100% ready"

```bash
npm run validate-plans && npm run validate-custom-plans && npm run lint && npm test -- --run && npm run build
```

Add `npm run test:e2e` for workout, auth, sync, or routing changes.

## Architecture map

| Area | Location |
|------|----------|
| Tab pages | `src/pages/Dashboard.tsx`, `Progress.tsx`, `Plans.tsx`, `Profile.tsx` |
| Workout flow | `Workout.tsx`, `ActiveWorkoutScreen.tsx`, `session-service.ts` |
| Plans data | `src/data/plans/` + `scripts/validate-plans.ts` |
| Local DB | `src/lib/db.ts` (Dexie) |
| Cloud sync | `src/lib/sync.ts`, `auth-sync.ts`, `enabled-programs-sync.ts` |
| i18n | `src/i18n/pl.ts` (PL + proxy), `src/i18n/en.ts` (EN), `src/i18n/index.ts` (runtime) |
| Home dashboard | `home-summary.ts`, `components/dashboard/` |

## User preferences (from project history)

- Improve UX by **reorganizing**, not removing dashboard content
- Simple Polish copy over verbose explanations
- Push to `main` on GitHub only when explicitly asked
- Thorough audit after each feature batch before shipping
