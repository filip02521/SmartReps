import { db, type LocalProgramProgress } from '@/lib/db'
import { getCycleById } from '@/data/plans'
import type { Program } from '@/data/plans/types'
import { enqueueSync, enqueueActiveWorkoutSync } from '@/lib/sync'
import { pl } from '@/i18n/pl'
import {
  advanceAfterDayPassed,
  daysUntilWorkout,
  getNextWorkoutDate,
  getTestBlockDays,
} from '@/lib/progress-engine'

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

export async function completeWorkoutDay(
  program: Program,
  passed: boolean,
  _totalReps: number,
) {
  const progress = await getProgramProgress(program)
  if (!progress) return

  const cycle = getCycleById(progress.cycleId)
  if (!cycle) return

  const day = cycle.days.find((d) => d.dayNumber === progress.currentDay)
  const restDays = day?.restAfterDay ?? 1

  if (!passed) {
    const restartDate = getNextWorkoutDate(new Date(), 2)
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
      return waitingRest ? 'warning' : 'success'
    case 'test_pending':
      return 'info'
    case 'cycle_failed':
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
      return pl.statusRestart
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
}

export async function clearActiveWorkout(program: Program) {
  await db.activeWorkout.delete(program)
  await enqueueActiveWorkoutSync(program, null)
}

export async function getActiveWorkout(program: Program) {
  return db.activeWorkout.get(program)
}
