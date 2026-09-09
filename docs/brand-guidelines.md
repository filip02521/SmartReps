# SmartReps — Brand Guidelines

## Symbol marki: "The Ascend"

Three ascending white bars on a gradient tile (indigo → cyan).

### Znaczenie

| Element | Znaczenie |
|--------|-----------|
| **Wznoszące się belki** | Postęp, progresywne przeładowanie — kluczowa zasada treningu |
| **Trzy belki** | Reps, serie, powtórzenia |
| **Gradient tile (indigo→cyan)** | Spójność z UI — przyciski, AiCoach, tła, akcenty |
| **Wypełnione kształty** | Ostrość przy każdym rozmiarze — zero blur, zero `<text>`, zero `feGaussianBlur` |

### Dlaczego nie ring + litera "R"

Poprzednie logo używało cienkiego pierścienia (stroke 2.5px) + litery "R" jako `<text>` + filtra `feGaussianBlur` (glow). Problemy:

1. **`feGaussianBlur`** dosłownie rozmazywał literę "R" — główne źródło wrażenia "miękkości"
2. **`<text>` w SVG** renderuje się niespójnie między przeglądarkami i rasteryzatorami (sharp/librsvg)
3. **Cienkie kreski** (2.2px ring, 1.3px arc w favicon 32px) stają się subpikselowe przy 16px
4. **Niespójność** między LogoMark (ring+R) a AiCoachMark (disc+path R) — dwa różne języki wizualne

Nowy design rozwiązuje wszystkie problemy: wypełnione prostokąty (`<rect>`) są ostre przy każdym rozmiarze, nie zależą od czcionek, i tworzą spójny język wizualny między LogoMark a AiCoachMark.

---

## Kolory marki

### Dark theme (domyślny)

| Token | Hex | Użycie |
|-------|-----|--------|
| `--sr-brand-primary` | `#6366f1` | Indigo — kolor główny marki |
| `--sr-brand-primary-hover` | `#818cf8` | Hover state |
| `--sr-brand-secondary` | `#22d3ee` | Cyan — akcent, koniec gradientu |
| `--sr-brand-gradient` | `linear-gradient(135deg, #6366f1, #22d3ee)` | Przyciski, akcenty, logo tile |
| `--sr-bg-base` | `#09090b` | Tło bazowe (zinc-950) |

### Light theme

| Token | Hex | Użycie |
|-------|-----|--------|
| `--sr-brand-primary` | `#4f46e5` | Indigo (darker for WCAG AA) |
| `--sr-brand-primary-hover` | `#4338ca` | Hover state |
| `--sr-brand-secondary` | `#0e7490` | Cyan (darker for WCAG AA) |
| `--sr-bg-base` | `#fafafa` | Tło bazowe |

### Kolory programów (akcenty)

| Program | Kolor | Token |
|---------|-------|-------|
| Pompki | `#f97316` (orange) | `--sr-pushups-accent` |
| Podciąganie | `#a78bfa` (violet) | `--sr-pullups-accent` |
| Przysiady | `#14b8a6` (teal) | `--sr-squats-accent` |

---

## Typografia

| Rola | Rozmiar | Waga | Token |
|------|---------|------|-------|
| Display | `clamp(4rem, 18vw, 6rem)` | 700 | `--sr-text-display` |
| H1 | 28px | 700 | `--sr-text-h1` |
| H2 | 22px | 600 | `--sr-text-h2` |
| H3 | 18px | 600 | `--sr-text-h3` |
| Body | 16px | 400 | `--sr-text-body` |
| Body sm | 14px | 400 | `--sr-text-body-sm` |
| Caption | 12px | 500 | `--sr-text-caption` |
| Overline | 11px | 600 | `--sr-text-overline` |

**Font:** Plus Jakarta Sans (`--sr-font`), fallback: system-ui, sans-serif.

**Wordmark:** "Smart" w `--sr-text-primary` (normal weight) + "Reps" w `sr-gradient-text` (bold). Klasa `sr-gradient-text` = gradient background-clip text.

---

## Geometria logo

### LogoMark (viewBox 64×64)

```
Tile: rect 64×64, rx=16, fill=gradient(indigo→cyan, 135°)
Bar 1 (short):  x=13,   y=37, w=9, h=8,  rx=3, fill=white
Bar 2 (medium): x=27.5, y=29, w=9, h=16, rx=3, fill=white
Bar 3 (tall):   x=42,   y=19, w=9, h=26, rx=3, fill=white
```

Belki są bottom-aligned (y=45), pionowo wyśrodkowane (center y=32), symetrycznie wyśrodkowane poziomo (padding 13px lewo/prawo). Ratio wysokości 8:16:26 = 1:2:3.25.

### Favicon (viewBox 32×32)

```
Tile: rect 32×32, rx=8, fill=gradient
Bar 1: x=6.5,  y=18.5, w=4.5, h=4,  rx=1.5
Bar 2: x=13.75,y=14.5, w=4.5, h=8,  rx=1.5
Bar 3: x=21,   y=9.5,  w=4.5, h=13, rx=1.5
```

Belki bottom-aligned (y=22.5), wyśrodkowane (center y=16). Ratio 4:8:13 = 1:2:3.25.

### AiCoachMark (viewBox 64×64, disc r=26)

Ten sam symbol belek wewnątrz tarczy gradientu + iskra AI:
```
Bar 1: x=21, y=35, w=6, h=5,  rx=2
Bar 2: x=29, y=30, w=6, h=10, rx=2
Bar 3: x=37, y=24, w=6, h=16, rx=2
```

Belki bottom-aligned (y=40), wyśrodkowane w tarczy (center y=32). Ratio 5:10:16 = 1:2:3.2.

### App icon (viewBox 512×512)

```
Tile: rect 512×512, rx=112, fill=#09090B (dark)
Bar 1: x=104, y=296, w=72, h=64,  rx=24
Bar 2: x=220, y=232, w=72, h=128, rx=24
Bar 3: x=336, y=152, w=72, h=208, rx=24
```

Belki bottom-aligned (y=360), wyśrodkowane (center y=256). Ratio 64:128:208 = 1:2:3.25.

### App icon maskable (viewBox 512×512)

```
Background: rect 512×512, fill=#09090B (full bleed)
Bar 1: x=128, y=286, w=56, h=48,  rx=18
Bar 2: x=228, y=238, w=56, h=96,  rx=18
Bar 3: x=328, y=178, w=56, h=156, rx=18
```

Belki bottom-aligned (y=334), wyśrodkowane (center y=256). Ratio 48:96:156 = 1:2:3.25. Mniejsze belki w safe zone (central 80%).

---

## Punkty styku marki

| Punkt styku | Komponent | Plik |
|-------------|-----------|------|
| Boot splash (pre-React) | inline SVG | `index.html` |
| Splash screen (React) | `LogoMark` | `src/components/brand/SplashScreen.tsx` |
| Dashboard header | `LogoFull` | `src/pages/Dashboard.tsx` |
| Login | `LogoFull` | `src/pages/setup/Login.tsx` |
| Onboarding | `LogoFull` | `src/pages/setup/Onboarding.tsx` |
| Empty states (15+ miejsc) | `LogoMark` | Plans, Progress, Profile, SessionSummary, etc. |
| AI Coach header | `AiCoachMark` | `src/components/brand/AiCoachHeader.tsx` |
| AI Coach messages | `AiCoachMark` | `src/components/brand/AiCoachHeader.tsx` |
| Favicon | `favicon.svg` + PNG | `public/brand/` |
| PWA icons | PNG (192/512/maskable) | `public/brand/` |
| Apple touch icon | PNG (180) | `public/brand/` |
| Notification icon | PNG (192) | `public/brand/` |
| OG/Twitter image | `icon-512.png` | `public/brand/` |

---

## Pliki marki

### SVG (źródło)

| Plik | Opis |
|------|------|
| `public/brand/logo-mark.svg` | Sam symbol (40×40) z tile |
| `public/brand/logo-wordmark.svg` | Sam wordmark (120×32) |
| `public/brand/logo-full.svg` | Mark + wordmark (200×40) |
| `public/brand/favicon.svg` | Favicon (32×32) z tile |
| `public/brand/app-icon.svg` | App icon (512×512) z dark tile |
| `public/brand/app-icon-mark.svg` | Same belki (512×512) transparent — do kompozycji na ciemnym |
| `public/brand/app-icon-maskable.svg` | Maskable (512×512) full-bleed dark + mniejsze belki |

### PNG (generowane)

Generowane przez `scripts/generate-pwa-icons.mjs`:

| Plik | Rozmiar | Użycie |
|------|---------|--------|
| `icon-512.png` | 512×512 | PWA (purpose: any) |
| `icon-192.png` | 192×192 | PWA (purpose: any) |
| `icon-512-maskable.png` | 512×512 | PWA (purpose: maskable) |
| `apple-touch-icon.png` | 180×180 | Apple touch icon (z `app-icon.svg`) |
| `favicon-32.png` | 32×32 | Favicon PNG (z `favicon.svg` — gradient tile) |
| `favicon-48.png` | 48×48 | Favicon PNG (z `favicon.svg` — gradient tile) |
| `notification-icon.png` | 192×192 | Web Push badge (z `app-icon-mark.svg`) |

**Źródła PNG:**
- `app-icon-mark.svg` → `icon-512.png`, `icon-192.png`, `icon-512-maskable.png`, `notification-icon.png` (dark canvas + gradient bars)
- `app-icon.svg` → `apple-touch-icon.png` (dark tile + gradient bars)
- `favicon.svg` → `favicon-32.png`, `favicon-48.png` (gradient tile + white bars — spójne z SVG favicon)

**Regeneracja:** `node scripts/generate-pwa-icons.mjs` (wymaga `sharp`).

### Komponenty React

| Komponent | Plik | Eksport |
|-----------|------|---------|
| `LogoMark` | `src/components/brand/Logo.tsx` | SVG inline, używa CSS vars |
| `LogoFull` | `src/components/brand/Logo.tsx` | Mark + wordmark |
| `AiCoachMark` | `src/components/brand/AiCoachMark.tsx` | Disc + bars + sparkle |
| `SplashScreen` | `src/components/brand/SplashScreen.tsx` | Boot splash (React) |

---

## Zasady projektowe

1. **Zero blur** — nigdy `feGaussianBlur` na elementach marki. Wypełnione kształty, nie kreski.
2. **Zero `<text>` w SVG** — litery jako `<path>` lub w ogóle bez tekstu w symbolu.
3. **Jeden symbol** — ten sam "Ascend" (trzy wznoszące się belki) w LogoMark i AiCoachMark.
4. **Gradient via CSS vars** — komponenty React używają `var(--sr-brand-primary)` / `var(--sr-brand-secondary)`, nie hardcoded hex.
5. **Hardcoded hex OK w SVG** — pliki SVG w `public/brand/` używają hardcoded hex (nie mają dostępu do CSS vars).
6. **Minimalna wielkość** — LogoMark ≥ 24px, favicon ≥ 16px. Poniżej używaj samego tile bez belek.
7. **Dark canvas dla PWA** — ikony PWA na ciemnym tle (#09090B), belki w gradient.
8. **Spójność tile** — wszystkie ikony używają rounded square (rx proporcjonalny), nie circle.
