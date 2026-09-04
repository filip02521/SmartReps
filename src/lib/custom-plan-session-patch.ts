import type {
  CustomPlan,
  ExerciseDefinition,
  ExerciseLog,
  PlanDay,
  PlannedExercise,
  PrimaryMetric,
  SetLog,
  SetPrescription,
} from '@/lib/exercise-model'
import { getGroupForExercise } from '@/lib/custom-workout-nav'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'

const MAX_SETS_PER_EXERCISE = 30

/** Clone last prescription (or a simple fixed template) onto the current exercise. */
export function addSetToPlanExercise(
  plan: CustomPlan,
  dayNumber: number,
  exerciseIndex: number,
): CustomPlan | null {
  const day = plan.days.find((d) => d.dayNumber === dayNumber)
  if (!day) return null
  const planned = day.exercises[exerciseIndex]
  if (!planned) return null
  if (getGroupForExercise(day, exerciseIndex)) return null
  if (planned.sets.length >= MAX_SETS_PER_EXERCISE) return null

  const template: SetPrescription =
    planned.sets[planned.sets.length - 1] ??
    planned.sets[0] ?? { reps: { kind: 'fixed', value: 8 } }

  const nextDay: PlanDay = {
    ...day,
    exercises: day.exercises.map((pe, i) =>
      i === exerciseIndex ? { ...pe, sets: [...pe.sets, structuredClone(template)] } : pe,
    ),
  }

  return {
    ...plan,
    days: plan.days.map((d) => (d.dayNumber === dayNumber ? nextDay : d)),
  }
}

export function canAddSetToExercise(day: PlanDay, exerciseIndex: number): boolean {
  const planned = day.exercises[exerciseIndex]
  if (!planned) return false
  if (getGroupForExercise(day, exerciseIndex)) return false
  return planned.sets.length < MAX_SETS_PER_EXERCISE
}

/** Baseline = set count from the saved plan at session start (per exerciseId). */
export function captureBaselineSetCounts(day: PlanDay): Record<string, number> {
  const out: Record<string, number> = {}
  for (const pe of day.exercises) {
    out[pe.exerciseId] = pe.sets.length
  }
  return out
}

export function baselineSetCountForExercise(
  baseline: Record<string, number>,
  exerciseId: string,
  fallback: number,
): number {
  const n = baseline[exerciseId]
  return typeof n === 'number' && n >= 0 ? n : fallback
}

/**
 * Session extras above baseline may be removed.
 * - Empty trailing slot → drop immediately
 * - Last slot logged → caller undoes log, then drops
 */
export function canRemoveSetFromExercise(
  day: PlanDay,
  exerciseIndex: number,
  baselineCount: number,
  loggedSetCount: number,
): boolean {
  const planned = day.exercises[exerciseIndex]
  if (!planned) return false
  if (getGroupForExercise(day, exerciseIndex)) return false
  if (planned.sets.length <= baselineCount) return false
  if (loggedSetCount > planned.sets.length) return false
  return true
}

/** Drop last set only when it has no log yet (`loggedSetCount < sets.length`). */
export function removeSetFromPlanExercise(
  plan: CustomPlan,
  dayNumber: number,
  exerciseIndex: number,
  baselineCount: number,
  loggedSetCount: number,
): CustomPlan | null {
  const day = plan.days.find((d) => d.dayNumber === dayNumber)
  if (!day) return null
  const planned = day.exercises[exerciseIndex]
  if (!planned) return null
  if (getGroupForExercise(day, exerciseIndex)) return null
  if (planned.sets.length <= baselineCount) return null
  if (loggedSetCount >= planned.sets.length) return null

  const nextSets = planned.sets.slice(0, -1)
  if (nextSets.length < baselineCount || nextSets.length < 1) return null

  const nextDay: PlanDay = {
    ...day,
    exercises: day.exercises.map((pe, i) =>
      i === exerciseIndex ? { ...pe, sets: nextSets } : pe,
    ),
  }

  return {
    ...plan,
    days: plan.days.map((d) => (d.dayNumber === dayNumber ? nextDay : d)),
  }
}

/** True when session day still differs from baseline set counts. */
export function sessionHasExtraSets(
  day: PlanDay,
  baseline: Record<string, number>,
): boolean {
  for (const pe of day.exercises) {
    const base = baselineSetCountForExercise(baseline, pe.exerciseId, pe.sets.length)
    if (pe.sets.length !== base) return true
  }
  return false
}

/** Baseline restBetweenSetsSec per exerciseId (from saved plan day). */
export function captureBaselineRests(day: PlanDay): Record<string, number> {
  const out: Record<string, number> = {}
  for (const pe of day.exercises) {
    out[pe.exerciseId] = pe.restBetweenSetsSec
  }
  return out
}

export function sessionHasRestChanges(
  day: PlanDay,
  baseline: Record<string, number>,
): boolean {
  for (const pe of day.exercises) {
    const base = baseline[pe.exerciseId]
    if (typeof base === 'number' && pe.restBetweenSetsSec !== base) return true
  }
  return false
}

export function sessionDayIsDirty(
  day: PlanDay,
  baselineSets: Record<string, number>,
  baselineRests: Record<string, number>,
): boolean {
  return sessionHasExtraSets(day, baselineSets) || sessionHasRestChanges(day, baselineRests)
}

/** Default prescriptions for a metric — used when swapping to a new exercise. */
function defaultSetsForMetric(metric: PrimaryMetric): SetPrescription[] {
  if (metric === 'duration_sec') return [{ durationSec: { kind: 'min', value: 30 } }]
  if (metric === 'reps_weight') {
    return [{ reps: { kind: 'fixed', value: 8 }, weightKg: { kind: 'fixed', value: 20 } }]
  }
  return [{ reps: { kind: 'fixed', value: 8 } }]
}

/**
 * Swap exercise at a linear (non-group) position — session-only until summary.
 * Sets are prefilled from `historySets` when available, otherwise defaults for the metric.
 * Adopts the new exercise's default rest.
 */
export function swapExerciseInSessionDay(
  plan: CustomPlan,
  dayNumber: number,
  exerciseIndex: number,
  newExerciseId: string,
  newDef: ExerciseDefinition,
  historySets?: SetLog[] | null,
): CustomPlan | null {
  const day = plan.days.find((d) => d.dayNumber === dayNumber)
  if (!day) return null
  const planned = day.exercises[exerciseIndex]
  if (!planned) return null
  if (getGroupForExercise(day, exerciseIndex)) return null
  if (planned.exerciseId === newExerciseId) return plan

  const sets =
    historySets && historySets.length > 0
      ? historySets.map((s) => setLogToPrescription(s, newDef.primaryMetric))
      : defaultSetsForMetric(newDef.primaryMetric)

  const nextDay: PlanDay = {
    ...day,
    exercises: day.exercises.map((pe, i) =>
      i === exerciseIndex
        ? {
            ...pe,
            exerciseId: newExerciseId,
            sets,
            restBetweenSetsSec: newDef.restDefaultSec,
          }
        : pe,
    ),
  }

  return {
    ...plan,
    days: plan.days.map((d) => (d.dayNumber === dayNumber ? nextDay : d)),
  }
}

/**
 * Append a new exercise to the end of a session day (non-group only).
 * Session-only until summary. Sets are prefilled from `historySets` when available,
 * otherwise defaults for the metric.
 */
export function addExerciseToSessionDay(
  plan: CustomPlan,
  dayNumber: number,
  newExerciseId: string,
  newDef: ExerciseDefinition,
  historySets?: SetLog[] | null,
): CustomPlan | null {
  const day = plan.days.find((d) => d.dayNumber === dayNumber)
  if (!day) return null

  const sets =
    historySets && historySets.length > 0
      ? historySets.map((s) => setLogToPrescription(s, newDef.primaryMetric))
      : defaultSetsForMetric(newDef.primaryMetric)

  const nextOrder = day.exercises.length > 0
    ? Math.max(...day.exercises.map((e) => e.order)) + 1
    : 0

  const newExercise: PlannedExercise = {
    exerciseId: newExerciseId,
    order: nextOrder,
    restBetweenSetsSec: newDef.restDefaultSec,
    sets,
  }

  const nextDay: PlanDay = {
    ...day,
    exercises: [...day.exercises, newExercise],
  }

  return {
    ...plan,
    days: plan.days.map((d) => (d.dayNumber === dayNumber ? nextDay : d)),
  }
}
export function sessionHasExerciseSwaps(
  day: PlanDay,
  baselineDay: PlanDay,
): boolean {
  const max = Math.min(day.exercises.length, baselineDay.exercises.length)
  for (let i = 0; i < max; i++) {
    if (getGroupForExercise(day, i)) continue
    if (day.exercises[i]!.exerciseId !== baselineDay.exercises[i]!.exerciseId) return true
  }
  return false
}

/** Update rest between sets for a linear (non-group) exercise — session-only until summary. */
export function setRestBetweenSetsOnExercise(
  plan: CustomPlan,
  dayNumber: number,
  exerciseIndex: number,
  restSec: number,
): CustomPlan | null {
  const day = plan.days.find((d) => d.dayNumber === dayNumber)
  if (!day) return null
  const planned = day.exercises[exerciseIndex]
  if (!planned) return null
  if (getGroupForExercise(day, exerciseIndex)) return null
  const sec = Math.max(0, Math.floor(restSec))
  if (planned.restBetweenSetsSec === sec) return plan

  const nextDay: PlanDay = {
    ...day,
    exercises: day.exercises.map((pe, i) =>
      i === exerciseIndex ? { ...pe, restBetweenSetsSec: sec } : pe,
    ),
  }

  return {
    ...plan,
    days: plan.days.map((d) => (d.dayNumber === dayNumber ? nextDay : d)),
  }
}

/** Convert a logged set into a fixed plan target for overwrite. */
export function setLogToPrescription(set: SetLog, metric: PrimaryMetric): SetPrescription {
  if (metric === 'duration_sec') {
    const value = set.actual.durationSec ?? 0
    return { durationSec: { kind: 'fixed', value: Math.max(1, value) } }
  }
  if (metric === 'reps_weight') {
    const reps = set.actual.reps ?? 0
    const kg = set.actual.weightKg
    const out: SetPrescription = { reps: { kind: 'fixed', value: Math.max(0, reps) } }
    if (kg != null && Number.isFinite(kg)) {
      out.weightKg = { kind: 'fixed', value: kg }
    }
    return out
  }
  const reps = set.actual.reps ?? 0
  return { reps: { kind: 'fixed', value: Math.max(0, reps) } }
}

export type TargetValueChange = {
  setNumber: number
  fromReps?: number
  toReps?: number
  fromWeightKg?: number
  toWeightKg?: number
  fromDurationSec?: number
  toDurationSec?: number
}

export type SessionPlanChange =
  | { kind: 'sets'; exerciseId: string; from: number; to: number }
  | { kind: 'rest'; exerciseId: string; from: number; to: number }
  | { kind: 'exercise_swap'; order: number; fromExerciseId: string; toExerciseId: string }
  | { kind: 'exercise_added'; exerciseId: string }
  | { kind: 'target_values'; exerciseId: string; changes: TargetValueChange[] }

/** Group changes into two categories for selective plan updates. */
export function categorizePlanChanges(changes: SessionPlanChange[]): {
  hasValueChanges: boolean
  hasExerciseChanges: boolean
} {
  const hasValueChanges = changes.some(
    (c) => c.kind === 'sets' || c.kind === 'rest' || c.kind === 'target_values',
  )
  const hasExerciseChanges = changes.some(
    (c) => c.kind === 'exercise_swap' || c.kind === 'exercise_added',
  )
  return { hasValueChanges, hasExerciseChanges }
}

/** Diff vs saved plan: exercise swaps + set counts + rest + target value changes. */
export function buildSessionPlanChanges(
  plan: CustomPlan,
  dayNumber: number,
  exerciseLogs: ExerciseLog[],
  sessionDay?: PlanDay | null,
  exerciseMap?: Map<string, ExerciseDefinition> | null,
): SessionPlanChange[] {
  const day = plan.days.find((d) => d.dayNumber === dayNumber)
  if (!day) return []
  const changes: SessionPlanChange[] = []
  for (let i = 0; i < day.exercises.length; i++) {
    const planned = day.exercises[i]
    if (!planned || getGroupForExercise(day, i)) continue

    // Exercise swap: session day exerciseId differs from saved plan.
    // When swapped, sets/rest/targets changes are implicit (new defaults) — skip them.
    let swapped = false
    if (sessionDay) {
      const sessionPe = sessionDay.exercises[i]
      if (sessionPe && sessionPe.exerciseId !== planned.exerciseId) {
        changes.push({
          kind: 'exercise_swap',
          order: planned.order,
          fromExerciseId: planned.exerciseId,
          toExerciseId: sessionPe.exerciseId,
        })
        swapped = true
      }
    }

    if (swapped) continue

    const log =
      exerciseLogs.find((l) => l.exerciseId === planned.exerciseId) ?? exerciseLogs[i]
    if (log && log.sets.length !== planned.sets.length) {
      changes.push({
        kind: 'sets',
        exerciseId: planned.exerciseId,
        from: planned.sets.length,
        to: log.sets.length,
      })
    }
    if (sessionDay) {
      const sessionPe = sessionDay.exercises[i]
      if (sessionPe && sessionPe.restBetweenSetsSec !== planned.restBetweenSetsSec) {
        changes.push({
          kind: 'rest',
          exerciseId: planned.exerciseId,
          from: planned.restBetweenSetsSec,
          to: sessionPe.restBetweenSetsSec,
        })
      }
    }

    // Target value changes: same set count but actual reps/weight/duration differ
    // from planned targets. Only detect when sets count matches to avoid duplicating
    // the "sets" change (which already rewrites targets from logs).
    if (log && log.sets.length === planned.sets.length && log.sets.length > 0) {
      const def = exerciseMap?.get(planned.exerciseId)
      const metric = def?.primaryMetric ?? 'reps'
      const valueChanges = detectTargetValueChanges(planned.sets, log.sets, metric)
      if (valueChanges.length > 0) {
        changes.push({
          kind: 'target_values',
          exerciseId: planned.exerciseId,
          changes: valueChanges,
        })
      }
    }
  }

  // Detect exercises added during the session (session day has more exercises than planned).
  if (sessionDay && sessionDay.exercises.length > day.exercises.length) {
    for (let i = day.exercises.length; i < sessionDay.exercises.length; i++) {
      const added = sessionDay.exercises[i]
      if (added && !getGroupForExercise(sessionDay, i)) {
        changes.push({ kind: 'exercise_added', exerciseId: added.exerciseId })
      }
    }
  }

  return changes
}

/** Detect when actual logged values differ from planned targets (same set count).
 *  Returns structured changes (no user-facing strings — formatting is in i18n). */
function detectTargetValueChanges(
  plannedSets: SetPrescription[],
  loggedSets: SetLog[],
  metric: PrimaryMetric,
): TargetValueChange[] {
  const out: TargetValueChange[] = []
  for (let i = 0; i < plannedSets.length && i < loggedSets.length; i++) {
    const planned = plannedSets[i]
    const logged = loggedSets[i]
    if (!planned || !logged) continue

    if (metric === 'duration_sec') {
      const plannedVal = planned.durationSec ? metricTargetDisplayValue(planned.durationSec) : 0
      const actualVal = logged.actual.durationSec ?? 0
      if (actualVal > 0 && actualVal !== plannedVal) {
        out.push({ setNumber: i + 1, fromDurationSec: plannedVal, toDurationSec: actualVal })
      }
    } else if (metric === 'reps_weight') {
      const plannedReps = planned.reps ? metricTargetDisplayValue(planned.reps) : 0
      const actualReps = logged.actual.reps ?? 0
      const plannedKg = planned.weightKg ? metricTargetDisplayValue(planned.weightKg) : undefined
      const actualKg = logged.actual.weightKg
      const repDiff = actualReps > 0 && actualReps !== plannedReps
      const kgDiff = actualKg != null && plannedKg != null && actualKg !== plannedKg
      if (repDiff || kgDiff) {
        out.push({
          setNumber: i + 1,
          fromReps: repDiff ? plannedReps : undefined,
          toReps: repDiff ? actualReps : undefined,
          fromWeightKg: kgDiff ? plannedKg : undefined,
          toWeightKg: kgDiff ? actualKg : undefined,
        })
      }
    } else {
      const plannedVal = planned.reps ? metricTargetDisplayValue(planned.reps) : 0
      const actualVal = logged.actual.reps ?? 0
      if (actualVal > 0 && actualVal !== plannedVal) {
        out.push({ setNumber: i + 1, fromReps: plannedVal, toReps: actualVal })
      }
    }
  }
  return out
}

export function parseSessionDayPatchJson(json: string | undefined | null): PlanDay | null {
  if (!json) return null
  try {
    const day = JSON.parse(json) as PlanDay
    if (typeof day?.dayNumber !== 'number' || !Array.isArray(day.exercises)) return null
    return day
  } catch {
    return null
  }
}

export function sessionSuggestsPlanUpdate(
  plan: CustomPlan,
  dayNumber: number,
  exerciseLogs: ExerciseLog[],
  sessionDay?: PlanDay | null,
  exerciseMap?: Map<string, ExerciseDefinition> | null,
): boolean {
  return buildSessionPlanChanges(plan, dayNumber, exerciseLogs, sessionDay, exerciseMap).length > 0
}

/** Merge a session-only PlanDay override into the plan (resume / extra sets). */
export function applyDayOverrideToPlan(
  plan: CustomPlan,
  dayOverrideJson: string,
): CustomPlan | null {
  try {
    const day = JSON.parse(dayOverrideJson) as PlanDay
    if (typeof day?.dayNumber !== 'number' || !Array.isArray(day.exercises)) return null
    if (!plan.days.some((d) => d.dayNumber === day.dayNumber)) return null
    return {
      ...plan,
      days: plan.days.map((d) => (d.dayNumber === day.dayNumber ? day : d)),
    }
  } catch {
    return null
  }
}

/** sessionStorage flag — discard on summary must survive refresh. */
export function planUpdateDeclinedKey(sessionId: string): string {
  return `sr.customPlanUpdateDeclined.${sessionId}`
}

export function isPlanUpdateDeclined(sessionId: string): boolean {
  try {
    return sessionStorage.getItem(planUpdateDeclinedKey(sessionId)) === '1'
  } catch {
    return false
  }
}

export function markPlanUpdateDeclined(sessionId: string): void {
  try {
    sessionStorage.setItem(planUpdateDeclinedKey(sessionId), '1')
  } catch {
    /* private mode */
  }
}

/**
 * Rewrite the completed day from the session:
 * - exercise swap → adopt new exerciseId + default sets + rest from sessionDay
 * - set count change on an exercise → targets from that exercise's logs only
 * - rest changes from sessionDay snapshot
 * - rest-only updates do not rewrite set targets
 */
export function applySessionLogsToPlanDay(
  plan: CustomPlan,
  dayNumber: number,
  exerciseLogs: ExerciseLog[],
  exerciseMap: Map<string, ExerciseDefinition>,
  sessionDay?: PlanDay | null,
): CustomPlan {
  return applySessionLogsToPlanDaySelective(plan, dayNumber, exerciseLogs, exerciseMap, sessionDay, {
    applyValues: true,
    applyExercises: true,
  })
}

export type PlanUpdateOptions = {
  /** Apply target value changes (reps, weight, duration) + set count + rest changes. */
  applyValues: boolean
  /** Apply exercise swaps and added exercises. */
  applyExercises: boolean
}

/**
 * Selective version of applySessionLogsToPlanDay.
 * Allows the user to choose which categories of changes to persist to the plan.
 */
export function applySessionLogsToPlanDaySelective(
  plan: CustomPlan,
  dayNumber: number,
  exerciseLogs: ExerciseLog[],
  exerciseMap: Map<string, ExerciseDefinition>,
  sessionDay: PlanDay | null | undefined,
  options: PlanUpdateOptions,
): CustomPlan {
  const { applyValues, applyExercises } = options
  return {
    ...plan,
    days: plan.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day
      const updatedExercises = day.exercises.map((pe, i) => {
        if (getGroupForExercise(day, i)) return pe
        let next = pe

        // Exercise swap: adopt new exerciseId + sets + rest from session day.
        const sessionPe = sessionDay?.exercises[i]
        const isSwapped = sessionPe && sessionPe.exerciseId !== pe.exerciseId
        if (applyExercises && isSwapped && sessionPe) {
          next = {
            ...next,
            exerciseId: sessionPe.exerciseId,
            sets: sessionPe.sets,
            restBetweenSetsSec: sessionPe.restBetweenSetsSec,
          }
        }

        // Set count change OR target value change: rewrite targets from logs.
        // When set count differs, we already rewrite. When set count is the same
        // but actual values differ from planned targets, also rewrite to match
        // what the user actually did.
        if (applyValues) {
          const log =
            exerciseLogs.find((l) => l.exerciseId === next.exerciseId) ?? exerciseLogs[i]
          if (log && log.sets.length > 0) {
            const def = exerciseMap.get(next.exerciseId)
            const metric = def?.primaryMetric ?? 'reps'
            if (log.sets.length !== next.sets.length) {
              // Set count changed — rewrite all targets from logs.
              next = { ...next, sets: log.sets.map((s) => setLogToPrescription(s, metric)) }
            } else {
              // Same set count — check if target values differ.
              const valueChanges = detectTargetValueChanges(next.sets, log.sets, metric)
              if (valueChanges.length > 0) {
                next = { ...next, sets: log.sets.map((s) => setLogToPrescription(s, metric)) }
              }
            }
          }
        }

        // Rest change (non-swap path — swap already applied rest above).
        if (applyValues && !isSwapped && sessionDay) {
          const restPe = sessionDay.exercises[i]
          if (restPe && restPe.restBetweenSetsSec !== next.restBetweenSetsSec) {
            next = { ...next, restBetweenSetsSec: restPe.restBetweenSetsSec }
          }
        }
        return next
      })

      // Append exercises added during the session (session day has more exercises).
      const added: PlannedExercise[] = []
      if (applyExercises && sessionDay && sessionDay.exercises.length > day.exercises.length) {
        for (let i = day.exercises.length; i < sessionDay.exercises.length; i++) {
          const sessionPe = sessionDay.exercises[i]
          if (!sessionPe || getGroupForExercise(sessionDay, i)) continue
          const def = exerciseMap.get(sessionPe.exerciseId)
          const metric = def?.primaryMetric ?? 'reps'
          const log = exerciseLogs.find((l) => l.exerciseId === sessionPe.exerciseId)
          const sets = log && log.sets.length > 0
            ? log.sets.map((s) => setLogToPrescription(s, metric))
            : sessionPe.sets
          added.push({ ...sessionPe, sets })
        }
      }

      return {
        ...day,
        exercises: [...updatedExercises, ...added],
      }
    }),
  }
}
