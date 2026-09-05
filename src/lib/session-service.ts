import { db, type LocalWorkoutSession } from '@/lib/db'
import type { SetResultDraft } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'
import { enqueueSync } from '@/lib/sync'
import {
  clearActiveWorkout,
  completeWorkoutDay,
  markProgramActiveIfReady,
  saveActiveWorkout,
} from '@/lib/program-service'
import { track } from '@/lib/analytics'
import { useAppStore } from '@/stores/app-store'

function requireBuiltinProgram(program: Program | 'custom'): Program {
  if (program === 'custom') {
    throw new Error('Builtin session helper called with custom plan session')
  }
  return program
}

async function schedulePostWorkoutSync(): Promise<void> {
  const { runAuthenticatedSync } = await import('@/lib/auth-sync')
  await runAuthenticatedSync({
    showSuccessToast: false,
    showFailureToast: false,
    silentOffline: true,
  })
}

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

export function sessionHasProgress(setResults: SetResultDraft[]): boolean {
  return setResults.length > 0
}

/** Drop in_progress rows with zero completed sets — peek-and-leave should not leave resume ghosts. */
export async function cleanupEmptyInProgressSessions(program: Program): Promise<void> {
  const orphans = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'in_progress' && s.setResults.length === 0)
    .toArray()
  if (orphans.length === 0) return

  const now = new Date().toISOString()
  for (const s of orphans) {
    await saveWorkoutSession({ ...s, status: 'abandoned', completedAt: now })
  }

  const active = await db.activeWorkout.get(program)
  if (!active) return
  const linked = await db.workoutSessions.get(active.sessionId)
  if (
    !linked ||
    linked.status !== 'in_progress' ||
    !sessionHasProgress(linked.setResults)
  ) {
    await clearActiveWorkout(program)
  }
}

/** First completed set creates the DB session + activeWorkout row. */
export async function ensureWorkoutSessionPersisted(
  session: LocalWorkoutSession,
  state: {
    currentSetIndex: number
    setResults: SetResultDraft[]
    restTimerJson: string | null
    failedRetryUsed?: boolean
    displayStartedAt?: string | null
  },
): Promise<void> {
  if (!sessionHasProgress(state.setResults)) return

  const existing = await db.workoutSessions.get(session.id)
  const row: LocalWorkoutSession = {
    ...session,
    status: 'in_progress',
    setResults: state.setResults,
  }
  if (!existing) {
    await saveWorkoutSession(row)
  } else if (existing.status === 'in_progress') {
    await saveWorkoutSession({ ...existing, setResults: state.setResults })
  }

  await saveActiveWorkout(requireBuiltinProgram(session.program), {
    sessionId: session.id,
    currentSetIndex: state.currentSetIndex,
    setResults: state.setResults,
    restTimerJson: state.restTimerJson,
    failedRetryUsed: state.failedRetryUsed,
    displayStartedAt: state.displayStartedAt,
  })
  await markProgramActiveIfReady(requireBuiltinProgram(session.program))
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
  // Use same fallback strategy as getSessionComparison — try same cycle first,
  // then any cycle for the same day, then any completed session.
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.dayNumber === dayNumber &&
        s.cycleAttempt === cycleAttempt,
    )
    .toArray()
  sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  const session = sessions[0]
  return session?.setResults.find((r) => r.setNumber === setNumber)?.actual
}

/**
 * Get the most recent completed set actual for a given day+set,
 * regardless of cycle attempt or whether the session was "passed".
 * Used for smart rest suggestions where we want to compare with the
 * user's latest performance, not just successful sessions.
 */
export async function getMostRecentSetActual(
  program: Program,
  dayNumber: number,
  setNumber: number,
  excludeSessionId?: string,
): Promise<number | undefined> {
  // First try to find a session for the same day (most relevant comparison)
  const sameDaySessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.dayNumber === dayNumber &&
        s.id !== excludeSessionId,
    )
    .toArray()
  sameDaySessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  const sameDayRecent = sameDaySessions[0]
  const sameDayActual = sameDayRecent?.setResults.find((r) => r.setNumber === setNumber)?.actual
  if (sameDayActual !== undefined) {
    return sameDayActual
  }

  // Fallback: find the most recent completed session for this program (any day)
  // and the same set number. This gives a useful comparison even when doing
  // a new day for the first time.
  const anyDaySessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'completed' && s.id !== excludeSessionId)
    .toArray()
  anyDaySessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  const mostRecent = anyDaySessions[0]
  return mostRecent?.setResults.find((r) => r.setNumber === setNumber)?.actual
}

/**
 * Check if the user has ANY completed sessions for a given program.
 * Used to distinguish "first time ever" from "new day/set combination"
 * in smart rest suggestions.
 */
export async function hasAnyCompletedSessions(
  program: Program,
  excludeSessionId?: string,
): Promise<boolean> {
  const count = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'completed' && s.id !== excludeSessionId)
    .count()
  return count > 0
}

export async function finalizeSuccessfulDay(
  session: LocalWorkoutSession,
  setResults: SetResultDraft[],
): Promise<void> {
  const program = requireBuiltinProgram(session.program)
  const key = progressKey(program, session.id)
  const existing = await db.workoutSessions.get(session.id)
  if (existing?.status === 'completed' && existing.passed === true) {
    if (!finalizedProgressKeys.has(key)) {
      await completeWorkoutDay(program, true, existing.totalReps ?? 0, session.id)
      finalizedProgressKeys.add(key)
    }
    markFirstWorkoutAndTrack(true, session.id)
    void schedulePostWorkoutSync()
    const { scheduleAchievementCheck } = await import('@/lib/achievements/schedule')
    scheduleAchievementCheck()
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
  await clearActiveWorkout(program)
  await completeWorkoutDay(program, true, totalReps, session.id)
  finalizedProgressKeys.add(key)
  markFirstWorkoutAndTrack(true, session.id)
  void schedulePostWorkoutSync()
  const { scheduleAchievementCheck } = await import('@/lib/achievements/schedule')
  scheduleAchievementCheck()
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
  void schedulePostWorkoutSync()
}

/** Delete a completed session from history (local + cloud sync).
 *  Enqueues sync delete BEFORE local delete to prevent pull from
 *  resurrecting the session. Also stores a tombstone locally so that
 *  even after the sync queue is flushed, the session won't be
 *  resurrected by another device pushing it back to the cloud. */
export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  const session = await db.workoutSessions.get(sessionId)
  if (!session) return
  // 1. Enqueue cloud delete
  await enqueueSync('workout_sessions', 'delete', { id: sessionId })
  // 2. Store tombstone locally (persists across syncs — prevents resurrection)
  await db.sessionTombstones.put({
    sessionId,
    deletedAt: new Date().toISOString(),
  })
  // 3. Delete locally
  await db.workoutSessions.delete(sessionId)
  track('session_deleted', { program: session.program })
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

  // First try: same day + same cycle attempt (most relevant comparison)
  const sameCycle = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.dayNumber === current.dayNumber &&
        s.cycleAttempt === current.cycleAttempt &&
        s.id !== current.id,
    )
    .toArray()
  sameCycle.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  if (sameCycle[0]) {
    return { current, previous: sameCycle[0] }
  }

  // Second try: same day, any cycle attempt
  const sameDay = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.dayNumber === current.dayNumber &&
        s.id !== current.id,
    )
    .toArray()
  sameDay.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  if (sameDay[0]) {
    return { current, previous: sameDay[0] }
  }

  // Third try: most recent completed session for this program (any day)
  // Gives some context even when doing a new day for the first time
  const anyDay = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'completed' && s.id !== current.id)
    .toArray()
  anyDay.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
  return { current, previous: anyDay[0] }
}
