# SmartReps — guide for AI agents

## Quick start

1. Read `docs/ux-guidelines.md` and `docs/product.md`
2. Follow rules in `.cursor/rules/*.mdc`
3. User-facing text → `src/i18n/pl.ts` AND `src/i18n/en.ts` (both, always)

## i18n rules (MANDATORY)

- **Every new translation key must be added to BOTH `pl.ts` and `en.ts` in the same commit.** No exceptions.
- **Zero hardcoded user-facing strings in `src/`.** All visible text (JSX, toasts, errors, aria-labels, placeholders, alt, title) must go through `pl.*` / `en.*` via the proxy.
- **Comments are OK in Polish** — they're not user-facing.
- **Function signatures must match** between pl and en for parameterized keys (same param names, same types, same order).
- **Key naming**: `camelCase`, grouped by feature prefix (e.g. `community*`, `ai*`, `cycle*`).
- **Never use `as const`** in en.ts — it breaks the `Translation` type contract. en.ts is typed as `Translation` imported from pl.ts.
- **Before committing i18n changes**, verify key parity:
  ```bash
  grep -E "^\s+[a-zA-Z_]+:" src/i18n/pl.ts | sed -E 's/^\s+//; s/:.*//' | sort | wc -l
  grep -E "^\s+[a-zA-Z_]+:" src/i18n/en.ts | sed -E 's/^\s+//; s/:.*//' | sort | wc -l
  # Both counts must be equal
  ```

## Sync rules (MANDATORY)

- **Every user-owned data entity must sync to Supabase.** If you add a new field to a synced entity (session, plan, exercise, profile, settings), you MUST:
  1. Add it to the Supabase upsert/pull in `src/lib/sync.ts` or the relevant sync file
  2. Add it to the local Dexie schema if needed (`src/lib/db.ts`)
  3. Ensure it survives `clearAllLocalData()` if it's a setting (`src/lib/local-data.ts`)
  4. Add it to profile sync if it's a profile/settings field (`src/lib/enabled-programs-sync.ts`)
- **AI API keys are LOCAL-ONLY.** Never sync `aiApiKey`, `aiModel`, `aiBaseUrl` to Supabase.
- **New settings fields** must be added to `defaultSettings` in `src/stores/app-store.ts` AND preserved in `clearAllLocalData()` in `src/lib/local-data.ts`.
- **Before shipping sync changes**, verify:
  - The field persists across reload
  - The field survives logout/clear-local-data (if it's a setting)
  - The field syncs to cloud when logged in
  - The field pulls from cloud on a fresh device

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
