import { db, type LocalWorkoutSession } from '@/lib/db'
import type { CustomPlan, CustomProgramProgress, ExerciseLog, SetLog } from '@/lib/exercise-model'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
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

/** Drop in_progress custom rows with zero completed sets — peek-and-leave ghosts.
 *  Keep sessions that only have a session-day override (extra sets before first log). */
export async function cleanupEmptyCustomInProgress(planId: string): Promise<void> {
  const active = await db.activeCustomWorkout.get(planId)
  const protectSessionId =
    active?.dayOverrideJson && active.sessionId ? active.sessionId : null

  const orphans = await db.workoutSessions
    .where('customPlanId')
    .equals(planId)
    .filter(
      (s) =>
        s.status === 'in_progress' &&
        !customSessionHasProgress(s.exerciseLogs ?? []) &&
        s.id !== protectSessionId,
    )
    .toArray()

  if (orphans.length === 0) {
    if (!active) return
    const linked = await db.workoutSessions.get(active.sessionId)
    if (active.dayOverrideJson && linked?.status === 'in_progress') return
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

  const activeAfter = await db.activeCustomWorkout.get(planId)
  if (!activeAfter) return
  const linked = await db.workoutSessions.get(activeAfter.sessionId)
  if (activeAfter.dayOverrideJson && linked?.status === 'in_progress') return
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
    dayOverrideJson?: string | null
    displayStartedAt?: string | null
  },
) {
  if (!session.customPlanId) return

  const linked = await db.workoutSessions.get(session.id)
  if (linked?.status === 'completed' || linked?.status === 'abandoned') return

  const existing = await db.activeCustomWorkout.get(session.customPlanId)

  const dayOverrideJson =
    state.dayOverrideJson !== undefined
      ? state.dayOverrideJson
      : (existing?.dayOverrideJson ?? null)

  const hasProgress = customSessionHasProgress(state.exerciseLogs)
  if (!hasProgress && !dayOverrideJson) {
    // Explicit clear of session-only edits — drop stale override without creating empty active.
    if (existing?.sessionId === session.id && existing.dayOverrideJson) {
      await db.activeCustomWorkout.put({
        ...existing,
        currentExerciseIndex: state.currentExerciseIndex,
        currentSetIndex: state.currentSetIndex,
        exerciseLogs: state.exerciseLogs,
        restTimerJson: state.restTimerJson,
        amrapEndAt: state.amrapEndAt ?? null,
        amrapGroupId: state.amrapGroupId ?? null,
        dayOverrideJson: null,
        updatedAt: new Date().toISOString(),
      })
      const activeRow = await db.activeCustomWorkout.get(session.customPlanId)
      if (activeRow) await enqueueActiveCustomWorkoutSync(session.customPlanId, activeRow)
    }
    return
  }

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
    dayOverrideJson,
    displayStartedAt: state.displayStartedAt ?? existing?.displayStartedAt ?? null,
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
  /** Mid-workout PlanDay edits (sets/rest) — offered on summary. */
  sessionDayPatchJson?: string | null
  /** @deprecated Custom days always complete and advance; kept for call-site compat. */
  passed?: boolean
}) {
  const { session, plan, exerciseLogs, sessionDayPatchJson } = params
  const hitTargets = allExerciseSetsPassed(exerciseLogs)

  const existing = await db.workoutSessions.get(session.id)
  if (
    finalizedCustomSessions.has(session.id) ||
    (existing?.status === 'completed' && existing.passed === true)
  ) {
    return { passed: true, hitTargets: existing?.passed === true }
  }
  if (existing?.status === 'completed') {
    // Already finalized — do not re-advance progress
    finalizedCustomSessions.add(session.id)
    return { passed: existing.passed === true, hitTargets: existing.passed === true }
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
  if (hitTargets && isLastDay && plan.progression?.enabled && plan.progression.afterCycleComplete) {
    const diff = previewProgressionDiff(plan, plan.progression).filter(
      (d) => JSON.stringify(d.before) !== JSON.stringify(d.after),
    )
    if (diff.length > 0) progressionDiffJson = JSON.stringify(diff)
  }

  // Custom: completing the day always counts as done (no Strong-style restart).
  // Below-target sets stay on logs for a soft summary note only.
  const completed: LocalWorkoutSession = {
    ...session,
    status: 'completed',
    completedAt: now,
    passed: true,
    totalReps,
    exerciseLogs,
    programKind: 'custom',
    customPlanId: plan.id,
    progressionDiffJson,
    sessionDayPatchJson: sessionDayPatchJson ?? null,
  }
  await db.workoutSessions.put(completed)
  await enqueueSync('workout_sessions', 'update', completed)
  if (session.customPlanId) await clearActiveCustomWorkout(session.customPlanId)

  const progress = await getOrCreateCustomProgress(plan.id)

  if (isLastDay) {
    await saveCustomProgress({
      ...progress,
      status: 'cycle_complete',
      currentDay: 1,
      lastWorkoutAt: now,
      nextWorkoutAfter: null,
      updatedAt: now,
    })
    if (hitTargets) {
      await applyCycleProgression(plan.id)
    }
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

  const store = useAppStore.getState()
  if (!store.hasCompletedFirstWorkout) {
    store.setHasCompletedFirstWorkout(true)
    track('first_workout_done')
  }
  track('day_completed')
  void schedulePostWorkoutSync()

  // Community: first train on imported plan
  if (plan.communityPublicationId) {
    const prior = await db.workoutSessions
      .where('customPlanId')
      .equals(plan.id)
      .filter((s) => s.id !== session.id && s.status === 'completed')
      .count()
    if (prior === 0) {
      try {
        const { recordCommunityTrained } = await import('@/lib/achievements/community-impact')
        const res = await recordCommunityTrained(plan.communityPublicationId)
        if (res.counted) {
          track('community_trained', { counted: true })
          const importMs = new Date(plan.createdAt).getTime()
          if (Number.isFinite(importMs) && Date.now() - importMs <= 48 * 60 * 60 * 1000) {
            track('community_import_trained_48h')
          }
        }
      } catch (err) {
        console.warn('[community] record_trained failed', err)
      }
    }
  }

  const { scheduleAchievementCheck } = await import('@/lib/achievements/schedule')
  scheduleAchievementCheck()
  return { passed: true, hitTargets }
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

/**
 * Check if the user has ANY completed sessions for a given custom plan.
 * Used to distinguish "first time ever" from "new day/set combination"
 * in smart rest suggestions.
 */
export async function hasAnyCompletedCustomSessions(
  customPlanId: string,
  excludeSessionId?: string,
): Promise<boolean> {
  const count = await db.workoutSessions
    .where('customPlanId')
    .equals(customPlanId)
    .filter((s) => s.status === 'completed' && s.id !== excludeSessionId)
    .count()
  return count > 0
}

/**
 * All sets from the most recent completed session for the given exercise in a plan.
 * Used when swapping an exercise mid-workout to prefill sets/reps/weight from history.
 */
export async function getLastExerciseLogs(params: {
  customPlanId: string
  exerciseId: string
  excludeSessionId?: string
}): Promise<SetLog[] | undefined> {
  const sessions = await db.workoutSessions
    .where('customPlanId')
    .equals(params.customPlanId)
    .toArray()
  const candidates = sessions
    .filter(
      (s) =>
        isCustomWorkoutSession(s) &&
        s.customPlanId === params.customPlanId &&
        s.status === 'completed' &&
        s.id !== params.excludeSessionId &&
        s.completedAt,
    )
    .sort(
      (a, b) =>
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime(),
    )
  for (const session of candidates) {
    const log = session.exerciseLogs?.find((l) => l.exerciseId === params.exerciseId)
    if (log && log.sets.length > 0) return log.sets
  }
  return undefined
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
