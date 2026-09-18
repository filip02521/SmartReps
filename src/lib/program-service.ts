import { db, type ActiveWorkoutState, type LocalProgramProgress } from '@/lib/db'
import { getCycleById, getCyclesByProgram } from '@/data/plans'
import type { Cycle, Program } from '@/data/plans/types'
import { enqueueSync, enqueueActiveWorkoutSync } from '@/lib/sync'
import { cleanupEmptyInProgressSessions } from '@/lib/session-service'
import { pl } from '@/i18n/pl'
import {
  advanceAfterDayPassed,
  daysUntilWorkout,
  getNextWorkoutDate,
  getTestBlockDays,
  isWorkoutAvailable,
} from '@/lib/progress-engine'

/** Prevents double day-advance for the same session id. */
const advancedBySession = new Set<string>()

/**
 * Zwraca następny wyższy cykl dla programu (level + 1) lub null gdy
 * bieżący cykl jest ostatnim (najwyższym) poziomem.
 */
export function getNextHigherCycle(program: Program, currentCycleId: string): Cycle | null {
  const current = getCycleById(currentCycleId)
  if (!current) return null
  const cycles = getCyclesByProgram(program).sort((a, b) => a.level - b.level)
  const next = cycles.find((c) => c.level === current.level + 1)
  return next ?? null
}

export async function getProgramProgress(program: Program): Promise<LocalProgramProgress | undefined> {
  return db.programProgress.where('program').equals(program).first()
}

export async function initProgramProgress(
  program: Program,
  cycleId: string,
): Promise<LocalProgramProgress> {
  const existing = await getProgramProgress(program)
  if (existing) return existing

  const progress: LocalProgramProgress = {
    program,
    cycleId,
    currentDay: 1,
    status: 'active',
    cycleAttempt: 1,
    lastWorkoutAt: null,
    nextWorkoutAfter: null,
    updatedAt: new Date().toISOString(),
  }
  await db.programProgress.add(progress)
  await enqueueSync('program_progress', 'insert', progress)
  return progress
}

export async function updateProgramProgress(
  program: Program,
  updates: Partial<LocalProgramProgress>,
): Promise<LocalProgramProgress | undefined> {
  const existing = await getProgramProgress(program)
  if (!existing?.id) return undefined
  const merged = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  await db.programProgress.update(existing.id, {
    ...updates,
    updatedAt: merged.updatedAt,
  })
  await enqueueSync('program_progress', 'update', merged)
  return merged
}

/** Mark program ready/active when user starts a day after rest / cycle_failed. */
export async function markProgramActiveIfReady(program: Program): Promise<void> {
  // No transaction: updateProgramProgress enqueues a sync write (syncQueue
  // table), which cannot run inside a programProgress-scoped transaction —
  // Dexie throws NotInTransactionError and the sync item is silently lost.
  // Writing 'active' twice is idempotent, so a plain check-then-write is safe.
  const progress = await getProgramProgress(program)
  if (!progress) return
  if (progress.status === 'test_pending' || progress.status === 'paused') return
  const available = isWorkoutAvailable(
    progress.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
  )
  if (!available) return
  if (progress.status === 'active') return
  await updateProgramProgress(program, { status: 'active' })
}

export async function completeWorkoutDay(
  program: Program,
  passed: boolean,
  _totalReps: number,
  sessionId?: string,
  sessionDayNumber?: number,
) {
  // Claim the session key BEFORE any await — the previous check→await→add
  // order let two concurrent calls both pass the check and double-advance.
  // The key is released if the day was NOT actually advanced (missing
  // progress/cycle or a failed write) so reconcileProgressFromSessions can retry.
  const advKey = sessionId ? `${program}:${sessionId}` : null
  if (advKey && advancedBySession.has(advKey)) return
  if (advKey) advancedBySession.add(advKey)

  let advanced = false
  try {
    const progress = await getProgramProgress(program)
    if (!progress) return

    const cycle = getCycleById(progress.cycleId)
    if (!cycle) return

    // Use the session's dayNumber if provided — this ensures we advance from
    // the day the session was actually for, not from progress.currentDay which
    // may have been changed by a concurrent call or stale state.
    const effectiveDay = sessionDayNumber ?? progress.currentDay

    const day = cycle.days.find((d) => d.dayNumber === effectiveDay)
    const restDays = day?.restAfterDay ?? 1

    if (!passed) {
      // Restart policy: same as post-test block (recovery before attempt N+1)
      const restartDate = getNextWorkoutDate(new Date(), getTestBlockDays())
      await updateProgramProgress(program, {
        status: 'cycle_failed',
        currentDay: 1,
        cycleAttempt: progress.cycleAttempt + 1,
        lastWorkoutAt: new Date().toISOString(),
        nextWorkoutAfter: restartDate.toISOString(),
      })
      advanced = true
      return
    }

    const { nextDay, cycleComplete } = advanceAfterDayPassed(
      effectiveDay,
      cycle.days.length,
    )

    if (cycleComplete) {
      // Automatyczne przejście na wyższy cykl (level + 1) bez testu maksymalnego.
      // Gdy bieżący cykl jest ostatnim poziomem, zostaw test_pending (retest).
      const nextCycle = getNextHigherCycle(program, progress.cycleId)
      if (nextCycle) {
        // Rest po ostatnim dniu ukończonego cyklu, potem nowy cykl od dnia 1.
        const restDate = getNextWorkoutDate(new Date(), restDays)
        await updateProgramProgress(program, {
          cycleId: nextCycle.id,
          status: 'rest',
          currentDay: 1,
          cycleAttempt: 1,
          lastWorkoutAt: new Date().toISOString(),
          nextWorkoutAfter: restDate.toISOString(),
        })
        advanced = true
        return
      }
      // Ostatni poziom — zachowaj test_pending (retest dla utrzymania / weryfikacji).
      const testDate = getNextWorkoutDate(new Date(), getTestBlockDays())
      await updateProgramProgress(program, {
        status: 'test_pending',
        currentDay: 1,
        lastWorkoutAt: new Date().toISOString(),
        nextWorkoutAfter: testDate.toISOString(),
      })
      advanced = true
      return
    }

    const nextDate = getNextWorkoutDate(new Date(), restDays)
    await updateProgramProgress(program, {
      status: 'rest',
      currentDay: nextDay,
      lastWorkoutAt: new Date().toISOString(),
      nextWorkoutAfter: nextDate.toISOString(),
    })
    advanced = true
  } finally {
    if (!advanced && advKey) advancedBySession.delete(advKey)
  }
}

/**
 * Self-heal: advances progress when a completed session for the current
 * cycle/attempt was never consumed — e.g. the app closed between the session
 * write and the progress update in finalizeSuccessfulDay. Idempotent: after
 * the advance the session's cycle/attempt/day no longer match the progress
 * row, so re-runs are no-ops.
 */
export async function reconcileProgressFromSessions(program: Program): Promise<void> {
  const progress = await getProgramProgress(program)
  if (!progress) return
  if (progress.status === 'paused' || progress.status === 'test_pending') return

  const lastWorkoutMs = progress.lastWorkoutAt ? new Date(progress.lastWorkoutAt).getTime() : 0
  const sessions = await db.workoutSessions
    .where('[program+status]')
    .equals([program, 'completed'])
    .toArray()
  const unconsumed = sessions
    .filter(
      (s) =>
        s.cycleId === progress.cycleId &&
        s.cycleAttempt === progress.cycleAttempt &&
        s.dayNumber >= progress.currentDay &&
        !!s.completedAt &&
        new Date(s.completedAt).getTime() > lastWorkoutMs,
    )
    .sort(
      (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
    )[0]
  if (!unconsumed) return
  await completeWorkoutDay(
    program,
    unconsumed.passed === true,
    unconsumed.totalReps ?? 0,
    unconsumed.id,
    unconsumed.dayNumber,
  )
}

export function getStatusTone(progress: LocalProgramProgress): 'success' | 'warning' | 'info' | 'error' {
  const waitingRest =
    progress.nextWorkoutAfter &&
    daysUntilWorkout(new Date(progress.nextWorkoutAfter)) > 0

  switch (progress.status) {
    case 'active':
    case 'rest':
    case 'cycle_failed':
      return waitingRest ? 'warning' : 'success'
    case 'test_pending':
      return 'info'
    case 'paused':
      return 'error'
    default:
      return 'info'
  }
}

export function getStatusLabel(progress: LocalProgramProgress): string {
  const waitingRest =
    progress.nextWorkoutAfter &&
    daysUntilWorkout(new Date(progress.nextWorkoutAfter)) > 0

  switch (progress.status) {
    case 'active':
    case 'rest':
      return waitingRest ? pl.statusRest : pl.statusReady
    case 'test_pending':
      return pl.statusTest
    case 'cycle_failed':
      return waitingRest ? pl.statusRestart : pl.statusReady
    case 'paused':
      return pl.statusPaused
    default:
      return progress.status
  }
}

export async function saveActiveWorkout(program: Program, state: {
  sessionId: string
  currentSetIndex: number
  setResults: unknown[]
  restTimerJson: string | null
  failedRetryUsed?: boolean
  displayStartedAt?: string | null
}) {
  // Never resurrect an active row after cancel/finish — late persist races must no-op.
  const session = await db.workoutSessions.get(state.sessionId)
  if (!session || session.status !== 'in_progress' || session.program !== program) {
    return false
  }

  const row = {
    program,
    sessionId: state.sessionId,
    currentSetIndex: state.currentSetIndex,
    setResults: state.setResults as import('@/lib/progress-engine').SetResultDraft[],
    restTimerJson: state.restTimerJson,
    failedRetryUsed: state.failedRetryUsed,
    displayStartedAt: state.displayStartedAt ?? null,
    updatedAt: new Date().toISOString(),
  }
  await db.activeWorkout.put(row)
  await enqueueActiveWorkoutSync(program, row)
  return true
}

export async function clearActiveWorkout(program: Program) {
  await db.activeWorkout.delete(program)
  await enqueueActiveWorkoutSync(program, null)
}

/** Drop orphan active rows whose session is no longer in progress or has no completed sets.
 *  Also verifies that the active session's dayNumber matches the current progress day —
 *  a mismatch means the session is stale (from a different day) and should not be resumed. */
export async function reconcileActiveWorkout(program: Program): Promise<ActiveWorkoutState | undefined> {
  await cleanupEmptyInProgressSessions(program)

  const active = await db.activeWorkout.get(program)
  if (!active) return undefined
  const session = await db.workoutSessions.get(active.sessionId)
  const progressInActive = active.setResults.length > 0
  const progressInSession = (session?.setResults.length ?? 0) > 0

  // Verify the session's dayNumber matches the current progress day.
  // A mismatch means the session is from a different day (e.g. progress was
  // advanced but the active row wasn't cleared) — resuming it would load the
  // wrong day plan and finalize incorrectly.
  const progress = await getProgramProgress(program)
  const dayMatches = !progress || !session || session.dayNumber === progress.currentDay

  if (
    session &&
    session.status === 'in_progress' &&
    session.program === program &&
    dayMatches &&
    (progressInActive || progressInSession)
  ) {
    return active
  }
  await clearActiveWorkout(program)
  return undefined
}

export async function getActiveWorkout(program: Program) {
  return db.activeWorkout.get(program)
}

export async function setProgramPaused(program: Program, paused: boolean) {
  const progress = await getProgramProgress(program)
  if (!progress) return
  if (paused) {
    await updateProgramProgress(program, { status: 'paused' })
  } else {
    const available = isWorkoutAvailable(
      progress.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
    )
    await updateProgramProgress(program, {
      status: available ? 'active' : 'rest',
    })
  }
}

/**
 * Skip the current rest period — make the workout available immediately.
 * Used when the user wants to train today despite a scheduled rest day.
 */
export async function skipRestDay(program: Program) {
  const progress = await getProgramProgress(program)
  if (!progress) return
  // Only meaningful during scheduled rest — never unpause or clear a pending
  // test just because a skip-rest action fired.
  if (progress.status === 'paused' || progress.status === 'test_pending') return
  await updateProgramProgress(program, {
    status: 'active',
    nextWorkoutAfter: null,
  })
}

/**
 * Skip rest for a custom plan — same concept as builtin skipRestDay.
 */
export async function skipCustomRestDay(customPlanId: string) {
  const { db } = await import('@/lib/db')
  const prog = await db.customProgramProgress.where('customPlanId').equals(customPlanId).first()
  if (!prog) return
  const updated = {
    ...prog,
    status: 'active' as const,
    nextWorkoutAfter: null,
    updatedAt: new Date().toISOString(),
  }
  await db.customProgramProgress.put(updated)
  await enqueueSync('custom_program_progress', 'update', updated)
}
