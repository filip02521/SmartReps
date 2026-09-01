# SmartReps — guide for AI agents

## Quick start

1. Read `docs/ux-guidelines.md` and `docs/product.md`
2. Follow rules in `.cursor/rules/*.mdc`
3. User-facing text → `src/i18n/pl.ts` only

## Verify before “100% ready”

```bash
npm run validate-plans && npm run lint && npm test -- --run && npm run build
```

Add `npm run test:e2e` for workout, auth, sync, or routing changes.

## Architecture map

| Area | Location |
|------|----------|
| Tab pages | `src/pages/Dashboard.tsx`, `Progress.tsx`, `Plans.tsx`, `Profile.tsx` |
| Workout flow | `Workout.tsx`, `ActiveWorkoutScreen.tsx`, `session-service.ts` |
| Plans data | `src/data/plans/` + `scripts/validate-plans.ts` |
| Local DB | `src/lib/db.ts` (Dexie) |
| Cloud sync | `src/lib/sync.ts`, `auth-sync.ts` |
| Home dashboard | `home-summary.ts`, `components/dashboard/` |

## User preferences (from project history)

- Improve UX by **reorganizing**, not removing dashboard content
- Simple Polish copy over verbose explanations
- Push to `main` on GitHub only when explicitly asked
- Thorough audit after each feature batch before shipping
