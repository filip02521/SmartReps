import { db, type LocalWorkoutSession } from '@/lib/db'
import type { SetResultDraft } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'
import { enqueueSync } from '@/lib/sync'
import { sanitizeReps } from '@/lib/sanitize'
import {
  clearActiveWorkout,
  completeWorkoutDay,
  markProgramActiveIfReady,
  saveActiveWorkout,
} from '@/lib/program-service'
import { track, AnalyticsEvents, trackSyncError } from '@/lib/analytics'
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
    track(AnalyticsEvents.firstWorkoutDone)
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

/** Keep the LAST entry per setNumber — resume-after-crash can leave both the
 *  failed attempt and the retried result for the same set, which would
 *  otherwise persist duplicate rows and inflate totalReps. */
function dedupeSetResults(results: SetResultDraft[]): SetResultDraft[] {
  const bySet = new Map<number, SetResultDraft>()
  for (const r of results) bySet.set(r.setNumber, r)
  return [...bySet.values()].sort((a, b) => a.setNumber - b.setNumber)
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

  try {
    // Atomic read-modify-write: a concurrent abandon (cancel / "start fresh"
    // on another device or tab) must not be overwritten back to in_progress.
    // saveWorkoutSession is transaction-safe here — it only enqueues sync for
    // 'completed' rows and never touches the sync queue for in_progress.
    const outcome = await db.transaction('rw', db.workoutSessions, async () => {
      const existing = await db.workoutSessions.get(session.id)
      if (existing && existing.status !== 'in_progress') return 'terminal'
      const base = existing ?? session
      await saveWorkoutSession({
        ...base,
        status: 'in_progress',
        setResults: state.setResults,
      })
      return 'ok'
    })
    if (outcome === 'terminal') {
      // Session is already completed or abandoned — don't overwrite it or
      // re-activate the program. This prevents flipping a rest/cycle_failed
      // progress back to 'active' based on a stale/completed session.
      return
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
  } catch (err) {
    trackSyncError('ensure_workout_session_persisted', err)
    throw err
  }
}

export async function saveWorkoutSession(session: LocalWorkoutSession): Promise<void> {
  await db.workoutSessions.put(session)
  // Only sync completed sessions to cloud — abandoned/in_progress are local-only
  // to avoid cluttering cloud history with failed attempts.
  if (session.status === 'completed') {
    await enqueueSync('workout_sessions', 'update', session)
  }
}

/** Newest completion instant of a session — "when you last did it". */
function sessionDoneAt(s: LocalWorkoutSession): number {
  return new Date(s.completedAt ?? s.startedAt).getTime()
}

/**
 * Last actual for a given day+set — literally "the last time you did this
 * day": the most recent completed session with the same dayNumber, from any
 * cycle. Cycle doesn't matter here — day N is the same program slot and the
 * user compares against their real last performance. No cross-day lookup:
 * set N on a different day has a different target, so its actual would be a
 * meaningless number.
 */
export async function getPreviousSetActual(
  program: Program,
  dayNumber: number,
  setNumber: number,
): Promise<number | undefined> {
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'completed' && s.dayNumber === dayNumber)
    .toArray()
  sessions.sort((a, b) => sessionDoneAt(b) - sessionDoneAt(a))
  return sessions[0]?.setResults.find((r) => r.setNumber === setNumber)?.actual
}

/**
 * Most recent completed set actual for a given day+set — "the last time you
 * did this day", regardless of whether that session was passed or which
 * cycle it belonged to. Used for "last time" badges, per-set deltas and
 * smart rest suggestions. No cross-day fallback: set N on a different day
 * has a different target, so its actual produced garbage numbers (e.g. a
 * max set's 30 next to a target of 8) when a new cycle restarted
 * dayNumber at 1.
 */
export async function getMostRecentSetActual(
  program: Program,
  dayNumber: number,
  setNumber: number,
  excludeSessionId?: string,
): Promise<number | undefined> {
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.dayNumber === dayNumber &&
        s.id !== excludeSessionId,
    )
    .toArray()
  sessions.sort((a, b) => sessionDoneAt(b) - sessionDoneAt(a))
  return sessions[0]?.setResults.find((r) => r.setNumber === setNumber)?.actual
}

/**
 * Most recent completed session for a program — the "last workout" a user
 * can peek at mid-workout. Any day/cycle is fine here: this is an
 * informational view labelled with the day and date, not a per-set
 * comparison (that path is scoped by getMostRecentSetActual).
 */
export async function getLastCompletedSession(
  program: Program,
  excludeSessionId?: string,
): Promise<LocalWorkoutSession | undefined> {
  const sessions = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'completed' && s.id !== excludeSessionId)
    .toArray()
  sessions.sort((a, b) => sessionDoneAt(b) - sessionDoneAt(a))
  return sessions[0]
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
  if (finalizedProgressKeys.has(key)) return

  try {
    // Use a DB transaction with re-check to prevent double-completion race.
    // Two concurrent calls could both observe status === 'in_progress' and both
    // write 'completed'. The transaction + re-check ensures only one wins.
    let alreadyCompleted = false
    let abandoned = false
    let existingPassed = false
    let totalReps = 0
    await db.transaction('rw', db.workoutSessions, async () => {
      const existing = await db.workoutSessions.get(session.id)
      if (existing?.status === 'completed') {
        alreadyCompleted = true
        existingPassed = existing.passed === true
        totalReps = existing.totalReps ?? 0
        return
      }
      if (existing?.status === 'abandoned') {
        // The user explicitly discarded this session (cancel / "start fresh").
        // A late finalize (in-flight persist, stale tab, another device) must
        // not resurrect it as completed nor advance/regress progress.
        abandoned = true
        return
      }
      const deduped = dedupeSetResults(setResults)
      totalReps = deduped.reduce((s, r) => s + sanitizeReps(r.actual), 0)
      const updated: LocalWorkoutSession = {
        ...session,
        status: 'completed',
        completedAt: new Date().toISOString(),
        passed: true,
        totalReps,
        setResults: deduped,
      }
      await db.workoutSessions.put(updated)
    })

    if (abandoned) return

    if (alreadyCompleted) {
      // Session was already completed by a concurrent call — still advance progress
      // if not yet done (e.g. after page reload, in-memory guard is empty).
      // Use the STORED outcome, not the caller's assumption — a session that
      // finished as failed must not be re-advanced as passed.
      if (!finalizedProgressKeys.has(key)) {
        await completeWorkoutDay(program, existingPassed, totalReps, session.id, session.dayNumber)
        finalizedProgressKeys.add(key)
      }
      markFirstWorkoutAndTrack(existingPassed, session.id)
      void schedulePostWorkoutSync()
      const { scheduleAchievementCheck } = await import('@/lib/achievements/schedule')
      scheduleAchievementCheck()
      return
    }

    // Enqueue sync after successful transaction
    const completed = await db.workoutSessions.get(session.id)
    if (completed) await enqueueSync('workout_sessions', 'update', completed)

    await clearActiveWorkout(program)
    await completeWorkoutDay(program, true, totalReps, session.id, session.dayNumber)
    finalizedProgressKeys.add(key)
    markFirstWorkoutAndTrack(true, session.id)
    void schedulePostWorkoutSync()
    const { scheduleAchievementCheck } = await import('@/lib/achievements/schedule')
    scheduleAchievementCheck()
  } catch (err) {
    trackSyncError('finalize_successful_day', err)
    throw err
  }
}

export async function finalizeFailedDay(
  sessionId: string,
  program: Program,
  setResults: SetResultDraft[],
): Promise<void> {
  const key = progressKey(program, sessionId)
  if (finalizedProgressKeys.has(key)) return

  try {
    let alreadyCompleted = false
    let missing = false
    let abandoned = false
    let existingPassed = false
    let existingDayNumber: number | undefined
    let totalReps = 0
    await db.transaction('rw', db.workoutSessions, async () => {
      const existing = await db.workoutSessions.get(sessionId)
      if (!existing) {
        // Ghost session — nothing was ever persisted. Advancing progress here
        // would mark a never-played day as failed (cycle restart!) for free.
        missing = true
        return
      }
      if (existing.status === 'completed') {
        alreadyCompleted = true
        existingPassed = existing.passed === true
        existingDayNumber = existing.dayNumber
        totalReps = existing.totalReps ?? 0
        return
      }
      if (existing.status === 'abandoned') {
        // Deliberately discarded — a late finalize must not resurrect it nor
        // regress progress to cycle_failed.
        abandoned = true
        return
      }
      const deduped = dedupeSetResults(setResults)
      totalReps = deduped.reduce((s, r) => s + sanitizeReps(r.actual), 0)
      const updated: LocalWorkoutSession = {
        ...existing,
        status: 'completed',
        completedAt: new Date().toISOString(),
        passed: false,
        totalReps,
        setResults: deduped,
      }
      await db.workoutSessions.put(updated)
    })

    if (missing || abandoned) return

    if (alreadyCompleted) {
      if (!finalizedProgressKeys.has(key)) {
        // Stored outcome is authoritative — don't regress a passed day to failed.
        await completeWorkoutDay(program, existingPassed, totalReps, sessionId, existingDayNumber)
        finalizedProgressKeys.add(key)
      }
      markFirstWorkoutAndTrack(existingPassed, sessionId)
      return
    }

    const completed = await db.workoutSessions.get(sessionId)
    if (completed) await enqueueSync('workout_sessions', 'update', completed)

    await clearActiveWorkout(program)
    await completeWorkoutDay(program, false, totalReps, sessionId, completed?.dayNumber)
    finalizedProgressKeys.add(key)
    markFirstWorkoutAndTrack(false, sessionId)
    void schedulePostWorkoutSync()
  } catch (err) {
    trackSyncError('finalize_failed_day', err)
    throw err
  }
}

/** Delete a completed session from history (local + cloud sync).
 *  Enqueues sync delete BEFORE local delete to prevent pull from
 *  resurrecting the session. Also stores a tombstone locally so that
 *  even after the sync queue is flushed, the session won't be
 *  resurrected by another device pushing it back to the cloud. */
export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  try {
    const session = await db.workoutSessions.get(sessionId)
    if (!session) return
    // 1. Enqueue cloud delete BEFORE local delete to prevent resurrection
    await enqueueSync('workout_sessions', 'delete', { id: sessionId })
    // 2. Store tombstone + delete locally in a transaction for atomicity
    await db.transaction('rw', [db.sessionTombstones, db.workoutSessions], async () => {
      await db.sessionTombstones.put({
        sessionId,
        deletedAt: new Date().toISOString(),
      })
      await db.workoutSessions.delete(sessionId)
    })
    // 3. Clear the active workout pointer only when it references the deleted
    // session — deleting an old history row must not kill the resume state of
    // an unrelated in-progress workout.
    if (session.program !== 'custom' && (session.programKind ?? 'builtin') !== 'custom') {
      const { getActiveWorkout, clearActiveWorkout } = await import('@/lib/program-service')
      const active = await getActiveWorkout(session.program as Program)
      if (active?.sessionId === sessionId) {
        await clearActiveWorkout(session.program as Program)
      }
    } else if (session.customPlanId) {
      const { clearActiveCustomWorkout } = await import('@/lib/custom-session-service')
      const active = await db.activeCustomWorkout.get(session.customPlanId)
      if (active?.sessionId === sessionId) {
        await clearActiveCustomWorkout(session.customPlanId)
      }
    }
    track(AnalyticsEvents.sessionDeleted, { program: session.program })
    // 4. Re-evaluate achievements — session counts/streaks may have changed
    const { scheduleAchievementCheck } = await import('@/lib/achievements/schedule')
    scheduleAchievementCheck()
  } catch (err) {
    trackSyncError('delete_workout_session', err)
    throw err
  }
}

export async function abandonWorkoutSession(program: Program, sessionId: string): Promise<void> {
  // Abandon only the specific session — not every in_progress session for the program.
  // The previous behavior abandoned ALL in_progress sessions, which could unintentionally
  // abandon an unrelated session if multiple existed.
  const session = await db.workoutSessions.get(sessionId)
  if (session && session.status === 'in_progress') {
    const now = new Date().toISOString()
    await saveWorkoutSession({ ...session, status: 'abandoned', completedAt: now })
  }
  // Check if the active workout points to this session — only clear if so
  const active = await db.activeWorkout.get(program)
  if (active?.sessionId === sessionId) {
    await clearActiveWorkout(program)
  }
}

/** Abandon every in_progress session for a program (cancel / start-fresh / setup).
 *  Uses a transaction so all abandon operations are atomic — either all
 *  sessions are abandoned or none, preventing partial states. */
export async function abandonAllInProgress(program: Program): Promise<void> {
  const orphans = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter((s) => s.status === 'in_progress')
    .toArray()
  const now = new Date().toISOString()
  await db.transaction('rw', db.workoutSessions, async () => {
    for (const s of orphans) {
      await db.workoutSessions.put({ ...s, status: 'abandoned', completedAt: now })
    }
  })
  // Abandoned sessions are local-only — don't sync to cloud
  await clearActiveWorkout(program)
}

export async function getSessionComparison(
  program: Program,
  sessionId: string,
): Promise<{ current: LocalWorkoutSession | undefined; previous: LocalWorkoutSession | undefined }> {
  const current = await db.workoutSessions.get(sessionId)
  // Wrong-program or custom session under a builtin summary route — the URL
  // :program must match the session, otherwise we'd render a mismatched recap.
  if (!current || current.program !== program) {
    return { current: undefined, previous: undefined }
  }

  // Previous = the most recent completed session of this program BEFORE the
  // viewed one — "your last workout before this", which is what the user
  // compares against. It may be a different day or a different cycle; the
  // summary labels the source ("Porównanie z: Dzień N · data") so it's never
  // misleading. The doneAt bound matters when a summary is opened from
  // history — otherwise an old session would compare against a NEWER one.
  const currentDoneAt = sessionDoneAt(current)
  const prior = await db.workoutSessions
    .where('program')
    .equals(program)
    .filter(
      (s) =>
        s.status === 'completed' &&
        s.id !== current.id &&
        sessionDoneAt(s) < currentDoneAt,
    )
    .toArray()
  prior.sort((a, b) => sessionDoneAt(b) - sessionDoneAt(a))
  return { current, previous: prior[0] }
}
