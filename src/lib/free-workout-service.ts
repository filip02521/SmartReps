/** Ad-hoc ("empty") workout — a custom session without a plan.
 *
 * The session row itself is the resume source: an in_progress custom session
 * with `customPlanId === undefined` IS the active free workout (this avoids the
 * `active_custom_workout.custom_plan_id NOT NULL FK`, which cannot reference a
 * plan that does not exist). On finish the user may convert the performed
 * structure into a real CustomPlan via `buildPlanFromFreeWorkout`. */

import { db, type LocalWorkoutSession } from '@/lib/db'
import { generateId } from '@/lib/utils'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import { enqueueSync } from '@/lib/sync'
import { track, AnalyticsEvents } from '@/lib/analytics'
import { useAppStore } from '@/stores/app-store'
import type {
  CustomPlan,
  ExerciseDefinition,
  ExerciseLog,
  PlannedExercise,
  PrimaryMetric,
  SetActual,
  SetLog,
  SetPrescription,
} from '@/lib/exercise-model'

export const FREE_WORKOUT_CYCLE_ID = 'free'

export function isFreeWorkoutSession(session: LocalWorkoutSession): boolean {
  return isCustomWorkoutSession(session) && session.customPlanId == null
}

export function freeSessionHasProgress(logs: ExerciseLog[] | undefined): boolean {
  return (logs ?? []).some((log) => log.sets.length > 0)
}

export function freeWorkoutSetCount(logs: ExerciseLog[] | undefined): number {
  return (logs ?? []).reduce((sum, log) => sum + log.sets.length, 0)
}

export function freeWorkoutTotalReps(logs: ExerciseLog[] | undefined): number {
  return (logs ?? []).reduce(
    (sum, log) => sum + log.sets.reduce((s, set) => s + (set.actual.reps ?? 0), 0),
    0,
  )
}

export function freeWorkoutVolumeKg(logs: ExerciseLog[] | undefined): number {
  return (logs ?? []).reduce(
    (sum, log) =>
      sum + log.sets.reduce((s, set) => s + (set.actual.reps ?? 0) * (set.actual.weightKg ?? 0), 0),
    0,
  )
}

function sessionDoneAt(s: LocalWorkoutSession): number {
  return new Date(s.completedAt ?? s.startedAt).getTime()
}

/** Duplicates younger than this are left alone — a second in_progress free
 * session may be a LIVE workout on another device (pull-before-push race);
 * sweeping it would remotely kill that device's persistence. Older ones are
 * zombies (double-mount ghosts, crashed tabs) and get abandoned. */
const FREE_DUPLICATE_STALE_MS = 24 * 60 * 60 * 1000

/** Latest in-progress free workout; abandons older zombie duplicates.
 * Prefers sessions that already have structure — a fresh empty session
 * created on a second device must not shadow the real workout with logged
 * exercises. */
export async function getActiveFreeWorkoutSession(): Promise<LocalWorkoutSession | null> {
  const rows = await db.workoutSessions
    .where('program')
    .equals('custom')
    .filter((s) => s.status === 'in_progress' && isFreeWorkoutSession(s))
    .toArray()
  if (rows.length === 0) return null
  const withStructure = rows.filter((s) => (s.exerciseLogs?.length ?? 0) > 0)
  const pool = withStructure.length > 0 ? withStructure : rows
  pool.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  const active = pool[0]
  const cutoff = Date.now() - FREE_DUPLICATE_STALE_MS
  for (const s of rows) {
    if (s.id !== active.id && new Date(s.startedAt).getTime() < cutoff) {
      await abandonFreeWorkoutSession(s.id)
    }
  }
  return active
}

export async function startFreeWorkoutSession(): Promise<LocalWorkoutSession> {
  const existing = await getActiveFreeWorkoutSession()
  if (existing) return existing
  const session: LocalWorkoutSession = {
    id: generateId(),
    program: 'custom',
    programKind: 'custom',
    cycleId: FREE_WORKOUT_CYCLE_ID,
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    setResults: [],
    exerciseLogs: [],
  }
  await db.workoutSessions.put(session)
  await enqueueSync('workout_sessions', 'insert', session)
  if (!useAppStore.getState().hasCompletedFirstWorkout) {
    track(AnalyticsEvents.firstWorkoutStarted, {
      program: 'custom',
      type: 'free',
    })
  }
  return session
}

/** Persists an in-progress mutation. Returns the stored terminal status when
 * the write is refused (session finished/abandoned elsewhere — e.g. another
 * device) so the caller can stop logging into a dead session.
 * Transactional read-modify-write: a racing finish/abandon can't get
 * overwritten back to in_progress. */
export async function persistFreeWorkoutSession(
  session: LocalWorkoutSession,
): Promise<LocalWorkoutSession['status'] | null> {
  const refused = await db.transaction('rw', db.workoutSessions, async () => {
    const stored = await db.workoutSessions.get(session.id)
    // Terminal states win — never resurrect a finished/abandoned session via a
    // late mutation write.
    if (stored && stored.status !== 'in_progress') return stored.status
    await db.workoutSessions.put(session)
    return null
  })
  if (refused) return refused
  await enqueueSync('workout_sessions', 'update', session)
  return null
}

export async function finishFreeWorkoutSession(
  session: LocalWorkoutSession,
): Promise<LocalWorkoutSession | null> {
  const { row, transitioned } = await db.transaction('rw', db.workoutSessions, async () => {
    const stored = await db.workoutSessions.get(session.id)
    if (!stored || stored.status === 'abandoned') {
      return { row: null, transitioned: false }
    }
    // Idempotent finish — a second tap (or a finish racing another device)
    // returns the already-completed session instead of stranding the caller.
    if (stored.status === 'completed') return { row: stored, transitioned: false }
    const next: LocalWorkoutSession = {
      ...stored,
      exerciseLogs: session.exerciseLogs ?? stored.exerciseLogs,
      status: 'completed' as const,
      completedAt: new Date().toISOString(),
      passed: true,
      totalReps: freeWorkoutTotalReps(session.exerciseLogs ?? stored.exerciseLogs),
    }
    await db.workoutSessions.put(next)
    return { row: next, transitioned: true }
  })
  if (row && transitioned) await enqueueSync('workout_sessions', 'update', row)
  return row
}

export async function abandonFreeWorkoutSession(sessionId: string): Promise<void> {
  const abandoned = await db.transaction('rw', db.workoutSessions, async () => {
    const stored = await db.workoutSessions.get(sessionId)
    if (!stored || stored.status !== 'in_progress' || !isFreeWorkoutSession(stored)) return null
    const next: LocalWorkoutSession = {
      ...stored,
      status: 'abandoned',
      completedAt: new Date().toISOString(),
    }
    await db.workoutSessions.put(next)
    return next
  })
  if (!abandoned) return
  // Propagate — in_progress rows sync, so a local-only abandon would leave a
  // zombie session on other devices.
  await enqueueSync('workout_sessions', 'update', abandoned)
}

/** Most recent logged SetActual per exercise across every session with logs —
 * used to prefill the next-set inputs of a freshly added exercise (the user
 * repeats their last performance, Strong-style). */
export async function computeLastActualsByExercise(): Promise<Map<string, SetActual>> {
  const sessions = await db.workoutSessions.toArray()
  sessions.sort((a, b) => sessionDoneAt(b) - sessionDoneAt(a))
  const map = new Map<string, SetActual>()
  for (const s of sessions) {
    for (const log of s.exerciseLogs ?? []) {
      if (map.has(log.exerciseId)) continue
      const last = log.sets[log.sets.length - 1]
      if (last) map.set(log.exerciseId, last.actual)
    }
  }
  return map
}

/** Previous completed free workout before `current` (for history comparison). */
export async function getPreviousFreeWorkoutSession(
  current: LocalWorkoutSession,
): Promise<LocalWorkoutSession | undefined> {
  const doneAt = sessionDoneAt(current)
  const priors = await db.workoutSessions
    .where('program')
    .equals('custom')
    .filter(
      (s) =>
        isFreeWorkoutSession(s) &&
        s.status === 'completed' &&
        s.id !== current.id &&
        sessionDoneAt(s) < doneAt,
    )
    .toArray()
  priors.sort((a, b) => sessionDoneAt(b) - sessionDoneAt(a))
  return priors[0]
}

/** Prescription mirroring what the user actually did — a free set has no target,
 * so the actual becomes the record (and the template target when saved). */
function prescriptionFromActual(actual: SetActual, metric: PrimaryMetric): SetPrescription {
  const p: SetPrescription = {}
  if (metric === 'duration_sec') {
    if (actual.durationSec != null) p.durationSec = { kind: 'fixed', value: actual.durationSec }
  } else {
    if (actual.reps != null) p.reps = { kind: 'fixed', value: actual.reps }
    if (actual.weightKg != null) p.weightKg = { kind: 'fixed', value: actual.weightKg }
  }
  return p
}

/** A completed free-workout set: no plan target → always logged as done. */
export function makeFreeSetLog(
  setNumber: number,
  actual: SetActual,
  metric: PrimaryMetric,
): SetLog {
  return {
    setNumber,
    actual,
    passed: true,
    prescription: prescriptionFromActual(actual, metric),
  }
}

/** Convert a finished free workout into a reusable single-day CustomPlan. */
export function buildPlanFromFreeWorkout(params: {
  session: LocalWorkoutSession
  exercises: Map<string, ExerciseDefinition>
  name: string
}): CustomPlan {
  const { session, exercises, name } = params
  const now = new Date().toISOString()
  const planned: PlannedExercise[] = (session.exerciseLogs ?? [])
    .filter((log) => log.sets.length > 0)
    .map((log, i) => {
      const def = exercises.get(log.exerciseId)
      return {
        exerciseId: log.exerciseId,
        order: i,
        sets: log.sets.map((set) =>
          prescriptionFromActual(set.actual, def?.primaryMetric ?? 'reps'),
        ),
        restBetweenSetsSec: def?.restDefaultSec ?? 90,
      }
    })
  return {
    id: generateId(),
    name,
    description: '',
    status: 'active',
    days: [{ dayNumber: 1, restAfterDay: 1, exercises: planned }],
    createdAt: now,
    updatedAt: now,
    source: 'user',
  }
}
