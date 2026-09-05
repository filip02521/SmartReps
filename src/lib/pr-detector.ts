import { db, type LocalWorkoutSession } from '@/lib/db'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import { pl } from '@/i18n/pl'

export type PersonalRecord = {
  /** Stable key for deduplication (e.g. "session:totalReps", "exercise:abc:maxReps"). */
  key: string
  /** Display label type — maps to i18n key. */
  kind: 'bestSession' | 'bestMaxSet' | 'maxReps' | 'maxWeight' | 'maxDuration'
  /** Exercise name (for custom exercise PRs). */
  exerciseName?: string
  /** New record value. */
  value: number
  /** Previous record value (null if first ever). */
  previousValue: number | null
  /** Unit: 'reps' | 'kg' | 's'. */
  unit: 'reps' | 'kg' | 's'
}

/**
 * Detect personal records set in the given session, compared to all prior completed sessions.
 * Returns an array of new PRs (records broken or set for the first time).
 */
export async function detectPersonalRecords(
  session: LocalWorkoutSession,
): Promise<PersonalRecord[]> {
  if (session.status !== 'completed') return []

  // Load all completed sessions before this one
  const sessionTime = new Date(session.startedAt).getTime()
  const allSessions = (await db.workoutSessions.toArray())
    .filter(
      (s) =>
        s.status === 'completed' &&
        new Date(s.startedAt).getTime() < sessionTime &&
        s.id !== session.id,
    )
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  const records: PersonalRecord[] = []

  if (isCustomWorkoutSession(session)) {
    // Custom session — check per-exercise PRs
    if (!session.exerciseLogs) return []

    // Build exercise name lookup
    const exerciseIds = new Set<string>()
    for (const log of session.exerciseLogs) {
      exerciseIds.add(log.exerciseId)
    }
    const exerciseMap = new Map<string, ExerciseDefinition>()
    for (const id of exerciseIds) {
      const ex = await db.exercises.get(id)
      if (ex) exerciseMap.set(id, ex)
    }

    for (const log of session.exerciseLogs) {
      const ex = exerciseMap.get(log.exerciseId)
      const name = ex?.name ?? pl.exerciseFallbackName

      // Current session values
      const currentMaxReps = Math.max(...log.sets.map((s) => s.actual.reps ?? 0), 0)
      const currentMaxWeight = Math.max(...log.sets.map((s) => s.actual.weightKg ?? 0), 0)
      const currentMaxDuration = Math.max(...log.sets.map((s) => s.actual.durationSec ?? 0), 0)

      // Historical values for this exercise
      let prevMaxReps = 0
      let prevMaxWeight = 0
      let prevMaxDuration = 0

      for (const prevSession of allSessions) {
        if (!isCustomWorkoutSession(prevSession) || !prevSession.exerciseLogs) continue
        const prevLog = prevSession.exerciseLogs.find((l) => l.exerciseId === log.exerciseId)
        if (!prevLog) continue
        for (const s of prevLog.sets) {
          prevMaxReps = Math.max(prevMaxReps, s.actual.reps ?? 0)
          prevMaxWeight = Math.max(prevMaxWeight, s.actual.weightKg ?? 0)
          prevMaxDuration = Math.max(prevMaxDuration, s.actual.durationSec ?? 0)
        }
      }

      if (currentMaxReps > 0 && currentMaxReps > prevMaxReps) {
        records.push({
          key: `exercise:${log.exerciseId}:maxReps`,
          kind: 'maxReps',
          exerciseName: name,
          value: currentMaxReps,
          previousValue: prevMaxReps > 0 ? prevMaxReps : null,
          unit: 'reps',
        })
      }
      if (currentMaxWeight > 0 && currentMaxWeight > prevMaxWeight) {
        records.push({
          key: `exercise:${log.exerciseId}:maxWeight`,
          kind: 'maxWeight',
          exerciseName: name,
          value: Math.round(currentMaxWeight * 10) / 10,
          previousValue: prevMaxWeight > 0 ? Math.round(prevMaxWeight * 10) / 10 : null,
          unit: 'kg',
        })
      }
      if (currentMaxDuration > 0 && currentMaxDuration > prevMaxDuration) {
        records.push({
          key: `exercise:${log.exerciseId}:maxDuration`,
          kind: 'maxDuration',
          exerciseName: name,
          value: currentMaxDuration,
          previousValue: prevMaxDuration > 0 ? prevMaxDuration : null,
          unit: 's',
        })
      }
    }
  } else {
    // Builtin session — check totalReps (best session) and max set
    const currentTotal = session.totalReps ?? 0
    const currentMaxSet = session.setResults.length
      ? Math.max(...session.setResults.map((s) => s.actual))
      : 0

    let prevBestSession = 0
    let prevBestMaxSet = 0

    for (const prevSession of allSessions) {
      if (isCustomWorkoutSession(prevSession)) continue
      if (prevSession.program !== session.program) continue
      prevBestSession = Math.max(prevBestSession, prevSession.totalReps ?? 0)
      if (prevSession.setResults.length) {
        prevBestMaxSet = Math.max(
          prevBestMaxSet,
          ...prevSession.setResults.map((s) => s.actual),
        )
      }
    }

    if (currentTotal > 0 && currentTotal > prevBestSession) {
      records.push({
        key: `session:${session.program}:totalReps`,
        kind: 'bestSession',
        value: currentTotal,
        previousValue: prevBestSession > 0 ? prevBestSession : null,
        unit: 'reps',
      })
    }
    if (currentMaxSet > 0 && currentMaxSet > prevBestMaxSet) {
      records.push({
        key: `session:${session.program}:maxSet`,
        kind: 'bestMaxSet',
        value: currentMaxSet,
        previousValue: prevBestMaxSet > 0 ? prevBestMaxSet : null,
        unit: 'reps',
      })
    }
  }

  return records
}
