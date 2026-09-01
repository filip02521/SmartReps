import { db, type ActiveCustomWorkoutState } from '@/lib/db'
import type {
  CustomPlan,
  CustomProgramProgress,
  ExerciseDefinition,
  ExerciseLog,
} from '@/lib/exercise-model'
import {
  mapRemoteCustomProgressToLocal,
  shouldPreferLocalCustomProgress,
  type RemoteCustomProgressRow,
} from '@/lib/custom-progress-sync-merge'
import { legacyRestTimerFromStartedAt, reconcileRestTimerJson } from '@/lib/rest-timer-sync'
import {
  hasPendingActiveCustomDelete,
  hasPendingActiveCustomUpdate,
  hasPendingCustomPlanDelete,
  hasPendingCustomPlanUpsert,
  hasPendingCustomProgressUpsert,
} from '@/lib/sync-queue-utils'
import { supabase } from '@/lib/supabase/client'

function remoteCustomSessionHasProgress(logs: ExerciseLog[]): boolean {
  return logs.some((l) => l.sets.length > 0)
}

export async function upsertUserExercise(userId: string, ex: ExerciseDefinition) {
  const { error } = await supabase.from('user_exercises').upsert({
    id: ex.id,
    user_id: userId,
    name: ex.name,
    primary_metric: ex.primaryMetric,
    rest_default_sec: ex.restDefaultSec,
    archived: ex.archived,
    created_at: ex.createdAt,
    updated_at: ex.updatedAt,
  })
  if (error) throw error
}

export async function upsertCustomPlan(userId: string, plan: CustomPlan) {
  const { error } = await supabase.from('custom_plans').upsert({
    id: plan.id,
    user_id: userId,
    name: plan.name,
    description: plan.description,
    status: plan.status,
    source: plan.source,
    plan_json: {
      days: plan.days,
    },
    progression_json: plan.progression ?? null,
    created_at: plan.createdAt,
    updated_at: plan.updatedAt,
  })
  if (error) throw error
}

export async function deleteCustomProgramProgressRemote(userId: string, customPlanId: string) {
  const { error } = await supabase
    .from('custom_program_progress')
    .delete()
    .eq('user_id', userId)
    .eq('custom_plan_id', customPlanId)
  if (error) throw error
}

export async function upsertCustomProgress(userId: string, row: CustomProgramProgress) {
  const { error } = await supabase.from('custom_program_progress').upsert(
    {
      user_id: userId,
      custom_plan_id: row.customPlanId,
      current_day: row.currentDay,
      status: row.status,
      cycle_attempt: row.cycleAttempt,
      last_workout_at: row.lastWorkoutAt,
      next_workout_after: row.nextWorkoutAfter,
      updated_at: row.updatedAt,
    },
    { onConflict: 'user_id,custom_plan_id' },
  )
  if (error) throw error
}

type RemoteExercise = {
  id: string
  name: string
  primary_metric: ExerciseDefinition['primaryMetric']
  rest_default_sec: number
  archived: boolean
  created_at: string
  updated_at: string
}

type RemotePlan = {
  id: string
  name: string
  description: string
  status: CustomPlan['status']
  source: CustomPlan['source']
  plan_json: { days: CustomPlan['days'] }
  progression_json: CustomPlan['progression']
  created_at: string
  updated_at: string
}

type RemoteActiveCustomWorkout = {
  custom_plan_id: string
  session_id: string
  current_exercise_index: number
  current_set_index: number
  exercise_logs_json: ActiveCustomWorkoutState['exerciseLogs']
  rest_timer_json: unknown
  rest_started_at?: string | null
  updated_at: string
}

function parseRestTimerForRemote(restTimerJson: string | null): {
  rest_started_at: string | null
  rest_timer_json: unknown
} {
  if (!restTimerJson) {
    return { rest_started_at: null, rest_timer_json: null }
  }
  try {
    const parsed = JSON.parse(restTimerJson) as { startedAt?: string }
    return {
      rest_started_at: parsed.startedAt ?? null,
      rest_timer_json: JSON.parse(restTimerJson),
    }
  } catch {
    return { rest_started_at: null, rest_timer_json: restTimerJson }
  }
}

function mapActiveCustomRestTimer(remote: RemoteActiveCustomWorkout): string | null {
  if (remote.rest_timer_json != null) {
    const raw =
      typeof remote.rest_timer_json === 'string'
        ? remote.rest_timer_json
        : JSON.stringify(remote.rest_timer_json)
    return reconcileRestTimerJson(raw)
  }
  if (remote.rest_started_at) {
    return legacyRestTimerFromStartedAt(remote.rest_started_at)
  }
  return null
}

export async function upsertActiveCustomWorkout(userId: string, row: ActiveCustomWorkoutState) {
  const timerFields = parseRestTimerForRemote(row.restTimerJson)
  const { error } = await supabase.from('active_custom_workout_state').upsert(
    {
      user_id: userId,
      custom_plan_id: row.customPlanId,
      session_id: row.sessionId,
      current_exercise_index: row.currentExerciseIndex,
      current_set_index: row.currentSetIndex,
      exercise_logs_json: row.exerciseLogs,
      rest_started_at: timerFields.rest_started_at,
      rest_timer_json: timerFields.rest_timer_json,
      updated_at: row.updatedAt,
    },
    { onConflict: 'user_id,custom_plan_id' },
  )
  if (error) throw error
}

export async function deleteActiveCustomWorkoutRemote(userId: string, customPlanId: string) {
  const { error } = await supabase
    .from('active_custom_workout_state')
    .delete()
    .eq('user_id', userId)
    .eq('custom_plan_id', customPlanId)
  if (error) throw error
}

async function mergeActiveCustomRemote(userId: string, remote: RemoteActiveCustomWorkout) {
  const customPlanId = remote.custom_plan_id
  if (await hasPendingActiveCustomDelete(customPlanId)) return

  const session = await db.workoutSessions.get(remote.session_id)
  if (session && session.status !== 'in_progress') {
    await deleteActiveCustomWorkoutRemote(userId, customPlanId)
    return
  }

  const remoteLogs = remote.exercise_logs_json ?? []
  if (!remoteCustomSessionHasProgress(remoteLogs)) {
    await deleteActiveCustomWorkoutRemote(userId, customPlanId)
    return
  }

  const local = await db.activeCustomWorkout.get(customPlanId)
  const remoteUpdated = new Date(remote.updated_at).getTime()
  const localUpdated = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0

  const mapped: ActiveCustomWorkoutState = {
    customPlanId,
    sessionId: remote.session_id,
    currentExerciseIndex: remote.current_exercise_index,
    currentSetIndex: remote.current_set_index,
    exerciseLogs: remoteLogs,
    restTimerJson: mapActiveCustomRestTimer(remote),
    updatedAt: remote.updated_at,
  }

  if (!local || remoteUpdated > localUpdated) {
    await db.activeCustomWorkout.put(mapped)
  } else if (localUpdated > remoteUpdated) {
    await upsertActiveCustomWorkout(userId, local)
  }
}

async function reconcileActiveCustomAfterPull(remotePlanIds: Set<string>): Promise<void> {
  for (const local of await db.activeCustomWorkout.toArray()) {
    if (remotePlanIds.has(local.customPlanId)) continue
    if (await hasPendingActiveCustomUpdate(local.customPlanId)) continue
    if (await hasPendingActiveCustomDelete(local.customPlanId)) {
      await db.activeCustomWorkout.delete(local.customPlanId)
      continue
    }
    await db.activeCustomWorkout.delete(local.customPlanId)
  }
}

async function reconcileCustomProgressAfterPull(remotePlanIds: Set<string>): Promise<void> {
  for (const local of await db.customProgramProgress.toArray()) {
    if (remotePlanIds.has(local.customPlanId)) continue
    if (await hasPendingCustomProgressUpsert(local.customPlanId)) continue
    if (await hasPendingCustomPlanDelete(local.customPlanId)) {
      if (local.id != null) await db.customProgramProgress.delete(local.id)
      continue
    }
    if (local.id != null) await db.customProgramProgress.delete(local.id)
  }
}

async function reconcileCustomPlansAfterPull(remotePlanIds: Set<string>): Promise<void> {
  for (const local of await db.customPlans.toArray()) {
    if (remotePlanIds.has(local.id)) continue
    if (await hasPendingCustomPlanUpsert(local.id)) continue
    if (await hasPendingCustomPlanDelete(local.id)) {
      await db.customPlans.delete(local.id)
      const prog = await db.customProgramProgress.where('customPlanId').equals(local.id).first()
      if (prog?.id != null) await db.customProgramProgress.delete(prog.id)
      await db.activeCustomWorkout.delete(local.id)
      continue
    }
    await db.customPlans.delete(local.id)
    const prog = await db.customProgramProgress.where('customPlanId').equals(local.id).first()
    if (prog?.id != null) await db.customProgramProgress.delete(prog.id)
    await db.activeCustomWorkout.delete(local.id)
  }
}

async function mergeCustomProgressRemote(
  userId: string,
  remote: RemoteCustomProgressRow,
): Promise<void> {
  const local = await db.customProgramProgress
    .where('customPlanId')
    .equals(remote.custom_plan_id)
    .first()

  if (!local) {
    await db.customProgramProgress.add(mapRemoteCustomProgressToLocal(remote))
    return
  }

  if (shouldPreferLocalCustomProgress(local, remote)) {
    await upsertCustomProgress(userId, local)
    return
  }

  await db.customProgramProgress.update(
    local.id!,
    mapRemoteCustomProgressToLocal(remote, local.id),
  )
}

function mapExercise(row: RemoteExercise): ExerciseDefinition {
  return {
    id: row.id,
    name: row.name,
    primaryMetric: row.primary_metric,
    restDefaultSec: row.rest_default_sec,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapPlan(row: RemotePlan): CustomPlan {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    days: row.plan_json?.days ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    source: row.source,
    progression: row.progression_json ?? null,
  }
}

export async function pushCustomEntities(userId: string): Promise<number> {
  let errors = 0
  for (const ex of await db.exercises.toArray()) {
    try {
      await upsertUserExercise(userId, ex)
    } catch (err) {
      errors++
      console.warn('[sync] user_exercise failed', ex.id, err)
    }
  }
  for (const plan of await db.customPlans.toArray()) {
    if (await hasPendingCustomPlanDelete(plan.id)) continue
    try {
      await upsertCustomPlan(userId, plan)
    } catch (err) {
      errors++
      console.warn('[sync] custom_plan failed', plan.id, err)
    }
  }

  const { data: remoteProgress } = await supabase
    .from('custom_program_progress')
    .select('*')
    .eq('user_id', userId)
  const remoteByPlan = new Map<string, RemoteCustomProgressRow>()
  for (const row of (remoteProgress ?? []) as RemoteCustomProgressRow[]) {
    remoteByPlan.set(row.custom_plan_id, row)
  }

  for (const prog of await db.customProgramProgress.toArray()) {
    try {
      if (await hasPendingCustomPlanDelete(prog.customPlanId)) continue
      const remote = remoteByPlan.get(prog.customPlanId)
      if (!shouldPreferLocalCustomProgress(prog, remote)) continue
      await upsertCustomProgress(userId, prog)
    } catch (err) {
      errors++
      console.warn('[sync] custom_progress failed', prog.customPlanId, err)
    }
  }

  for (const active of await db.activeCustomWorkout.toArray()) {
    if (await hasPendingActiveCustomDelete(active.customPlanId)) continue
    try {
      await upsertActiveCustomWorkout(userId, active)
    } catch (err) {
      errors++
      console.warn('[sync] active_custom_workout failed', active.customPlanId, err)
    }
  }
  return errors
}

export async function pullCustomEntities(userId: string): Promise<number> {
  let errors = 0
  try {
    const { data: exercises, error: exErr } = await supabase
      .from('user_exercises')
      .select('*')
      .eq('user_id', userId)
    if (exErr) throw exErr
    for (const row of (exercises ?? []) as RemoteExercise[]) {
      const mapped = mapExercise(row)
      const local = await db.exercises.get(mapped.id)
      if (!local || new Date(mapped.updatedAt) >= new Date(local.updatedAt)) {
        await db.exercises.put(mapped)
      } else {
        await upsertUserExercise(userId, local)
      }
    }

    const { data: plans, error: planErr } = await supabase
      .from('custom_plans')
      .select('*')
      .eq('user_id', userId)
    if (planErr) throw planErr
    const remotePlanIds = new Set<string>()
    for (const row of (plans ?? []) as RemotePlan[]) {
      remotePlanIds.add(row.id)
      const mapped = mapPlan(row)
      const local = await db.customPlans.get(mapped.id)
      if (!local || new Date(mapped.updatedAt) >= new Date(local.updatedAt)) {
        await db.customPlans.put(mapped)
      } else {
        await upsertCustomPlan(userId, local)
      }
    }
    await reconcileCustomPlansAfterPull(remotePlanIds)

    const { data: progress, error: progErr } = await supabase
      .from('custom_program_progress')
      .select('*')
      .eq('user_id', userId)
    if (progErr) throw progErr
    for (const row of (progress ?? []) as RemoteCustomProgressRow[]) {
      if (!remotePlanIds.has(row.custom_plan_id)) continue
      await mergeCustomProgressRemote(userId, row)
    }
    await reconcileCustomProgressAfterPull(remotePlanIds)

    const { data: activeCustom, error: activeCustomErr } = await supabase
      .from('active_custom_workout_state')
      .select('*')
      .eq('user_id', userId)
    if (activeCustomErr) throw activeCustomErr
    const remoteActiveIds = new Set<string>()
    for (const row of (activeCustom ?? []) as RemoteActiveCustomWorkout[]) {
      remoteActiveIds.add(row.custom_plan_id)
      await mergeActiveCustomRemote(userId, row)
    }
    await reconcileActiveCustomAfterPull(remoteActiveIds)

    const { ensureDefaultExercises } = await import('@/lib/custom-plan-service')
    await ensureDefaultExercises()
  } catch (err) {
    console.warn('[sync] pullCustomEntities failed', err)
    errors++
  }
  return errors
}

// Exported for tests
export {
  reconcileCustomPlansAfterPull,
  reconcileActiveCustomAfterPull,
  reconcileCustomProgressAfterPull,
  mergeCustomProgressRemote,
}
