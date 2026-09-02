import type {
  CustomPlan,
  ExerciseDefinition,
  ExerciseLog,
  PlanDay,
  PrimaryMetric,
  SetLog,
  SetPrescription,
} from '@/lib/exercise-model'
import { getGroupForExercise } from '@/lib/custom-workout-nav'

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

export type SessionPlanChange =
  | { kind: 'sets'; exerciseId: string; from: number; to: number }
  | { kind: 'rest'; exerciseId: string; from: number; to: number }

/** Diff vs saved plan: set counts from logs + rest from optional session day snapshot. */
export function buildSessionPlanChanges(
  plan: CustomPlan,
  dayNumber: number,
  exerciseLogs: ExerciseLog[],
  sessionDay?: PlanDay | null,
): SessionPlanChange[] {
  const day = plan.days.find((d) => d.dayNumber === dayNumber)
  if (!day) return []
  const changes: SessionPlanChange[] = []
  for (let i = 0; i < day.exercises.length; i++) {
    const planned = day.exercises[i]
    if (!planned || getGroupForExercise(day, i)) continue
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
      const sessionPe =
        sessionDay.exercises.find((e) => e.exerciseId === planned.exerciseId) ??
        sessionDay.exercises[i]
      if (sessionPe && sessionPe.restBetweenSetsSec !== planned.restBetweenSetsSec) {
        changes.push({
          kind: 'rest',
          exerciseId: planned.exerciseId,
          from: planned.restBetweenSetsSec,
          to: sessionPe.restBetweenSetsSec,
        })
      }
    }
  }
  return changes
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
): boolean {
  return buildSessionPlanChanges(plan, dayNumber, exerciseLogs, sessionDay).length > 0
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
  return {
    ...plan,
    days: plan.days.map((day) => {
      if (day.dayNumber !== dayNumber) return day
      return {
        ...day,
        exercises: day.exercises.map((pe, i) => {
          if (getGroupForExercise(day, i)) return pe
          let next = pe
          const log =
            exerciseLogs.find((l) => l.exerciseId === pe.exerciseId) ?? exerciseLogs[i]
          if (log && log.sets.length > 0 && log.sets.length !== pe.sets.length) {
            const def = exerciseMap.get(pe.exerciseId)
            const metric = def?.primaryMetric ?? 'reps'
            next = { ...next, sets: log.sets.map((s) => setLogToPrescription(s, metric)) }
          }
          if (sessionDay) {
            const sessionPe =
              sessionDay.exercises.find((e) => e.exerciseId === pe.exerciseId) ??
              sessionDay.exercises[i]
            if (sessionPe && sessionPe.restBetweenSetsSec !== next.restBetweenSetsSec) {
              next = { ...next, restBetweenSetsSec: sessionPe.restBetweenSetsSec }
            }
          }
          return next
        }),
      }
    }),
  }
}
