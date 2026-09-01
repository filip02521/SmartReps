import type { CustomProgramProgress } from '@/lib/exercise-model'

export type RemoteCustomProgressRow = {
  custom_plan_id: string
  current_day: number
  status: CustomProgramProgress['status']
  cycle_attempt: number
  last_workout_at: string | null
  next_workout_after: string | null
  updated_at: string
}

function updatedMs(updatedAt: string | null | undefined): number {
  return updatedAt ? new Date(updatedAt).getTime() : 0
}

/** Whether local custom progress should win over remote (push) or replace stale local (pull). */
export function shouldPreferLocalCustomProgress(
  local: CustomProgramProgress,
  remote: RemoteCustomProgressRow | null | undefined,
): boolean {
  if (!remote) return true

  const sameAttempt = local.cycleAttempt === remote.cycle_attempt
  if (sameAttempt && local.currentDay !== remote.current_day) {
    return local.currentDay > remote.current_day
  }

  const localMs = updatedMs(local.updatedAt)
  const remoteMs = updatedMs(remote.updated_at)
  if (localMs !== remoteMs) return localMs > remoteMs

  if (sameAttempt) return local.currentDay >= remote.current_day
  return localMs >= remoteMs
}

export function mapRemoteCustomProgressToLocal(
  remote: RemoteCustomProgressRow,
  localId?: number,
): CustomProgramProgress {
  return {
    id: localId,
    customPlanId: remote.custom_plan_id,
    currentDay: remote.current_day,
    status: remote.status,
    cycleAttempt: remote.cycle_attempt,
    lastWorkoutAt: remote.last_workout_at,
    nextWorkoutAfter: remote.next_workout_after,
    updatedAt: remote.updated_at,
  }
}
