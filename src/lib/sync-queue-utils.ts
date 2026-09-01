import { db } from '@/lib/db'

type SyncAction = 'insert' | 'update' | 'delete'

export async function hasPendingSyncQueue(
  table: string,
  actions: SyncAction | SyncAction[],
  match: (payload: unknown) => boolean,
): Promise<boolean> {
  const wanted = Array.isArray(actions) ? actions : [actions]
  const items = await db.syncQueue.toArray()
  for (const item of items) {
    if (item.table !== table || !wanted.includes(item.action as SyncAction)) continue
    try {
      const payload = JSON.parse(item.payload) as unknown
      if (match(payload)) return true
    } catch {
      // ignore malformed queue rows
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
