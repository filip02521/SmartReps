# SmartReps — model biznesowy i roadmap monetyzacji

## Kontekst strategiczny

SmartReps to offline-first PWA do treningu kalistenicznego: pompki, podciąganie i przysiady (38 cykli autorskich, PL-first + EN). Obecnie w pełni darmowa, bez reklam. AI (hosted + BYOK) jest w całości funkcją Pro — hard paywall wdrożony po stronie klienta i Edge Function. Celem jest model **freemium** z subskrypcją Pro, docelowo na App Store + Google Play.

### Pozycja konkurencyjna

| Aplikacja | Model | Cena | Uwagi |
|-----------|-------|------|-------|
| Calisteniapp | Freemium | €9.99/mo, €69.99/yr | 700+ ćwiczeń, 40+ programów, największy konkurent kalisteniki |
| Strong | Freemium | $4.99/mo, $29.99/yr, $99.99 lifetime | Simple tracker, ~$35K/mo, 3 custom routines free |
| Just 6 Weeks | Freemium | premium = no ads + custom + sync | 11 programów, 1M+ instalacji, bardzo podobne do SmartReps |
| Caliprog | Trial → sub | sub po 14 dniach | Progresywna kalistenika, personalized programs |
| Calisthenics AI | Sub | weekly/yearly/lifetime | AI video analysis, chat coach |

### Przewagi SmartReps

- **Offline-first PWA** — brak prowizji App Store (30%), działa na każdym urządzeniu
- **PL-first** — polski rynek niedostatecznie obsłużony przez globalne aplikacje
- **Strong-style UX** — immersyjny flow treningu (checklista serii, timer, auto-start przerwy)
- **Katalog społecznościowy + follow** — warstwa społeczna (plan sharing, reviews, follow)
- **38 cykli autorskich** opartych na ogólnodostępnej metodyce treningu kalistenicznego
- **55 osiągnięć + wyzwania tygodniowe** — grywalizacja napędza zaangażowanie = konwersję
- **AI Coach** — insighty po treningu, raporty tygodniowe, analiza plateau, generator planów (PL-first, structured JSON)

### Ograniczenia do rozwiązania

1. **PWA → native** — docelowo App Store + Google Play; ścieżka: Capacitor (wrap PWA, minimalne zmiany)
2. **Brak infrastruktury płatności** — Phase 1: Stripe/Lemon Squeezy (web); Phase 2: RevenueCat (native IAP)
3. **Brak płatności = paywall AI bez checkoutu** — hosted AI i gating wdrożone, ale do czasu Stripe Pro nadaje się ręcznie w `profiles.subscription_status` lub przez trial
4. **Nisza: pompki + podciąganie + przysiady** — custom plans już obsługują dowolne ćwiczenia; ewentualna rozbudowa builtin cycles to decyzja produktowa, nie techniczna

---

## Model freemium — design

### Zasada: core darmowy napędza wzrost, Pro odblokowuje wartość premium

Dane rynkowe (Adapty SOIS 2026, RevenueCat 2024-2025):
- Health & Fitness: annual plans = 60.6% przychodu kategorii
- Trial-to-paid: median 40%, top 10% = 68%
- Annual subscribers retain 2.4x longer than monthly (33.9% vs 13.8%)
- Hybrid (sub + consumable) zarabia więcej niż sub alone
- 14-21 day trials outperform 7-day (46% vs lower conversion)
- Habit-forming features + community engagement = główne drivery konwersji

### Tabela feature gating

| Funkcja | Free | Pro | Uwagi |
|---------|------|-----|-------|
| **38 cykli builtin (pompki + podciąganie + przysiady)** | ✓ pełne | ✓ pełne | NIE gate'ować — to core value, gating zabija wzrost |
| **Custom plans** | max 3 aktywne | nielimitowane | Limit wystarczający do wypróbowania, blokuje power users |
| **Community browse + import** | ✓ | ✓ | Network effect — darmowy browse napędza katalog |
| **Community publish** | max 3 publikacje | nielimitowane | Autorzy premium = content katalogu |
| **Follow system** | ✓ | ✓ | Social = retention, nie gate'ować |
| **Podstawowe Postępy** (heatmap, historia, rekordy) | ✓ | ✓ | Podstawowa wizualizacja = motywacja = nawyk |
| **Zaawansowane analytics** (body-weight korelacja, e1RM, muscle balance trends) | ✗ | ✓ | Wartość premium dla zaawansowanych |
| **Cele i prognozy** (regresja liniowa → przewidywany termin celu) | ✗ | ✓ | Emocjonalnie silne ("50 pompek ~12.10"), tanie obliczeniowo |
| **AI Coach — wszystkie funkcje AI** (insight, raport, analiza, generator) | ✗ | ✓ | Hard paywall — hosted + BYOK za Pro; free widzi ProTeaser |
| **AI raport tygodniowy server-side + push** | lokalny heurystyczny | AI + push w niedzielę | `send-weekly-report` generuje raport do `ai_insights` (sync → historia w chmurze) i wysyła push z headline |
| **Adaptacyjna progresja planu (AI)** | ✗ | ✓ | AI dostraja ProgressionRule/DeloadRule; propozycja z diffem, user akceptuje — nigdy cicha zmiana |
| **AI Coach — BYOK** (user's own key) | ✗ | ✓ | Zaawansowana opcja dla Pro; zapisany klucz odblokowuje się po upgrade |
| **Lokalne insighty heurystyczne** (po treningu) | ✓ | ✓ | Nie-AI fallback = darmowy teaser wartości AI |
| **14-dniowy trial** | ✓ opt-in | — | "Taste" AI bez darmowej quoty; trial = pełne Pro |
| **Cloud sync (Supabase)** | ✓ | ✓ | Darmowy — data safety przy zmianie urządzenia to oczekiwanie bazowe, nie premium; koszt znikomy, gate karze najbardziej zaangażowanych userów |
| **Web Push reminders** | ✗ | ✓ | Wymaga infrastruktury (VAPID), uzasadnia Pro |
| **Local in-app reminders** | ✓ | ✓ | Darmowe — podstawowa funkcja nawyku |
| **Export CSV** | ✗ | ✓ | "Ładny" format raportowy = wartość premium |
| **Export JSON (backup)** | ✓ | ✓ | Data portability = baseline etyczny — dane usera są jego |
| **Achievement showcase customization** | auto + manual | auto + manual | Darmowe — personalizacja profilu napędza community engagement; za cienkie na osobny paywall |
| **Verified author badge** | ✗ | ✓ | Status społeczny w katalogu — ⚠️ NIE wdrożone jeszcze, nie reklamować w UI (usunięte z tabeli porównania i ProTeaser do czasu implementacji) |
| **Wyzwania tygodniowe** | ✓ | ✓ | Engagement = nie gate'ować |
| **Osiągnięcia (unlock)** | ✓ | ✓ | Gamification = nie gate'ować |
| **High-contrast + theme** | ✓ | ✓ | Dostępność = nie gate'ować |
| **i18n (PL + EN)** | ✓ | ✓ | Nie gate'ować |

### Uzasadnienie gatingu

**Co zostaje darmowe (growth drivers):**
- Wszystkie 38 cykli builtin — to jest powód dla którego user instaluje aplikację
- 3 custom plans — wystarczająco do wypróbowania kreatora
- Community browse + import + publish (max 3) — network effect (więcej userów = więcej planów)
- Podstawowe Postępy — wizualizacja postępu = motywacja = nawyk = konwersja
- Follow + achievements + challenges — engagement = retention = LTV
- Lokalne insighty po treningu — heurystyka bez AI = koszt zero + naturalny teaser Pro
- Auth + community online features (browse, publish, follow) — nie wymagają sync, tylko auth

**Co jest Pro (value drivers):**
- **Całe AI** — hosted SmartReps AI + BYOK: insight po treningu, raport tygodniowy (server-side co niedzielę + push), analiza plateau, generator planów, adaptacyjna progresja. Hard paywall egzekwowany server-side (403 `pro_required`) i client-side; Pro dostaje `AI_MODEL_PRO` (lepszy model)
- Unlimited custom plans — power users potrzebują więcej niż 3
- Advanced analytics + cele/prognozy — wartość dla zaawansowanych użytkowników
- Web Push — wymaga infrastruktury (koszt VAPID + Edge Function)
- Export CSV — "ładny" format raportowy jest wartością premium (surowy backup JSON zostaje darmowy)
- Unlimited publications — autorzy premium = content katalogu

### Pricing

| Plan | Cena PLN | Cena USD | Uwagi |
|------|----------|----------|-------|
| Free | 0 | 0 | Core features, 3 custom plans, lokalne insighty (bez AI) |
| Pro Monthly | 14.99 PLN/mo | ~$3.99/mo | Wszystkie funkcje Pro, cancel anytime |
| Pro Annual | 79.99 PLN/yr | ~$19.99/yr | ~6.67 PLN/mo (44% oszczędności), annual-first |
| Pro Lifetime | 199.99 PLN | ~$49.99 | One-time, wszystkie funkcje Pro na zawsze |

**Strategia cenowa:**
- Annual-first (60.6% przychodu H&F = annual, 2.4x retention vs monthly)
- PLN pricing (PPP-adjusted dla polskiego rynku — 79.99 PLN nie $29.99)
- Lifetime option dla userów nienawidzących subskrypcji (Strong: $99.99, my taniej)
- 14-day free trial ( optimum wg danych: 14-21 dni = 46% konwersji)
- Pricing page: annual z monthly equivalent obok (wzór: 5-7x monthly)

---

## Architektura techniczna

### Phase 1: PWA + Stripe (teraz)

```
User → SmartReps PWA → Stripe Checkout (web)
                         ↓
                    Stripe Webhook → Supabase Edge Function
                         ↓
                    Update profiles.subscription_status
                         ↓
                    Client pulls subscription status on sync
```

**Komponenty:**
1. `src/lib/subscription.ts` — stan subskrypcji, `isProStatus()`, `isPro()`, `useProFeatures()`, trial tracking ✅
2. `src/lib/feature-gating.ts` — `canUseHostedAi()`, `canCreateCustomPlan()`, `canPublishPlan()`, `canCloudSync()`, `canExport()`, `canWebPush()` ✅ (limity egzekwowane od Etapu 1)
3. `src/stores/app-store.ts` — `subscriptionStatus`, `subscriptionExpiresAt`, `trialStartedAt` w `UserSettings` ✅
4. `supabase/functions/stripe-webhook/` — Edge Function odbierająca webhooki Stripe (do zrobienia)
5. `supabase/migrations/057_subscriptions.sql` — kolumny `subscription_status` + `subscription_expires_at` + `trial_started_at` w `profiles` + tabela `subscription_events` ✅
6. `src/pages/setup/Pricing.tsx` — strona cenowa + checkout (do zrobienia; obecnie `ProTeaser` z placeholder CTA)
7. Stripe Customer Portal — zarządzanie subskrypcją (cancel, update payment)

**Schema (wdrożone, migracja 057):**
```sql
-- profiles.subscription_status: 'free' | 'trial' | 'pro' | 'lifetime' | 'expired'
-- profiles.subscription_expires_at timestamptz  — dla trial = koniec okresu próbnego
-- profiles.trial_started_at timestamptz
-- subscription_events — audit trail zmian statusu (trial_started, trial_expired, ...)
```

**App store (wdrożone):**
```typescript
// UserSettings (status przychodzi z Supabase profiles przy sync)
subscriptionStatus: 'free' | 'trial' | 'pro' | 'lifetime' | 'expired'
subscriptionExpiresAt: string | null  // ISO timestamp
trialStartedAt: string | null
```

**Feature gating (wdrożone, `src/lib/subscription.ts`):**
```typescript
isProStatus(status, expiresAt): boolean  // pure — lifetime/pro/trial z ważnym expiresAt
isPro(): boolean                          // non-reactive, dla lib/ i handlerów
useProFeatures(): boolean                 // reactive hook dla komponentów
// feature-gating.ts: canUseHostedAi() = isPro() — AI (hosted + BYOK) w całości za Pro
// FREE_CUSTOM_PLAN_LIMIT = 3, FREE_PUBLICATION_LIMIT = 3
```

### Phase 2: Hosted AI (Edge Function proxy)

```
Pro User → SmartReps PWA → Supabase Edge Function (ai-proxy)
                              ↓
                         AI Provider (OpenAI; endpoint OpenAI-compatible — Gemini/Groq możliwe via AI_BASE_URL)
                              ↓
                         Response back to client
```

**Wybór modelu (aktualne ceny per 1M tokenów in/out, typowe zapytanie ~3-5k in / ~600 out):**
- `gpt-5-mini` ($0.25/$2.00) → ~$0.002-0.005/zapytanie — **model bazowy** (`AI_MODEL`): najlepszy stosunek jakość/cena, bardzo dobry polski, stabilny JSON, reasoning wbudowany
- `gpt-5.4-mini` ($0.75/$4.50) → ~$0.005-0.01/zapytanie — **model premium** (`AI_MODEL_PRO`, nadpisuje `AI_MODEL` dla pro/trial/lifetime): zauważalnie lepsza analiza = konkretny benefit płatności
- `gemini-2.5-flash-lite` ($0.10/$0.40) → ~$0.0005-0.001/zapytanie — budżetowy fallback gdy koszty urosną; proxy wysyła `reasoning_effort: 'none'` (thinking wyłączony = szybko i tanio)
- Uwaga na reasoning: modele gpt-5.x liczą ukryte tokeny myślenia jako output — proxy dodaje +1024 headroom do `max_completion_tokens` i wymusza `reasoning_effort: low` (medium przy generowaniu planu)
- Koszt ponoszą wyłącznie płacący userzy (hard paywall): przy limicie 60/dzień nawet 100 Pro userów dobijających limit ≈ $12-36/dzień teoretyczne max, realnie ułamek tego

**Zaimplementowano (Phase 2):**
1. `supabase/functions/ai-proxy/` — Edge Function proxy ✅
   - Weryfikuje JWT użytkownika (auth)
   - Czyta `subscription_status` z `profiles` → tier (free/pro/trial/lifetime)
   - Atomowy limit dzienny per user: `ai_consume` RPC + tabela `ai_usage_daily` (migracja 078)
   - **AI = hard paywall Pro**: free → 403 `pro_required` (zero AI, hosted i BYOK); Pro/trial/lifetime → 60 wywołań/dzień
   - Klucz API jako Supabase secret (`AI_API_KEY`) — nigdy w kliencie
   - Model i provider wybierane server-side (`AI_MODEL`, `AI_MODEL_PRO`, `AI_BASE_URL`)
   - Whitelist feature'ów + limity rozmiaru payloadu (max 20 wiadomości, 24k znaków, 8k tokenów)
2. `src/lib/ai/managed-client.ts` — `aiChat()` router: `managed` → edge function, BYOK → `chatCompletion()` ✅
3. `resolveAiContext(settings, loggedIn, proAccess)` — zwraca `undefined` dla free (wszystkie call site'y dostają lokalny fallback); dla Pro: BYOK wygrywa gdy ustawiony, inaczej managed dla zalogowanych ✅
4. Settings UI — Pro: status "SmartReps AI — aktywne" + licznik limitu + BYOK jako "zaawansowane"; Free: status "PRO" + opis + CTA upgrade (BYOK i opcje ukryte) ✅

**Hard gate na Pro (wdrożony):** edge function zwraca 403 `pro_required` dla free userów przed konsumpcją quoty; klient mapuje na error kind `pro_required` i pokazuje `ProTeaser` na wszystkich powierzchniach AI (analiza, generator, dashboard CTA, ustawienia). "Taste" = 14-dniowy trial zamiast darmowej quoty.

**Implementacja:** `supabase/functions/ai-proxy/index.ts` — pełny kod w repo. Deploy:

```bash
supabase db push                       # migracja 078: ai_usage_daily + ai_consume + ai_refund
supabase functions deploy ai-proxy --no-verify-jwt
supabase secrets set AI_API_KEY=<klucz> AI_MODEL=gpt-5-mini AI_MODEL_PRO=gpt-5.4-mini
```

Kluczowe elementy: refund quota przy błędach providera (`ai_refund`), timeout 30s na upstream, shaping requestów per-model (Gemini 3.x bez temperature, Gemini 2.5 Flash z reasoning_effort 'none', OpenAI reasoning z max_completion_tokens + headroom), neutralne błędy bez wycieku wnętrzności providera.

### Phase 3: Capacitor → App Store + Google Play

**Capacitor** = wrap PWA w native shell, minimalne zmiany w kodzie:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init SmartReps com.smartreps.app
npx cap add ios
npx cap add android
```

**Co Capacitor daje:**
- Natywny wrapper (App Store + Google Play distribution)
- IAP via `@capacitor-community/in-app-purchases` lub RevenueCat
- Natywne push notifications (lepsze niż Web Push)
- Camera, Haptics, App Links
- Wszystkie istniejące React components działają bez zmian

**RevenueCat** (cross-platform IAP):
- Jedne API dla iOS + Android + Web (Stripe)
- Zarządzanie subskrypcjami, trials, entitlements
- Analytics (konwersja, retention, churn)
- Webhook do Supabase → update `subscription_status`

**Co trzeba dostosować w kodzie:**
- `vite.config.ts` — build output dla Capacitor (`dist/` → `npx cap copy`)
- `src/lib/pwa-detect.ts` — wykryj native vs PWA (`Capacitor.isNativePlatform()`)
- `src/lib/notifications.ts` — natywne push gdy native, Web Push gdy PWA
- `src/lib/subscription.ts` — IAP gdy native, Stripe gdy PWA
- `index.html` — meta tags dla native (safe-area, viewport)
- Service Worker — tylko PWA (native ma własny update mechanism)

**Timeline szacunkowy (po dopracowaniu aplikacji):**
1. Capacitor setup + build config — 1-2 dni
2. IAP integration (RevenueCat) — 2-3 dni
3. App Store review prep (screenshots, metadata, privacy) — 1-2 dni
4. Google Play setup — 1 dzień
5. TestFlight + Internal Testing — 1 tydzień (review process)

---

## Roadmap implementacji

### Etap 0 — przygotowanie ✅ WDROŻONE

Zmiany w kodzie, które NIE wymagają Stripe — wykonane:

1. **`src/lib/subscription.ts`** ✅ — typy, `isProStatus()`/`isPro()`/`useProFeatures()`, `TRIAL_DURATION_DAYS = 14`, `startTrial()` — self-serve przez RPC `start_trial` (migracja 067), bez Stripe
2. **`src/lib/feature-gating.ts`** ✅ — `canUse*()` per feature; `canUseHostedAi()` już egzekwuje `isPro()` (AI = pierwszy aktywny gate)
3. **`src/stores/app-store.ts`** ✅ — `subscriptionStatus`, `subscriptionExpiresAt`, `trialStartedAt` w `UserSettings` + `defaultSettings`
4. **Supabase migration 057** ✅ — kolumny w `profiles` + `subscription_events` (audit trail)
5. **Sync** ✅ — pull subscription status z `profiles`; ai-proxy czyta status server-side
6. **UI: Pro badges + ProTeaser** ✅ — badge "PRO" na wejściach AI (Plans, Profil, Ustawienia), `ProTeaser` na wszystkich powierzchniach AI

### Etap 1 — Stripe + web subscriptions

1. **Stripe account setup** — produkty: Pro Monthly, Pro Annual, Pro Lifetime (do zrobienia w Stripe Dashboard)
2. **`supabase/functions/stripe-webhook/`** ✅ wdrożony — `checkout.session.completed`, `checkout.session.async_payment_succeeded` / `async_payment_failed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`; weryfikacja podpisu (constructEventAsync), idempotentność przez UNIQUE `stripe_event_id` w `subscription_events` (migracja 083), lifetime grant dopiero po `payment_status='paid'` (async P24/BLIK), strażnik stale-event (nie nadpisuje Pro z nowszej subskrypcji), ochrona lifetime przed nadpisaniem
3. **`src/lib/stripe-client.ts`** ✅ — `redirectToCheckout(plan)` / `redirectToPortal()` (fetch z user JWT, konwencja jak ai-proxy)
4. **`supabase/functions/stripe-checkout/`** ✅ szkielet — Checkout Session (subscription lub one-time dla lifetime), `client_reference_id` + `metadata.user_id` wiążą płatność z profilem, reuse `stripe_customer_id`, blokada `already_pro`
5. **`supabase/functions/stripe-portal/`** ✅ szkielet — Customer Portal; 404 `no_customer` dla kont bez historii Stripe (ręczne nadania, lifetime grant)
6. **`src/pages/Pro.tsx`** ✅ podpięte pod `VITE_BILLING_ENABLED` — upgrade → checkout, manage → portal, `?checkout=success|cancel` → toast + refresh statusu; bez flagi CTA bez zmian (trial działa niezależnie)
7. **Feature gating aktywny** ✅ — limity działają: custom plany (3), publikacje (3, też server-side w RPC `publish_community_plan` — migracja 079), export CSV, push, advanced analytics; sync, backup JSON i manual showcase zostają darmowe (decyzja #5 + feature-mix review)
8. **14-day trial** ✅ — self-serve opt-in przez RPC `start_trial` (migracja 067): atomowy, jednorazowy (`trial_started_at` = permanentny znacznik), audit `subscription_events`, działa bez Stripe. Stripe `trial_period_days` niepotrzebne — trial jest aplikacyjny
9. **Server-side push gating** ✅ — `send-workout-reminders` i `send-weekly-report` filtrują odbiorców do aktywnych Pro/trial/lifetime (wcześniej wygasły Pro dostawał push bez końca)

#### Deployment checklist (Stripe go-live)

1. Stripe Dashboard → produkty + ceny: `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `STRIPE_PRICE_LIFETIME` (one-time)
2. Funkcje wdrożone: `stripe-checkout` i `stripe-portal` z verify_jwt, `stripe-webhook` bez (podpis Stripe zamiast JWT)
3. `supabase secrets set STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=... STRIPE_PRICE_MONTHLY=... STRIPE_PRICE_ANNUAL=... STRIPE_PRICE_LIFETIME=... APP_BASE_URL=https://...`
4. Stripe Dashboard → Developers → Webhooks → endpoint `https://<project>.supabase.co/functions/v1/stripe-webhook`, eventy jak w nagłówku funkcji → skopiuj signing secret do `STRIPE_WEBHOOK_SECRET`
5. Vercel env: `VITE_BILLING_ENABLED=true` → redeploy
6. Test: `stripe trigger checkout.session.completed` (CLI) lub test-mode checkout na koncie testowym → sprawdź `subscription_events` + `profiles.subscription_status`
7. Migracja 081 już wdrożona (`stripe_customer_id` + rozszerzony trigger 080)

### Etap 2 — Hosted AI ✅ WDROŻONE (przed Stripe — AI to główny value driver Pro)

1. **`supabase/functions/ai-proxy/`** ✅ — Edge Function proxy (OpenAI-compatible; provider via `AI_BASE_URL`)
2. **`src/lib/ai/managed-client.ts`** ✅ — `aiChat()` router: managed → proxy, BYOK → `chatCompletion()`
3. **`resolveAiContext(settings, loggedIn, proAccess)`** ✅ — free → `undefined` (lokalny fallback), Pro → BYOK lub managed
4. **Rate limiting server-side** ✅ — `ai_usage_daily` + atomowy `ai_consume`/`ai_refund`, 60/dzień dla Pro, 403 `pro_required` dla free
5. **UI: AI gating** ✅ — `ProTeaser` na wszystkich powierzchniach, BYOK jako opcja zaawansowana dla Pro
6. **Pozostało:** deploy (`supabase db push` + `functions deploy` + secrets) + cost monitoring na `ai_usage_daily`

### Etap 3 — Capacitor + App Store + Google Play

1. **Capacitor setup** — init, add ios/android, build config
2. **RevenueCat integration** — cross-platform IAP (iOS + Android + Stripe web)
3. **Native push** — `@capacitor-community/push-notifications` (lepsze niż Web Push)
4. **App Store review** — screenshots, metadata, privacy policy, review process
5. **Google Play** — setup, AAB, review process
6. **Cross-platform sync** — RevenueCat webhook → Supabase → subscription_status

### Etap 4 — optymalizacja i rozwój

1. **Consumable add-ons** — ⚠️ konflikt z obecną decyzją (AI w całości Pro): ewentualne credits tylko dla Pro userów jako top-up ponad dzienny limit, nie dla free
2. **Pricing experiments** — A/B test annual vs monthly default, trial length
3. **Win-back flow** — discount przy cancellation (10% apps używa, działa przy decision point)
4. **Creator economy** — płatne plany w katalogu (SmartReps bierze 20-30%)
5. **B2B** — white-label dla trenerów/siłowni (higher ARPU)

---

## Projections (szacunkowe)

### Koszty operacyjne (miesięczne)

| Pozycja | 100 Pro users | 1000 Pro users | Uwagi |
|---------|---------------|----------------|-------|
| Supabase (free tier → Pro) | $0-25 | $25-100 | Zależy od DB size + Edge Function invocations |
| AI API (gpt-5-mini / gpt-5.4-mini) | ~$3-10 | ~$30-100 | ~$0.002-0.01/request, tylko Pro userzy generują koszty, limit 60/dzień |
| Stripe fees | ~2.9% + $0.30/transaction | ~2.9% + $0.30/transaction | Standard |
| Vercel | $0 (free) | $0-20 | Hobby tier wystarcza długo |
| **Total** | ~$10-40 | ~$80-270 | |

### Przychód (szacunkowy, annual-first)

| Scenariusz | Pro users | ARPU/yr | Przychód/yr | Koszty/yr | Zysk/yr |
|------------|-----------|---------|-------------|-----------|---------|
| Konserwatywny | 100 | ~80 PLN | 8,000 PLN | ~1,200 PLN | ~6,800 PLN |
| Umiarkowany | 500 | ~80 PLN | 40,000 PLN | ~6,000 PLN | ~34,000 PLN |
| Optymistyczny | 2000 | ~80 PLN | 160,000 PLN | ~24,000 PLN | ~136,000 PLN |

**Konwersja zakładana:** 2-5% free → Pro (median H&F: ~40% trial-to-paid, ale install-to-trial ~10%)

### Break-even

Przy kosztach ~$25/miesiąc (Supabase + AI + Vercel) i ARPU ~80 PLN/yr (~$20/yr):
- **~15 Pro users** pokrywa koszty operacyjne
- **~50 Pro users** pokrywa koszty + czas deweloperski (part-time)

---

## Ryzyka i mitygacja

| Ryzyko | Prawdopodobieństwo | Mitygacja |
|--------|-------------------|-----------|
| Userzy odejdą przy wprowadzeniu płatności | Średnie | Core (38 cykli, custom plans, community, podstawowe postępy) zostaje darmowe; AI gate'owane od startu jako nowa wartość premium, z ProTeaser i lokalnym fallbackiem |
| Konkurencja doda podobne funkcje za darmo | Niskie | PL-first + community + Strong-style UX = trudne do skopiowania |
| AI API costs rosną | Średnie | Koszty tylko od płacących (hard paywall), limit 60/dzień per user, `AI_MODEL` można przełączyć na tańszy (gemini-2.5-flash-lite), cache 24h po stronie klienta |
| App Store rejection | Średnie | PWA działa niezależnie; Capacitor to dodatek, nie zależność. Review process ~1 tydzień |
| Polish market price sensitivity | Wysokie | PLN pricing (nie USD), annual-first (niższa miesięczna), lifetime option, 14-day trial |

---

## Decyzje (rozstrzygnięte)

1. **Stripe** — pełna kontrola, lower fees, Stripe Customer Portal
2. **OpenAI dla hosted AI** — `gpt-5-mini` jako `AI_MODEL` (jakość/cena), `gpt-5.4-mini` jako `AI_MODEL_PRO`; proxy jest provider-agnostic (OpenAI-compatible `AI_BASE_URL` pozwala przełączyć na Gemini/Groq bez zmian kodu)
3. **Opt-in trial** — user sam decyduje o rozpoczęciu 14-dniowego trial (nie auto-start)
4. **AI = hard paywall Pro** — żadnych darmowych wywołań AI (ani hosted, ani BYOK); free dostaje lokalne insighty heurystyczne jako teaser; "taste" realizowane przez 14-dniowy trial zamiast darmowej quoty
5. **Cloud sync = darmowy dla wszystkich** — sync między urządzeniami to fundament offline-first i data safety przy zmianie telefonu; gate'owanie karałoby zaangażowanych userów w newralgicznym momencie za znikomy koszt infra. Pro koncentruje się na wartości addytywnej (AI, analytics, limity, export, push)
6. **Capacitor po Stripe + AI** — najpierw dopracować PWA + Stripe + hosted AI, potem native apps
