# SmartReps — produkt

## Dla kogo

Osoby trenujące pompki i/lub podciąganie w domu, które chcą **jasnego planu dnia**, offline i opcjonalnego syncu między telefonami — bez social feedu i bez AI. Opcjonalnie mogą przeglądać i importować gotowe plany od innych użytkowników (katalog, nie sieć społecznościowa).

## Sukces (metryki)

- **Activation:** ukończony Dzień 1 w ≤ 48 h od pierwszego otwarcia
- **Habit:** ≥ 3 ukończone sesje w 14 dni
- **Trust:** niski odsetek `sync_failed` / OTP fail w PWA standalone
- **Retention:** powrót D7
- **Community:** import (obcy) → 1. ukończona sesja custom ≤ 48 h; publish → ≥1 obcy import / 7d

## W scope

- Cykle pompki + podciąganie, Strong-style workout, postępy, PWA, OTP login, sync Supabase
- **Własne ćwiczenia i plany multi-exercise** (biblioteka, kreator, trening custom)
- **Katalog społecznościowy planów** — publikacja snapshotu, like’i, import jako własny draft (bez feeda i komentarzy)
- Honest reminders (przy otwartej app) + Web Push (VAPID; godzina + dzień gdy trening dostępny po `nextWorkoutAfter`)
- Własne plany: poniżej celu = dzień i tak zaliczony (miękka wzmianka na summary); Strong = fail → restart od dnia 1
- Marka PL-first, privacy/terms

## Poza scope (na razie)

- Angielski i18n, gotowe programy curated Strong (np. przysiady w katalogu builtin), feed / komentarze / follow / rankingi osób, AI dobór planu, CRDT mid-workout
