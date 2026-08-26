# SmartReps UX Guidelines

## Sekcja 2B — Referencja Strong (adaptacja)

| Wzorzec Strong | SmartReps |
|---|---|
| Checklist serii | `SetChecklist` + `SetRow` (done/active/pending/failed) |
| Szybkie logowanie | `RepCounter` + CTA „Zrobione” (prefill z celu) |
| Poprzednie wyniki | `PreviousResultBadge` w `RepCounter` |
| Timer inline | `RestTimerPill` → tap → `RestTimerExpanded` + `ProgressRing` |
| Auto-start przerwy | Po „Zrobione” — timer startuje automatycznie |
| Immersive | Tab bar ukryty (`useWorkoutStore.immersive`) |
| Ekran treningu | `ActiveWorkoutScreen` (Strong-style layout) |

## Komponenty design system

| Komponent | Plik |
|---|---|
| ProgressRing | `src/components/ui/ProgressRing.tsx` |
| SegmentedControl | `src/components/ui/SegmentedControl.tsx` |
| StatTile | `src/components/ui/StatTile.tsx` |
| TrendIndicator | `src/components/ui/TrendIndicator.tsx` |
| SessionCompare | `src/components/workout/SessionCompare.tsx` |
| FeedbackBanner | `src/components/ux/Feedback.tsx` |

## Hierarchia ekranu treningu (Strong-style)

1. **POZIOM 1** — liczba celu (`--sr-text-display`), CTA „Zrobione"
2. **POZIOM 2** — kontekst: seria, `PreviousResultBadge`
3. **POZIOM 3** — SetChecklist, timer pill

## Wireframe — Dashboard

```
[Logo SmartReps]
[Karta Pompki — badge status — progress bar — CTA]
[Karta Podciąganie]
[Tab bar]
```

## Wireframe — Trening (`ActiveWorkoutScreen`)

```
[← Pompki · Dzień 3 · Seria 2/5]
[RepCounter: duża liczba + Zrobione]
[SetChecklist]
[RestTimerPill]
```

## Wireframe — Timer expanded

```
[PRZERWA]
[ProgressRing mm:ss]
[Następnie: Seria 3 · 7 pompek]
[+15s] [+30s] [Pomiń]
```

## Checklist przed merge

- [x] Test 5 sekund — użytkownik wie co robić
- [x] Jedna primary action bez scrolla (5 serii)
- [x] Stany loading/empty/error/offline (Dashboard, Progress, Workout, Summary)
- [x] Toast sukcesu (2s) — sync, ukończony dzień, eksport CSV
- [x] Microcopy ze słownika PL (`src/i18n/pl.ts`)
- [x] Touch targets ≥ 48px (`--sr-spacing-touch`, size touch)
- [x] Tab bar ukryty w treningu
- [x] prefers-reduced-motion (tokens + timer ring)
- [x] Filtry historii — status, bieżący cykl, zakres dat (30/90 dni)
- [ ] iPhone SE 375px — wymaga ręcznego QA urządzenia
