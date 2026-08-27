# SmartReps

Offline-first PWA do treningu **pompek** i **podciągania** w cyklach progresji (23 cykle na program). Aplikacja działa lokalnie bez konta; opcjonalna synchronizacja przez Supabase.

## Funkcje

- **Strong-style workout** — checklista serii, licznik powtórzeń, timer przerwy z auto-startem
- **23 cykle treningowe** na pompki i podciąganie z walidacją planów
- **Offline-first** — Dexie (IndexedDB), pełna funkcjonalność bez internetu
- **PWA** — instalacja na telefonie, service worker, auto-update
- **Postępy** — heatmapa aktywności, statystyki, historia sesji z filtrami
- **Retest po cyklu** — test maksymalny przed kolejnym cyklem
- **Opcjonalny cloud sync** — Supabase Auth + sync sesji i postępu

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

Bez `.env` ekran logowania ma opcję **„Później”** — trening działa w pełni lokalnie.

## Skrypty

| Polecenie | Opis |
|-----------|------|
| `npm run dev` | Serwer deweloperski |
| `npm run build` | Build produkcyjny → `dist/` |
| `npm run preview` | Podgląd buildu |
| `npm test` | Testy (Vitest) |
| `npm run validate-plans` | Walidacja 23 cykli treningowych |

## Supabase (opcjonalnie)

1. Utwórz projekt na [supabase.com](https://supabase.com)
2. W SQL Editor uruchom migracje w kolejności:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_sync_and_constraints.sql`
   - `supabase/migrations/003_harden_handle_new_user.sql`
3. Wklej URL i anon key do `.env` / Vercel env
4. W **Authentication → URL Configuration** ustaw:
   - **Site URL:** `https://smart-reps.vercel.app`
   - **Redirect URLs:**
     - `https://smart-reps.vercel.app/**`
     - `http://localhost:5173/**`
     - `https://smart-reps.vercel.app/setup/login`
     - `http://localhost:5173/setup/login`
5. W aplikacji: Profil → Zaloguj się (magic link)

## Produkcja

Live: **https://smart-reps.vercel.app**  
Repo: https://github.com/filip02521/SmartReps

Push na `main` automatycznie deployuje na Vercel. CI: `validate-plans` → `lint` → `test` → `build`.

## Deploy na Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Ffilip02521%2FSmartReps)

### Ręcznie (GitHub)

1. [vercel.com/new](https://vercel.com/new) → Import `filip02521/SmartReps`
2. Framework: **Vite** (wykrywany automatycznie)
3. Build: `npm run build` · Output: `dist`
4. Dodaj env vars (`VITE_SUPABASE_*`) jeśli używasz sync
5. Deploy

Plik `vercel.json` zawiera rewrite pod React Router (SPA).

### CLI

```bash
npx vercel          # preview
npx vercel --prod   # produkcja
```

## Instalacja PWA

1. Otwórz aplikację w Chrome / Safari na telefonie
2. **Chrome:** menu → „Zainstaluj aplikację” / „Dodaj do ekranu głównego”
3. **Safari:** Udostępnij → „Do ekranu początkowego”

## Struktura

```
src/
  pages/          # Dashboard, Workout, Progress, Profile, setup flow
  components/     # UI, workout (Strong-style), brand
  data/plans/     # Cykle pompek i podciągania
  lib/            # Dexie, sync, stats, program-service
  stores/         # Zustand (app, workout, toast)
supabase/migrations/
docs/ux-guidelines.md
```

## Licencja

Projekt prywatny — © Filip Masny
