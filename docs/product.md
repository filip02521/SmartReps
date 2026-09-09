# SmartReps — produkt

## Dla kogo

Osoby trenujące pompki i/lub podciąganie w domu, a także osoby tworzące własne plany multi-exercise. Aplikacja daje **jasny plan dnia**, działa offline i opcjonalnie synchronizuje się między urządzeniami (Supabase). Łączy trening programowy (cykle wbudowane) z własnymi planami, **katalogiem społecznościowym planów** (publikacja, import, opinie), **followami** i publicznymi profilami, **osiągnięciami**, **tygodniowymi wyzwaniami** z leaderboardem oraz **opcjonalnym AI asystentem** (klucz lokalny, OpenAI-compatible endpoint). Nie ma chronologicznego feeda aktywności ani globalnego rankingu użytkowników.

## Sukces (metryki)

- **Activation:** ukończony Dzień 1 (lub pierwsza sesja custom) w ≤ 48 h od pierwszego otwarcia
- **Habit:** ≥ 3 ukończone sesje w 14 dni
- **Trust:** niski odsetek `sync_failed` / OTP fail w PWA standalone
- **Retention:** powrót D7
- **Community — katalog:** import (obcy) → 1. ukończona sesja custom ≤ 48 h; publish → ≥1 obcy import / 7d; opinia (gwiazdki + tekst) → ≥1 recenzja / publikacja / 7d
- **Community — follow:** publiczny profil → ≥1 follower / 14d; follow → ≥1 ukończona sesja obserwowanego widziana w katalogu
- **AI:** wygenerowany plan → zaimportowany jako własny ≤ 24 h; analiza → ≥1 akcja podjęta na podstawie insightu / 7d; proactive coach → ≥1 weekly report obejrzany / tydzień
- **Achievements:** odblokowanie 1. osiągnięcia ≤ 7d; showcase ustawiony przez ≥ X% profili publicznych
- **Weekly challenge:** ≥1 zgłoszenie / aktywne wyzwanie / użytkownik

## Główna nawigacja

Cztery zakładki (bottom nav): **Trening** (`/`), **Postępy** (`/progress`), **Plany** (`/plans`), **Profil** (`/profile`). Podczas treningu i setupu nav jest ukryty (immersive). Dodatkowe ekrany: trening wbudowany (`/workout/:program` + summary), trening custom (`/workout/custom/:planId` + summary), szczegóły publikacji społecznościowej (`/community/:slug`), onboarding/login/setup, privacy, terms. Globalnie montowane: `AchievementHost`, `ResumeWorkoutPrompt`, `GlobalOfflineBar`, `AuthBridge`, `AccountSwitchGate`, `ToastHost`.

## W scope

### Rdzeń treningowy
- **Cykle wbudowane pompki + podciąganie** (`src/data/plans/` — tylko `pushups` + `pullups`): max test → wybór cyklu → start; daily workout; session summary; fail dnia → restart programu od dnia 1
- **Własne ćwiczenia i plany multi-exercise** — biblioteka ćwiczeń, kreator planów, trening custom; plany mogą być jedynym włączonym treningiem (dashboard bez programów wbudowanych)
- **Cykl życia planu custom** — draft / active / paused / completed; duplikowanie, edycja, pauza, usuwanie, aktywacja, start treningu; podgląd treningu; import/eksport JSON
- **Sesje custom** — poniżej celu = dzień i tak zaliczony (miękka wzmianka na summary); resume in-progress; pause; abandon; multi-exercise logs z reps / weight / duration
- **Podmiana ćwiczeń w sesji** — substitute suggestions, swap, add/remove sets, edycja restów w locie
- **Rest timer** — smart rest suggestions (porównanie z poprzednią sesją), prep countdown, audio + vibration feedback, keep-screen-awake (Wake Lock), add time / skip
- **Reminders** — lokalne przypomnienia (gdy apka otwarta) + **Web Push** (VAPID; wymaga login + PWA); godzina przypomnienia 0–23; `nextWorkoutAfter` dla kontekstu dnia
- **Sync mid-workout** — pragmatyczny LWW (`session-sync-merge.ts`): przy konflikcie `in_progress` wygrywa strona z większą liczbą zalogowanych serii (równe = local); pełny CRDT pozostaje poza scope; tombstony dla usuniętych sesji zapobiegają resurrect

### i18n
- **PL-first + EN** — pełne tłumaczenia w `src/i18n/pl.ts` (źródło prawdy) i `src/i18n/en.ts`; parzystość kluczy i sygnatur wymuszana przez `i18n-parity.test.ts`; zero hardcoded stringów widocznych dla usera w `src/` (JSX, toast, error, aria, placeholder, alt, title, treść prawna, prompty AI, nazwy cykli, etykiety grup mięśniowych); `BrowserRouter key={language}` odświeża proxy tłumaczeń; wybór języka w onboarding i w Settings

### Dashboard (`/`)
- Status header + contextual greeting + quick CTA (start / continue trening)
- Karty włączonych programów wbudowanych + sekcja planów custom
- **Community teaser** (3 obce plany, offline cache) → link do `/plans?tab=community`
- **Weekly challenge card** (gdy aktywne wyzwanie + online)
- **Weekly report card** (AI proactive coach, gdy `aiProactiveCoach` + skonfigurowany klucz; metryki tygodnia + insight; regeneracja 1×/tydzień, force 1×/dzień)
- **Install coach** (A2HS) + contextual home tips (login backup, habit met)
- Empty state gdy brak programów → link do Plans / Profile
- Offline-aware loading/error

### Plans (`/plans`)
- Cztery zakładki: **Mine** (własne plany), **Programs** (cykle wbudowane), **Library** (biblioteka ćwiczeń), **Community** (katalog)
- **Custom plan editor** + exercise library + **AI plan generator** (`AiPlanGenerator.tsx`)
- **JSON import/export** planów; duplikowanie, edycja, pauza, usuwanie, aktywacja, start treningu
- **Community catalog** — sortowanie (popularne / nowe / imports / rating), filtrowanie po tagach, karty z ratingiem + like + imports; offline list cache
- **Own publications panel** — lista własnych publikacji + community impact strip; publikacja / republish / unpublish
- Status badges: active / paused / draft / published / unpublished

### Progress (`/progress`)
- Trzy zakładki: **Overview**, **History**, **Achievements**
- **Overview** — statystyki programów wbudowanych (postęp, volume, wykresy max-set, weekly volume, day-cycle trend, records z datami); statystyki planów custom (volume, PR per ćwiczenie, weekly volume, overview stats); activity insights + weekly recap; activity calendar (heatmap); muscle balance heatmap; unified records; exercise detail sheets; **body-weight tracking** (wpisy + wykres + korelacja z performance); AI analysis teaser (gdy dane)
- **History** — wszystkie sesje (builtin + custom), filtry (source / result / date), detail sheets, usuwanie sesji, **AI workout analysis** (`AiWorkoutAnalysis.tsx`, cache 24h), eksport CSV (builtin + custom, merge)
- **Achievements** — galeria z filtrami (all / unlocked, track: training / habit / catalog / legend), trophy summary bar, in-progress, detail sheet, showcase picker

### Profile (`/profile`)
- **Profile hero** — display name, email, bio, przełącznik public/private; public profile sheet; statystyki (sesje, powtórzenia, streak, best streak)
- **Follow** — follower/following counts + sheets; follow/unfollow z potwierdzeniem; avatary; top achievements obserwowanych
- **Achievements section** — galeria + showcase picker (sloty na profilu, auto lub manual, sync do chmury)
- **AI coach card** (status connected/offline) → otwiera Settings; **AI coach history** (insights: post-workout, weekly report, plateau warning; filtry; dismiss)
- **Settings sheet** — sekcje: Konto i synchronizacja (sync now / login / logout), Wygląd i język (theme system/dark/light, high-contrast, language PL/EN), Trening (weight unit kg/lb, timer sound/vibration, keep screen on), Przypomnienia (push, local reminders, reminder hour), Trener AI (provider OpenAI/Gemini/Groq/custom, API key, model, base URL, reasoning effort, proactive coach toggle), Dane i backup (import JSON, export JSON, export CSV, clear local, delete account)
- **About** — app identity + wersja, privacy/terms links, źródła (100pompek.pl, podciaganie.pl), health disclaimer

### Onboarding (`/setup/onboarding`)
- Kroki: welcome → interest (Strong programy / własne plany) → programs (pushups/pullups, tylko gdy Strong) → next steps
- **Language selector** (PL/EN) dostępny od welcome
- **Carousel** — slajdy: cykle, AI, postępy (ilustracje)
- Setup queue management (kolejkowanie wielu programów), auth + post-auth navigation, Supabase sync w tle (nie blokuje wizarda)

### Warstwa społeczna (katalog + follow, bez feeda)
- **Katalog społeczzeniowy planów** — publikacja snapshotu planu custom (wymaga publicznego profilu + aktywnego planu), like/unlike (nie własne), import jako własny draft, tagi (home/gym/bodyweight/weights/short_cycle/long_cycle, max 3), sortowanie (popularne / nowe / imports / rating), cache offline list, trained badge, detail page z dniami i ćwiczeniami
- **Akcje na publikacji** — import, like, share (Web Share / clipboard), report (spam/unsafe/other), unpublish (autor), republish (autor)
- **Opinie (reviews)** — gwiazdki 1–5 + tekstowa recenzja (max 500 znaków); jedna opinia per user per publikacja; autor nie ocenia własnej; edycja i usuwanie własnej; agregat (avg + count) na karcie i detailu
- **Follow system** — follow/unfollow użytkowników z publicznym profilem (nie siebie); listy followers / following z top achievements; liczniki na profilu; przycisk follow na autorach publikacji i kartach katalogu; `sr-follow-changed` event odświeża UI
- **Publiczne profile** — display name, bio, statystyki (sesje, powtórzenia, streaki, pushup/pullup max), showcase osiągnięć, przełącznik public/private; prywatne profile nieobserwowalne; refresh stats z `workout_sessions` + `max_tests`
- **Community impact** — metryki autora: likeTotal, importTotal, trainedTotal, publishedCount, bestPlanImports/Trained, followerCount, followingCount, reviewCount, challengeParticipations, challengeWins

### Osiągnięcia
- **Katalog osiągnięć/trofeów** (`src/lib/achievements/`) — tracki: training / habit / catalog / legend; rzadkości: common / rare / legendary; tier'y progresywne (progi, rarity per tier, glyph override); osiągnięcia sekretne (progressive); rolling-window (odwoływane gdy metryka spada)
- **Osiągnięcia obejmują** (55 total, pogrupowane wg tracku):
  - **training** (19): first session, habit 3-in-14, first custom session, cycle closed strong, pushup/pullup goals (100/50/30), workshop custom, PR repeat, sessions 100, volume 10k, cycles 5, custom sessions 25, pr master, custom creator, both programs, AI first insight, AI coach user, exercise creator
  - **habit** (9): streaki (1/4/12/26/52), comeback, habit builder, weight tracker, weekend warrior
  - **catalog** (18): first publish, first like, first import, first trained, plan with legs, trainer 25, poly publisher, liked/imported author, community pillar, first follower, followed by 25, first follow, first review, reviewer 10, challenge first/winner/5
  - **legend** (9): full circle, quiet master, grandmaster, community + sekretne (dawn, marathon, night, precision, weekend)
- **Unlock flow** — unlock sheet, mark seen, in-progress display, achievement check scheduling; sync do Supabase (z tier level, revoke dla rolling)
- **Showcase** — sloty na profilu publicznym (auto z rarity/tier, lub manual pick); sync do chmury; widoczne w follow cards

### Tygodniowe wyzwania
- **Weekly challenge** (`src/lib/weekly-challenge.ts`) — aktywne wyzwanie tygodniowe (pushups lub pullups, target reps, week key ISO); zgłoszenie / aktualizacja własnego wyniku (is_new_best); licznik uczestników; **leaderboard** (ranking po total_reps, display name, medale 1/2/3, podświetlenie "Ty"); karta na dashboardzie (gdy online + aktywne); login required; ended banner

### AI (opcjonalne, klucz lokalny)
- **AI plan generation** (`AiPlanGenerator.tsx`, `plan-generator.ts`) — opis + days/week + experience + equipment + goal + duration → gotowy `CustomPlan` (walidacja, sanitizacja, limity dni/serii); ćwiczenia nie persistowane aż do importu planu; prompt z research context (Schoenfeld, Helms, Israetel, Rhea)
- **AI workout analysis** (`AiWorkoutAnalysis.tsx`, `workout-analyzer.ts`) — analiza historii (summary, strengths, weaknesses, suggestions z priorytetami, volumeAssessment: optimal/below_mev/above_mrv/low/high); cache 24h; w History tab Progress
- **AI proactive coach** (`proactive-coach.ts`) — hybrydowy: lokalne insights zawsze dostępne, AI zastępuje gdy `aiProactiveCoach` + klucz:
  - **Smart rest suggestions** — porównanie z poprzednią sesją w rest timerze
  - **Post-workout auto-insight** — 1-sentence insight na summary (15s timeout AI, fallback lokalny)
  - **Plateau detector** — 3 sesje bez progresji → warning
  - **Weekly report** — karta na dashboardzie z metrykami tygodnia + insight (auto 1×/tydzień, force 1×/dzień); przechowywane w `db.aiInsights` (max 200, prune dismissed/oldest)
- **AI coach branding** — `AiCoachHeader`, `AiCoachMessage`, `AiCoachMark`, `AiCoachCard` (na profilu), `AiCoachHistory`
- **AI settings** — `aiApiKey` (LOCAL-ONLY, nigdy do Supabase), `aiModel` + `aiBaseUrl` (sync do chmury), `aiReasoningEffort` (auto/low/medium/high), `aiProactiveCoach` toggle; presety OpenAI/Gemini/Groq + custom; mapowanie Gemini 2.5 Flash/Flash-Lite (disable reasoning), Gemini 2.5 Pro / 3.x (no `reasoning_effort: none`, 3.x no `temperature`, `thinking_level`)
- **Rate limiting** (`rate-limiter.ts`) — globalny daily quota + per-feature cooldown (weekly_report 24h, post_workout 2min, workout_analysis 30min, plan_generation 3min) + per-feature inflight mutex; localStorage; komunikaty przez i18n
- **OpenAI-compatible** — OpenAI, OpenRouter, Groq, Gemini (OpenAI-compat endpoint)

### Sync, dane lokalne, PWA
- **Supabase** — auth (email/OTP), optional cloud sync; user settings + user data sync; profile sync (enabled programs, enabled custom plans, UI settings, AI model/baseURL, language); tombstony dla deletions
- **Offline-first** — Dexie (local DB), offline bar, offline cache (community list + detail), graceful degradation; `aiApiKey` lokalny
- **PWA** — standalone, install coach (A2HS), chunk-load recovery dla lazy routes
- **Data portability** — JSON backup export/import, CSV export (sessions builtin + custom, merge), clear local data, delete account
- **Dostępność** — theme (system/dark/light), high-contrast mode, focus rings, skip-to-main, aria, tabular-nums, motion-reduce

### Marka
- PL-first, privacy/terms (treść prawna przez i18n), health disclaimer, źródła (100pompek.pl, podciaganie.pl)

## Poza scope (na razie)

- **Curated builtin programy poza pompkami/podciąganiem** — `src/data/plans/` zawiera tylko `pushups` + `pullups`; nowe programy wbudowane wymagają danych + walidacji (`validate-plans`)
- **Chronologiczny social activity feed** — katalog jest browseable (sort/tagi/rating), nie feedem aktywności obserwowanych
- **Pełny CRDT mid-workout** — istnieje tylko pragmatyczny LWW (większa liczba serii wygrywa, równe = local), nie true CRDT z wektorami wersji
- **Globalny ranking użytkowników** — leaderboard dotyczy tylko aktywnego wyzwania tygodniowego, nie globalnego rankingu wszystkich userów
- **Komentarze ogólne (social-feed)** — opinie istnieją jako text reviews z gwiazdkami na publikacjach, nie jako ogólny system komentarzy socialnych
- **Hostowany AI service** — AI jest user-configured (własny klucz, własny provider), nie centralnie hostowany przez SmartReps
