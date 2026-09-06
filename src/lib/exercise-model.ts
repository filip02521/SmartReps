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
}

export type ExerciseLog = {
  exerciseId: string
  order: number
  sets: SetLog[]
}

export type ExerciseGroupKind = 'superset' | 'circuit' | 'amrap'

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

export type CustomPlanSource = 'user' | 'duplicate' | 'import' | 'community'

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
  // Plecy
  | 'barbellRow'
  | 'latPulldown'
  | 'deadlift'
  | 'seatedRow'
  | 'facePulls'
  // Barki
  | 'overheadPress'
  | 'lateralRaise'
  | 'frontRaise'
  | 'rearDeltFlyes'
  | 'arnoldPress'
  // Ramiona
  | 'barbellCurl'
  | 'dumbbellCurl'
  | 'hammerCurl'
  | 'tricepPushdown'
  | 'skullCrusher'
  | 'closeGripBench'
  // Nogi
  | 'legPress'
  | 'lunges'
  | 'romanianDeadlift'
  | 'legExtension'
  | 'legCurl'
  | 'calfRaise'
  | 'gobletSquat'
  | 'hipThrust'
  // Core
  | 'crunches'
  | 'hangingLegRaise'
  | 'russianTwist'
  | 'mountainClimbers'
  | 'deadBug'
  // Całe ciało
  | 'burpees'
  | 'kettlebellSwing'
  | 'thrusters'
  | 'cleanAndPress'

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
  // Plecy
  { key: 'barbellRow', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'back' },
  { key: 'latPulldown', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'back' },
  { key: 'deadlift', primaryMetric: 'reps_weight', restDefaultSec: 180, muscleGroup: 'back' },
  { key: 'seatedRow', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'back' },
  { key: 'facePulls', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'back' },
  // Barki
  { key: 'overheadPress', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'shoulders' },
  { key: 'lateralRaise', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'shoulders' },
  { key: 'frontRaise', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'shoulders' },
  { key: 'rearDeltFlyes', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'shoulders' },
  { key: 'arnoldPress', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'shoulders' },
  // Ramiona
  { key: 'barbellCurl', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'arms' },
  { key: 'dumbbellCurl', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'arms' },
  { key: 'hammerCurl', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'arms' },
  { key: 'tricepPushdown', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'arms' },
  { key: 'skullCrusher', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'arms' },
  { key: 'closeGripBench', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'arms' },
  // Nogi
  { key: 'legPress', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'legs' },
  { key: 'lunges', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'legs' },
  { key: 'romanianDeadlift', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'legs' },
  { key: 'legExtension', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'legs' },
  { key: 'legCurl', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'legs' },
  { key: 'calfRaise', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'legs' },
  { key: 'gobletSquat', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'legs' },
  { key: 'hipThrust', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'legs' },
  // Core
  { key: 'crunches', primaryMetric: 'reps', restDefaultSec: 60, muscleGroup: 'core' },
  { key: 'hangingLegRaise', primaryMetric: 'reps', restDefaultSec: 60, muscleGroup: 'core' },
  { key: 'russianTwist', primaryMetric: 'reps', restDefaultSec: 60, muscleGroup: 'core' },
  { key: 'mountainClimbers', primaryMetric: 'duration_sec', restDefaultSec: 45, muscleGroup: 'core' },
  { key: 'deadBug', primaryMetric: 'reps', restDefaultSec: 45, muscleGroup: 'core' },
  // Całe ciało
  { key: 'burpees', primaryMetric: 'reps', restDefaultSec: 60, muscleGroup: 'full_body' },
  { key: 'kettlebellSwing', primaryMetric: 'reps_weight', restDefaultSec: 60, muscleGroup: 'full_body' },
  { key: 'thrusters', primaryMetric: 'reps_weight', restDefaultSec: 90, muscleGroup: 'full_body' },
  { key: 'cleanAndPress', primaryMetric: 'reps_weight', restDefaultSec: 120, muscleGroup: 'full_body' },
]
