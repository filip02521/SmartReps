import type { ExerciseLog } from '@/lib/exercise-model'
import type { LocalWorkoutSession } from '@/lib/db'
import type { SetResultDraft } from '@/lib/progress-engine'

/** How many sets have been logged — used for in-progress session LWW. */
export function countSessionLoggedSets(session: {
  setResults?: Pick<SetResultDraft, 'actual'>[]
  exerciseLogs?: Pick<ExerciseLog, 'sets'>[]
}): number {
  let n = 0
  for (const r of session.setResults ?? []) {
    if (r.actual != null) n++
  }
  for (const log of session.exerciseLogs ?? []) {
    for (const set of log.sets) {
      const a = set.actual
      if (
        set.passed ||
        a?.reps != null ||
        a?.durationSec != null ||
        a?.weightKg != null
      ) {
        n++
      }
    }
  }
  return n
}

/**
 * Prefer local when it has more mid-workout progress than remote.
 * Falls back to completedAt / startedAt timestamps for finished sessions.
 */
export function shouldPreferLocalSession(
  local: LocalWorkoutSession,
  remote: {
    status: string
    started_at: string
    completed_at: string | null
    setResults: Pick<SetResultDraft, 'actual'>[]
    exerciseLogs?: Pick<ExerciseLog, 'sets'>[]
  },
): boolean {
  if (local.status === 'in_progress' && remote.status === 'in_progress') {
    const localSets = countSessionLoggedSets(local)
    const remoteSets = countSessionLoggedSets({
      setResults: remote.setResults,
      exerciseLogs: remote.exerciseLogs,
    })
    if (localSets !== remoteSets) return localSets > remoteSets
    // Equal logged-set count: keep local to avoid wiping live mid-workout edits on pull.
    return true
  }

  if (local.status === 'completed' && remote.status !== 'completed') return true
  if (remote.status === 'completed' && local.status !== 'completed') return false

  const remoteTime = new Date(remote.completed_at ?? remote.started_at).getTime()
  const localTime = local.completedAt
    ? new Date(local.completedAt).getTime()
    : new Date(local.startedAt).getTime()

  return localTime > remoteTime
}
