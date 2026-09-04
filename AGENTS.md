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

- **Every user-owned data entity must sync to Supabase.** If you add a new field to a synced entity (session, plan, exercise, profile, settings), you MUST:
  1. Add it to the Supabase upsert/pull in `src/lib/sync.ts` or the relevant sync file
  2. Add it to the local Dexie schema if needed (`src/lib/db.ts`)
  3. Ensure it survives `clearAllLocalData()` if it's a setting (`src/lib/local-data.ts`)
  4. Add it to profile sync if it's a profile/settings field (`src/lib/enabled-programs-sync.ts`)
- **AI API keys are LOCAL-ONLY.** Never sync `aiApiKey`, `aiModel`, `aiBaseUrl` to Supabase.
- **New settings fields** must be added to `defaultSettings` in `src/stores/app-store.ts` AND preserved in `clearAllLocalData()` in `src/lib/local-data.ts`. Test `local-data-preservation.test.ts` will fail otherwise.
- **Comments must reflect reality.** If a field is synced, don't comment "not synced" — this caused confusion with the `language` field.
- **Before shipping sync changes**, verify:
  - The field persists across reload
  - The field survives logout/clear-local-data (if it's a setting)
  - The field syncs to cloud when logged in
  - The field pulls from cloud on a fresh device

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
