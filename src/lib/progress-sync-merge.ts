import type { LocalProgramProgress } from '@/lib/db'
import type { RemoteProgressRow } from '@/lib/sync-mappers'
import type { Program } from '@/data/plans/types'

function progressUpdatedMs(updatedAt: string | null | undefined): number {
  return updatedAt ? new Date(updatedAt).getTime() : 0
}

/** Whether local progress should win over remote (push) or replace stale local (pull). */
export function shouldPreferLocalProgress(
  local: LocalProgramProgress,
  remote: RemoteProgressRow | null | undefined,
): boolean {
  if (!remote) return true

  const sameCycle =
    local.cycleId === remote.cycle_id && local.cycleAttempt === remote.cycle_attempt

  if (sameCycle && local.currentDay !== remote.current_day) {
    return local.currentDay > remote.current_day
  }

  const localMs = progressUpdatedMs(local.updatedAt)
  const remoteMs = progressUpdatedMs(remote.updated_at)
  if (localMs !== remoteMs) return localMs > remoteMs

  if (sameCycle) return local.currentDay >= remote.current_day

  return localMs >= remoteMs
}

export function mapRemoteProgressToLocal(
  remote: RemoteProgressRow,
  localId?: number,
): LocalProgramProgress {
  return {
    id: localId,
    program: remote.program as Program,
    cycleId: remote.cycle_id,
    currentDay: remote.current_day,
    status: remote.status as LocalProgramProgress['status'],
    cycleAttempt: remote.cycle_attempt,
    lastWorkoutAt: remote.last_workout_at,
    nextWorkoutAfter: remote.next_workout_after,
    updatedAt: remote.updated_at,
  }
}
