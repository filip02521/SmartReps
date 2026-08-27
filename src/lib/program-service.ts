import { db, type ActiveWorkoutState, type LocalProgramProgress } from '@/lib/db'
import { getCycleById } from '@/data/plans'
import type { Program } from '@/data/plans/types'
import { enqueueSync, enqueueActiveWorkoutSync } from '@/lib/sync'
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
) {
  if (sessionId) {
    const key = `${program}:${sessionId}`
    if (advancedBySession.has(key)) return
    advancedBySession.add(key)
  }

  const progress = await getProgramProgress(program)
  if (!progress) return

  const cycle = getCycleById(progress.cycleId)
  if (!cycle) return

  const day = cycle.days.find((d) => d.dayNumber === progress.currentDay)
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
    return
  }

  const { nextDay, cycleComplete } = advanceAfterDayPassed(
    progress.currentDay,
    cycle.days.length,
  )

  if (cycleComplete) {
    const testDate = getNextWorkoutDate(new Date(), getTestBlockDays())
    await updateProgramProgress(program, {
      status: 'test_pending',
      currentDay: 1,
      lastWorkoutAt: new Date().toISOString(),
      nextWorkoutAfter: testDate.toISOString(),
    })
    return
  }

  const nextDate = getNextWorkoutDate(new Date(), restDays)
  await updateProgramProgress(program, {
    status: 'rest',
    currentDay: nextDay,
    lastWorkoutAt: new Date().toISOString(),
    nextWorkoutAfter: nextDate.toISOString(),
  })
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

/** Drop orphan active rows whose session is no longer in progress. */
export async function reconcileActiveWorkout(program: Program): Promise<ActiveWorkoutState | undefined> {
  const active = await db.activeWorkout.get(program)
  if (!active) return undefined
  const session = await db.workoutSessions.get(active.sessionId)
  if (session && session.status === 'in_progress' && session.program === program) {
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
