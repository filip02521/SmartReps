import type { SetResultDraft } from '@/lib/progress-engine'
import type { LocalWorkoutSession } from '@/lib/db'

/** Build a valid SetResultDraft for builtin sessions in tests. */
export function setDraft(actual: number, setNumber = 1): SetResultDraft {
  return { setNumber, target: { kind: 'fixed', reps: actual }, actual, passed: true }
}

/** Convert simple { actual } array to full SetResultDraft[]. */
export function setDrafts(actuals: number[]): SetResultDraft[] {
  return actuals.map((a, i) => setDraft(a, i + 1))
}

/** Build a builtin LocalWorkoutSession with valid setResults. */
export function builtinSession(
  id: string,
  startedAt: string,
  totalReps: number,
  setActuals: number[],
  program: 'pushups' | 'pullups' = 'pushups',
): LocalWorkoutSession {
  return {
    id,
    program,
    cycleId: 'c1',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'completed',
    startedAt,
    completedAt: startedAt,
    passed: true,
    totalReps,
    setResults: setDrafts(setActuals),
  }
}
