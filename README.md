# SmartReps

Offline-first PWA do treningu **pompek** i **podciągania**. **23 cykle łącznie** (12 pompki + 11 podciąganie). Aplikacja działa lokalnie bez konta; opcjonalna synchronizacja przez Supabase.

## Funkcje

- **Strong-style workout** — checklista serii, licznik powtórzeń, timer przerwy z auto-startem, smart rest suggestions
- **23 cykle treningowe** (12 pompki + 11 podciąganie) z walidacją planów
- **Własne plany multi-exercise** — biblioteka ćwiczeń, kreator planów, cykl życia (draft/active/paused/completed), import/eksport JSON
- **Społeczność** — katalog planów (publikacja, import, opinie, tagi, sortowanie), follow, publiczne profile
- **Osiągnięcia** — 55 trofeów w 4 trackach (training/habit/catalog/legend) + osiągnięcia sekretne, showcase na profilu
- **Tygodniowe wyzwania** — aktywne wyzwanie (pompki/podciąganie) z leaderboardem
- **AI coach (opcjonalny)** — generator planów, analiza treningu, proactive coach (weekly report, plateau detector, post-workout insights); klucz lokalny, OpenAI-compatible
- **Postępy** — heatmapa aktywności, statystyki, historia sesji z filtrami, body-weight tracking, rekordy, AI analysis
- **Offline-first** — Dexie (IndexedDB), pełna funkcjonalność bez internetu
- **PWA** — instalacja na telefonie, service worker, auto-update, Web Push (VAPID)
- **Retest / zmiana poziomu** — test max albo wybór przedziału bez ponownego testu
- **Opcjonalny cloud sync** — Supabase Auth (e-mail OTP) + sync sesji, planów, ustawień, osiągnięć; tombstony dla deletions
- **i18n** — PL-first + EN, zero hardcoded stringów, parzystość kluczy wymuszana testem

## Stack

Vite · React 19 · TypeScript · Tailwind CSS v4 · Dexie · Zustand · Recharts · vite-plugin-pwa · Supabase

## Szybki start

```bash
git clone https://github.com/filip02521/SmartReps.git
cd SmartReps
npm install
npm run dev
```

Aplikacja: [http://localhost:5173](http://localhost:5173)

## Zmienne środowiskowe

Skopiuj `.env.example` do `.env` (opcjonalnie — bez Supabase aplikacja działa offline):

```bash
cp .env.example .env
```

| Zmienna | Opis |
|---------|------|
| `VITE_SUPABASE_URL` | URL projektu Supabase |
| `VITE_SUPABASE_ANON_KEY` | Klucz anon (publiczny) |
| `VITE_VAPID_PUBLIC_KEY` | Publiczny klucz Web Push (opcjonalnie) |
| `VITE_SENTRY_DSN` | Sentry DSN (opcjonalnie) |

Bez `.env` ekran logowania ma opcję pominięcia — trening działa w pełni lokalnie.

## Skrypty

| Polecenie | Opis |
|-----------|------|
| `npm run dev` | Serwer deweloperski |
| `npm run build` | Build produkcyjny → `dist/` |
| `npm run preview` | Podgląd buildu |
| `npm test` | Testy jednostkowe (Vitest) |
| `npm run validate-plans` | Walidacja 23 cykli treningowych (pompki + podciąganie) |
| `npm run validate-custom-plans` | Walidacja planów custom (schema, dni, serie) |
| `npm run generate-icons` | Generowanie ikon PWA / apple-touch PNG |
| `npm run test:e2e` | Playwright — critical paths, smoke-iphone, community, achievements, custom-plan, login, profile, accessibility |

## Supabase (opcjonalnie)

1. Utwórz projekt na [supabase.com](https://supabase.com)
2. W SQL Editor uruchom migracje z `supabase/migrations/` w kolejności numerycznej (`001_*.sql` → `059_*.sql`). Główne grupy:
   - `001`–`007` — schema, sync, constraints, profiles, push, UI settings
   - `008`–`010` — push config (private/public, dedup)
   - `011`–`015` — custom exercises, session fixes, active workout, sync clocks
   - `016`–`019` — community, custom plan sync, achievements, tier levels
   - `020`–`028` — session notes, body-weight, AI insights, reasoning effort
   - `029`–`035` — community impact, reviews, weekly challenge, follow, public profiles
   - `036`–`050` — RPC bug fixes, RLS, grants, advisor warnings
   - `051`–`056` — achievement showcase, duration display, body-weight cascade, rating summary
   - `057` — subscriptions (Stripe webhook event log)
   - `058` — starter template source (`source: 'starter'` on custom plans)
   - `059` — body-weight entries FK cascade (RODO/GDPR safety)
   - `060` — squats program CHECK constraints (program_progress, workout_sessions, weekly_challenges, profiles.enabled_programs)
3. Wklej URL i anon key do `.env` / Vercel env (**Config**, nie Secret)
4. (Opcjonalnie Web Push) ustaw `VITE_VAPID_PUBLIC_KEY` (Vercel Config + `.env`).
   Sekrety Edge (`VAPID_*`, `CRON_SECRET`) — Dashboard Secrets **albo** wiersze w
   `public.push_config` (RLS, bez polityk). Cron: workflow
   `.github/workflows/push-reminders.yml` (sekrety GH: `PUSH_CRON_SECRET`,
   `SUPABASE_PUSH_FUNCTION_URL`) albo `./scripts/setup-push-secrets.sh` + cron Dashboard.
5. W **Authentication → URL Configuration** ustaw:
   - **Site URL:** `https://smart-reps.vercel.app`
   - **Redirect URLs:** `https://smart-reps.vercel.app/**`, `http://localhost:5173/**`, oraz `/setup/login`
6. **Custom SMTP + szablony OTP** (AWS SES): uzupełnij `SUPABASE_ACCESS_TOKEN` w
   `.env.smtp.local` (gitignored), potem `node scripts/configure-supabase-smtp.mjs`.
   Skrypt ustawia SMTP, `mailer_autoconfirm=true`, szablony Magic Link **i** Confirm
   (`{{ .Token }}` tylko — bez `ConfirmationURL`), `mailer_otp_length=6` i Site URL.
   Nadawca: `SmartReps <SR@ontime.mikran.pl>`. Logowanie wyłącznie kodem (bez linku w mailu).
7. W aplikacji: Profil → Zaloguj się (6-cyfrowy kod z e-maila)

## Produkcja

Live: **https://smart-reps.vercel.app**  
Repo: https://github.com/filip02521/SmartReps

Push na `main` automatycznie deployuje na Vercel. CI: `validate-plans` → `lint` → `test` → `build` → `test:e2e`. CodeQL scan cotygodniowo (niedziela).

## Instalacja PWA

1. Otwórz aplikację w Chrome / Safari na telefonie
2. **Chrome:** menu → „Zainstaluj aplikację” / „Dodaj do ekranu głównego”
3. **Safari:** Udostępnij → „Do ekranu początkowego”
4. W zainstalowanej aplikacji loguj się **6-cyfrowym kodem z e-maila** (nadawca: SR@ontime.mikran.pl)

## Dokumentacja

- [`docs/ux-guidelines.md`](docs/ux-guidelines.md) — Strong-style UX
- [`docs/product.md`](docs/product.md) — persona i metryki sukcesu
- [`/privacy`](https://smart-reps.vercel.app/privacy) · [`/terms`](https://smart-reps.vercel.app/terms)

## Licencja

Projekt prywatny — © Filip Masny
