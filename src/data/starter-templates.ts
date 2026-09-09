import type {
  DeloadRule,
  ExerciseGroup,
  ExerciseStarterKey,
  MuscleGroup,
  ProgressionRule,
  SetPrescription,
} from '@/lib/exercise-model'

/** Kategorie szablonów — 3, bez nakładania się (home = bez sprzętu, gym = ze sprzętem, cardio). */
export type StarterTemplateCategory = 'home' | 'gym' | 'cardio'

export type StarterTemplateDifficulty = 'beginner' | 'intermediate' | 'advanced'

/** Sprzęt — align z AI generator (`PlanGenerationInput.equipment`). */
export type StarterTemplateEquipment =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell'
  | 'full_gym'
  | 'kettlebell'

/** Referencja do ćwiczenia przez starter key — match po nazwie w materializeStarterTemplate. */
export type StarterTemplateExerciseRef = {
  starterKey: ExerciseStarterKey
  sets: SetPrescription[]
  restBetweenSetsSec: number
  restAfterExerciseSec?: number
  note?: string
  /** Links exercise into a day group (superset / circuit / AMRAP). */
  groupId?: string
  /** Overrides plan-level progression for this exercise only. */
  progression?: ProgressionRule | null
}

export type StarterTemplateDay = {
  dayNumber: number
  exercises: StarterTemplateExerciseRef[]
  restAfterDay: 1 | 2
  groups?: ExerciseGroup[]
}

export type StarterTemplate = {
  id: string
  category: StarterTemplateCategory
  difficulty: StarterTemplateDifficulty
  daysPerWeek: 2 | 3 | 4 | 5
  equipment: StarterTemplateEquipment
  muscleFocus: MuscleGroup[]
  days: StarterTemplateDay[]
  progression: ProgressionRule | null
  deload: DeloadRule | null
}

// ── Helpers do budowania set prescriptions ──

function reps(value: number): SetPrescription {
  return { reps: { kind: 'fixed', value } }
}

function repsMax(min: number): SetPrescription {
  return { reps: { kind: 'max', minValue: min } }
}

function repsWeight(reps: number, weightKg: number): SetPrescription {
  return { reps: { kind: 'fixed', value: reps }, weightKg: { kind: 'fixed', value: weightKg } }
}

function durationSec(sec: number): SetPrescription {
  return { durationSec: { kind: 'fixed', value: sec } }
}

// ── Progresje ──

const HYPERTROPHY_PROGRESSION: ProgressionRule = {
  enabled: true,
  afterCycleComplete: true,
  repsDelta: 2,
}

const STRENGTH_PROGRESSION: ProgressionRule = {
  enabled: true,
  afterCycleComplete: true,
  repsDelta: 1,
}

const ENDURANCE_PROGRESSION: ProgressionRule = {
  enabled: true,
  afterCycleComplete: true,
  repsDelta: 3,
}

// ── 9 szablonów opartych na dowodach ──

export const STARTER_TEMPLATES: StarterTemplate[] = [
  // ═══════════════════════════════════════════════════════════════
  // HOME — BEZ SPRZĘTU
  // ═══════════════════════════════════════════════════════════════

  // 1. Foundation Bodyweight — początkujący, 3 dni/tyg
  // Cel: fundament siłowy, opanowanie podstawowych wzorców ruchu.
  // Baza: Schoenfeld minimal effective dose (~4-8 sets/grupa/tyg),
  // ACSM 2024: 2-3 serie, pełen ROM, progresywne obciążenie.
  {
    id: 'foundation-bodyweight-3d',
    category: 'home',
    difficulty: 'beginner',
    daysPerWeek: 3,
    equipment: 'bodyweight',
    muscleFocus: ['chest', 'back', 'legs', 'core'],
    progression: ENDURANCE_PROGRESSION,
    deload: null,
    days: [
      {
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'pushups', sets: [reps(8), reps(8), reps(8)], restBetweenSetsSec: 90 },
          { starterKey: 'squats', sets: [reps(12), reps(12), reps(12)], restBetweenSetsSec: 90 },
          { starterKey: 'lunges', sets: [reps(10), reps(10)], restBetweenSetsSec: 60 },
          { starterKey: 'plank', sets: [durationSec(30), durationSec(30)], restBetweenSetsSec: 60 },
        ],
      },
      {
        dayNumber: 2,
        restAfterDay: 2,
        exercises: [
          { starterKey: 'pushupWide', sets: [reps(8), reps(8), reps(8)], restBetweenSetsSec: 90 },
          { starterKey: 'dips', sets: [reps(6), reps(6), reps(6)], restBetweenSetsSec: 90 },
          { starterKey: 'deadBug', sets: [reps(10), reps(10), reps(10)], restBetweenSetsSec: 45 },
          { starterKey: 'sidePlank', sets: [durationSec(20), durationSec(20)], restBetweenSetsSec: 60 },
        ],
      },
      {
        dayNumber: 3,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'pushups', sets: [reps(10), reps(10), reps(10)], restBetweenSetsSec: 90 },
          { starterKey: 'squats', sets: [reps(15), reps(15), reps(15)], restBetweenSetsSec: 90 },
          { starterKey: 'lunges', sets: [reps(12), reps(12)], restBetweenSetsSec: 60 },
          { starterKey: 'plank', sets: [durationSec(40), durationSec(40)], restBetweenSetsSec: 60 },
        ],
      },
    ],
  },

  // 2. Calisthenics Strength — średniozaawansowany, 4 dni/tyg
  // Push/Pull/Legs/Core split. Cel: hipertrofia + siła kalisteniczna.
  // Baza: Schoenfeld 10-20 sets/grupa/tyg, PPL split 2x/tyg = 12-16 sets/grupa.
  {
    id: 'calisthenics-strength-4d',
    category: 'home',
    difficulty: 'intermediate',
    daysPerWeek: 4,
    equipment: 'bodyweight',
    muscleFocus: ['chest', 'back', 'legs', 'core', 'arms', 'shoulders'],
    progression: HYPERTROPHY_PROGRESSION,
    deload: null,
    days: [
      {
        // Push: chest + triceps + shoulders
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'pushups', sets: [repsMax(15), repsMax(12), repsMax(10), repsMax(8)], restBetweenSetsSec: 90 },
          { starterKey: 'dips', sets: [reps(10), reps(8), reps(8)], restBetweenSetsSec: 90 },
          { starterKey: 'pushupWide', sets: [reps(12), reps(10), reps(10)], restBetweenSetsSec: 90 },
          { starterKey: 'pushups', sets: [reps(10), reps(8)], restBetweenSetsSec: 90, note: 'Pike pushup jeśli potrafisz — ręce wyżej niż stopy' },
        ],
      },
      {
        // Pull: back + biceps
        dayNumber: 2,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'pullups', sets: [repsMax(8), repsMax(6), repsMax(5), repsMax(4)], restBetweenSetsSec: 120 },
          { starterKey: 'pullups', sets: [repsMax(6), repsMax(5), repsMax(4)], restBetweenSetsSec: 120, note: 'Lub inverted row jeśli masz drążek niski' },
          { starterKey: 'pullups', sets: [repsMax(5), repsMax(4)], restBetweenSetsSec: 120 },
        ],
      },
      {
        // Legs + core
        dayNumber: 3,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'squats', sets: [reps(20), reps(20), reps(20)], restBetweenSetsSec: 90 },
          { starterKey: 'lunges', sets: [reps(15), reps(15), reps(15)], restBetweenSetsSec: 90 },
          { starterKey: 'hangingLegRaise', sets: [reps(10), reps(10), reps(10)], restBetweenSetsSec: 60 },
          { starterKey: 'plank', sets: [durationSec(60), durationSec(60)], restBetweenSetsSec: 60 },
        ],
      },
      {
        // Upper body volume
        dayNumber: 4,
        restAfterDay: 2,
        exercises: [
          { starterKey: 'pushups', sets: [reps(15), reps(15), reps(12), reps(12)], restBetweenSetsSec: 75 },
          { starterKey: 'pullups', sets: [repsMax(6), repsMax(5), repsMax(4), repsMax(3)], restBetweenSetsSec: 120 },
          { starterKey: 'dips', sets: [reps(12), reps(10), reps(8)], restBetweenSetsSec: 90 },
          { starterKey: 'deadBug', sets: [reps(12), reps(12), reps(12)], restBetweenSetsSec: 45 },
        ],
      },
    ],
  },

  // 3. Pullup Foundations — początkujący, 3 dni/tyg
  // Cel: pierwszy podciąg. Negatywy + assisted → pełne powtórzenia.
  // Baza: PoinT GO research — 3x4-6 negatywów, 3 dni/tyg, 5s opuszczanie.
  // Faza 1: negatywy + inverted row + scapular work.
  {
    id: 'pullup-foundations-3d',
    category: 'home',
    difficulty: 'beginner',
    daysPerWeek: 3,
    equipment: 'bodyweight',
    muscleFocus: ['back', 'core', 'arms'],
    progression: STRENGTH_PROGRESSION,
    deload: null,
    days: [
      {
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'pullups', sets: [repsMax(5), repsMax(4), repsMax(3)], restBetweenSetsSec: 120, note: 'Negatywy jeśli nie dasz rady — 5s opuszczanie' },
          { starterKey: 'pullups', sets: [repsMax(4), repsMax(3), repsMax(3)], restBetweenSetsSec: 120, note: 'Lub inverted row jeśli masz drążek niski' },
          { starterKey: 'deadBug', sets: [reps(10), reps(10), reps(10)], restBetweenSetsSec: 45 },
          { starterKey: 'plank', sets: [durationSec(30), durationSec(30)], restBetweenSetsSec: 60 },
        ],
      },
      {
        dayNumber: 2,
        restAfterDay: 2,
        exercises: [
          { starterKey: 'pullups', sets: [repsMax(5), repsMax(5), repsMax(4)], restBetweenSetsSec: 120, note: 'Negatywy jeśli nie dasz rady — 5s opuszczanie' },
          { starterKey: 'pullups', sets: [repsMax(4), repsMax(4), repsMax(3)], restBetweenSetsSec: 120, note: 'Lub inverted row jeśli masz drążek niski' },
          { starterKey: 'hangingLegRaise', sets: [reps(8), reps(8), reps(8)], restBetweenSetsSec: 60 },
          { starterKey: 'sidePlank', sets: [durationSec(25), durationSec(25)], restBetweenSetsSec: 60 },
        ],
      },
      {
        dayNumber: 3,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'pullups', sets: [repsMax(6), repsMax(5), repsMax(4), repsMax(3)], restBetweenSetsSec: 120, note: 'Próbuj pełnych powtórzeń, reszta negatywy' },
          { starterKey: 'pullups', sets: [repsMax(5), repsMax(4), repsMax(3)], restBetweenSetsSec: 120, note: 'Lub inverted row jeśli masz drążek niski' },
          { starterKey: 'deadBug', sets: [reps(12), reps(12), reps(12)], restBetweenSetsSec: 45 },
          { starterKey: 'plank', sets: [durationSec(40), durationSec(40)], restBetweenSetsSec: 60 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // GYM — ZE SPRZĘTEM
  // ═══════════════════════════════════════════════════════════════

  // 4. Full Body Dumbbell — początkujący, 3 dni/tyg
  // Cel: siła całego ciała, nauka wzorców z obciążeniem.
  // Baza: ACSM 2024 — full body 3x/tyg, 2-3 serie, ≥80% 1RM dla siły.
  // Minimal effective dose: ~6-9 sets/grupa/tyg (Schoenfeld).
  {
    id: 'fullbody-dumbbell-3d',
    category: 'gym',
    difficulty: 'beginner',
    daysPerWeek: 3,
    equipment: 'dumbbells',
    muscleFocus: ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'],
    progression: HYPERTROPHY_PROGRESSION,
    deload: null,
    days: [
      {
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'gobletSquat', sets: [repsWeight(12, 12), repsWeight(12, 12), repsWeight(10, 15)], restBetweenSetsSec: 120 },
          { starterKey: 'dumbbellRow', sets: [repsWeight(10, 12), repsWeight(10, 12), repsWeight(10, 12)], restBetweenSetsSec: 90 },
          { starterKey: 'dumbbellFlyes', sets: [repsWeight(10, 8), repsWeight(10, 8), repsWeight(10, 8)], restBetweenSetsSec: 90 },
          { starterKey: 'dumbbellCurl', sets: [repsWeight(12, 8), repsWeight(12, 8)], restBetweenSetsSec: 90 },
          { starterKey: 'plank', sets: [durationSec(30), durationSec(30)], restBetweenSetsSec: 60 },
        ],
      },
      {
        dayNumber: 2,
        restAfterDay: 2,
        exercises: [
          { starterKey: 'lunges', sets: [repsWeight(10, 10), repsWeight(10, 10), repsWeight(10, 10)], restBetweenSetsSec: 90 },
          { starterKey: 'overheadPress', sets: [repsWeight(10, 10), repsWeight(10, 10), repsWeight(10, 10)], restBetweenSetsSec: 90 },
          { starterKey: 'seatedRow', sets: [repsWeight(10, 15), repsWeight(10, 15), repsWeight(10, 15)], restBetweenSetsSec: 90 },
          { starterKey: 'tricepPushdown', sets: [repsWeight(12, 10), repsWeight(12, 10)], restBetweenSetsSec: 60 },
          { starterKey: 'deadBug', sets: [reps(10), reps(10), reps(10)], restBetweenSetsSec: 45 },
        ],
      },
      {
        dayNumber: 3,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'gobletSquat', sets: [repsWeight(12, 15), repsWeight(12, 15), repsWeight(10, 20)], restBetweenSetsSec: 120 },
          { starterKey: 'dumbbellRow', sets: [repsWeight(10, 15), repsWeight(10, 15), repsWeight(10, 15)], restBetweenSetsSec: 90 },
          { starterKey: 'lateralRaise', sets: [repsWeight(12, 6), repsWeight(12, 6), repsWeight(12, 6)], restBetweenSetsSec: 60 },
          { starterKey: 'hammerCurl', sets: [repsWeight(12, 8), repsWeight(12, 8)], restBetweenSetsSec: 90 },
          { starterKey: 'hangingLegRaise', sets: [reps(10), reps(10)], restBetweenSetsSec: 60 },
        ],
      },
    ],
  },

  // 5. Upper/Lower Barbell — średniozaawansowany, 4 dni/tyg
  // Cel: hipertrofia + siła z sztangą. Upper/Lower 2x/tyg.
  // Baza: Schoenfeld 10-20 sets/grupa/tyg, 2x częstotliwość/grupa.
  // 12-16 sets/grupa/tyg w tym splicie.
  {
    id: 'upper-lower-barbell-4d',
    category: 'gym',
    difficulty: 'intermediate',
    daysPerWeek: 4,
    equipment: 'barbell',
    muscleFocus: ['chest', 'back', 'legs', 'shoulders', 'arms'],
    progression: STRENGTH_PROGRESSION,
    deload: null,
    days: [
      {
        // Upper A — siła
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'benchPress', sets: [repsWeight(8, 40), repsWeight(8, 45), repsWeight(6, 50)], restBetweenSetsSec: 150 },
          { starterKey: 'barbellRow', sets: [repsWeight(8, 30), repsWeight(8, 35), repsWeight(8, 40)], restBetweenSetsSec: 120 },
          { starterKey: 'overheadPress', sets: [repsWeight(8, 25), repsWeight(8, 27), repsWeight(6, 30)], restBetweenSetsSec: 120 },
          { starterKey: 'barbellCurl', sets: [repsWeight(10, 15), repsWeight(10, 17), repsWeight(10, 20)], restBetweenSetsSec: 90 },
          { starterKey: 'skullCrusher', sets: [repsWeight(10, 15), repsWeight(10, 17), repsWeight(10, 20)], restBetweenSetsSec: 90 },
        ],
      },
      {
        // Lower A — siła
        dayNumber: 2,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'frontSquat', sets: [repsWeight(8, 30), repsWeight(8, 35), repsWeight(6, 40)], restBetweenSetsSec: 180 },
          { starterKey: 'romanianDeadlift', sets: [repsWeight(10, 30), repsWeight(10, 35), repsWeight(8, 40)], restBetweenSetsSec: 120 },
          { starterKey: 'legPress', sets: [repsWeight(12, 60), repsWeight(12, 70), repsWeight(10, 80)], restBetweenSetsSec: 120 },
          { starterKey: 'calfRaise', sets: [repsWeight(15, 20), repsWeight(15, 25), repsWeight(15, 30)], restBetweenSetsSec: 60 },
        ],
      },
      {
        // Upper B — hipertrofia
        dayNumber: 3,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'inclineBenchPress', sets: [repsWeight(10, 25), repsWeight(10, 27), repsWeight(10, 30), repsWeight(8, 32)], restBetweenSetsSec: 120 },
          { starterKey: 'latPulldown', sets: [repsWeight(12, 25), repsWeight(12, 30), repsWeight(10, 35), repsWeight(10, 40)], restBetweenSetsSec: 90 },
          { starterKey: 'lateralRaise', sets: [repsWeight(12, 8), repsWeight(12, 10), repsWeight(12, 12)], restBetweenSetsSec: 60 },
          { starterKey: 'dumbbellCurl', sets: [repsWeight(12, 10), repsWeight(12, 12), repsWeight(10, 14)], restBetweenSetsSec: 90 },
          { starterKey: 'tricepPushdown', sets: [repsWeight(12, 15), repsWeight(12, 17), repsWeight(12, 20)], restBetweenSetsSec: 60 },
        ],
      },
      {
        // Lower B — hipertrofia
        dayNumber: 4,
        restAfterDay: 2,
        exercises: [
          { starterKey: 'deadlift', sets: [repsWeight(5, 40), repsWeight(5, 50), repsWeight(5, 60)], restBetweenSetsSec: 180 },
          { starterKey: 'gobletSquat', sets: [repsWeight(12, 20), repsWeight(12, 25), repsWeight(10, 30)], restBetweenSetsSec: 120 },
          { starterKey: 'legExtension', sets: [repsWeight(15, 25), repsWeight(15, 30), repsWeight(12, 35)], restBetweenSetsSec: 60 },
          { starterKey: 'legCurl', sets: [repsWeight(15, 20), repsWeight(15, 25), repsWeight(12, 30)], restBetweenSetsSec: 60 },
          { starterKey: 'hipThrust', sets: [repsWeight(12, 30), repsWeight(12, 40), repsWeight(10, 50)], restBetweenSetsSec: 120 },
        ],
      },
    ],
  },

  // 6. Push Pull Legs — zaawansowany, 6 dni/tyg
  // Cel: maksymalna hipertrofia. PPL 2x/tyg = 16-24 sets/grupa/tyg.
  // Baza: Schoenfeld górny zakres 20+ sets, 2x częstotliwość.
  // Dla zaawansowanych z dobrą zdolnością regeneracji.
  {
    id: 'push-pull-legs-6d',
    category: 'gym',
    difficulty: 'advanced',
    daysPerWeek: 5,
    equipment: 'full_gym',
    muscleFocus: ['chest', 'back', 'legs', 'shoulders', 'arms'],
    progression: HYPERTROPHY_PROGRESSION,
    deload: null,
    days: [
      {
        // Push A
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'benchPress', sets: [repsWeight(8, 50), repsWeight(8, 55), repsWeight(6, 60), repsWeight(6, 62)], restBetweenSetsSec: 150 },
          { starterKey: 'overheadPress', sets: [repsWeight(8, 30), repsWeight(8, 32), repsWeight(6, 35)], restBetweenSetsSec: 120 },
          { starterKey: 'inclineBenchPress', sets: [repsWeight(10, 30), repsWeight(10, 32), repsWeight(8, 35)], restBetweenSetsSec: 120 },
          { starterKey: 'lateralRaise', sets: [repsWeight(12, 10), repsWeight(12, 12), repsWeight(12, 14)], restBetweenSetsSec: 60 },
          { starterKey: 'tricepPushdown', sets: [repsWeight(12, 20), repsWeight(12, 22), repsWeight(10, 25)], restBetweenSetsSec: 60 },
        ],
      },
      {
        // Pull A
        dayNumber: 2,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'deadlift', sets: [repsWeight(5, 60), repsWeight(5, 70), repsWeight(5, 80)], restBetweenSetsSec: 180 },
          { starterKey: 'barbellRow', sets: [repsWeight(8, 40), repsWeight(8, 45), repsWeight(8, 50), repsWeight(6, 55)], restBetweenSetsSec: 120 },
          { starterKey: 'latPulldown', sets: [repsWeight(12, 35), repsWeight(12, 40), repsWeight(10, 45)], restBetweenSetsSec: 90 },
          { starterKey: 'facePulls', sets: [repsWeight(15, 15), repsWeight(15, 17), repsWeight(15, 20)], restBetweenSetsSec: 60 },
          { starterKey: 'barbellCurl', sets: [repsWeight(10, 20), repsWeight(10, 22), repsWeight(8, 25)], restBetweenSetsSec: 90 },
        ],
      },
      {
        // Legs A
        dayNumber: 3,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'frontSquat', sets: [repsWeight(6, 40), repsWeight(6, 45), repsWeight(6, 50), repsWeight(4, 55)], restBetweenSetsSec: 180 },
          { starterKey: 'romanianDeadlift', sets: [repsWeight(8, 40), repsWeight(8, 45), repsWeight(8, 50)], restBetweenSetsSec: 120 },
          { starterKey: 'legPress', sets: [repsWeight(12, 80), repsWeight(12, 90), repsWeight(10, 100)], restBetweenSetsSec: 120 },
          { starterKey: 'legCurl', sets: [repsWeight(12, 25), repsWeight(12, 30), repsWeight(10, 35)], restBetweenSetsSec: 60 },
          { starterKey: 'calfRaise', sets: [repsWeight(15, 30), repsWeight(15, 35), repsWeight(12, 40)], restBetweenSetsSec: 60 },
        ],
      },
      {
        // Push B
        dayNumber: 4,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'inclineBenchPress', sets: [repsWeight(10, 30), repsWeight(10, 32), repsWeight(8, 35), repsWeight(8, 37)], restBetweenSetsSec: 120 },
          { starterKey: 'dips', sets: [reps(12), reps(10), reps(10), reps(8)], restBetweenSetsSec: 90 },
          { starterKey: 'declineBenchPress', sets: [repsWeight(10, 30), repsWeight(10, 32), repsWeight(8, 35)], restBetweenSetsSec: 120 },
          { starterKey: 'lateralRaise', sets: [repsWeight(15, 8), repsWeight(15, 10), repsWeight(15, 12)], restBetweenSetsSec: 60 },
          { starterKey: 'overheadTricepExtension', sets: [repsWeight(12, 15), repsWeight(12, 17), repsWeight(10, 20)], restBetweenSetsSec: 60 },
        ],
      },
      {
        // Pull B + Legs B (kompaktowy dzień 5)
        dayNumber: 5,
        restAfterDay: 2,
        exercises: [
          { starterKey: 'seatedRow', sets: [repsWeight(10, 35), repsWeight(10, 40), repsWeight(10, 45), repsWeight(8, 50)], restBetweenSetsSec: 90 },
          { starterKey: 'tbarRow', sets: [repsWeight(10, 20), repsWeight(10, 25), repsWeight(8, 30)], restBetweenSetsSec: 120 },
          { starterKey: 'gobletSquat', sets: [repsWeight(12, 25), repsWeight(12, 30), repsWeight(10, 35)], restBetweenSetsSec: 120 },
          { starterKey: 'hipThrust', sets: [repsWeight(12, 40), repsWeight(12, 50), repsWeight(10, 60)], restBetweenSetsSec: 120 },
          { starterKey: 'hammerCurl', sets: [repsWeight(12, 12), repsWeight(12, 14), repsWeight(10, 16)], restBetweenSetsSec: 90 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════
  // CARDIO / CONDITIONING
  // ═══════════════════════════════════════════════════════════════

  // 7. HIIT Express — początkujący, 3 dni/tyg
  // Cel: kondycja, spalanie, zdrowie serca. Low-volume HIIT.
  // Baza: BJSM 2024 — <15min high-intensity nie gorszy niż high-volume,
  // 2-3x/tyg, ≤40min. Frontiers 2024 — 2-3x/tyg ≤40min = najlepsze efekty.
  {
    id: 'hiit-express-3d',
    category: 'cardio',
    difficulty: 'beginner',
    daysPerWeek: 3,
    equipment: 'bodyweight',
    muscleFocus: ['cardio', 'core', 'full_body'],
    progression: ENDURANCE_PROGRESSION,
    deload: null,
    days: [
      {
        // Day 1: Tabata-style 20/10
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'jumpingJacks', sets: [durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20)], restBetweenSetsSec: 10 },
          { starterKey: 'highKnees', sets: [durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20)], restBetweenSetsSec: 10 },
          { starterKey: 'mountainClimbers', sets: [durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20), durationSec(20)], restBetweenSetsSec: 10 },
          { starterKey: 'plank', sets: [durationSec(30), durationSec(30)], restBetweenSetsSec: 30 },
        ],
      },
      {
        // Day 2: Longer intervals 30/30
        dayNumber: 2,
        restAfterDay: 2,
        exercises: [
          { starterKey: 'burpees', sets: [durationSec(30), durationSec(30), durationSec(30), durationSec(30), durationSec(30), durationSec(30)], restBetweenSetsSec: 30 },
          { starterKey: 'highKnees', sets: [durationSec(30), durationSec(30), durationSec(30), durationSec(30), durationSec(30), durationSec(30)], restBetweenSetsSec: 30 },
          { starterKey: 'jumpingJacks', sets: [durationSec(30), durationSec(30), durationSec(30), durationSec(30), durationSec(30), durationSec(30)], restBetweenSetsSec: 30 },
          { starterKey: 'deadBug', sets: [reps(10), reps(10), reps(10)], restBetweenSetsSec: 45 },
        ],
      },
      {
        // Day 3: Circuit
        dayNumber: 3,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'mountainClimbers', sets: [durationSec(40), durationSec(40), durationSec(40)], restBetweenSetsSec: 20 },
          { starterKey: 'burpees', sets: [durationSec(40), durationSec(40), durationSec(40)], restBetweenSetsSec: 20 },
          { starterKey: 'highKnees', sets: [durationSec(40), durationSec(40), durationSec(40)], restBetweenSetsSec: 20 },
          { starterKey: 'jumpingJacks', sets: [durationSec(40), durationSec(40), durationSec(40)], restBetweenSetsSec: 20 },
          { starterKey: 'plank', sets: [durationSec(45), durationSec(45)], restBetweenSetsSec: 30 },
        ],
      },
    ],
  },

  // 8. Core & Conditioning — średniozaawansowany, 3 dni/tyg
  // Cel: mocny core + kondycja. Anti-rotation + anti-extension + cardio.
  // Baza: McGill core training — anti-rotation/extension > crunches.
  // Schoenfeld core: 10+ sets/tyg dla hipertrofii core.
  {
    id: 'core-conditioning-3d',
    category: 'cardio',
    difficulty: 'intermediate',
    daysPerWeek: 3,
    equipment: 'bodyweight',
    muscleFocus: ['core', 'cardio', 'full_body'],
    progression: ENDURANCE_PROGRESSION,
    deload: null,
    days: [
      {
        // Day 1: Anti-extension + cardio
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'plank', sets: [durationSec(45), durationSec(45), durationSec(45)], restBetweenSetsSec: 45 },
          { starterKey: 'deadBug', sets: [reps(12), reps(12), reps(12)], restBetweenSetsSec: 45 },
          { starterKey: 'hangingLegRaise', sets: [reps(10), reps(10), reps(10)], restBetweenSetsSec: 60 },
          { starterKey: 'mountainClimbers', sets: [durationSec(40), durationSec(40), durationSec(40)], restBetweenSetsSec: 20 },
          { starterKey: 'highKnees', sets: [durationSec(40), durationSec(40), durationSec(40)], restBetweenSetsSec: 20 },
        ],
      },
      {
        // Day 2: Anti-rotation + cardio
        dayNumber: 2,
        restAfterDay: 2,
        exercises: [
          { starterKey: 'sidePlank', sets: [durationSec(30), durationSec(30), durationSec(30), durationSec(30)], restBetweenSetsSec: 30 },
          { starterKey: 'russianTwist', sets: [reps(20), reps(20), reps(20)], restBetweenSetsSec: 45 },
          { starterKey: 'reverseCrunch', sets: [reps(12), reps(12), reps(12)], restBetweenSetsSec: 45 },
          { starterKey: 'burpees', sets: [durationSec(45), durationSec(45), durationSec(45)], restBetweenSetsSec: 30 },
          { starterKey: 'jumpingJacks', sets: [durationSec(45), durationSec(45), durationSec(45)], restBetweenSetsSec: 20 },
        ],
      },
      {
        // Day 3: Dynamic core + finisher
        dayNumber: 3,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'hangingLegRaise', sets: [reps(12), reps(12), reps(12)], restBetweenSetsSec: 60 },
          { starterKey: 'plank', sets: [durationSec(60), durationSec(60)], restBetweenSetsSec: 60 },
          { starterKey: 'deadBug', sets: [reps(15), reps(15)], restBetweenSetsSec: 45 },
          { starterKey: 'mountainClimbers', sets: [durationSec(50), durationSec(50), durationSec(50)], restBetweenSetsSec: 20 },
          { starterKey: 'burpees', sets: [durationSec(50), durationSec(50)], restBetweenSetsSec: 30 },
        ],
      },
    ],
  },

  // 9. Kettlebell Power — średniozaawansowany, 3 dni/tyg
  // Cel: moc eksplozywna, hipertrofia, kondycja z kettlebell.
  // Baza: kettlebell swings = moc posterior chain (McGill),
  // compound movements, 3x/tyg.
  {
    id: 'kettlebell-power-3d',
    category: 'home',
    difficulty: 'intermediate',
    daysPerWeek: 3,
    equipment: 'kettlebell',
    muscleFocus: ['full_body', 'core', 'shoulders', 'legs'],
    progression: HYPERTROPHY_PROGRESSION,
    deload: null,
    days: [
      {
        // Day 1: Swing + squat
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'kettlebellSwing', sets: [repsWeight(15, 12), repsWeight(15, 12), repsWeight(15, 12), repsWeight(15, 12)], restBetweenSetsSec: 60 },
          { starterKey: 'gobletSquat', sets: [repsWeight(12, 12), repsWeight(12, 12), repsWeight(10, 16)], restBetweenSetsSec: 90 },
          { starterKey: 'plank', sets: [durationSec(45), durationSec(45), durationSec(45)], restBetweenSetsSec: 45 },
        ],
      },
      {
        // Day 2: Press + clean
        dayNumber: 2,
        restAfterDay: 2,
        exercises: [
          { starterKey: 'cleanAndPress', sets: [repsWeight(8, 12), repsWeight(8, 12), repsWeight(8, 12), repsWeight(6, 16)], restBetweenSetsSec: 120 },
          { starterKey: 'kettlebellSwing', sets: [repsWeight(20, 12), repsWeight(20, 12), repsWeight(20, 12)], restBetweenSetsSec: 60 },
          { starterKey: 'deadBug', sets: [reps(12), reps(12), reps(12)], restBetweenSetsSec: 45 },
        ],
      },
      {
        // Day 3: Thrusters + finisher
        dayNumber: 3,
        restAfterDay: 1,
        exercises: [
          { starterKey: 'thrusters', sets: [repsWeight(10, 8), repsWeight(10, 8), repsWeight(10, 8), repsWeight(8, 12)], restBetweenSetsSec: 90 },
          { starterKey: 'kettlebellSwing', sets: [repsWeight(25, 12), repsWeight(25, 12), repsWeight(25, 12)], restBetweenSetsSec: 45 },
          { starterKey: 'gobletSquat', sets: [repsWeight(15, 12), repsWeight(15, 12), repsWeight(12, 16)], restBetweenSetsSec: 90 },
          { starterKey: 'russianTwist', sets: [repsWeight(20, 8), repsWeight(20, 8), repsWeight(20, 8)], restBetweenSetsSec: 45 },
        ],
      },
    ],
  },
]

export const STARTER_TEMPLATE_CATEGORIES: StarterTemplateCategory[] = ['home', 'gym', 'cardio']

export function getStarterTemplate(id: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find((t) => t.id === id)
}

/** Wylicza szacowany czas trwania w tygodniach: dni / dniTyg * 1 tyg (cykl). */
export function starterTemplateEstimatedWeeks(template: StarterTemplate): [number, number] {
  const weeks = Math.ceil(template.days.length / template.daysPerWeek)
  return [weeks, weeks + 2]
}
