import type { SetTarget } from '@/data/plans/types'
import type { SetResultDraft } from '@/lib/progress-engine'
import type { RestTimerState } from '@/lib/rest-timer'

type RemoteSetRow = {
  set_number: number
  target_kind: string
  target_reps: number | null
  min_reps: number | null
  actual_reps: number
  passed: boolean
}

export function mapRemoteSetRow(row: RemoteSetRow): SetResultDraft {
  let target: SetTarget
  if (row.target_kind === 'max') {
    target = { kind: 'max', minReps: row.min_reps ?? 0 }
  } else if (row.target_kind === 'exact') {
    target = { kind: 'exact', reps: row.target_reps ?? 0 }
  } else {
    target = { kind: 'fixed', reps: row.target_reps ?? 0 }
  }
  return {
    setNumber: row.set_number,
    target,
    actual: row.actual_reps,
    passed: row.passed,
  }
}

export type RemoteSessionRow = {
  id: string
  program: string
  program_kind?: string | null
  custom_plan_id?: string | null
  cycle_id: string
  day_number: number
  cycle_attempt: number
  status: string
  started_at: string
  completed_at: string | null
  passed: boolean | null
  total_reps: number | null
  exercise_logs_json?: unknown
  session_day_patch_json?: unknown
  progression_diff_json?: unknown
  notes?: string | null
  set_results?: RemoteSetRow[]
}

export type RemoteActiveRow = {
  program: string
  session_id: string
  current_set: number
  set_results_json: SetResultDraft[]
  rest_started_at: string | null
  rest_timer_json?: RestTimerState | string | null
  display_started_at?: string | null
  failed_retry_used?: boolean | null
  updated_at: string
}

export type RemoteMaxTestRow = {
  program: string
  reps: number
  tested_at: string
  selected_cycle_id: string
  was_manual_override: boolean
}

export type RemoteBodyWeightRow = {
  id: string
  weight_kg: number
  measured_at: string
  note: string | null
}

export type RemoteProgressRow = {
  program: string
  cycle_id: string
  current_day: number
  status: string
  cycle_attempt: number
  last_workout_at: string | null
  next_workout_after: string | null
  updated_at: string
}
