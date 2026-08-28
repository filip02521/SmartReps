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
| MetricStrip | `src/components/ui/MetricStrip.tsx` |
| ProgramAccentCard | `src/components/ui/ProgramAccentCard.tsx` |
| SetTargetsRow | `src/components/ui/SetTargetsRow.tsx` (cele serii — home / Plany) |
| NestedStat | `src/components/ui/NestedStat.tsx` (size: sm / md / lg) |
| CycleDayRail | `src/components/ui/CycleDayRail.tsx` (home / ProgramStart) |
| CycleDayPicker | `src/components/ui/CycleDayPicker.tsx` (Progress) |
| PageSection | `src/components/ui/PageSection.tsx` |
| TextField / CheckboxField | `src/components/ui/TextField.tsx` |
| ProgressRing | `src/components/ui/ProgressRing.tsx` |
| SegmentedControl | `src/components/ui/SegmentedControl.tsx` |
| TrendIndicator | `src/components/ui/TrendIndicator.tsx` |
| SessionCompare | `src/components/workout/SessionCompare.tsx` |
| FeedbackBanner / NoticeCard | `src/components/ux/NoticeCard.tsx` + Feedback — tipy, coach, bannery |
| ConfirmSheet | wrapper nad `Sheet` (`showClose={false}`) |

## Chrome stacking

Treść → tab / RestTimerPill (`z-40`) → RestTimerExpanded (`z-50`) → Sheet (`z-55`) → CycleCelebration (`z-70`) → Offline (`z-80`) → Toast (`z-90`).  
Toast nad pillem gdy `restTimer.mode === 'pill'`. Offline bar tylko top.

## Konwencje shell

- Taby: `max-w-lg px-4 py-6 safe-top` (bez page `safe-bottom`)
- Flow: `py-8 safe-top safe-bottom`
- CTA trening: `size="touch"`; ustawienia: `sm` / `ghost`
- Empty katalog → `EmptyState`; błąd → `ErrorBanner` + retry in-app
- CSV: Progress = bieżący program; Profil = wszystkie
- InstallCoach XOR HomeTip: tip dopiero gdy `installVisible === false`
- Logout sheet: 3 akcje (wyczyść / zostaw dane / Anuluj = zamknij)
- Summary: headline dominant — bez toastu „dzień ukończony”

## Hierarchia ekranu treningu (Strong-style)

1. **POZIOM 1** — liczba celu (`--sr-text-display`), CTA „Zrobione"
2. **POZIOM 2** — kontekst: seria, `PreviousResultBadge`
3. **POZIOM 3** — SetChecklist, timer pill

## Wireframe — Dashboard (home)

```
[Logo SmartReps]
[HomeSummary — data, status, MetricStrip, paski cyklu]
[Attention: InstallCoach XOR HomeTip — min-height band]
[Wybierz trening]
[ProgramHomeCard — CycleDayRail, NestedStat, CTA 1+1]
[Tab bar]
```

## Wireframe — Postępy

```
[PageHeader + status]
[program SegmentedControl][tabs]
[MetricStrip + NestedStat]
[wykresy / CycleDayPicker / historia / rekordy]
```

## Wireframe — Plany

```
[PageHeader + hint katalogu]
[PageSection pompki — ProgramAccentCard accordion]
[PageSection podciąganie]
[guma — PageSection]
```

## Wireframe — Profil

```
[PageHeader]
[Konto | Wygląd | Trening | Programy | Dane | O aplikacji]
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
- [x] Toast sukcesu (3.5–5s) — sync / eksport (nie „dzień ukończony”)
- [x] Microcopy ze słownika PL (`src/i18n/pl.ts`)
- [x] Touch targets ≥ 48px (`--sr-spacing-touch`, size touch)
- [x] Tab bar ukryty w treningu
- [x] prefers-reduced-motion (tokens + timer ring)
- [x] Filtry historii — status, bieżący cykl, zakres dat (30/90 dni)
- [x] focus-visible na Button / tabs / SegmentedControl / TextField
- [x] Toast nie zasłania RestTimerPill
- [x] Profile CSV = wszystkie programy; Progress CSV = bieżący
- [x] Attention band min-height stabilny (coach → tip)
- [ ] iPhone SE 375px — final smoke na urządzeniu
