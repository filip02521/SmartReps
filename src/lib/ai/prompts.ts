/**
 * Research-based prompt templates for AI plan generation and workout analysis.
 *
 * Grounded in:
 * - Schoenfeld BJ, et al. (2017) — volume thresholds for hypertrophy (MEV/MAV/MRV)
 * - Schoenfeld BJ, et al. (2016) — training frequency 2x/week per muscle group
 * - Helms ER, et al. — RPE/RIR-based load prescription
 * - Israetel M, Hoffmann A — volume landmarks & periodization
 * - Rhea MR (2003) — dose-response relationship for strength (3 sets per exercise)
 * - Robbins DW, et al. — exercise selection for hypertrophy
 */

import type { ExerciseDefinition, MuscleGroup } from '@/lib/exercise-model'
import type { ChatMessage } from './ai-client'

// ─── Research context injected into every prompt ───────────────────────────

export const RESEARCH_CONTEXT = `Jesteś ekspertem ds. treningu siłowego z wiedzą opartą na badaniach naukowych.

Kluczowe zasady, którymi się kierujesz:

1. OBJĘTOŚĆ (Volume Landmarks — Israetel & Hoffmann):
   - MEV (Minimum Effective Volume): 10 serii na grupę mięśniową na tydzień (początkujący)
   - MAV (Maximum Adaptive Volume): 15-25 serii na grupę mięśniową na tydzień (średniozaawansowani)
   - MRV (Maximum Recoverable Volume): 20-30+ serii na grupę mięśniową na tydzień (zaawansowani)
   - Każda grupa mięśniowa powinna otrzymać objętość w zakresie MEV-MAV

2. CZĘSTOTLIWOŚĆ (Schoenfeld et al. 2016):
   - Każda grupa mięśniowa 2x w tygodniu (optymalne dla hipertrofii)
   - 1x w tygodniu akceptowalne dla początkujących lub przy niskiej częstotliwości treningowej
   - 3x+ w tygodniu dla małych grup (core, łydki) lub gdy objętość jest niska

3. PROGRESJA (Progressive Overload):
   - Zwiększaj obciążenie o 2.5-5% lub 1-2 powtórzenia gdy wszystkie serie są w zakresie RPE 7-8
   - RPE 7 = zostawiasz 3 powtórzenia w rezerwie (RIR=3)
   - RPE 8 = zostawiasz 2 powtórzenia w rezerwie (RIR=2)
   - RPE 9 = zostawiasz 1 powtórzenie w rezerwie (RIR=1)
   - Nie trenuj do upadku mięśniowego regularnie (RPE 10) — zwiększa ryzyko kontuzji i zmęczenie

4. WYBÓR ĆWICZEŃ:
   - Priorytetyzuj ćwiczenia wielostawowe (przysiady, martwy ciąg, wyciskanie, wiosłowanie)
   - 60-70% objętości z ćwiczeń wielostawowych, 30-40% z izolacji
   - Na każdą grupę mięśniową: 1 ćwiczenie wielostawowe + 1-2 izolacje

5. PRZERWY (Rest intervals):
   - Ćwiczenia siłowe (1-6 rep): 3-5 min
   - Hipertrofia (6-12 rep): 60-90 sek
   - Wytrzymałość (12+ rep): 30-60 sek
   - Core/izolacje: 45-60 sek

6. DELOAD:
   - Co 4-6 tygodni zmniejsz objętość o 40-50% przy zachowaniu intensywności
   - Deload po 3-4 tygodniach przy wysokim RPE (8-9)

7. BEZPIECZEŃSTWO:
   - Nigdy nie proponuj ćwiczeń z dużym ryzykiem kontuzji bez odpowiedniego przygotowania
   - Uwzględniaj poziom doświadczenia i dostępny sprzęt
   - Zawsze zaczynaj od rozgrzewki (5-10 min) — nie wliczaj w objętość`

// ─── Plan generation prompt ────────────────────────────────────────────────

export type PlanGenerationInput = {
  description: string
  daysPerWeek: number
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  equipment: 'bodyweight' | 'dumbbells' | 'barbell' | 'full_gym' | 'kettlebell'
  goal: 'hypertrophy' | 'strength' | 'endurance' | 'general_fitness' | 'fat_loss'
  sessionDurationMin?: number
}

export function buildPlanGenerationPrompt(
  input: PlanGenerationInput,
  library: ExerciseDefinition[],
): { system: ChatMessage; user: ChatMessage } {
  const libraryList = library
    .filter((e) => !e.archived)
    .map(
      (e) =>
        `  - id: "${e.id}", nazwa: "${e.name}", metryka: "${e.primaryMetric}", grupa: "${e.muscleGroup ?? 'other'}"`,
    )
    .join('\n')

  const equipmentMap: Record<PlanGenerationInput['equipment'], string> = {
    bodyweight: 'tylko masa ciała (bez sprzętu)',
    dumbbells: 'hantle',
    barbell: 'sztanga',
    full_gym: 'pełna siłownia',
    kettlebell: 'odwążki (kettlebell)',
  }

  const goalMap: Record<PlanGenerationInput['goal'], string> = {
    hypertrophy: 'hipertrofia (budowa masy mięśniowej)',
    strength: 'siła',
    endurance: 'wytrzymałość mięśniowa',
    general_fitness: 'ogólna sprawność',
    fat_loss: 'redukcja tkanki tłuszczowej',
  }

  const experienceMap: Record<PlanGenerationInput['experienceLevel'], string> = {
    beginner: 'początkujący (0-6 miesięcy doświadczenia)',
    intermediate: 'średniozaawansowany (6 miesięcy - 2 lata)',
    advanced: 'zaawansowany (2+ lata)',
  }

  const userPrompt = `Ułóż plan treningowy na podstawie:
- Opis użytkownika: "${input.description}"
- Dni w tygodniu: ${input.daysPerWeek}
- Poziom: ${experienceMap[input.experienceLevel]}
- Sprzęt: ${equipmentMap[input.equipment]}
- Cel: ${goalMap[input.goal]}
${input.sessionDurationMin ? `- Czas jednego treningu: ~${input.sessionDurationMin} min` : ''}

BIBLIOTEKA ĆWICZEŃ (używaj tych gdy pasują, ale możesz proponować nowe):
${libraryList || '  (pusta biblioteka)'}

ZASADY:
1. Używaj ćwiczeń z biblioteki gdy pasują do celu i sprzętu. Jeśli używasz ćwiczenia z biblioteki, zachowaj jego primaryMetric.
2. Możesz proponować NOWE ćwiczenia — zostaną dodane do biblioteki. Podaj realistyczną nazwę po polsku.
3. Każde ćwiczenie musi mieć metrykę: "reps" (powtórzenia), "reps_weight" (powtórzenia + ciężar), lub "duration_sec" (czas w sekundach). Dla ćwiczeń z ciężarem używaj "reps_weight" i ustaw weightKg w seriach.
4. Dobierz serie, powtórzenia i przerwy zgodnie z badaniami (patrz kontekst systemowy).
5. Rozłóż grupy mięśniowe na dni tak, aby każda była trenowana 2x w tygodniu (lub 1x dla początkujących).
6. Uwzględnij przerwę po dniu treningowym (1 lub 2 dni).
7. Dodaj progresję (zwiększaj o 1-2 powtórzenia lub 2.5kg po pełnym cyklu).
8. Zwróć DOKŁADNIE ${input.daysPerWeek} dni treningowych (tyle ile użytkownik wybrał).
9. Maksymalnie 10 ćwiczeń na dzień, maksymalnie 5 serii na ćwiczenie.
10. Nazwa planu po polsku, krótka i opisowa (np. "Push/Pull/Legs 4x tyg.").
11. Używaj TYLKO kind: "fixed", "max", "min", lub "exact". NIE używaj "range" ani innych.

DOZWOLONE wartości muscleGroup: "chest", "back", "shoulders", "arms", "legs", "core", "full_body", "cardio", "other".
DOZWOLONE wartości primaryMetric: "reps", "reps_weight", "duration_sec".
DOZWOLONE wartości kind w MetricTarget: "fixed", "max", "min", "exact".

Zwróć JSON w tym formacie (to jest przykład, podmień wartości):
{
  "plan": {
    "name": "Push/Pull/Legs 4x tyg.",
    "description": "Plan na hipertrofię z hantlami, 4 dni w tygodniu.",
    "days": [
      {
        "dayNumber": 1,
        "restAfterDay": 1,
        "exercises": [
          {
            "exerciseName": "Pompki",
            "primaryMetric": "reps",
            "muscleGroup": "chest",
            "sets": [
              { "reps": { "kind": "fixed", "value": 10 } },
              { "reps": { "kind": "fixed", "value": 10 } },
              { "reps": { "kind": "max", "value": 8 } }
            ],
            "restBetweenSetsSec": 90,
            "restAfterExerciseSec": 120,
            "note": "RPE 7-8"
          }
        ]
      }
    ],
    "progression": {
      "enabled": true,
      "repsDelta": 1,
      "weightKgDelta": 2.5,
      "afterCycleComplete": true
    },
    "rationale": "Plan rozkłada objętość 12-16 serii na główne grupy, 2x w tygodniu."
  }
}`

  return {
    system: { role: 'system', content: RESEARCH_CONTEXT },
    user: { role: 'user', content: userPrompt },
  }
}

// ─── Workout analysis prompt ───────────────────────────────────────────────

export type WorkoutHistorySummary = {
  totalSessions: number
  totalSets: number
  totalReps: number
  dateRange: { first: string; last: string } | null
  sessionsPerWeek: number
  muscleGroupVolume: { muscleGroup: MuscleGroup; weeklySets: number }[]
  recentSessions: {
    date: string
    planName: string
    dayNumber: number
    exercises: { name: string; sets: number; reps?: number; weightKg?: number }[]
  }[]
  activePlanName?: string
}

export function buildWorkoutAnalysisPrompt(
  history: WorkoutHistorySummary,
): { system: ChatMessage; user: ChatMessage } {
  const volumeTable = history.muscleGroupVolume
    .map((v) => `  ${v.muscleGroup}: ${v.weeklySets} serii/tydzień`)
    .join('\n')

  const recentTable = history.recentSessions
    .slice(0, 10)
    .map((s) => {
      const exs = s.exercises.map((e) => `${e.name} (${e.sets}x${e.reps ?? ''}${e.weightKg ? ` @${e.weightKg}kg` : ''})`).join(', ')
      return `  ${s.date} — ${s.planName} D${s.dayNumber}: ${exs}`
    })
    .join('\n')

  const userPrompt = `Przeanalizuj historię treningów użytkownika i daj konkretne sugestie.

DANE:
- Liczba sesji: ${history.totalSessions}
- Liczba serii łącznie: ${history.totalSets}
- Liczba powtórzeń łącznie: ${history.totalReps}
- Okres: ${history.dateRange ? `${history.dateRange.first} → ${history.dateRange.last}` : 'brak danych'}
- Sesji na tydzień: ${history.sessionsPerWeek.toFixed(1)}
${history.activePlanName ? `- Aktywny plan: ${history.activePlanName}` : ''}

OBJĘTOŚĆ NA GRUPĘ MIĘŚNIOWĄ (serie/tydzień):
${volumeTable || '  (brak danych)'}

OSTATNIE SESJE:
${recentTable || '  (brak sesji)'}

Zasady analizy:
1. Porównaj objętość z zakresami MEV/MAV/MRV (patrz kontekst systemowy).
2. Sprawdź czy częstotliwość treningowa jest optymalna.
3. Zidentyfikuj grupy mięśniowe z niedostateczną lub nadmierną objętością.
4. Sprawdź czy progresja jest odpowiednia.
5. Daj 3-5 konkretnych, praktycznych sugestii (po polsku).

Zwróć JSON w tym formacie (to jest przykład, podmień wartości):
{
  "analysis": {
    "summary": "Ogólna ocena treningów (2-3 zdania po polsku)",
    "strengths": ["Mocna strona 1", "Mocna strona 2"],
    "weaknesses": ["Słaba strona 1", "Słaba strona 2"],
    "suggestions": [
      {
        "title": "Zwiększ objętość na plecy",
        "description": "Trenujesz plecy 1x w tygodniu z 6 seriami. Dodaj drugi dzień lub ćwiczenie.",
        "priority": "high"
      }
    ],
    "volumeAssessment": [
      {
        "muscleGroup": "chest",
        "weeklySets": 12,
        "status": "optimal",
        "recommendation": "Objętość w zakresie MAV, utrzymaj."
      }
    ]
  }
}

DOZWOLONE wartości priority: "high", "medium", "low".
DOZWOLONE wartości status: "optimal", "below_mev", "above_mrv", "low", "high".
DOZWOLONE wartości muscleGroup: "chest", "back", "shoulders", "arms", "legs", "core", "full_body", "cardio", "other".`

  return {
    system: { role: 'system', content: RESEARCH_CONTEXT },
    user: { role: 'user', content: userPrompt },
  }
}

// ─── Types for AI response ─────────────────────────────────────────────────

export type AiPlanResponse = {
  plan: {
    name: string
    description: string
    days: {
      dayNumber: number
      restAfterDay: 1 | 2
      exercises: {
        exerciseName: string
        primaryMetric: 'reps' | 'reps_weight' | 'duration_sec'
        muscleGroup?: MuscleGroup
        sets: { reps?: { kind: string; value?: number; min?: number; max?: number }; durationSec?: { kind: string; value?: number; min?: number; max?: number }; weightKg?: { kind: string; value?: number; min?: number; max?: number } }[]
        restBetweenSetsSec: number
        restAfterExerciseSec?: number
        note?: string
      }[]
    }[]
    progression?: {
      enabled: boolean
      repsDelta?: number
      weightKgDelta?: number
      durationSecDelta?: number
      afterCycleComplete?: boolean
    }
    rationale?: string
  }
}

export type AiAnalysisResponse = {
  analysis: {
    summary: string
    strengths: string[]
    weaknesses: string[]
    suggestions: {
      title: string
      description: string
      priority: 'high' | 'medium' | 'low'
    }[]
    volumeAssessment: {
      muscleGroup: string
      weeklySets: number
      status: 'optimal' | 'below_mev' | 'above_mrv' | 'low' | 'high'
      recommendation: string
    }[]
  }
}
