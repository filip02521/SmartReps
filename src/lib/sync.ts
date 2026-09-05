import { db, type LocalMaxTest, type LocalProgramProgress, type LocalWorkoutSession, type ActiveWorkoutState, type BodyWeightEntry, type LocalAiInsight } from './db'
import { isSupabaseConfigured, supabase } from './supabase/client'
import {
  mapRemoteSetRow,
  type RemoteActiveRow,
  type RemoteMaxTestRow,
  type RemoteBodyWeightRow,
  type RemoteProgressRow,
  type RemoteSessionRow,
} from './sync-mappers'
import type { Program } from '@/data/plans/types'
import { legacyRestTimerFromStartedAt, reconcileRestTimerJson } from '@/lib/rest-timer-sync'
import {
  mergeEnabledProgramsFromProfile,
  mergeEnabledProgramsFromProgress,
  mergeEnabledCustomWorkoutsFromProfile,
  mergeUiSettingsFromProfile,
} from '@/lib/enabled-programs-sync'
import {
  mapRemoteProgressToLocal,
  shouldPreferLocalProgress,
} from '@/lib/progress-sync-merge'
import { shouldPreferLocalSession } from '@/lib/session-sync-merge'
import {
  hasPendingActiveWorkoutDelete,
  hasPendingActiveWorkoutUpdate,
  hasPendingSessionDelete,
} from '@/lib/sync-queue-utils'
import { useAppStore } from '@/stores/app-store'

type SyncAction = 'insert' | 'update' | 'delete'

export type SyncFailureReason =
  | 'offline'
  | 'no_session'
  | 'auth_expired'
  | 'remote_error'
  | 'dead_letter'
  | 'unknown'

export type SyncResult = { ok: boolean; errors: number; reason?: SyncFailureReason }

export async function enqueueSync(table: string, action: SyncAction, payload: unknown) {
  await db.syncQueue.add({
    table,
    action,
    payload: JSON.stringify(payload),
    createdAt: new Date().toISOString(),
  })
}

async function getUserId(): Promise<string | null> {
  if (!isSupabaseConfigured) return null
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

function mapProgressRow(userId: string, row: LocalProgramProgress) {
  return {
    user_id: userId,
    program: row.program,
    cycle_id: row.cycleId,
    current_day: row.currentDay,
    status: row.status,
    cycle_attempt: row.cycleAttempt,
    last_workout_at: row.lastWorkoutAt,
    next_workout_after: row.nextWorkoutAfter,
    updated_at: row.updatedAt,
  }
}

function mapSessionRow(userId: string, row: LocalWorkoutSession) {
  const programKind = row.programKind ?? (row.program === 'custom' ? 'custom' : 'builtin')
  return {
    id: row.id,
    user_id: userId,
    program: row.program,
    program_kind: programKind,
    custom_plan_id: row.customPlanId ?? null,
    cycle_id: row.cycleId,
    day_number: row.dayNumber,
    cycle_attempt: row.cycleAttempt,
    status: row.status,
    started_at: row.startedAt,
    completed_at: row.completedAt ?? null,
    passed: row.passed ?? null,
    total_reps: row.totalReps ?? null,
    exercise_logs_json: row.exerciseLogs ?? null,
    session_day_patch_json: parseJsonbField(row.sessionDayPatchJson),
    progression_diff_json: parseJsonbField(row.progressionDiffJson),
    notes: row.note ?? null,
  }
}

/** Dexie stores JSON columns as strings; Supabase expects jsonb objects/arrays. */
function parseJsonbField(value: string | null | undefined): unknown {
  if (value == null || value === '') return null
  try {
    return JSON.parse(value) as unknown
  } catch {
    return value
  }
}

function jsonbToLocalString(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') return value.length > 0 ? value : null
  try {
    return JSON.stringify(value)
  } catch {
    return null
  }
}

function mapMaxTestRow(userId: string, row: LocalMaxTest) {
  return {
    user_id: userId,
    program: row.program,
    reps: row.reps,
    tested_at: row.testedAt,
    selected_cycle_id: row.selectedCycleId,
    was_manual_override: row.wasManualOverride,
  }
}

function parseRestTimerForRemote(restTimerJson: string | null): {
  rest_started_at: string | null
  rest_timer_json: object | null
} {
  if (!restTimerJson) {
    return { rest_started_at: null, rest_timer_json: null }
  }
  try {
    const parsed = JSON.parse(restTimerJson)
    return {
      rest_started_at: parsed.startedAt ? new Date(parsed.startedAt).toISOString() : null,
      rest_timer_json: parsed,
    }
  } catch {
    return { rest_started_at: null, rest_timer_json: null }
  }
}

function mapActiveRestTimer(remote: RemoteActiveRow): string | null {
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

async function upsertProfileEnabledPrograms(userId: string): Promise<void> {
  const state = useAppStore.getState()
  // Stamp clocks only when missing AFTER pull-first in syncWithRemote — never invent a
  // winning "now" that overwrites remote prefs on upgrade / second device.
  let programsUpdatedAt = state.enabledProgramsUpdatedAt
  let customWorkoutsUpdatedAt = state.enabledCustomWorkoutsUpdatedAt
  let uiUpdatedAt = state.uiSettingsUpdatedAt
  if (!programsUpdatedAt) {
    programsUpdatedAt = new Date().toISOString()
    useAppStore.setState({ enabledProgramsUpdatedAt: programsUpdatedAt })
  }
  if (!customWorkoutsUpdatedAt) {
    customWorkoutsUpdatedAt = new Date().toISOString()
    useAppStore.setState({ enabledCustomWorkoutsUpdatedAt: customWorkoutsUpdatedAt })
  }
  if (!uiUpdatedAt) {
    uiUpdatedAt = new Date().toISOString()
    useAppStore.setState({ uiSettingsUpdatedAt: uiUpdatedAt })
  }
  const { settings } = useAppStore.getState()
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      display_name: settings.displayName?.trim() ? settings.displayName.trim() : null,
      enabled_programs: settings.enabledPrograms,
      enabled_programs_updated_at: programsUpdatedAt,
      enabled_workouts_json: settings.enabledCustomPlanIds,
      enabled_workouts_updated_at: customWorkoutsUpdatedAt,
      custom_plans_filter_explicit: settings.customPlansFilterExplicit,
      theme_preference: settings.theme,
      timer_sound: settings.timerSound,
      timer_vibration: settings.timerVibration,
      keep_screen_on: settings.keepScreenOn,
      reminder_hour: settings.reminderHour,
      weight_unit: settings.weightUnit ?? 'kg',
      high_contrast: settings.highContrast ?? false,
      language: settings.language ?? 'pl',
      ai_proactive_coach: settings.aiProactiveCoach ?? false,
      ai_reasoning_effort: settings.aiReasoningEffort ?? 'auto',
      ai_model: settings.aiModel ?? null,
      ai_base_url: settings.aiBaseUrl ?? null,
      ui_settings_updated_at: uiUpdatedAt,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
}

/** Push only profile settings (e.g. after toggling enabled programs while online). */
export async function pushProfileSettingsOnly(): Promise<SyncResult> {
  const userId = await getUserId()
  if (!userId) return { ok: true, errors: 0 }
  try {
    await upsertProfileEnabledPrograms(userId)
    return { ok: true, errors: 0 }
  } catch (err) {
    console.warn('[sync] pushProfileSettingsOnly failed', err)
    return { ok: false, errors: 1 }
  }
}

async function pullProfileEnabledPrograms(userId: string): Promise<SyncResult> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'display_name, enabled_programs, enabled_programs_updated_at, enabled_workouts_json, enabled_workouts_updated_at, custom_plans_filter_explicit, theme_preference, timer_sound, timer_vibration, keep_screen_on, reminder_hour, weight_unit, high_contrast, language, ai_proactive_coach, ai_reasoning_effort, ai_model, ai_base_url, ui_settings_updated_at',
      )
      .eq('id', userId)
      .maybeSingle()
    if (error) throw error
    mergeEnabledProgramsFromProfile(data)
    mergeEnabledCustomWorkoutsFromProfile(data)
    mergeUiSettingsFromProfile(data)
    if (data && typeof data.display_name === 'string') {
      const name = data.display_name.trim()
      const { settings } = useAppStore.getState()
      if (name && name !== settings.displayName) {
        useAppStore.getState().setSettings({ displayName: name })
      } else if (!settings.displayName && name) {
        useAppStore.getState().setSettings({ displayName: name })
      }
    }
    return { ok: true, errors: 0 }
  } catch (err) {
    console.warn('[sync] pullProfileEnabledPrograms failed', err)
    return { ok: false, errors: 1 }
  }
}

async function upsertProgress(userId: string, row: LocalProgramProgress) {
  const { error } = await supabase.from('program_progress').upsert(mapProgressRow(userId, row), {
    onConflict: 'user_id,program',
  })
  if (error) throw error
}

async function fetchRemoteProgressMap(userId: string): Promise<Map<string, RemoteProgressRow>> {
  const { data, error } = await supabase.from('program_progress').select('*').eq('user_id', userId)
  if (error) throw error
  const map = new Map<string, RemoteProgressRow>()
  for (const row of data ?? []) {
    map.set(row.program, row as RemoteProgressRow)
  }
  return map
}

async function upsertProgressIfNewer(
  userId: string,
  row: LocalProgramProgress,
  remoteByProgram?: Map<string, RemoteProgressRow>,
): Promise<boolean> {
  const remote =
    remoteByProgram?.get(row.program) ??
    (
      await supabase
        .from('program_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('program', row.program)
        .maybeSingle()
    ).data
  if (!shouldPreferLocalProgress(row, remote as RemoteProgressRow | null)) return false
  await upsertProgress(userId, row)
  return true
}

async function upsertSession(userId: string, row: LocalWorkoutSession) {
  const { error: sessionError } = await supabase.from('workout_sessions').upsert(mapSessionRow(userId, row), {
    onConflict: 'id',
  })
  if (sessionError) throw sessionError

  if (row.setResults.length > 0) {
    const payload = row.setResults.map((r) => ({
      session_id: row.id,
      set_number: r.setNumber,
      exercise_order: 0,
      exercise_id: null,
      target_kind: r.target.kind,
      target_reps: r.target.kind !== 'max' ? ('reps' in r.target ? r.target.reps : null) : null,
      min_reps: r.target.kind === 'max' ? r.target.minReps : null,
      actual_reps: r.actual,
      passed: r.passed,
    }))
    // Align with unique (session_id, exercise_order, set_number) from migration 011
    const { error: setsError } = await supabase.from('set_results').upsert(payload, {
      onConflict: 'session_id,exercise_order,set_number',
    })
    if (setsError) throw setsError

    const keepSets = new Set(row.setResults.map((r) => r.setNumber))
    const { data: remoteSets, error: listError } = await supabase
      .from('set_results')
      .select('id, set_number, exercise_order')
      .eq('session_id', row.id)
    if (listError) throw listError
    const orphanIds = (remoteSets ?? [])
      .filter((s) => (s.exercise_order ?? 0) === 0 && !keepSets.has(s.set_number))
      .map((s) => s.id)
    if (orphanIds.length > 0) {
      const { error: delError } = await supabase.from('set_results').delete().in('id', orphanIds)
      if (delError) throw delError
    }
  }

  // Custom multi-exercise: also flatten exerciseLogs into set_results when present
  if (row.exerciseLogs?.length) {
    const isUuid = (id: string) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    const payload = row.exerciseLogs.flatMap((log) =>
      log.sets.map((s) => ({
        session_id: row.id,
        set_number: s.setNumber,
        exercise_order: log.order,
        exercise_id: isUuid(log.exerciseId) ? log.exerciseId : null,
        target_kind: s.prescription.reps?.kind ?? s.prescription.durationSec?.kind ?? 'fixed',
        target_reps:
          s.prescription.reps && s.prescription.reps.kind !== 'max'
            ? s.prescription.reps.value
            : null,
        min_reps:
          s.prescription.reps?.kind === 'max' ? s.prescription.reps.minValue : null,
        actual_reps: s.actual.reps ?? 0,
        duration_sec: s.actual.durationSec ?? null,
        weight_kg: s.actual.weightKg ?? null,
        passed: s.passed,
        metrics_json: s.actual,
      })),
    )
    if (payload.length > 0) {
      const { error: setsError } = await supabase.from('set_results').upsert(payload, {
        onConflict: 'session_id,exercise_order,set_number',
      })
      if (setsError) throw setsError
    }

    const keepKeys = new Set(
      row.exerciseLogs.flatMap((log) =>
        log.sets.map((s) => `${log.order}:${s.setNumber}`),
      ),
    )
    const { data: remoteSets, error: listError } = await supabase
      .from('set_results')
      .select('id, set_number, exercise_order')
      .eq('session_id', row.id)
    if (listError) throw listError
    const orphanIds = (remoteSets ?? [])
      .filter((s) => !keepKeys.has(`${s.exercise_order ?? 0}:${s.set_number}`))
      .map((s) => s.id)
    if (orphanIds.length > 0) {
      const { error: delError } = await supabase.from('set_results').delete().in('id', orphanIds)
      if (delError) throw delError
    }
  }
}

async function upsertActiveWorkout(userId: string, row: ActiveWorkoutState) {
  const timerFields = parseRestTimerForRemote(row.restTimerJson)
  const { error } = await supabase.from('active_workout_state').upsert(
    {
      user_id: userId,
      program: row.program,
      session_id: row.sessionId,
      current_set: row.currentSetIndex + 1,
      set_results_json: row.setResults,
      rest_started_at: timerFields.rest_started_at,
      rest_timer_json: timerFields.rest_timer_json,
      display_started_at: row.displayStartedAt ?? null,
      failed_retry_used: row.failedRetryUsed ?? null,
      updated_at: row.updatedAt,
    },
    { onConflict: 'user_id,program' },
  )
  if (error) throw error
}

async function deleteActiveWorkoutRemote(userId: string, program: string) {
  const { error } = await supabase.from('active_workout_state').delete().eq('user_id', userId).eq('program', program)
  if (error) throw error
}

async function upsertMaxTest(userId: string, row: LocalMaxTest) {
  const { error } = await supabase.from('max_tests').upsert(mapMaxTestRow(userId, row), {
    onConflict: 'user_id,program,tested_at',
  })
  if (error) throw error
}

function mapBodyWeightRow(userId: string, row: BodyWeightEntry) {
  return {
    user_id: userId,
    weight_kg: row.weightKg,
    measured_at: row.measuredAt,
    note: row.note ?? null,
  }
}

async function upsertBodyWeight(userId: string, row: BodyWeightEntry) {
  const { error } = await supabase.from('body_weight_entries').upsert(mapBodyWeightRow(userId, row), {
    onConflict: 'user_id,measured_at',
  })
  if (error) throw error
}

async function processQueueItem(userId: string, table: string, action: SyncAction, payload: unknown) {
  switch (table) {
    case 'program_progress':
      if (action !== 'delete') {
        const queued = payload as LocalProgramProgress
        const local = await db.programProgress.where('program').equals(queued.program).first()
        const row = local ?? queued
        await upsertProgressIfNewer(userId, row)
      }
      break
    case 'workout_sessions':
      if (action === 'delete') {
        const { id } = payload as { id: string }
        const { error } = await supabase
          .from('workout_sessions')
          .delete()
          .eq('user_id', userId)
          .eq('id', id)
        if (error) throw error
      } else {
        const queued = payload as LocalWorkoutSession
        const local = await db.workoutSessions.get(queued.id)
        await upsertSession(userId, local ?? queued)
      }
      break
    case 'max_tests':
      if (action !== 'delete') await upsertMaxTest(userId, payload as LocalMaxTest)
      break
    case 'body_weight_entries':
      if (action === 'delete') {
        const { error } = await supabase
          .from('body_weight_entries')
          .delete()
          .eq('user_id', userId)
          .eq('measured_at', (payload as BodyWeightEntry).measuredAt)
        if (error) throw error
      } else {
        const queued = payload as BodyWeightEntry
        const local = await db.bodyWeight.get(queued.id)
        await upsertBodyWeight(userId, local ?? queued)
      }
      break
    case 'active_workout':
      if (action === 'delete') {
        await deleteActiveWorkoutRemote(userId, (payload as { program: string }).program)
      } else {
        await upsertActiveWorkout(userId, payload as ActiveWorkoutState)
      }
      break
    case 'user_exercises': {
      const { upsertUserExercise } = await import('@/lib/custom-sync')
      if (action === 'delete') {
        const id = (payload as { id: string }).id
        await supabase.from('user_exercises').delete().eq('id', id).eq('user_id', userId)
      } else {
        await upsertUserExercise(userId, payload as import('@/lib/exercise-model').ExerciseDefinition)
      }
      break
    }
    case 'custom_plans': {
      const { upsertCustomPlan } = await import('@/lib/custom-sync')
      if (action === 'delete') {
        const id = (payload as { id: string }).id
        await supabase.from('custom_plans').delete().eq('id', id).eq('user_id', userId)
      } else {
        await upsertCustomPlan(userId, payload as import('@/lib/exercise-model').CustomPlan)
      }
      break
    }
    case 'custom_program_progress': {
      const { upsertCustomProgress, deleteCustomProgramProgressRemote } = await import(
        '@/lib/custom-sync'
      )
      if (action === 'delete') {
        await deleteCustomProgramProgressRemote(
          userId,
          (payload as { customPlanId: string }).customPlanId,
        )
      } else {
        await upsertCustomProgress(
          userId,
          payload as import('@/lib/exercise-model').CustomProgramProgress,
        )
      }
      break
    }
    case 'active_custom_workout': {
      const { upsertActiveCustomWorkout, deleteActiveCustomWorkoutRemote } = await import(
        '@/lib/custom-sync'
      )
      if (action === 'delete') {
        await deleteActiveCustomWorkoutRemote(
          userId,
          (payload as { customPlanId: string }).customPlanId,
        )
      } else {
        await upsertActiveCustomWorkout(userId, payload as import('@/lib/db').ActiveCustomWorkoutState)
      }
      break
    }
    case 'ai_insights': {
      const insight = payload as LocalAiInsight
      if (action === 'delete') {
        const { error } = await supabase
          .from('ai_insights')
          .delete()
          .eq('user_id', userId)
          .eq('id', insight.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('ai_insights').upsert({
          id: insight.id,
          user_id: userId,
          type: insight.type,
          session_id: insight.sessionId ?? null,
          week_key: insight.weekKey ?? null,
          program: insight.program ?? null,
          custom_plan_id: insight.customPlanId ?? null,
          title: insight.title,
          body: insight.body,
          tone: insight.tone,
          source: insight.source,
          created_at: insight.createdAt,
          dismissed_at: insight.dismissedAt ?? null,
          read_at: insight.readAt ?? null,
          metrics_json: insight.metricsJson ?? null,
        })
        if (error) throw error
      }
      break
    }
  }
}

export async function flushSyncQueue(): Promise<number> {
  const userId = await getUserId()
  if (!userId) return 0

  const MAX_ATTEMPTS = 5
  let errors = 0
  const items = await db.syncQueue.orderBy('createdAt').toArray()
  for (const item of items) {
    if ((item.attempts ?? 0) >= MAX_ATTEMPTS) continue
    try {
      await processQueueItem(userId, item.table, item.action, JSON.parse(item.payload))
      if (item.id !== undefined) await db.syncQueue.delete(item.id)
    } catch (err) {
      errors++
      const attempts = (item.attempts ?? 0) + 1
      console.warn('[sync] queue item failed', item.table, err)
      if (item.id !== undefined) {
        await db.syncQueue.update(item.id, { attempts })
        if (attempts >= MAX_ATTEMPTS) {
          console.warn('[sync] queue item dead-lettered after', attempts, 'attempts', item.table)
        }
      }
    }
  }
  return errors
}

export async function getDeadLetterCount(): Promise<number> {
  const items = await db.syncQueue.toArray()
  return items.filter((i) => (i.attempts ?? 0) >= 5).length
}

export async function retryDeadLetterItems(): Promise<SyncResult> {
  const items = await db.syncQueue.toArray()
  for (const item of items) {
    if (item.id !== undefined && (item.attempts ?? 0) >= 5) {
      await db.syncQueue.update(item.id, { attempts: 0 })
    }
  }
  const { runAuthenticatedSync } = await import('@/lib/auth-sync')
  return runAuthenticatedSync({ showSuccessToast: false, showFailureToast: false })
}

export async function syncAllLocalData(): Promise<SyncResult> {
  const userId = await getUserId()
  if (!userId) return { ok: true, errors: 0 }

  let errors = 0

  try {
    await upsertProfileEnabledPrograms(userId)

    const remoteProgress = await fetchRemoteProgressMap(userId)

    const progressRows = await db.programProgress.toArray()
    for (const row of progressRows) {
      try {
        await upsertProgressIfNewer(userId, row, remoteProgress)
      } catch (err) {
        errors++
        console.warn('[sync] progress failed', row.program, err)
      }
    }

    // Custom plans/exercises before sessions — workout_sessions.custom_plan_id FK.
    const { pushCustomEntities } = await import('@/lib/custom-sync')
    errors += await pushCustomEntities(userId)

    const sessions = await db.workoutSessions.toArray()
    // Skip sessions that have a tombstone — they were deleted on this device
    const tombstonedIds = new Set((await db.sessionTombstones.toArray()).map((t) => t.sessionId))
    for (const session of sessions) {
      if (tombstonedIds.has(session.id)) continue
      try {
        await upsertSession(userId, session)
      } catch (err) {
        errors++
        console.warn('[sync] session failed', session.id, err)
      }
    }

    const tests = await db.maxTests.toArray()
    for (const test of tests) {
      try {
        await upsertMaxTest(userId, test)
      } catch (err) {
        errors++
        console.warn('[sync] max_test failed', test.program, err)
      }
    }

    const bodyWeights = await db.bodyWeight.toArray()
    for (const bw of bodyWeights) {
      try {
        await upsertBodyWeight(userId, bw)
      } catch (err) {
        errors++
        console.warn('[sync] body_weight failed', bw.id, err)
      }
    }

    const activeRows = await db.activeWorkout.toArray()
    for (const row of activeRows) {
      if (await hasPendingActiveWorkoutDelete(row.program)) continue
      try {
        await upsertActiveWorkout(userId, row)
      } catch (err) {
        errors++
        console.warn('[sync] active_workout failed', row.program, err)
      }
    }

    errors += await flushSyncQueue()
  } catch (err) {
    console.warn('[sync] syncAllLocalData failed', err)
    errors++
  }

  return { ok: errors === 0, errors }
}

async function mergeProgressRemote(userId: string, remote: RemoteProgressRow) {
  const local = await db.programProgress.where('program').equals(remote.program as Program).first()

  if (!local) {
    await db.programProgress.add(mapRemoteProgressToLocal(remote))
    return
  }

  if (shouldPreferLocalProgress(local, remote)) {
    await upsertProgress(userId, local)
    return
  }

  await db.programProgress.update(local.id!, mapRemoteProgressToLocal(remote, local.id))
}

async function mergeSessionRemote(userId: string, remote: RemoteSessionRow) {
  // Don't resurrect a session that was deleted locally — check both
  // pending sync queue (narrow window) and persistent tombstones (cross-device).
  if (await hasPendingSessionDelete(remote.id)) return
  const tombstone = await db.sessionTombstones.get(remote.id)
  if (tombstone) return

  const local = await db.workoutSessions.get(remote.id)

  const setResults = (remote.set_results ?? [])
    .filter((r) => (r as { exercise_order?: number }).exercise_order == null || (r as { exercise_order?: number }).exercise_order === 0)
    .map(mapRemoteSetRow)
  const programKind =
    remote.program_kind === 'custom' || remote.program === 'custom' ? 'custom' : 'builtin'
  const remoteLogs = Array.isArray(remote.exercise_logs_json)
    ? (remote.exercise_logs_json as LocalWorkoutSession['exerciseLogs'])
    : undefined

  if (
    local &&
    shouldPreferLocalSession(local, {
      status: remote.status,
      started_at: remote.started_at,
      completed_at: remote.completed_at,
      setResults,
      exerciseLogs: remoteLogs,
    })
  ) {
    await upsertSession(userId, local)
    return
  }

  const mapped: LocalWorkoutSession = {
    id: remote.id,
    program: (remote.program === 'custom' ? 'custom' : remote.program) as LocalWorkoutSession['program'],
    programKind,
    customPlanId: remote.custom_plan_id ?? undefined,
    cycleId: remote.cycle_id,
    dayNumber: remote.day_number,
    cycleAttempt: remote.cycle_attempt,
    status: remote.status as LocalWorkoutSession['status'],
    startedAt: remote.started_at,
    completedAt: remote.completed_at ?? undefined,
    passed: remote.passed ?? undefined,
    totalReps: remote.total_reps ?? undefined,
    setResults: setResults.length ? setResults : local?.setResults ?? [],
    exerciseLogs: remoteLogs?.length ? remoteLogs : local?.exerciseLogs,
    sessionDayPatchJson:
      remote.session_day_patch_json !== undefined
        ? jsonbToLocalString(remote.session_day_patch_json)
        : (local?.sessionDayPatchJson ?? null),
    progressionDiffJson:
      remote.progression_diff_json !== undefined
        ? (jsonbToLocalString(remote.progression_diff_json) ?? undefined)
        : local?.progressionDiffJson,
    note: remote.notes ?? local?.note,
  }

  await db.workoutSessions.put(mapped)
}

async function reconcileActiveWorkoutsAfterPull(remotePrograms: Set<string>): Promise<void> {
  for (const local of await db.activeWorkout.toArray()) {
    if (remotePrograms.has(local.program)) continue
    if (await hasPendingActiveWorkoutUpdate(local.program)) continue
    if (await hasPendingActiveWorkoutDelete(local.program)) {
      await db.activeWorkout.delete(local.program)
      continue
    }
    await db.activeWorkout.delete(local.program)
  }
}

async function mergeActiveRemote(userId: string, remote: RemoteActiveRow) {
  const program = remote.program as Program
  if (await hasPendingActiveWorkoutDelete(program)) return

  // Do not resurrect active for a session that is already finished/cancelled locally.
  const session = await db.workoutSessions.get(remote.session_id)
  if (session && session.status !== 'in_progress') {
    await deleteActiveWorkoutRemote(userId, program)
    return
  }

  const remoteSets = remote.set_results_json ?? []
  const sessionSets = session?.setResults.length ?? 0
  if (remoteSets.length === 0 && sessionSets === 0) {
    await deleteActiveWorkoutRemote(userId, program)
    return
  }

  const local = await db.activeWorkout.get(program)
  const remoteUpdated = new Date(remote.updated_at).getTime()
  const localUpdated = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0

  const mapped: ActiveWorkoutState = {
    program,
    sessionId: remote.session_id,
    currentSetIndex: remote.current_set - 1,
    setResults: remote.set_results_json ?? [],
    restTimerJson: mapActiveRestTimer(remote),
    displayStartedAt: remote.display_started_at ?? null,
    failedRetryUsed: remote.failed_retry_used ?? undefined,
    updatedAt: remote.updated_at,
  }

  if (!local || remoteUpdated > localUpdated) {
    await db.activeWorkout.put(mapped)
  } else if (localUpdated > remoteUpdated) {
    await upsertActiveWorkout(userId, local)
  }
}

async function mergeMaxTestRemote(remote: RemoteMaxTestRow) {
  // Normalize to epoch ms — Postgres timestamp format differs from local ISO.
  const remoteMs = new Date(remote.tested_at).getTime()
  const existing = await db.maxTests
    .where('program')
    .equals(remote.program as Program)
    .filter((t) => new Date(t.testedAt).getTime() === remoteMs)
    .first()

  if (existing) return

  await db.maxTests.add({
    program: remote.program as Program,
    reps: remote.reps,
    testedAt: new Date(remoteMs).toISOString(),
    selectedCycleId: remote.selected_cycle_id,
    wasManualOverride: remote.was_manual_override,
  })
}

async function mergeBodyWeightRemote(remote: RemoteBodyWeightRow) {
  // Normalize both sides to epoch ms — Postgres returns "2026-09-03 16:52:29.877+00"
  // while local stores ISO "2026-09-03T16:52:29.877Z". String comparison fails.
  const remoteMs = new Date(remote.measured_at).getTime()
  const all = await db.bodyWeight.toArray()
  const existing = all.find((e) => new Date(e.measuredAt).getTime() === remoteMs)

  if (existing) return

  // Store as ISO 8601 to keep local format consistent.
  await db.bodyWeight.add({
    id: remote.id,
    weightKg: remote.weight_kg,
    measuredAt: new Date(remoteMs).toISOString(),
    note: remote.note ?? undefined,
  })
}

type RemoteAiInsightRow = {
  id: string
  type: 'post_workout' | 'weekly_report' | 'plateau_warning'
  session_id: string | null
  week_key: string | null
  program: string | null
  custom_plan_id: string | null
  title: string
  body: string
  tone: 'insight' | 'warning' | 'success'
  source: 'local' | 'ai'
  created_at: string
  dismissed_at: string | null
  read_at: string | null
  metrics_json: string | null
}

export async function mergeAiInsightRemote(remote: RemoteAiInsightRow) {
  const existing = await db.aiInsights.get(remote.id)
  // For weekly reports: if remote is AI and local has a different-id local
  // report for the same weekKey, replace it (AI wins over local for same week)
  if (remote.type === 'weekly_report' && remote.week_key && remote.source === 'ai') {
    const sameWeekLocals = await db.aiInsights
      .where('weekKey')
      .equals(remote.week_key)
      .filter((i) => i.type === 'weekly_report' && i.id !== remote.id && i.source !== 'ai')
      .toArray()
    await Promise.all(sameWeekLocals.map((r) => db.aiInsights.delete(r.id)))
  }
  if (existing) {
    // LWW: remote wins if created later, OR if remote has state updates
    // (dismissed_at / read_at) that local doesn't have yet.
    const remoteMs = new Date(remote.created_at).getTime()
    const localMs = new Date(existing.createdAt).getTime()
    const remoteHasDismiss = remote.dismissed_at && !existing.dismissedAt
    const remoteHasRead = remote.read_at && !existing.readAt
    const remoteNewer = remoteMs > localMs
    if (remoteNewer || remoteHasDismiss || remoteHasRead) {
      await db.aiInsights.put({
        id: remote.id,
        type: remote.type,
        sessionId: remote.session_id ?? undefined,
        weekKey: remote.week_key ?? undefined,
        program: remote.program ?? undefined,
        customPlanId: remote.custom_plan_id ?? undefined,
        title: remote.title,
        body: remote.body,
        tone: remote.tone,
        source: remote.source,
        createdAt: new Date(remoteMs).toISOString(),
        // Preserve the latest dismiss/read timestamps (remote wins if it has them)
        dismissedAt: remote.dismissed_at ?? existing.dismissedAt,
        readAt: remote.read_at ?? existing.readAt,
        // Use remote metrics_json if available, fall back to local
        metricsJson: remote.metrics_json ?? existing.metricsJson,
      })
    }
    return
  }
  await db.aiInsights.put({
    id: remote.id,
    type: remote.type,
    sessionId: remote.session_id ?? undefined,
    weekKey: remote.week_key ?? undefined,
    program: remote.program ?? undefined,
    customPlanId: remote.custom_plan_id ?? undefined,
    title: remote.title,
    body: remote.body,
    tone: remote.tone,
    source: remote.source,
    createdAt: new Date(remote.created_at).toISOString(),
    dismissedAt: remote.dismissed_at ?? undefined,
    readAt: remote.read_at ?? undefined,
    metricsJson: remote.metrics_json ?? undefined,
  })
}

async function mergeEnabledProgramsLegacyFallback(remoteProgress: RemoteProgressRow[]) {
  const programs = remoteProgress
    .map((row) => row.program as Program)
    .filter((p): p is Program => p === 'pushups' || p === 'pullups')
  if (programs.length) mergeEnabledProgramsFromProgress(programs)
}

export async function pullRemoteData(): Promise<SyncResult> {
  const userId = await getUserId()
  if (!userId) return { ok: true, errors: 0 }

  let errors = 0

  try {
    const profilePull = await pullProfileEnabledPrograms(userId)
    errors += profilePull.errors

    const { data: remoteProgress, error: progressError } = await supabase
      .from('program_progress')
      .select('*')
      .eq('user_id', userId)
    if (progressError) throw progressError

    // Legacy fallback when profiles.enabled_programs not yet migrated
    const { enabledProgramsUpdatedAt } = useAppStore.getState()
    if (!enabledProgramsUpdatedAt) {
      await mergeEnabledProgramsLegacyFallback(remoteProgress ?? [])
    }

    for (const remote of remoteProgress ?? []) {
      await mergeProgressRemote(userId, remote as RemoteProgressRow)
    }

    const { data: remoteSessions, error: sessionsError } = await supabase
      .from('workout_sessions')
      .select('*, set_results(*)')
      .eq('user_id', userId)
    if (sessionsError) throw sessionsError

    for (const remote of remoteSessions ?? []) {
      await mergeSessionRemote(userId, remote as RemoteSessionRow)
    }

    const { data: remoteActive, error: activeError } = await supabase
      .from('active_workout_state')
      .select('*')
      .eq('user_id', userId)
    if (activeError) throw activeError

    for (const remote of remoteActive ?? []) {
      await mergeActiveRemote(userId, remote as RemoteActiveRow)
    }
    await reconcileActiveWorkoutsAfterPull(
      new Set((remoteActive ?? []).map((r) => (r as RemoteActiveRow).program)),
    )

    const { data: remoteTests, error: testsError } = await supabase
      .from('max_tests')
      .select('*')
      .eq('user_id', userId)
      .order('tested_at', { ascending: true })
    if (testsError) throw testsError

    for (const remote of remoteTests ?? []) {
      await mergeMaxTestRemote(remote as RemoteMaxTestRow)
    }

    const { data: remoteBodyWeight, error: bodyWeightError } = await supabase
      .from('body_weight_entries')
      .select('*')
      .eq('user_id', userId)
      .order('measured_at', { ascending: true })
    if (bodyWeightError) throw bodyWeightError

    for (const remote of remoteBodyWeight ?? []) {
      await mergeBodyWeightRemote(remote as RemoteBodyWeightRow)
    }

    // Pull AI insights
    const { data: remoteInsights, error: insightsError } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('user_id', userId)
    if (insightsError) throw insightsError
    for (const remote of remoteInsights ?? []) {
      await mergeAiInsightRemote(remote as RemoteAiInsightRow)
    }

    // Pull session tombstones — delete any local sessions that were
    // deleted on another device, and store tombstones locally.
    const { data: remoteTombstones, error: tombstoneError } = await supabase
      .from('session_tombstones')
      .select('session_id, deleted_at')
      .eq('user_id', userId)
    if (tombstoneError) throw tombstoneError
    for (const row of remoteTombstones ?? []) {
      const r = row as { session_id: string; deleted_at: string }
      await db.sessionTombstones.put({ sessionId: r.session_id, deletedAt: r.deleted_at })
      // Delete local session if it still exists (resurrected by earlier sync)
      const localSession = await db.workoutSessions.get(r.session_id)
      if (localSession) {
        await db.workoutSessions.delete(r.session_id)
      }
    }

    // Push local tombstones to cloud (that haven't been pushed yet)
    const localTombstones = await db.sessionTombstones.toArray()
    for (const tombstone of localTombstones) {
      try {
        await supabase
          .from('session_tombstones')
          .upsert({
            user_id: userId,
            session_id: tombstone.sessionId,
            deleted_at: tombstone.deletedAt,
          }, { onConflict: 'user_id,session_id' })
      } catch {
        // Non-fatal — will retry on next sync
      }
    }

    const { pullCustomEntities } = await import('@/lib/custom-sync')
    errors += await pullCustomEntities(userId)
  } catch (err) {
    console.warn('[sync] pullRemoteData failed', err)
    errors++
  }

  return { ok: errors === 0, errors }
}

export async function syncWithRemote(): Promise<SyncResult> {
  const userId = await getUserId()
  if (!userId) return { ok: true, errors: 0 }

  // Pull profile clocks first when local LWW stamps are missing (upgrade / new device),
  // so we don't overwrite remote theme/timer prefs with fresh defaults.
  const { enabledProgramsUpdatedAt, uiSettingsUpdatedAt, enabledCustomWorkoutsUpdatedAt } =
    useAppStore.getState()
  if (!enabledProgramsUpdatedAt || !uiSettingsUpdatedAt || !enabledCustomWorkoutsUpdatedAt) {
    await pullProfileEnabledPrograms(userId)
  }

  // Pull before push — stale local Dexie must not clobber newer remote progress.
  const pull = await pullRemoteData()
  const push = await syncAllLocalData()
  const errors = pull.errors + push.errors
  return { ok: errors === 0, errors }
}

export async function enqueueActiveWorkoutSync(program: string, state: ActiveWorkoutState | null) {
  if (state) {
    await enqueueSync('active_workout', 'update', state)
  } else {
    // Drop stale updates so a late flush cannot resurrect after cancel.
    await dropPendingActiveWorkoutUpdates(program)
    await enqueueSync('active_workout', 'delete', { program })
  }
}

export async function enqueueActiveCustomWorkoutSync(
  customPlanId: string,
  state: import('@/lib/db').ActiveCustomWorkoutState | null,
) {
  if (state) {
    await enqueueSync('active_custom_workout', 'update', state)
  } else {
    await dropPendingActiveCustomWorkoutUpdates(customPlanId)
    await enqueueSync('active_custom_workout', 'delete', { customPlanId })
  }
}

async function dropPendingActiveCustomWorkoutUpdates(customPlanId: string) {
  const items = await db.syncQueue.toArray()
  for (const item of items) {
    if (item.table !== 'active_custom_workout') continue
    if (item.action !== 'update' && item.action !== 'insert') continue
    if (item.id === undefined) continue
    try {
      const payload = JSON.parse(item.payload) as { customPlanId?: string }
      if (payload.customPlanId === customPlanId) {
        await db.syncQueue.delete(item.id)
      }
    } catch {
      // ignore malformed queue rows
    }
  }
}

async function dropPendingActiveWorkoutUpdates(program: string) {
  const items = await db.syncQueue.toArray()
  for (const item of items) {
    if (item.table !== 'active_workout') continue
    if (item.action !== 'update' && item.action !== 'insert') continue
    if (item.id === undefined) continue
    try {
      const payload = JSON.parse(item.payload) as { program?: string }
      if (payload.program === program) {
        await db.syncQueue.delete(item.id)
      }
    } catch {
      // ignore malformed queue rows
    }
  }
}

export function isStaleActiveWorkout(updatedAt: string, hours = 24): boolean {
  const updated = new Date(updatedAt).getTime()
  return Date.now() - updated > hours * 60 * 60 * 1000
}
