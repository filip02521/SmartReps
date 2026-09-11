import { db } from '@/lib/db'
import { trackSyncError } from '@/lib/analytics'

type SyncAction = 'insert' | 'update' | 'delete'

export async function hasPendingSyncQueue(
  table: string,
  actions: SyncAction | SyncAction[],
  match: (payload: unknown) => boolean,
): Promise<boolean> {
  const wanted = Array.isArray(actions) ? actions : [actions]
  let items: import('@/lib/db').SyncQueueItem[]
  try {
    // Use the `table` index (v14) to filter without scanning the entire queue.
    // Falls back to toArray() if the index doesn't exist (older DB versions).
    try {
      items = await db.syncQueue.where('table').equals(table).toArray()
    } catch {
      items = await db.syncQueue.toArray()
    }
  } catch (err) {
    trackSyncError('sync_queue_db_error', err)
    return false
  }
  for (const item of items) {
    if (item.table !== table || !wanted.includes(item.action as SyncAction)) continue
    try {
      const payload = JSON.parse(item.payload) as unknown
      if (match(payload)) return true
    } catch (err) {
      trackSyncError('sync_queue_parse_error', err)
    }
  }
  return false
}

export async function hasPendingCustomPlanDelete(planId: string): Promise<boolean> {
  return hasPendingSyncQueue('custom_plans', 'delete', (p) => (p as { id?: string }).id === planId)
}

export async function hasPendingCustomPlanUpsert(planId: string): Promise<boolean> {
  return hasPendingSyncQueue('custom_plans', ['insert', 'update'], (p) => (p as { id?: string }).id === planId)
}

export async function hasPendingActiveWorkoutDelete(program: string): Promise<boolean> {
  return hasPendingSyncQueue('active_workout', 'delete', (p) => (p as { program?: string }).program === program)
}

export async function hasPendingActiveWorkoutUpdate(program: string): Promise<boolean> {
  return hasPendingSyncQueue('active_workout', 'update', (p) => (p as { program?: string }).program === program)
}

export async function hasPendingActiveCustomDelete(customPlanId: string): Promise<boolean> {
  return hasPendingSyncQueue(
    'active_custom_workout',
    'delete',
    (p) => (p as { customPlanId?: string }).customPlanId === customPlanId,
  )
}

export async function hasPendingActiveCustomUpdate(customPlanId: string): Promise<boolean> {
  return hasPendingSyncQueue(
    'active_custom_workout',
    'update',
    (p) => (p as { customPlanId?: string }).customPlanId === customPlanId,
  )
}

export async function hasPendingCustomProgressUpsert(customPlanId: string): Promise<boolean> {
  return hasPendingSyncQueue(
    'custom_program_progress',
    ['insert', 'update'],
    (p) => (p as { customPlanId?: string }).customPlanId === customPlanId,
  )
}

export async function hasPendingCustomProgressDelete(customPlanId: string): Promise<boolean> {
  return hasPendingSyncQueue(
    'custom_program_progress',
    'delete',
    (p) => (p as { customPlanId?: string }).customPlanId === customPlanId,
  )
}

export async function hasPendingSessionDelete(sessionId: string): Promise<boolean> {
  return hasPendingSyncQueue('workout_sessions', 'delete', (p) => (p as { id?: string }).id === sessionId)
}

/** Remove pending sync queue items for a specific table + entity ID.
 *  Used when cleaning up stale tombstones — the tombstone and its associated
 *  queue delete must both be removed, otherwise the queue delete would kill
 *  the exercise in the cloud after the stale tombstone cleanup pulled it. */
export async function removePendingSyncQueueItems(
  table: string,
  entityId: string,
): Promise<number> {
  let removed = 0
  let items: import('@/lib/db').SyncQueueItem[]
  try {
    items = await db.syncQueue.where('table').equals(table).toArray()
  } catch {
    try {
      items = await db.syncQueue.toArray()
    } catch (err) {
      trackSyncError('remove_pending_sync_queue_items', err)
      return 0
    }
  }
  for (const item of items) {
    if (item.table !== table) continue
    if (item.id === undefined) continue
    try {
      const payload = JSON.parse(item.payload) as Record<string, unknown>
      const id = payload.id ?? payload.customPlanId ?? payload.exerciseId ?? payload.planId
      if (id === entityId) {
        await db.syncQueue.delete(item.id)
        removed++
      }
    } catch {
      // Non-serializable or unexpected payload — skip
    }
  }
  return removed
}

export async function hasPendingInsightDelete(insightId: string): Promise<boolean> {
  return hasPendingSyncQueue('ai_insights', 'delete', (p) => (p as { id?: string }).id === insightId)
}
