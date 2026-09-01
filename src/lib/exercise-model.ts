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

export type PlannedExercise = {
  exerciseId: string
  order: number
  sets: SetPrescription[]
  restBetweenSetsSec: number
  restAfterExerciseSec?: number
  note?: string
}

export type PlanDay = {
  dayNumber: number
  exercises: PlannedExercise[]
  restAfterDay: 1 | 2
}

export type CustomPlanStatus = 'draft' | 'active'

export type CustomPlanSource = 'user' | 'duplicate' | 'import'

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
}

export type ExerciseDefinition = {
  id: string
  name: string
  primaryMetric: PrimaryMetric
  restDefaultSec: number
  archived: boolean
  createdAt: string
  updatedAt: string
}

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
    if (day.exercises.length === 0) {
      issues.push({ path: `${dPath}.exercises`, message: pl.validationDayNoExercises })
    }
    if (![1, 2].includes(day.restAfterDay)) {
      issues.push({ path: `${dPath}.restAfterDay`, message: pl.validationRestAfterDay })
    }
    for (const pe of day.exercises) {
      const ePath = `${dPath}.exercises[${pe.order}]`
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
    }
  }
  return issues
}

export function metricTargetMet(target: MetricTarget, actual: number): boolean {
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
    return metricTargetMet(prescription.durationSec, actual.durationSec)
  }
  if (prescription.reps == null || actual.reps == null) return false
  if (!metricTargetMet(prescription.reps, actual.reps)) return false
  if (metric === 'reps_weight') {
    // Require a recorded weight (0 allowed for bodyweight-tagged work)
    if (actual.weightKg == null || !Number.isFinite(actual.weightKg)) return false
  }
  if (prescription.weightKg) {
    if (actual.weightKg == null) return false
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

export const EXERCISE_STARTERS: Array<{
  key: ExerciseStarterKey
  primaryMetric: PrimaryMetric
  restDefaultSec: number
}> = [
  { key: 'pushups', primaryMetric: 'reps', restDefaultSec: 90 },
  { key: 'pullups', primaryMetric: 'reps', restDefaultSec: 120 },
  { key: 'squats', primaryMetric: 'reps', restDefaultSec: 90 },
  { key: 'plank', primaryMetric: 'duration_sec', restDefaultSec: 60 },
  { key: 'sidePlank', primaryMetric: 'duration_sec', restDefaultSec: 60 },
  { key: 'press', primaryMetric: 'reps_weight', restDefaultSec: 120 },
]
