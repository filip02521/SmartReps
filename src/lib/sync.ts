import { db, type LocalMaxTest, type LocalProgramProgress, type LocalWorkoutSession, type ActiveWorkoutState } from './db'
import { isSupabaseConfigured, supabase } from './supabase/client'
import {
  mapRemoteSetRow,
  type RemoteActiveRow,
  type RemoteMaxTestRow,
  type RemoteProgressRow,
  type RemoteSessionRow,
} from './sync-mappers'
import type { Program } from '@/data/plans/types'
import { pl } from '@/i18n/pl'
import { showToast } from '@/stores/toast-store'
import { legacyRestTimerFromStartedAt, reconcileRestTimerJson } from '@/lib/rest-timer-sync'

type SyncAction = 'insert' | 'update' | 'delete'

export type SyncResult = { ok: boolean; errors: number }

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
  return {
    id: row.id,
    user_id: userId,
    program: row.program,
    cycle_id: row.cycleId,
    day_number: row.dayNumber,
    cycle_attempt: row.cycleAttempt,
    status: row.status,
    started_at: row.startedAt,
    completed_at: row.completedAt ?? null,
    passed: row.passed ?? null,
    total_reps: row.totalReps ?? null,
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

async function upsertProgress(userId: string, row: LocalProgramProgress) {
  const { error } = await supabase.from('program_progress').upsert(mapProgressRow(userId, row), {
    onConflict: 'user_id,program',
  })
  if (error) throw error
}

async function upsertSession(userId: string, row: LocalWorkoutSession) {
  const { error: sessionError } = await supabase.from('workout_sessions').upsert(mapSessionRow(userId, row), {
    onConflict: 'id',
  })
  if (sessionError) throw sessionError

  if (row.setResults.length > 0) {
    await supabase.from('set_results').delete().eq('session_id', row.id)
    const { error: setsError } = await supabase.from('set_results').insert(
      row.setResults.map((r) => ({
        session_id: row.id,
        set_number: r.setNumber,
        target_kind: r.target.kind,
        target_reps: r.target.kind !== 'max' ? ('reps' in r.target ? r.target.reps : null) : null,
        min_reps: r.target.kind === 'max' ? r.target.minReps : null,
        actual_reps: r.actual,
        passed: r.passed,
      })),
    )
    if (setsError) throw setsError
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

async function processQueueItem(userId: string, table: string, action: SyncAction, payload: unknown) {
  switch (table) {
    case 'program_progress':
      if (action !== 'delete') await upsertProgress(userId, payload as LocalProgramProgress)
      break
    case 'workout_sessions':
      if (action !== 'delete') await upsertSession(userId, payload as LocalWorkoutSession)
      break
    case 'max_tests':
      if (action !== 'delete') await upsertMaxTest(userId, payload as LocalMaxTest)
      break
    case 'active_workout':
      if (action === 'delete') {
        await deleteActiveWorkoutRemote(userId, (payload as { program: string }).program)
      } else {
        await upsertActiveWorkout(userId, payload as ActiveWorkoutState)
      }
      break
  }
}

export async function flushSyncQueue(): Promise<number> {
  const userId = await getUserId()
  if (!userId) return 0

  let errors = 0
  const items = await db.syncQueue.orderBy('createdAt').toArray()
  for (const item of items) {
    try {
      await processQueueItem(userId, item.table, item.action, JSON.parse(item.payload))
      if (item.id !== undefined) await db.syncQueue.delete(item.id)
    } catch (err) {
      errors++
      console.warn('[sync] queue item failed', item.table, err)
    }
  }
  return errors
}

export async function syncAllLocalData(): Promise<SyncResult> {
  const userId = await getUserId()
  if (!userId) return { ok: true, errors: 0 }

  let errors = 0

  try {
    const progressRows = await db.programProgress.toArray()
    for (const row of progressRows) {
      try {
        await upsertProgress(userId, row)
      } catch (err) {
        errors++
        console.warn('[sync] progress failed', row.program, err)
      }
    }

    const sessions = await db.workoutSessions.toArray()
    for (const session of sessions) {
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

    const activeRows = await db.activeWorkout.toArray()
    for (const row of activeRows) {
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

export async function pullRemoteProgress(): Promise<void> {
  await pullRemoteData()
}

async function mergeProgressRemote(userId: string, remote: RemoteProgressRow) {
  const local = await db.programProgress.where('program').equals(remote.program as Program).first()
  const remoteUpdated = new Date(remote.updated_at).getTime()
  const localUpdated = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0

  const mapped: LocalProgramProgress = {
    id: local?.id,
    program: remote.program as Program,
    cycleId: remote.cycle_id,
    currentDay: remote.current_day,
    status: remote.status as LocalProgramProgress['status'],
    cycleAttempt: remote.cycle_attempt,
    lastWorkoutAt: remote.last_workout_at,
    nextWorkoutAfter: remote.next_workout_after,
    updatedAt: remote.updated_at,
  }

  if (!local || remoteUpdated > localUpdated) {
    if (local?.id) await db.programProgress.update(local.id, mapped)
    else await db.programProgress.add(mapped)
  } else if (localUpdated > remoteUpdated) {
    await upsertProgress(userId, local)
  }
}

async function mergeSessionRemote(userId: string, remote: RemoteSessionRow) {
  const local = await db.workoutSessions.get(remote.id)
  const remoteTime = new Date(remote.completed_at ?? remote.started_at).getTime()
  const localTime = local?.completedAt
    ? new Date(local.completedAt).getTime()
    : local?.startedAt
      ? new Date(local.startedAt).getTime()
      : 0

  const setResults = (remote.set_results ?? []).map(mapRemoteSetRow)
  const mapped: LocalWorkoutSession = {
    id: remote.id,
    program: remote.program as Program,
    cycleId: remote.cycle_id,
    dayNumber: remote.day_number,
    cycleAttempt: remote.cycle_attempt,
    status: remote.status as LocalWorkoutSession['status'],
    startedAt: remote.started_at,
    completedAt: remote.completed_at ?? undefined,
    passed: remote.passed ?? undefined,
    totalReps: remote.total_reps ?? undefined,
    setResults: setResults.length ? setResults : local?.setResults ?? [],
  }

  if (!local || remoteTime >= localTime) {
    await db.workoutSessions.put(mapped)
  } else if (localTime > remoteTime) {
    await upsertSession(userId, local)
  }
}

async function mergeActiveRemote(userId: string, remote: RemoteActiveRow) {
  const local = await db.activeWorkout.get(remote.program as Program)
  const remoteUpdated = new Date(remote.updated_at).getTime()
  const localUpdated = local?.updatedAt ? new Date(local.updatedAt).getTime() : 0

  const mapped: ActiveWorkoutState = {
    program: remote.program as Program,
    sessionId: remote.session_id,
    currentSetIndex: remote.current_set - 1,
    setResults: remote.set_results_json ?? [],
    restTimerJson: mapActiveRestTimer(remote),
    updatedAt: remote.updated_at,
  }

  if (!local || remoteUpdated > localUpdated) {
    await db.activeWorkout.put(mapped)
  } else if (localUpdated > remoteUpdated) {
    await upsertActiveWorkout(userId, local)
  }
}

async function mergeMaxTestRemote(remote: RemoteMaxTestRow) {
  const existing = await db.maxTests
    .where('program')
    .equals(remote.program as Program)
    .filter((t) => t.testedAt === remote.tested_at)
    .first()

  if (existing) return

  await db.maxTests.add({
    program: remote.program as Program,
    reps: remote.reps,
    testedAt: remote.tested_at,
    selectedCycleId: remote.selected_cycle_id,
    wasManualOverride: remote.was_manual_override,
  })
}

export async function pullRemoteData(): Promise<SyncResult> {
  const userId = await getUserId()
  if (!userId) return { ok: true, errors: 0 }

  let errors = 0

  try {
    const { data: remoteProgress, error: progressError } = await supabase
      .from('program_progress')
      .select('*')
      .eq('user_id', userId)
    if (progressError) throw progressError

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

    const { data: remoteTests, error: testsError } = await supabase
      .from('max_tests')
      .select('*')
      .eq('user_id', userId)
      .order('tested_at', { ascending: true })
    if (testsError) throw testsError

    for (const remote of remoteTests ?? []) {
      await mergeMaxTestRemote(remote as RemoteMaxTestRow)
    }
  } catch (err) {
    console.warn('[sync] pullRemoteData failed', err)
    errors++
  }

  return { ok: errors === 0, errors }
}

export function setupOnlineSync() {
  if (typeof window === 'undefined') return () => {}

  const onOnline = () => {
    void syncAllLocalData().then(({ ok }) => {
      if (ok) showToast(pl.toastSyncDone, 'success')
      else showToast(pl.toastSyncFailed, 'error')
    })
  }

  window.addEventListener('online', onOnline)
  void syncAllLocalData()

  return () => window.removeEventListener('online', onOnline)
}

export async function enqueueActiveWorkoutSync(program: string, state: ActiveWorkoutState | null) {
  if (state) {
    await enqueueSync('active_workout', 'update', state)
  } else {
    await enqueueSync('active_workout', 'delete', { program })
  }
}

export function isStaleActiveWorkout(updatedAt: string, hours = 24): boolean {
  const updated = new Date(updatedAt).getTime()
  return Date.now() - updated > hours * 60 * 60 * 1000
}
