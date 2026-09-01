import { db, type LocalWorkoutSession } from '@/lib/db'
import type { CustomPlan, CustomProgramProgress, ExerciseLog, SetLog } from '@/lib/exercise-model'
import { getOrCreateCustomProgress, applyCycleProgression } from '@/lib/custom-plan-service'
import { previewProgressionDiff } from '@/lib/custom-progression'
import {
  pickPreviousCustomSet,
  toPreviousCustomSetResult,
  type PreviousCustomSetResult,
} from '@/lib/custom-previous-result'
import { getNextWorkoutDate } from '@/lib/progress-engine'
import { enqueueSync, enqueueActiveCustomWorkoutSync } from '@/lib/sync'
import { generateId } from '@/lib/utils'
import { track } from '@/lib/analytics'
import { useAppStore } from '@/stores/app-store'

/** Prevent double finalize / double progression for the same session. */
const finalizedCustomSessions = new Set<string>()

async function schedulePostWorkoutSync(): Promise<void> {
  const { runAuthenticatedSync } = await import('@/lib/auth-sync')
  await runAuthenticatedSync({
    showSuccessToast: false,
    showFailureToast: false,
    silentOffline: true,
  })
}

function allExerciseSetsPassed(logs: ExerciseLog[]): boolean {
  return (
    logs.length > 0 &&
    logs.every((l) => l.sets.length > 0 && l.sets.every((s) => s.passed))
  )
}

export function customSessionHasProgress(logs: ExerciseLog[]): boolean {
  return logs.some((l) => l.sets.length > 0)
}

/** Drop in_progress custom rows with zero completed sets — peek-and-leave ghosts. */
export async function cleanupEmptyCustomInProgress(planId: string): Promise<void> {
  const orphans = await db.workoutSessions
    .where('customPlanId')
    .equals(planId)
    .filter(
      (s) =>
        s.status === 'in_progress' &&
        !customSessionHasProgress(s.exerciseLogs ?? []),
    )
    .toArray()
  if (orphans.length === 0) {
    const active = await db.activeCustomWorkout.get(planId)
    if (!active) return
    const linked = await db.workoutSessions.get(active.sessionId)
    if (
      !linked ||
      linked.status !== 'in_progress' ||
      !customSessionHasProgress(linked.exerciseLogs ?? [])
    ) {
      await clearActiveCustomWorkout(planId)
    }
    return
  }

  const now = new Date().toISOString()
  for (const s of orphans) {
    const abandoned: LocalWorkoutSession = {
      ...s,
      status: 'abandoned',
      completedAt: now,
    }
    await db.workoutSessions.put(abandoned)
    await enqueueSync('workout_sessions', 'update', abandoned)
  }

  const active = await db.activeCustomWorkout.get(planId)
  if (!active) return
  const linked = await db.workoutSessions.get(active.sessionId)
  if (
    !linked ||
    linked.status !== 'in_progress' ||
    !customSessionHasProgress(linked.exerciseLogs ?? [])
  ) {
    await clearActiveCustomWorkout(planId)
  }
}

export async function reconcileActiveCustomWorkout(planId: string) {
  await cleanupEmptyCustomInProgress(planId)
  return db.activeCustomWorkout.get(planId)
}

async function saveCustomProgress(row: CustomProgramProgress) {
  if (row.id != null) {
    await db.customProgramProgress.put(row)
  } else {
    const id = await db.customProgramProgress.add(row)
    row = { ...row, id }
  }
  await enqueueSync('custom_program_progress', 'update', row)
  return row
}

export async function createCustomSession(params: {
  plan: CustomPlan
  dayNumber: number
  cycleAttempt: number
}): Promise<LocalWorkoutSession> {
  const session: LocalWorkoutSession = {
    id: generateId(),
    program: 'custom',
    programKind: 'custom',
    customPlanId: params.plan.id,
    cycleId: params.plan.id,
    dayNumber: params.dayNumber,
    cycleAttempt: params.cycleAttempt,
    status: 'in_progress',
    startedAt: new Date().toISOString(),
    setResults: [],
    exerciseLogs: [],
  }
  return session
}

export async function persistCustomActive(
  session: LocalWorkoutSession,
  state: {
    currentExerciseIndex: number
    currentSetIndex: number
    exerciseLogs: ExerciseLog[]
    restTimerJson: string | null
    amrapEndAt?: number | null
    amrapGroupId?: string | null
  },
) {
  if (!session.customPlanId) return
  if (!customSessionHasProgress(state.exerciseLogs)) return

  const row: LocalWorkoutSession = {
    ...session,
    exerciseLogs: state.exerciseLogs,
    status: 'in_progress',
    programKind: 'custom',
  }
  await db.workoutSessions.put(row)
  await db.activeCustomWorkout.put({
    customPlanId: session.customPlanId,
    sessionId: session.id,
    currentExerciseIndex: state.currentExerciseIndex,
    currentSetIndex: state.currentSetIndex,
    exerciseLogs: state.exerciseLogs,
    restTimerJson: state.restTimerJson,
    amrapEndAt: state.amrapEndAt ?? null,
    amrapGroupId: state.amrapGroupId ?? null,
    updatedAt: new Date().toISOString(),
  })
  const activeRow = await db.activeCustomWorkout.get(session.customPlanId)
  if (activeRow) await enqueueActiveCustomWorkoutSync(session.customPlanId, activeRow)
  await enqueueSync('workout_sessions', 'update', row)
}

export async function clearActiveCustomWorkout(planId: string) {
  await db.activeCustomWorkout.delete(planId)
  await enqueueActiveCustomWorkoutSync(planId, null)
}

export async function finalizeCustomDay(params: {
  session: LocalWorkoutSession
  plan: CustomPlan
  exerciseLogs: ExerciseLog[]
  passed: boolean
}) {
  const { session, plan, exerciseLogs, passed } = params

  const existing = await db.workoutSessions.get(session.id)
  if (
    finalizedCustomSessions.has(session.id) ||
    (existing?.status === 'completed' && existing.passed === passed)
  ) {
    return { passed: existing?.passed === true }
  }
  if (existing?.status === 'completed') {
    // Already finalized with different outcome — do not re-advance progress
    finalizedCustomSessions.add(session.id)
    return { passed: existing.passed === true }
  }

  finalizedCustomSessions.add(session.id)

  const now = new Date().toISOString()
  const totalReps = exerciseLogs.reduce(
    (sum, log) => sum + log.sets.reduce((s, set) => s + (set.actual.reps ?? 0), 0),
    0,
  )

  const day = plan.days.find((d) => d.dayNumber === session.dayNumber)
  const restDays = day?.restAfterDay ?? 1
  const isLastDay =
    plan.days.length > 0 &&
    session.dayNumber === Math.max(...plan.days.map((d) => d.dayNumber))

  let progressionDiffJson: string | undefined
  if (passed && isLastDay && plan.progression?.enabled && plan.progression.afterCycleComplete) {
    const diff = previewProgressionDiff(plan, plan.progression).filter(
      (d) => JSON.stringify(d.before) !== JSON.stringify(d.after),
    )
    if (diff.length > 0) progressionDiffJson = JSON.stringify(diff)
  }

  const completed: LocalWorkoutSession = {
    ...session,
    status: 'completed',
    completedAt: now,
    passed,
    totalReps,
    exerciseLogs,
    programKind: 'custom',
    customPlanId: plan.id,
    progressionDiffJson,
  }
  await db.workoutSessions.put(completed)
  await enqueueSync('workout_sessions', 'update', completed)
  if (session.customPlanId) await clearActiveCustomWorkout(session.customPlanId)

  const progress = await getOrCreateCustomProgress(plan.id)

  if (passed) {
    if (isLastDay) {
      await saveCustomProgress({
        ...progress,
        status: 'cycle_complete',
        currentDay: 1,
        lastWorkoutAt: now,
        nextWorkoutAfter: null,
        updatedAt: now,
      })
      await applyCycleProgression(plan.id)
    } else {
      const sorted = [...plan.days].map((d) => d.dayNumber).sort((a, b) => a - b)
      const idx = sorted.indexOf(session.dayNumber)
      const nextDay = sorted[idx + 1] ?? session.dayNumber + 1
      await saveCustomProgress({
        ...progress,
        status: 'rest',
        currentDay: nextDay,
        lastWorkoutAt: now,
        nextWorkoutAfter: getNextWorkoutDate(new Date(now), restDays).toISOString(),
        updatedAt: now,
      })
    }
  } else {
    await saveCustomProgress({
      ...progress,
      status: 'rest',
      lastWorkoutAt: now,
      nextWorkoutAfter: getNextWorkoutDate(new Date(now), 1).toISOString(),
      updatedAt: now,
      cycleAttempt: progress.cycleAttempt + 1,
    })
  }

  const store = useAppStore.getState()
  if (passed && !store.hasCompletedFirstWorkout) {
    store.setHasCompletedFirstWorkout(true)
    track('first_workout_done')
  }
  track(passed ? 'day_completed' : 'day_failed')
  void schedulePostWorkoutSync()
  return { passed: passed && allExerciseSetsPassed(exerciseLogs) }
}

/** Last logged result for the same exercise + set (any day, most recent session). */
export type { PreviousCustomSetResult } from '@/lib/custom-previous-result'

export async function getPreviousCustomSetResult(params: {
  customPlanId: string
  exerciseId: string
  setNumber: number
  currentDayNumber: number
  currentCycleAttempt: number
  excludeSessionId?: string
}): Promise<PreviousCustomSetResult | undefined> {
  const sessions = await db.workoutSessions
    .where('customPlanId')
    .equals(params.customPlanId)
    .toArray()
  const picked = pickPreviousCustomSet(sessions, {
    customPlanId: params.customPlanId,
    exerciseId: params.exerciseId,
    setNumber: params.setNumber,
    excludeSessionId: params.excludeSessionId,
  })
  if (!picked) return undefined
  return toPreviousCustomSetResult(picked.session, picked.set)
}

export async function getPreviousCustomSetActual(params: {
  customPlanId: string
  exerciseId: string
  setNumber: number
  currentDayNumber: number
  currentCycleAttempt: number
  excludeSessionId?: string
}): Promise<number | undefined> {
  const result = await getPreviousCustomSetResult(params)
  if (!result) return undefined
  if (result.durationSec != null) return result.durationSec
  return result.reps
}

export async function abandonCustomWorkout(planId: string, sessionId: string) {
  const session = await db.workoutSessions.get(sessionId)
  if (session) {
    const abandoned: LocalWorkoutSession = {
      ...session,
      status: 'abandoned',
      completedAt: new Date().toISOString(),
    }
    await db.workoutSessions.put(abandoned)
    await enqueueSync('workout_sessions', 'update', abandoned)
  }
  await clearActiveCustomWorkout(planId)
}

/** Append a failed set into logs (mirrors builtin finalizeFailedDay). */
export function appendFailedSetLog(
  logs: ExerciseLog[],
  exerciseIndex: number,
  exerciseId: string,
  order: number,
  result: SetLog,
): ExerciseLog[] {
  const next = [...logs]
  const existing = next[exerciseIndex]
  next[exerciseIndex] = existing
    ? { ...existing, exerciseId, order, sets: [...existing.sets, result] }
    : { exerciseId, order, sets: [result] }
  return next
}
