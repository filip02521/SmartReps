import { db, type LocalWorkoutSession } from '@/lib/db'
import type { SetResultDraft } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'
import { enqueueSync } from '@/lib/sync'
import { clearActiveWorkout, completeWorkoutDay } from '@/lib/program-service'
import { track } from '@/lib/analytics'
import { useAppStore } from '@/stores/app-store'

/** Session ids already advanced in progress — prevents double completeWorkoutDay. */
const finalizedProgressKeys = new Set<string>()

function progressKey(program: Program, sessionId: string) {
  return `${program}:${sessionId}`
}

function markFirstWorkoutAndTrack(passed: boolean, sessionId: string) {
  const store = useAppStore.getState()
  if (passed && !store.hasCompletedFirstWorkout) {
    store.setHasCompletedFirstWorkout(true)
    track('first_workout_done')
  }
  // Idempotent across retries / early-return finalize paths
  const trackKey = `sr-tracked-day:${sessionId}`
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(trackKey)) return
    sessionStorage?.setItem(trackKey, '1')
  } catch {
    // private mode — still emit once per call stack via finalizedProgressKeys caller
  }
  track(passed ? 'day_completed' : 'day_failed')
}

export async function saveWorkoutSession(session: LocalWorkoutSession): Promise<void> {
  await db.workoutSessions.put(session)
  await enqueueSync('workout_sessions', 'update', session)
}

export async function getLastPassedSession(
  program: Program,
  dayNumber: number,
  cycleAttempt: number,
): Promise<LocalWorkoutSession | undefined> {
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.passed === true &&
        s.dayNumber === dayNumber &&
        s.cycleAttempt === cycleAttempt,
    )
    .toArray()
  sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  return sessions[0]
}

export async function getPreviousSetActual(
  program: Program,
  dayNumber: number,
  cycleAttempt: number,
  setNumber: number,
): Promise<number | undefined> {
  const session = await getLastPassedSession(program, dayNumber, cycleAttempt)
  return session?.setResults.find((r) => r.setNumber === setNumber)?.actual
}

export async function finalizeSuccessfulDay(
  session: LocalWorkoutSession,
  setResults: SetResultDraft[],
): Promise<void> {
  const key = progressKey(session.program, session.id)
  const existing = await db.workoutSessions.get(session.id)
  if (existing?.status === 'completed' && existing.passed === true) {
    if (!finalizedProgressKeys.has(key)) {
      await completeWorkoutDay(session.program, true, existing.totalReps ?? 0, session.id)
      finalizedProgressKeys.add(key)
    }
    markFirstWorkoutAndTrack(true, session.id)
    return
  }

  const totalReps = setResults.reduce((s, r) => s + r.actual, 0)
  const updated: LocalWorkoutSession = {
    ...session,
    status: 'completed',
    completedAt: new Date().toISOString(),
    passed: true,
    totalReps,
    setResults,
  }
  await saveWorkoutSession(updated)
  await clearActiveWorkout(session.program)
  await completeWorkoutDay(session.program, true, totalReps, session.id)
  finalizedProgressKeys.add(key)
  markFirstWorkoutAndTrack(true, session.id)
}

export async function finalizeFailedDay(
  sessionId: string,
  program: Program,
  setResults: SetResultDraft[],
): Promise<void> {
  const key = progressKey(program, sessionId)
  const existing = await db.workoutSessions.get(sessionId)
  if (!existing) return
  if (existing.status === 'completed' && existing.passed === false) {
    if (!finalizedProgressKeys.has(key)) {
      await completeWorkoutDay(program, false, existing.totalReps ?? 0, sessionId)
      finalizedProgressKeys.add(key)
    }
    markFirstWorkoutAndTrack(false, sessionId)
    return
  }

  const totalReps = setResults.reduce((s, r) => s + r.actual, 0)
  const updated: LocalWorkoutSession = {
    ...existing,
    status: 'completed',
    completedAt: new Date().toISOString(),
    passed: false,
    totalReps,
    setResults,
  }
  await saveWorkoutSession(updated)
  await clearActiveWorkout(program)
  await completeWorkoutDay(program, false, totalReps, sessionId)
  finalizedProgressKeys.add(key)
  markFirstWorkoutAndTrack(false, sessionId)
}

export async function abandonWorkoutSession(program: Program, _sessionId: string): Promise<void> {
  // Always clear every in_progress row for the program — cancels must not leave ghosts
  // that Workout init reconstructs into a resume when activeWorkout is missing.
  await abandonAllInProgress(program)
}

/** Abandon every in_progress session for a program (cancel / start-fresh / setup). */
export async function abandonAllInProgress(program: Program): Promise<void> {
  const orphans = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'in_progress')
    .toArray()
  const now = new Date().toISOString()
  for (const s of orphans) {
    await saveWorkoutSession({ ...s, status: 'abandoned', completedAt: now })
  }
  await clearActiveWorkout(program)
}

export async function getSessionComparison(
  program: Program,
  sessionId: string,
): Promise<{ current: LocalWorkoutSession | undefined; previous: LocalWorkoutSession | undefined }> {
  const current = await db.workoutSessions.get(sessionId)
  if (!current) return { current: undefined, previous: undefined }
  const previous = await getLastPassedSession(program, current.dayNumber, current.cycleAttempt)
  if (previous?.id === current.id) {
    const all = await db.workoutSessions
      .where('program')
      .equals(program)
      .filter(
        (s) =>
          s.status === 'completed' &&
          s.passed === true &&
          s.dayNumber === current.dayNumber &&
          s.cycleAttempt === current.cycleAttempt &&
          s.id !== current.id,
      )
      .toArray()
    all.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    return { current, previous: all[0] }
  }
  return { current, previous }
}
