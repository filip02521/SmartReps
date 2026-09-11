/** Domain model for custom exercises and multi-exercise plans. */

import type { SetTarget } from '../data/plans/types'
import { pl } from '../i18n/pl'

export type PrimaryMetric = 'reps' | 'duration_sec' | 'reps_weight'

export type MetricTarget =
  | { kind: 'fixed'; value: number }
  | { kind: 'max'; minValue: number }
  | { kind: 'min'; value: number }
  | { kind: 'exact'; value: number }

export type SetPrescription = {
  reps?: MetricTarget
  durationSec?: MetricTarget
  weightKg?: MetricTarget
}

export type SetActual = {
  reps?: number
  durationSec?: number
  weightKg?: number | null
}

export type SetLog = {
  setNumber: number
  actual: SetActual
  passed: boolean
  prescription: SetPrescription
  /** Rate of Perceived Exertion (1-10). Optional, user-entered after a set. */
  rpe?: number
  /** Reps In Reserve (0-10). Optional, alternative to RPE. */
  rir?: number
  /** Per-set note (form cues, how it felt). Optional. */
  note?: string
}

export type ExerciseLog = {
  exerciseId: string
  order: number
  sets: SetLog[]
}

export type ExerciseGroupKind = 'superset' | 'circuit' | 'amrap' | 'dropset'

export type ExerciseGroup = {
  id: string
  kind: ExerciseGroupKind
  /** Circuit: full rounds through all exercises in the group. */
  rounds?: number
  /** AMRAP: block duration in seconds. */
  amrapDurationSec?: number
  /** Rest after each superset round or circuit round. */
  restAfterRoundSec?: number
}

export type PlannedExercise = {
  exerciseId: string
  order: number
  sets: SetPrescription[]
  restBetweenSetsSec: number
  restAfterExerciseSec?: number
  note?: string
  /** Links exercise into a day group (superset / circuit / AMRAP). */
  groupId?: string
  /** Overrides plan-level progression for this exercise only. */
  progression?: ProgressionRule | null
}

export type PlanDay = {
  dayNumber: number
  exercises: PlannedExercise[]
  restAfterDay: 1 | 2
  groups?: ExerciseGroup[]
}

export type CustomPlanStatus = 'draft' | 'active'

export type CustomPlanSource = 'user' | 'duplicate' | 'import' | 'community' | 'starter'

export type CustomPlan = {
  id: string
  name: string
  description: string
  status: CustomPlanStatus
  days: PlanDay[]
  createdAt: string
  updatedAt: string
  source: CustomPlanSource
  /** Optional auto-progression (Faza 5). */
  progression?: ProgressionRule | null
  /** Optional deload every N cycles (negative deltas). */
  deload?: DeloadRule | null
  /** Set when plan was imported from community catalog. */
  communityPublicationId?: string | null
}

export type DeloadRule = {
  enabled: boolean
  /** Apply deload on every Nth upcoming cycle (e.g. 4 → cycles 4, 8, …). */
  everyNCycles: number
  repsDelta?: number
  weightKgDelta?: number
  durationSecDelta?: number
}

export type ExerciseDefinition = {
  id: string
  name: string
  primaryMetric: PrimaryMetric
  restDefaultSec: number
  archived: boolean
  createdAt: string
  updatedAt: string
  /** Optional muscle group tag for substitution suggestions. */
  muscleGroup?: MuscleGroup
  /** Origin of the exercise — 'user' (manually created), 'ai' (AI plan generator),
   *  or 'starter' (auto-seeded by ensureDefaultExercises, not user-created).
   *  Defaults to 'user' for backwards compatibility with existing records. */
  source?: 'user' | 'ai' | 'starter'
  /** Display unit for duration_sec exercises — 'sec' (default) or 'min'.
   *  When 'min', the UI shows/accepts minutes and converts to seconds internally.
   *  Only meaningful when primaryMetric === 'duration_sec'. */
  durationDisplayUnit?: 'sec' | 'min'
}

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'arms'
  | 'legs'
  | 'core'
  | 'full_body'
  | 'cardio'
  | 'other'

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'arms',
  'legs',
  'core',
  'full_body',
  'cardio',
  'other',
]

export type CustomProgramStatus = 'active' | 'rest' | 'cycle_complete' | 'paused'

export type CustomProgramProgress = {
  id?: number
  customPlanId: string
  currentDay: number
  status: CustomProgramStatus
  cycleAttempt: number
  lastWorkoutAt: string | null
  nextWorkoutAfter: string | null
  updatedAt: string
}

export type ProgressionRule = {
  enabled: boolean
  /** Apply after completing a full cycle. */
  afterCycleComplete: boolean
  repsDelta?: number
  weightKgDelta?: number
  durationSecDelta?: number
}

export type ValidationIssue = { path: string; message: string }

export function validateMetricTarget(target: MetricTarget, path: string): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const value =
    target.kind === 'max' ? target.minValue : target.value
  if (!Number.isFinite(value) || value < 0) {
    issues.push({ path, message: pl.validationMetricNonNegative })
  }
  if (target.kind !== 'max' && value === 0 && target.kind === 'exact') {
    issues.push({ path, message: pl.validationExactPositive })
  }
  return issues
}

export function validateSetPrescription(
  set: SetPrescription,
  metric: PrimaryMetric,
  path: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (metric === 'reps' || metric === 'reps_weight') {
    if (!set.reps) issues.push({ path: `${path}.reps`, message: pl.validationMissingReps })
    else issues.push(...validateMetricTarget(set.reps, `${path}.reps`))
  }
  if (metric === 'duration_sec') {
    if (!set.durationSec) {
      issues.push({ path: `${path}.durationSec`, message: pl.validationMissingDuration })
    } else {
      issues.push(...validateMetricTarget(set.durationSec, `${path}.durationSec`))
    }
  }
  if (set.weightKg) {
    issues.push(...validateMetricTarget(set.weightKg, `${path}.weightKg`))
  }
  return issues
}

export function validateExerciseDefinition(ex: ExerciseDefinition): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!ex.id) issues.push({ path: 'id', message: pl.validationMissingId })
  if (!ex.name.trim()) issues.push({ path: 'name', message: pl.validationExerciseName })
  if (ex.name.trim().length > 80) {
    issues.push({ path: 'name', message: pl.validationNameTooLong })
  }
  if (!['reps', 'duration_sec', 'reps_weight'].includes(ex.primaryMetric)) {
    issues.push({ path: 'primaryMetric', message: pl.validationBadMetric })
  }
  if (!Number.isFinite(ex.restDefaultSec) || ex.restDefaultSec < 0) {
    issues.push({ path: 'restDefaultSec', message: pl.validationRestNonNegative })
  }
  return issues
}

export function validateCustomPlan(
  plan: CustomPlan,
  exercisesById: Map<string, ExerciseDefinition>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  if (!plan.id) issues.push({ path: 'id', message: pl.validationMissingId })
  if (!plan.name.trim()) issues.push({ path: 'name', message: pl.validationPlanName })
  if (plan.days.length === 0) {
    issues.push({ path: 'days', message: pl.validationNoDays })
  }
  if (plan.days.length > 14) {
    issues.push({ path: 'days', message: pl.validationMaxDays })
  }
  const dayNums = new Set<number>()
  for (const day of plan.days) {
    const dPath = `days[${day.dayNumber}]`
    if (dayNums.has(day.dayNumber)) {
      issues.push({ path: dPath, message: pl.validationDuplicateDay })
    }
    dayNums.add(day.dayNumber)
    // Day number must be a positive integer (1-based)
    if (!Number.isInteger(day.dayNumber) || day.dayNumber < 1) {
      issues.push({ path: dPath, message: pl.validationDuplicateDay })
    }
    if (day.exercises.length === 0) {
      issues.push({ path: `${dPath}.exercises`, message: pl.validationDayNoExercises })
    }
    if (![1, 2].includes(day.restAfterDay)) {
      issues.push({ path: `${dPath}.restAfterDay`, message: pl.validationRestAfterDay })
    }
    const groupIds = new Set((day.groups ?? []).map((g) => g.id))
    const groupMemberCount = new Map<string, number>()
    const orderSet = new Set<number>()
    for (const pe of day.exercises) {
      const ePath = `${dPath}.exercises[${pe.order}]`
      // Check for duplicate order values
      if (orderSet.has(pe.order)) {
        issues.push({ path: `${ePath}.order`, message: pl.validationDuplicateDay })
      }
      orderSet.add(pe.order)
      // Validate restBetweenSetsSec is non-negative and finite
      if (
        typeof pe.restBetweenSetsSec === 'number' &&
        (!Number.isFinite(pe.restBetweenSetsSec) || pe.restBetweenSetsSec < 0 || pe.restBetweenSetsSec > 600)
      ) {
        issues.push({ path: `${ePath}.restBetweenSetsSec`, message: pl.validationRestAfterDay })
      }
      const def = exercisesById.get(pe.exerciseId)
      if (!def || def.archived) {
        issues.push({ path: `${ePath}.exerciseId`, message: pl.validationExerciseUnavailable })
        continue
      }
      if (pe.sets.length === 0) {
        issues.push({ path: `${ePath}.sets`, message: pl.validationNoSets })
      }
      if (pe.sets.length > 30) {
        issues.push({ path: `${ePath}.sets`, message: pl.validationMaxSets })
      }
      pe.sets.forEach((s, i) => {
        issues.push(...validateSetPrescription(s, def.primaryMetric, `${ePath}.sets[${i}]`))
      })
      if (pe.groupId) {
        if (!groupIds.has(pe.groupId)) {
          issues.push({ path: `${ePath}.groupId`, message: pl.validationGroupMissing })
        }
        groupMemberCount.set(pe.groupId, (groupMemberCount.get(pe.groupId) ?? 0) + 1)
      }
    }
    for (const group of day.groups ?? []) {
      const gPath = `${dPath}.groups[${group.id}]`
      const count = groupMemberCount.get(group.id) ?? 0
      if (count === 0) {
        issues.push({ path: gPath, message: pl.validationGroupEmpty })
      } else if (group.kind !== 'amrap' && count < 2) {
        issues.push({ path: gPath, message: pl.validationGroupMinTwo })
      }
      if (group.kind === 'circuit') {
        const rounds = group.rounds ?? 0
        if (!Number.isFinite(rounds) || rounds < 1 || rounds > 30) {
          issues.push({ path: `${gPath}.rounds`, message: pl.validationCircuitRounds })
        }
      }
      if (group.kind === 'amrap') {
        const sec = group.amrapDurationSec ?? 0
        if (!Number.isFinite(sec) || sec < 30 || sec > 3600) {
          issues.push({ path: `${gPath}.amrapDurationSec`, message: pl.validationAmrapDuration })
        }
      }
    }
  }
  if (plan.deload?.enabled) {
    const n = plan.deload.everyNCycles
    if (!Number.isFinite(n) || n < 2 || n > 52) {
      issues.push({ path: 'deload.everyNCycles', message: pl.validationDeloadCycles })
    }
  }
  return issues
}

export function metricTargetMet(target: MetricTarget, actual: number): boolean {
  if (!Number.isFinite(actual) || actual < 0) return false
  switch (target.kind) {
    case 'fixed':
    case 'min':
      return actual >= target.value
    case 'max':
      return actual >= target.minValue
    case 'exact':
      return actual === target.value
  }
}

export function validateSetLog(
  prescription: SetPrescription,
  actual: SetActual,
  metric: PrimaryMetric,
): boolean {
  if (metric === 'duration_sec') {
    if (prescription.durationSec == null || actual.durationSec == null) return false
    if (!Number.isFinite(actual.durationSec) || actual.durationSec < 0) return false
    return metricTargetMet(prescription.durationSec, actual.durationSec)
  }
  if (prescription.reps == null || actual.reps == null) return false
  if (!Number.isFinite(actual.reps) || actual.reps < 0) return false
  if (!metricTargetMet(prescription.reps, actual.reps)) return false
  // Only require weight when the prescription specifies a weight target.
  // Without a prescription weight, reps_weight exercises can be done bodyweight
  // (weightKg = 0 or null) — e.g. weighted pull-ups prescription vs bodyweight.
  if (prescription.weightKg) {
    if (actual.weightKg == null || !Number.isFinite(actual.weightKg)) return false
    return metricTargetMet(prescription.weightKg, actual.weightKg)
  }
  return true
}

/** Extract the numeric target value from a MetricTarget (for volume calculations). */
function metricTargetValue(target: MetricTarget): number {
  switch (target.kind) {
    case 'fixed':
    case 'min':
    case 'exact':
      return target.value
    case 'max':
      return target.minValue
  }
}

/**
 * For reps_weight exercises: check if a below-target set still represents
 * progress via volume (reps × weight). Returns true when:
 * - The set did NOT pass (reps below target)
 * - But the actual volume (reps × weight) >= target volume (targetReps × targetWeight)
 *
 * Example: target 10 reps @ 20kg (volume 200), actual 8 reps @ 30kg (volume 240).
 * 240 >= 200 → volume progress → should be marked amber, not red.
 *
 * Only applies when the prescription specifies BOTH reps and weight targets.
 * Bodyweight reps_weight (no prescription weight) falls back to pure reps.
 */
export function isVolumeProgress(
  prescription: SetPrescription,
  actual: SetActual,
  metric: PrimaryMetric,
): boolean {
  if (metric !== 'reps_weight') return false
  if (prescription.reps == null || prescription.weightKg == null) return false
  if (actual.reps == null || actual.weightKg == null) return false
  // Only relevant when reps are below target (otherwise it's a normal pass)
  if (metricTargetMet(prescription.reps, actual.reps)) return false
  const targetReps = metricTargetValue(prescription.reps)
  const targetWeight = metricTargetValue(prescription.weightKg)
  const targetVolume = targetReps * targetWeight
  const actualVolume = actual.reps * actual.weightKg
  return actualVolume >= targetVolume && actual.weightKg > targetWeight
}

export function setTargetToMetricTarget(target: SetTarget): MetricTarget {
  switch (target.kind) {
    case 'fixed':
      return { kind: 'fixed', value: target.reps }
    case 'max':
      return { kind: 'max', minValue: target.minReps }
    case 'exact':
      return { kind: 'exact', value: target.reps }
    default: {
      const _exhaustive: never = target
      return _exhaustive
    }
  }
}

/** RPE helpers — Rate of Perceived Exertion (1-10 scale). */
export const RPE_MIN = 1
export const RPE_MAX = 10
export const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

/** RIR helpers — Reps In Reserve (0-10). */
export const RIR_MIN = 0
export const RIR_MAX = 10
export const RIR_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const

/** Convert RPE to RIR (RPE 10 = 0 RIR, RPE 9 = 1 RIR, etc.). */
export function rpeToRir(rpe: number): number {
  return Math.max(0, 10 - rpe)
}

/** Convert RIR to RPE. */
export function rirToRpe(rir: number): number {
  return Math.min(10, Math.max(1, 10 - rir))
}

/** Estimated 1RM using Epley formula: weight * (1 + reps/30). */
export function estimate1rmEpley(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  return Math.round(weightKg * (1 + reps / 30))
}

/** Estimated 1RM using Brzycki formula: weight * 36 / (37 - reps). */
export function estimate1rmBrzycki(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0 || reps >= 37) return 0
  return Math.round((weightKg * 36) / (37 - reps))
}

/** Best 1RM estimate — uses Epley for reps <= 10, Brzycki for 11-36, Epley fallback for >36. */
export function estimate1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0
  if (reps <= 10) return estimate1rmEpley(weightKg, reps)
  const brzycki = estimate1rmBrzycki(weightKg, reps)
  // Brzycki returns 0 for reps >= 37 (division by zero) — fall back to Epley
  return brzycki > 0 ? brzycki : estimate1rmEpley(weightKg, reps)
}

/** Volume for a single set: reps * weightKg (0 if no weight). */
export function setVolume(set: SetLog): number {
  const reps = set.actual.reps ?? 0
  const kg = set.actual.weightKg ?? 0
  return kg > 0 ? reps * kg : 0
}

/** Starter pack keys — labels live in pl.ts (`exerciseStarter*`). */
export type ExerciseStarterKey =
  | 'pushups'
  | 'pullups'
  | 'squats'
  | 'plank'
  | 'sidePlank'
  | 'press'
  // Klatka piersiowa
  | 'benchPress'
  | 'inclineBenchPress'
  | 'dumbbellFlyes'
  | 'dips'
  | 'pushupWide'
  | 'declineBenchPress'
  | 'pecDeck'
  // Plecy
  | 'barbellRow'
  | 'latPulldown'
  | 'deadlift'
  | 'seatedRow'
  | 'facePulls'
  | 'dumbbellRow'
  | 'tbarRow'
  | 'straightArmPulldown'
  | 'shrug'
  // Barki
  | 'overheadPress'
  | 'lateralRaise'
  | 'frontRaise'
  | 'rearDeltFlyes'
  | 'arnoldPress'
  | 'uprightRow'
  // Ramiona
  | 'barbellCurl'
  | 'dumbbellCurl'
  | 'hammerCurl'
  | 'tricepPushdown'
  | 'skullCrusher'
  | 'closeGripBench'
  | 'concentrationCurl'
  | 'preacherCurl'
  | 'overheadTricepExtension'
  | 'tricepKickback'
  // Nogi
  | 'legPress'
  | 'lunges'
  | 'romanianDeadlift'
  | 'legExtension'
  | 'legCurl'
  | 'calfRaise'
  | 'gobletSquat'
  | 'hipThrust'
  | 'frontSquat'
  | 'stepUp'
  // Core
  | 'crunches'
  | 'hangingLegRaise'
  | 'russianTwist'
  | 'mountainClimbers'
  | 'deadBug'
  | 'reverseCrunch'
  | 'lyingLegRaise'
  // Całe ciało
  | 'burpees'
  | 'kettlebellSwing'
  | 'thrusters'
  | 'cleanAndPress'
  // Cardio
  | 'stairClimbing'
  | 'running'
  | 'cycling'
  | 'rowingMachine'
  | 'elliptical'
  | 'jumpRope'
  | 'jumpingJacks'
  | 'highKnees'

export const EXERCISE_STARTERS: Array<{
  key: ExerciseStarterKey
  primaryMetric: PrimaryMetric
  restDefaultSec: number
  muscleGroup: MuscleGroup
}> = [
  // Oryginalne
  { key: 'pushups', primaryMetric: 'reps', restDefaultSec: 90, muscleGroup: 'chest' },
  { key: 'pullups', primaryMetric: 'reps', restDefaultSec: 120, muscleGroup: 'back' },
  { key: 'squats', primaryMetric: 'reps', restDefaultSec: 90, muscleGroup: 'legs' },
  { key: 'plank', primaryMetric: 'duration_sec', restDefaultSec: 60, muscleGroup: 'core' },
  { key: 'sidePlank', primaryMetric: 'duration_sec', restDefaultSec: 60, muscleGroup: 'core' },
  { key: 'press', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'shoulders' },
  // Klatka piersiowa
  { key: 'benchPress', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'chest' },
  { key: 'inclineBenchPress', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'chest' },
  { key: 'dumbbellFlyes', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'chest' },
  { key: 'dips', primaryMetric: 'reps', restDefaultSec: 90, muscleGroup: 'chest' },
  { key: 'pushupWide', primaryMetric: 'reps', restDefaultSec: 90, muscleGroup: 'chest' },
  { key: 'declineBenchPress', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'chest' },
  { key: 'pecDeck', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'chest' },
  // Plecy
  { key: 'barbellRow', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'back' },
  { key: 'latPulldown', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'back' },
  { key: 'deadlift', primaryMetric: 'reps_weight', restDefaultSec: 180, muscleGroup: 'back' },
  { key: 'seatedRow', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'back' },
  { key: 'facePulls', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'back' },
  { key: 'dumbbellRow', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'back' },
  { key: 'tbarRow', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'back' },
  { key: 'straightArmPulldown', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'back' },
  { key: 'shrug', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'back' },
  // Barki
  { key: 'overheadPress', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'shoulders' },
  { key: 'lateralRaise', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'shoulders' },
  { key: 'frontRaise', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'shoulders' },
  { key: 'rearDeltFlyes', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'shoulders' },
  { key: 'arnoldPress', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'shoulders' },
  { key: 'uprightRow', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'shoulders' },
  // Ramiona
  { key: 'barbellCurl', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'arms' },
  { key: 'dumbbellCurl', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'arms' },
  { key: 'hammerCurl', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'arms' },
  { key: 'tricepPushdown', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'arms' },
  { key: 'skullCrusher', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'arms' },
  { key: 'closeGripBench', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'arms' },
  { key: 'concentrationCurl', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'arms' },
  { key: 'preacherCurl', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'arms' },
  { key: 'overheadTricepExtension', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'arms' },
  { key: 'tricepKickback', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'arms' },
  // Nogi
  { key: 'legPress', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'legs' },
  { key: 'lunges', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'legs' },
  { key: 'romanianDeadlift', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'legs' },
  { key: 'legExtension', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'legs' },
  { key: 'legCurl', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'legs' },
  { key: 'calfRaise', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'legs' },
  { key: 'gobletSquat', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'legs' },
  { key: 'hipThrust', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'legs' },
  { key: 'frontSquat', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'legs' },
  { key: 'stepUp', primaryMetric: 'reps', restDefaultSec: 60, muscleGroup: 'legs' },
  // Core
  { key: 'crunches', primaryMetric: 'reps', restDefaultSec: 60, muscleGroup: 'core' },
  { key: 'hangingLegRaise', primaryMetric: 'reps', restDefaultSec: 60, muscleGroup: 'core' },
  { key: 'russianTwist', primaryMetric: 'reps', restDefaultSec: 60, muscleGroup: 'core' },
  { key: 'mountainClimbers', primaryMetric: 'duration_sec', restDefaultSec: 45, muscleGroup: 'core' },
  { key: 'deadBug', primaryMetric: 'reps', restDefaultSec: 45, muscleGroup: 'core' },
  { key: 'reverseCrunch', primaryMetric: 'reps', restDefaultSec: 60, muscleGroup: 'core' },
  { key: 'lyingLegRaise', primaryMetric: 'reps', restDefaultSec: 60, muscleGroup: 'core' },
  // Całe ciało
  { key: 'burpees', primaryMetric: 'reps', restDefaultSec: 60, muscleGroup: 'full_body' },
  { key: 'kettlebellSwing', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'full_body' },
  { key: 'thrusters', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'full_body' },
  { key: 'cleanAndPress', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'full_body' },
  // Cardio — duration in minutes
  { key: 'stairClimbing', primaryMetric: 'duration_sec', restDefaultSec: 60, muscleGroup: 'cardio' },
  { key: 'running', primaryMetric: 'duration_sec', restDefaultSec: 60, muscleGroup: 'cardio' },
  { key: 'cycling', primaryMetric: 'duration_sec', restDefaultSec: 60, muscleGroup: 'cardio' },
  { key: 'rowingMachine', primaryMetric: 'duration_sec', restDefaultSec: 60, muscleGroup: 'cardio' },
  { key: 'elliptical', primaryMetric: 'duration_sec', restDefaultSec: 60, muscleGroup: 'cardio' },
  { key: 'jumpRope', primaryMetric: 'duration_sec', restDefaultSec: 60, muscleGroup: 'cardio' },
  { key: 'jumpingJacks', primaryMetric: 'duration_sec', restDefaultSec: 60, muscleGroup: 'cardio' },
  { key: 'highKnees', primaryMetric: 'duration_sec', restDefaultSec: 60, muscleGroup: 'cardio' },
]
