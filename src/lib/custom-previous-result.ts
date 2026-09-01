import type { LocalWorkoutSession } from '@/lib/db'
import type { PrimaryMetric, SetLog } from '@/lib/exercise-model'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import { pl } from '@/i18n/pl'

export type PreviousCustomSetResult = {
  reps?: number
  durationSec?: number
  weightKg?: number
  fromDayNumber: number
  fromCycleAttempt: number
  fromCompletedAt: string
}

export function pickPreviousCustomSet(
  sessions: LocalWorkoutSession[],
  params: {
    customPlanId: string
    exerciseId: string
    setNumber: number
    excludeSessionId?: string
  },
): { session: LocalWorkoutSession; set: SetLog } | undefined {
  const candidates = sessions
    .filter(
      (s) =>
        isCustomWorkoutSession(s) &&
        s.customPlanId === params.customPlanId &&
        s.status === 'completed' &&
        s.id !== params.excludeSessionId &&
        s.completedAt,
    )
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
    )

  for (const session of candidates) {
    const log = session.exerciseLogs?.find((l) => l.exerciseId === params.exerciseId)
    const set = log?.sets.find((s) => s.setNumber === params.setNumber)
    if (set) return { session, set }
  }
  return undefined
}

export function toPreviousCustomSetResult(
  session: LocalWorkoutSession,
  set: SetLog,
): PreviousCustomSetResult {
  return {
    reps: set.actual.reps,
    durationSec: set.actual.durationSec,
    weightKg: set.actual.weightKg ?? undefined,
    fromDayNumber: session.dayNumber,
    fromCycleAttempt: session.cycleAttempt,
    fromCompletedAt: session.completedAt!,
  }
}

/** Short context chip: different day or earlier attempt on same day. */
export function formatPreviousCustomContext(
  result: PreviousCustomSetResult,
  currentDayNumber: number,
  currentCycleAttempt: number,
): string | null {
  if (result.fromDayNumber !== currentDayNumber) {
    return pl.customPreviousFromDay(result.fromDayNumber)
  }
  if (result.fromCycleAttempt !== currentCycleAttempt) {
    return pl.customPreviousFromAttempt(result.fromCycleAttempt)
  }
  return null
}

export function formatPreviousCustomValue(
  result: PreviousCustomSetResult,
  metric: PrimaryMetric,
): string | null {
  if (metric === 'duration_sec') {
    if (result.durationSec == null) return null
    return pl.customPreviousDuration(result.durationSec)
  }
  if (metric === 'reps_weight') {
    if (result.reps == null) return null
    if (result.weightKg != null && Number.isFinite(result.weightKg)) {
      return pl.customPreviousRepsWeightValue(result.reps, result.weightKg)
    }
    return pl.customPreviousRepsValue(result.reps)
  }
  if (result.reps == null) return null
  return pl.customPreviousRepsValue(result.reps)
}

export function hasPreviousCustomDisplay(
  result: PreviousCustomSetResult,
  metric: PrimaryMetric,
): boolean {
  return formatPreviousCustomValue(result, metric) != null
}
