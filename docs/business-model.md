# SmartReps — model biznesowy i roadmap monetyzacji

## Kontekst strategiczny

SmartReps to offline-first PWA do treningu pompek i podciągania (23 cykle, PL-first + EN). Obecnie w pełni darmowa, bez reklam, z BYOK AI (user przynosi własny klucz API). Celem jest przejście na model **freemium** z subskrypcją Pro, docelowo na App Store + Google Play.

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
- **BYOK AI** — zero kosztów AI dla SmartReps (user przynosi własny klucz)

### Ograniczenia do rozwiązania

1. **PWA → native** — docelowo App Store + Google Play; ścieżka: Capacitor (wrap PWA, minimalne zmiany)
2. **Brak infrastruktury płatności** — Phase 1: Stripe/Lemon Squeezy (web); Phase 2: RevenueCat (native IAP)
3. **BYOK AI = tarcie UX** — dodać hosted AI jako funkcja Pro (SmartReps trzyma klucz, user płaci subskrypcję)
4. **Nisza: pompki + podciąganie** — custom plans już obsługują dowolne ćwiczenia; ewentualna rozbudowa builtin cycles to decyzja produktowa, nie techniczna

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
| **23 cykle builtin (pompki + podciąganie)** | ✓ pełne | ✓ pełne | NIE gate'ować — to core value, gating zabija wzrost |
| **Custom plans** | max 3 aktywne | nielimitowane | Limit wystarczający do wypróbowania, blokuje power users |
| **Community browse + import** | ✓ | ✓ | Network effect — darmowy browse napędza katalog |
| **Community publish** | max 3 publikacje | nielimitowane | Autorzy premium = content katalogu |
| **Follow system** | ✓ | ✓ | Social = retention, nie gate'ować |
| **Podstawowe Postępy** (heatmap, historia, rekordy) | ✓ | ✓ | Podstawowa wizualizacja = motywacja = nawyk |
| **Zaawansowane analytics** (body-weight korelacja, e1RM, muscle balance trends) | ✗ | ✓ | Wartość premium dla zaawansowanych |
| **AI Coach — BYOK** (user's own key) | ✓ | ✓ | Free user może używać z własnym kluczem |
| **AI Coach — Hosted** (SmartReps-provided key) | ✗ | ✓ | Kluczowa funkcja Pro — usuwa tarcie UX |
| **AI plan generation** | 1 darmowy (trial) | nielimitowane | Trial AI = hook do konwersji |
| **AI workout analysis** | 1 darmowy (trial) | nielimitowane | Trial AI = hook do konwersji |
| **AI proactive coach** (weekly report, plateau, post-workout) | ✗ (BYOK only) | ✓ (hosted + BYOK) | Pro = hosted AI proactive |
| **Cloud sync (Supabase)** | ✗ | ✓ | Pro-only — sync między urządzeniami. Auth + community (browse/publish/follow) pozostają darmowe |
| **Web Push reminders** | ✗ | ✓ | Wymaga infrastruktury (VAPID), uzasadnia Pro |
| **Local in-app reminders** | ✓ | ✓ | Darmowe — podstawowa funkcja nawyku |
| **Export (CSV + JSON backup)** | ✗ | ✓ | Data portability = wartość premium |
| **Achievement showcase customization** | auto only | auto + manual | Kosmetyczne, ale Pro-exclusive |
| **Verified author badge** | ✗ | ✓ | Status społeczny w katalogu |
| **Wyzwania tygodniowe** | ✓ | ✓ | Engagement = nie gate'ować |
| **Osiągnięcia (unlock)** | ✓ | ✓ | Gamification = nie gate'ować |
| **High-contrast + theme** | ✓ | ✓ | Dostępność = nie gate'ować |
| **i18n (PL + EN)** | ✓ | ✓ | Nie gate'ować |

### Uzasadnienie gatingu

**Co zostaje darmowe (growth drivers):**
- Wszystkie 23 cykli builtin — to jest powód dla którego user instaluje aplikację
- 3 custom plans — wystarczająco do wypróbowania kreatora
- Community browse + import + publish (max 3) — network effect (więcej userów = więcej planów)
- Podstawowe Postępy — wizualizacja postępu = motywacja = nawyk = konwersja
- Follow + achievements + challenges — engagement = retention = LTV
- BYOK AI — user z własnym kluczem może używać AI za darmo (zero kosztów dla SmartReps)
- Auth + community online features (browse, publish, follow) — nie wymagają sync, tylko auth

**Co jest Pro (value drivers):**
- Hosted AI — najważniejsza funkcja Pro (usuwa tarcie UX klucza API)
- Unlimited custom plans — power users potrzebują więcej niż 3
- Advanced analytics — wartość dla zaawansowanych użytkowników
- Web Push — wymaga infrastruktury (koszt VAPID + Edge Function)
- Export — data portability jest wartością premium
- Unlimited publications — autorzy premium = content katalogu

### Pricing

| Plan | Cena PLN | Cena USD | Uwagi |
|------|----------|----------|-------|
| Free | 0 | 0 | Core features, 3 custom plans, BYOK AI |
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
1. `src/lib/subscription.ts` — stan subskrypcji, sprawdzanie Pro, trial tracking
2. `src/lib/feature-gating.ts` — funkcje `isPro()`, `useProFeatures()`, `checkFeatureLimit()`
3. `src/stores/app-store.ts` — dodaj `subscriptionStatus`, `subscriptionExpiresAt`, `trialStartedAt`
4. `supabase/functions/stripe-webhook/` — Edge Function odbierająca webhooki Stripe
5. `supabase/migrations/057_subscriptions.sql` — tabela `subscriptions` + kolumny w `profiles`
6. `src/pages/setup/Pricing.tsx` — strona cenowa + checkout
7. Stripe Customer Portal — zarządzanie subskrypcją (cancel, update payment)

**Supabase schema (migration 057):**
```sql
-- Subscription status on profiles
alter table profiles add column subscription_status text default 'free';
  -- 'free' | 'trial' | 'pro_monthly' | 'pro_annual' | 'lifetime' | 'expired'
alter table profiles add column subscription_expires_at timestamptz;
alter table profiles add column trial_started_at timestamptz;

-- Subscription events log (audit trail)
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null,  -- 'active' | 'canceled' | 'past_due' | 'trialing'
  plan text not null,    -- 'pro_monthly' | 'pro_annual' | 'lifetime'
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

**App store changes:**
```typescript
// Nowe pola w UserSettings (NOT synced — comes from Supabase profiles)
subscriptionStatus: 'free' | 'trial' | 'pro' | 'lifetime'
subscriptionExpiresAt: string | null  // ISO timestamp
trialStartedAt: string | null

// Nowe pola w AppStore (ephemeral, not persisted)
isProUser: boolean  // computed from subscriptionStatus + expiresAt
```

**Feature gating pattern:**
```typescript
// src/lib/feature-gating.ts
export function isPro(): boolean {
  const { settings } = useAppStore.getState()
  if (settings.subscriptionStatus === 'lifetime') return true
  if (settings.subscriptionStatus === 'pro') {
    if (!settings.subscriptionExpiresAt) return true
    return new Date(settings.subscriptionExpiresAt) > new Date()
  }
  if (settings.subscriptionStatus === 'trial') {
    // 14-day trial
    if (!settings.trialStartedAt) return false
    const trialEnd = new Date(settings.trialStartedAt)
    trialEnd.setDate(trialEnd.getDate() + 14)
    return trialEnd > new Date()
  }
  return false
}

export function useProFeatures(): boolean {
  return useAppStore((s) => {
    // same logic as isPro but reactive
  })
}

export const FREE_CUSTOM_PLAN_LIMIT = 3
export const FREE_PUBLISH_LIMIT = 3
```

### Phase 2: Hosted AI (Edge Function proxy)

```
Pro User → SmartReps PWA → Supabase Edge Function (ai-proxy)
                              ↓
                         AI Provider (Gemini Flash / Groq)
                              ↓
                         Response back to client
```

**Dlaczego Gemini Flash / Groq (nie GPT):**
- Gemini 2.5 Flash: ~$0.075/1M input tokens, ~$0.30/1M output → ~$0.01-0.03 per request
- Groq (Llama): ~$0.05/1M tokens → ~$0.01-0.02 per request
- GPT-5-mini: ~$0.08-0.15 per request (5-10x droższy)
- Przy 4-5 treningach/tydzień: ~$0.04-0.15/user/miesiąc (Gemini Flash) vs ~$2-3 (GPT)

**Komponenty:**
1. `supabase/functions/ai-proxy/` — Edge Function proxy
   - Sprawdza `subscription_status` (tylko Pro/trial)
   - Rate limiting per user (reuse `rate-limiter.ts` logic server-side)
   - API key jako Supabase secret (nie w kliencie)
   - Forward do Gemini/Groq API
2. `src/lib/ai/ai-client.ts` — dodaj `hostedCall()` obok istniejącego `chatCompletion()`
3. `src/lib/ai/config.ts` — wybór źródła AI: `byok` | `hosted` (Pro only) | `hosted-fallback`
4. App store: `aiSource: 'byok' | 'hosted'` (default: 'hosted' dla Pro, 'byok' dla free)

**Edge Function (sketch):**
```typescript
// supabase/functions/ai-proxy/index.ts
import { createClient } from '@supabase/supabase-js'

Deno.serve(async (req) => {
  const supabase = createClient(URL, ANON_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization')! } }
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Check subscription
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_status, subscription_expires_at')
    .eq('id', user.id).single()
  if (!isPro(profile)) return new Response('Pro required', { status: 403 })

  // Rate limit (per user, per feature)
  // ... reuse rate-limiter logic

  // Forward to AI provider
  const { messages, feature } = await req.json()
  const response = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${GEMINI_API_KEY}` },
    body: JSON.stringify({ model: 'gemini-2.5-flash', messages, ... })
  })
  return new Response(await response.text(), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

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

### Etap 0 — przygotowanie (teraz, bez płatności)

Zmiany w kodzie, które NIE wymagają Stripe ale przygotowują infrastrukturę:

1. **`src/lib/subscription.ts`** — typy, stan, `isPro()`, trial logic
2. **`src/lib/feature-gating.ts`** — `useProFeatures()`, limity (custom plans, publications)
3. **`src/stores/app-store.ts`** — dodaj `subscriptionStatus`, `subscriptionExpiresAt`, `trialStartedAt` do `UserSettings`; `isProUser` computed
4. **Supabase migration 057** — kolumny `subscription_status` + `subscription_expires_at` + `trial_started_at` w `profiles`
5. **Sync** — pull subscription status z `profiles` w `pullProfileEnabledPrograms`
6. **UI: Pro badges** — dodaj "PRO" badge przy gate'owanych funkcjach (nie blokuj jeszcze, pokaż tylko)
7. **UI: Paywall teaser** — komponent `ProTeaser` pokazujący "Upgrade to Pro" przy gate'owanych funkcjach (link do pricing page placeholder)

### Etap 1 — Stripe + web subscriptions

1. **Stripe account setup** — produkty: Pro Monthly, Pro Annual, Pro Lifetime
2. **`supabase/functions/stripe-webhook/`** — odbierz `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
3. **`src/pages/setup/Pricing.tsx`** — strona cenowa z Stripe Checkout
4. **`src/lib/stripe-client.ts`** — redirect do Stripe Checkout
5. **Feature gating aktywny** — blokuj funkcje Pro dla free users
6. **14-day trial** — auto-start przy pierwszym otwarciu (jeśli user ma konto)
7. **Profile → Subscription section** — status, manage (Stripe Customer Portal), cancel

### Etap 2 — Hosted AI

1. **`supabase/functions/ai-proxy/`** — Edge Function proxy do Gemini Flash / Groq
2. **`src/lib/ai/ai-client.ts`** — dodaj `hostedCall()` obok BYOK
3. **`src/lib/ai/config.ts`** — wybór źródła AI (hosted dla Pro, BYOK dla free)
4. **Rate limiting server-side** — per user, per feature (reuse `rate-limiter.ts` logic)
5. **UI: AI source toggle** — w Settings (Pro: hosted/byok, Free: byok only)
6. **Cost monitoring** — Supabase analytics na AI API spend per user

### Etap 3 — Capacitor + App Store + Google Play

1. **Capacitor setup** — init, add ios/android, build config
2. **RevenueCat integration** — cross-platform IAP (iOS + Android + Stripe web)
3. **Native push** — `@capacitor-community/push-notifications` (lepsze niż Web Push)
4. **App Store review** — screenshots, metadata, privacy policy, review process
5. **Google Play** — setup, AAB, review process
6. **Cross-platform sync** — RevenueCat webhook → Supabase → subscription_status

### Etap 4 — optymalizacja i rozwój

1. **Consumable add-ons** — AI plan generation credits dla free users (hybrid model)
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
| AI API (Gemini Flash) | ~$5-15 | ~$50-150 | ~$0.01-0.03/request, ~4-5 treningów/user/tydzień |
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
| Userzy odejdą przy wprowadzeniu płatności | Średnie | Etap 0: nic nie blokuj, tylko pokaż Pro badges. Etap 1: wszystko co jest darmowe zostaje darmowe, gate'uj tylko nowe/zaawansowane |
| Konkurencja doda podobne funkcje za darmo | Niskie | PL-first + community + Strong-style UX = trudne do skopiowania |
| AI API costs rosną | Średnie | Gemini Flash / Groq (najtańsze), rate limiting per user, cache 24h (już zaimplementowane) |
| App Store rejection | Średnie | PWA działa niezależnie; Capacitor to dodatek, nie zależność. Review process ~1 tydzień |
| Polish market price sensitivity | Wysokie | PLN pricing (nie USD), annual-first (niższa miesięczna), lifetime option, 14-day trial |

---

## Decyzje (rozstrzygnięte)

1. **Stripe** — pełna kontrola, lower fees, Stripe Customer Portal
2. **Gemini** (quality-first) — Gemini 2.5 Flash/Pro dla hosted AI (reasoning, stabilność, jakość)
3. **Opt-in trial** — user sam decyduje o rozpoczęciu 14-dniowego trial (nie auto-start)
4. **Cloud sync = Pro only** — free users używają lokalnie (Dexie), sync między urządzeniami = Pro. Auth + community (browse, publish, follow) pozostają darmowe (to funkcje online, nie sync)
5. **Capacitor po Stripe + AI** — najpierw dopracować PWA + Stripe + hosted AI, potem native apps
