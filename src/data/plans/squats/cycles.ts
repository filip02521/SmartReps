import type { Cycle } from '../types'
import { standard6DaySquat } from '../helpers'

export const squatCycles: Cycle[] = [
  // ═══════════════════════════════════════════════════════════════
  // BEGINNER (L1–L4): 1–80 przysiadów
  // ═══════════════════════════════════════════════════════════════

  // L1 — 1-20 przysiadów (5 serii, 60s rest)
  {
    id: 'squats-1-20',
    program: 'squats',
    name: '1–20 przysiadów',
    nameShort: '1–20',
    testRange: { min: 1, max: 20 },
    level: 1,
    layout: 'standard_6day',
    description:
      'Cykl startowy dla osób wykonujących 1–20 przysiadów w teście. Buduje podstawową siłę i wytrzymałość nóg.',
    estimatedWeeks: [2, 3],
    days: standard6DaySquat([
      { reps: [4, 6, 6, 7], maxMin: 7 },
      { reps: [6, 6, 6, 8], maxMin: 8 },
      { reps: [8, 6, 6, 8], maxMin: 8 },
      { reps: [8, 8, 8, 6], maxMin: 8 },
      { reps: [8, 8, 6, 8], maxMin: 10 },
      { reps: [8, 8, 8, 8], maxMin: 10 },
    ]),
  },

  // L2 — 21-40 przysiadów (5 serii, 60s rest)
  {
    id: 'squats-21-40',
    program: 'squats',
    name: '21–40 przysiadów',
    nameShort: '21–40',
    testRange: { min: 21, max: 40 },
    level: 2,
    layout: 'standard_6day',
    description:
      'Cykl dla osób wykonujących 21–40 przysiadów w teście. Stopniowo zwiększa objętość treningową.',
    estimatedWeeks: [2, 3],
    days: standard6DaySquat([
      { reps: [8, 8, 8, 10], maxMin: 10 },
      { reps: [10, 10, 10, 8], maxMin: 10 },
      { reps: [12, 10, 10, 12], maxMin: 12 },
      { reps: [12, 12, 12, 12], maxMin: 12 },
      { reps: [12, 12, 14, 14], maxMin: 16 },
      { reps: [14, 12, 14, 16], maxMin: 15 },
    ]),
  },

  // L3 — 41-60 przysiadów (5 serii, 60s rest)
  {
    id: 'squats-41-60',
    program: 'squats',
    name: '41–60 przysiadów',
    nameShort: '41–60',
    testRange: { min: 41, max: 60 },
    level: 3,
    layout: 'standard_6day',
    description:
      'Cykl dla osób wykonujących 41–60 przysiadów w teście. Kontynuuje progresję objętości treningowej.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [16, 16, 16, 18], maxMin: 10 },
      { reps: [16, 14, 14, 18], maxMin: 18 },
      { reps: [18, 18, 16, 16], maxMin: 18 },
      { reps: [20, 20, 18, 18], maxMin: 22 },
      { reps: [22, 22, 18, 18], maxMin: 22 },
      { reps: [22, 22, 20, 20], maxMin: 24 },
    ]),
  },

  // L4 — 61-80 przysiadów (5 serii, 60s rest)
  {
    id: 'squats-61-80',
    program: 'squats',
    name: '61–80 przysiadów',
    nameShort: '61–80',
    testRange: { min: 61, max: 80 },
    level: 4,
    layout: 'standard_6day',
    description:
      'Ostatni cykl początkujący dla osób wykonujących 61–80 przysiadów. Wyższe liczby powtórzeń budują wytrzymałość mięśniową.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [22, 22, 22, 22], maxMin: 24 },
      { reps: [22, 22, 22, 24], maxMin: 24 },
      { reps: [22, 24, 24, 22], maxMin: 24 },
      { reps: [24, 24, 24, 22], maxMin: 26 },
      { reps: [24, 24, 24, 24], maxMin: 26 },
      { reps: [26, 26, 24, 24], maxMin: 28 },
    ]),
  },

  // ═══════════════════════════════════════════════════════════════
  // INTERMEDIATE (L5–L8): 81–175 przysiadów
  // ═══════════════════════════════════════════════════════════════

  // L5 — 81-100 przysiadów (5 serii, 60s rest)
  {
    id: 'squats-81-100',
    program: 'squats',
    name: '81–100 przysiadów',
    nameShort: '81–100',
    testRange: { min: 81, max: 100 },
    level: 5,
    layout: 'standard_6day',
    description:
      'Pierwszy cykl średniozaawansowany dla osób wykonujących 81–100 przysiadów. Wyższa objętość i intensywność.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [26, 26, 26, 26], maxMin: 28 },
      { reps: [26, 26, 26, 28], maxMin: 28 },
      { reps: [28, 26, 26, 28], maxMin: 30 },
      { reps: [28, 28, 28, 28], maxMin: 30 },
      { reps: [28, 28, 30, 30], maxMin: 30 },
      { reps: [30, 30, 28, 30], maxMin: 32 },
    ]),
  },

  // L6 — 101-125 przysiadów (5 serii, 60s rest)
  {
    id: 'squats-101-125',
    program: 'squats',
    name: '101–125 przysiadów',
    nameShort: '101–125',
    testRange: { min: 101, max: 125 },
    level: 6,
    layout: 'standard_6day',
    description:
      'Cykl dla osób wykonujących 101–125 przysiadów. Stabilna progresja w średnim zakresie powtórzeń.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [32, 32, 30, 30], maxMin: 32 },
      { reps: [32, 32, 32, 32], maxMin: 34 },
      { reps: [34, 32, 32, 34], maxMin: 36 },
      { reps: [34, 34, 34, 36], maxMin: 36 },
      { reps: [36, 36, 34, 34], maxMin: 36 },
      { reps: [36, 36, 36, 34], maxMin: 38 },
    ]),
  },

  // L7 — 126-150 przysiadów (5 serii, 60s rest)
  {
    id: 'squats-126-150',
    program: 'squats',
    name: '126–150 przysiadów',
    nameShort: '126–150',
    testRange: { min: 126, max: 150 },
    level: 7,
    layout: 'standard_6day',
    description:
      'Cykl dla osób wykonujących 126–150 przysiadów. Wyższa objętość w każdym dniu treningowym.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [38, 36, 36, 40], maxMin: 40 },
      { reps: [40, 38, 38, 38], maxMin: 40 },
      { reps: [40, 38, 38, 40], maxMin: 42 },
      { reps: [40, 40, 42, 40], maxMin: 40 },
      { reps: [40, 40, 42, 42], maxMin: 40 },
      { reps: [42, 42, 40, 40], maxMin: 46 },
    ]),
  },

  // L8 — 151-175 przysiadów (5 serii, 60s rest)
  {
    id: 'squats-151-175',
    program: 'squats',
    name: '151–175 przysiadów',
    nameShort: '151–175',
    testRange: { min: 151, max: 175 },
    level: 8,
    layout: 'standard_6day',
    description:
      'Ostatni cykl średniozaawansowany dla osób wykonujących 151–175 przysiadów. Przygotowuje do wyższych objętości.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [44, 44, 40, 40], maxMin: 46 },
      { reps: [44, 44, 46, 46], maxMin: 46 },
      { reps: [46, 46, 46, 44], maxMin: 46 },
      { reps: [46, 46, 46, 44], maxMin: 48 },
      { reps: [46, 46, 46, 48], maxMin: 48 },
      { reps: [48, 48, 46, 46], maxMin: 50 },
    ]),
  },

  // ═══════════════════════════════════════════════════════════════
  // ADVANCED (L9–L15): 176–300 przysiadów
  // Cykle L11+ mają 7 serii zamiast 5 — zgodnie z oryginalnym programem.
  // ═══════════════════════════════════════════════════════════════

  // L9 — 176-200 przysiadów (5 serii, 60s rest)
  {
    id: 'squats-176-200',
    program: 'squats',
    name: '176–200 przysiadów',
    nameShort: '176–200',
    testRange: { min: 176, max: 200 },
    level: 9,
    layout: 'standard_6day',
    description:
      'Pierwszy cykl zaawansowany dla osób wykonujących 176–200 przysiadów. Wysoka objętość treningowa.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [50, 50, 48, 48], maxMin: 50 },
      { reps: [50, 50, 50, 48], maxMin: 52 },
      { reps: [52, 52, 50, 50], maxMin: 52 },
      { reps: [52, 52, 52, 50], maxMin: 54 },
      { reps: [54, 52, 52, 52], maxMin: 56 },
      { reps: [52, 52, 54, 52], maxMin: 60 },
    ]),
  },

  // L10 — 201-220 przysiadów (5 serii, 60s rest)
  {
    id: 'squats-201-220',
    program: 'squats',
    name: '201–220 przysiadów',
    nameShort: '201–220',
    testRange: { min: 201, max: 220 },
    level: 10,
    layout: 'standard_6day',
    description:
      'Ostatni cykl z 5 seriami. Przygotowuje do formatu 7-serii w cyklach wyższych.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [52, 52, 54, 54], maxMin: 60 },
      { reps: [54, 54, 54, 54], maxMin: 60 },
      { reps: [58, 54, 54, 54], maxMin: 60 },
      { reps: [58, 58, 54, 54], maxMin: 60 },
      { reps: [58, 58, 56, 56], maxMin: 60 },
      { reps: [58, 58, 58, 56], maxMin: 62 },
    ]),
  },

  // L11 — 221-240 przysiadów (7 serii, 60s rest)
  {
    id: 'squats-221-240',
    program: 'squats',
    name: '221–240 przysiadów',
    nameShort: '221–240',
    testRange: { min: 221, max: 240 },
    level: 11,
    layout: 'standard_6day',
    description:
      'Zaawansowany cykl z 7 seriami na dzień. Wysoka gęstość treningowa dla osób wykonujących 221–240 przysiadów.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [50, 40, 42, 42, 42, 42], maxMin: 44 },
      { reps: [50, 50, 42, 42, 42, 42], maxMin: 44 },
      { reps: [50, 50, 42, 42, 42, 42], maxMin: 50 },
      { reps: [52, 52, 44, 44, 44, 42], maxMin: 52 },
      { reps: [44, 44, 52, 52, 50, 50], maxMin: 54 },
      { reps: [44, 44, 52, 52, 50, 50], maxMin: 56 },
    ]),
  },

  // L12 — 241-260 przysiadów (7 serii, 60s rest)
  {
    id: 'squats-241-260',
    program: 'squats',
    name: '241–260 przysiadów',
    nameShort: '241–260',
    testRange: { min: 241, max: 260 },
    level: 12,
    layout: 'standard_6day',
    description:
      'Cykl z 7 seriami dla osób wykonujących 241–260 przysiadów. Stabilna progresja ku finałowi.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [50, 50, 52, 52, 50, 50], maxMin: 56 },
      { reps: [50, 50, 52, 52, 54, 54], maxMin: 56 },
      { reps: [54, 54, 52, 50, 50, 56], maxMin: 56 },
      { reps: [56, 56, 52, 50, 50, 56], maxMin: 58 },
      { reps: [58, 58, 52, 52, 50, 56], maxMin: 58 },
      { reps: [58, 58, 52, 52, 52, 58], maxMin: 60 },
    ]),
  },

  // L13 — 261-275 przysiadów (7 serii, 60s rest)
  {
    id: 'squats-261-275',
    program: 'squats',
    name: '261–275 przysiadów',
    nameShort: '261–275',
    testRange: { min: 261, max: 275 },
    level: 13,
    layout: 'standard_6day',
    description:
      'Przedostatni cykl z 7 seriami. Wysoka objętość zbliżająca do celu 300 przysiadów.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [60, 60, 52, 52, 52, 60], maxMin: 60 },
      { reps: [58, 58, 54, 58, 54, 60], maxMin: 60 },
      { reps: [60, 60, 58, 54, 54, 60], maxMin: 62 },
      { reps: [60, 60, 58, 56, 56, 62], maxMin: 62 },
      { reps: [60, 60, 58, 58, 58, 62], maxMin: 62 },
      { reps: [60, 60, 60, 60, 60, 62], maxMin: 64 },
    ]),
  },

  // L14 — 276-290 przysiadów (7 serii, 60s rest)
  {
    id: 'squats-276-290',
    program: 'squats',
    name: '276–290 przysiadów',
    nameShort: '276–290',
    testRange: { min: 276, max: 290 },
    level: 14,
    layout: 'standard_6day',
    description:
      'Przedfinałowy cykl z 7 seriami. Maksymalna objętość przygotowująca do ostatniego testu.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [64, 64, 60, 60, 60, 60], maxMin: 64 },
      { reps: [64, 64, 64, 60, 60, 60], maxMin: 64 },
      { reps: [64, 64, 64, 64, 60, 60], maxMin: 64 },
      { reps: [64, 64, 64, 64, 60, 64], maxMin: 66 },
      { reps: [64, 64, 64, 64, 64, 64], maxMin: 66 },
      { reps: [66, 66, 64, 64, 64, 64], maxMin: 68 },
    ]),
  },

  // L15 — 291-300 przysiadów (7 serii, 60s rest) — FINAŁ
  {
    id: 'squats-291-300',
    program: 'squats',
    name: '291–300 przysiadów',
    nameShort: '291–300',
    testRange: { min: 291, max: null },
    level: 15,
    layout: 'standard_6day',
    description:
      'Finałowy cykl programu 300 przysiadów. Po ukończeniu wykonaj test — tym razem powinieneś osiągnąć magiczne 300.',
    estimatedWeeks: [2, 4],
    days: standard6DaySquat([
      { reps: [66, 66, 66, 64, 64, 64], maxMin: 68 },
      { reps: [68, 68, 66, 66, 66, 64], maxMin: 68 },
      { reps: [68, 68, 68, 68, 68, 64], maxMin: 68 },
      { reps: [68, 68, 68, 68, 68, 68], maxMin: 70 },
      { reps: [70, 70, 68, 68, 68, 68], maxMin: 72 },
      { reps: [70, 70, 70, 70, 70, 72], maxMin: 72 },
    ]),
  },
]
