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

- Taby: `TAB_PAGE_SHELL` (`src/lib/ui-chrome.ts`) — `w-full min-w-0 max-w-lg px-4 py-6`
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
[Status dnia — headline + opcjonalny subtitle]
[Attention: InstallCoach XOR HomeTip]
[Zacznij trening]
  — ProgramHomeCard(s) z pełnym lifecycle
  — CustomPlanHomeCard(s) LUB empty: Stwórz plan + Biblioteka
[Twoja aktywność — MetricStrip + trend „wcześniej”]
[Tab bar: Trening · Postępy · Plany · Profil]
```

## Wireframe — Postępy

```
[PageHeader: streak LUB N sesji]
[program compact — jeśli 2+][tabs: Przegląd · Historia · Cykl · Własne?]
URL: ?tab=overview|history|cycle|custom ; ?view=exercises|plan|history ; ?program=
?tab=records → overview + #progress-records (replace)
[ProgressSection — flow, bez cieni Card]
  Przegląd: MetricStrip (test max · dzień X/Y · sesje) + last-set trend + LineChart + heatmap summary + Rekordy (bez hero test)
  Historia: filtry + lista + Sheet → „Pełne podsumowanie”
  Cykl: CycleDayPicker + BarChart max-set + CTA highlight plan
  Własne: Ćwiczenia | Plan | Historia (compact); tab tylko przy planach/sesjach custom
```

## Wireframe — Plany

```
[PageHeader — hint zależny od segmentu]
[Segmented: Moje (default) | Programy | Biblioteka]
Moje: Nowy plan → Import → lista planów
Programy: PageSection pompki / podciąganie / guma
Biblioteka: ExerciseLibraryPanel inline (sheet tylko w edytorze)
Query: ?tab=mine|programs|library ; legacy ?library=1 → library
?highlight= → segment Programy
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

## Wireframe — Plany (Moje)

```
[PageHeader Plany]
[Wbudowane | Moje]
[Nowy plan] [Biblioteka ćwiczeń]
[karta: nazwa + Badge + N dni · X ćw. + nazwy dnia 1]
[Trenuj] [Edytuj] [Więcej → Duplikuj / Eksport / Usuń+confirm]
```

## Wireframe — Edytor planu custom (Sheet, stack)

```
Hub: nazwa, lista dni (skrót ćwiczeń), progresja, Zapisz szkic / Zapisz i aktywuj
  → Dzień: rest 1|2 dni, lista ćwiczeń + chips serii, ↑↓🗑, Dodaj ćwiczenie
    → Pick: ExerciseLibraryPanel (inline, bez nested Sheet)
    → Serie: rest chips, ± serii, cele (+ kg)
```

## Wireframe — Trening custom (multi-exercise)

```
[←] [Pompki · Dzień N · Seria j/m] [⋮]
    [Nazwa planu · Ćw. i/n]
[rail: ćwiczenia dnia — tap niedokończone = skok; done = statystyki]
[notatka trenera — opcjonalnie]
[hint / fail banner]
[RepCounter: cel + display + −/Zrobione/+]
[SetChecklist + przerwa między seriami]
[RestTimerExpanded po serii]
Menu: Zmień ćwiczenie / Ćwiczenia dnia (tap = skok) · Anuluj
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
- [x] Sheet / dolne menu — portal do `document.body` (ponad tab bar) + safe-area na panelu
- [x] Pełnoekranowe overlaye (`RestTimerExpanded`, `CycleCelebration`) — `OverlayPortal`
- [x] Toast / PWA prompt nad tab barem — `CHROME_BOTTOM_ABOVE_TABS` (safe-area)
- [x] Profile CSV = wszystkie programy; Progress CSV = bieżący
- [x] Attention band min-height stabilny (coach → tip)
- [x] iOS status bar: `black-translucent` + `.safe-header` (sticky tło pod notch) — [`index.html`](../index.html), [`globals.css`](../src/styles/globals.css), [`AppLayout.tsx`](../src/components/layout/AppLayout.tsx)
- [x] iPhone SE 375px — Playwright `smoke-iphone` (automatyczny smoke)
- [x] Feedback treningu: dźwięk końca przerwy + „Zrobione” (`workout-feedback.ts`), unlock audio po geście, wibracja gdy tab w tle
- [ ] iPhone SE 375px — manual smoke (7 ekranów, patrz niżej)

### iPhone SE — manual smoke (7 ekranów)

Uruchom dev/preview na urządzeniu 375×667 (lub symulator). Sprawdź brak treści pod notch i stabilne tło nagłówka:

1. **Dashboard** (`/`) — status dnia + karta programu, tab bar
2. **Postępy** (`/progress`) — strip + wykres / Historia / Cykl; Własne gdy są dane
3. **Plany** (`/plans`) — Moje | Programy | Biblioteka; badge „Twój cykl”
4. **Profil** (`/profile`) — sekcja Konto + SyncStatusPanel
5. **Onboarding** (`/setup/onboarding`) — hero + CTA, bez ucięcia u góry
6. **Login** (`/setup/login`) — formularz e-mail + „Pomiń”
7. **Trening aktywny** (`/workout/pushups?force=1`) — licznik serii, menu treningu, bez nachodzenia na home indicator
