import { db } from '@/lib/db'
import type { CustomPlan, ExerciseDefinition } from '@/lib/exercise-model'
import {
  parseCommunitySnapshot,
  remapPlanDays,
  type CommunitySnapshot,
} from '@/lib/community-snapshot'
import { enqueueSync } from '@/lib/sync'
import { generateId } from '@/lib/utils'
import { recordCommunityImport } from '@/lib/community-api'

export async function importCommunityPublication(
  snapshotRaw: unknown,
  meta: { publicationId: string },
): Promise<{ plan: CustomPlan; importCount: number; counted: boolean }> {
  const snapshot = parseCommunitySnapshot(snapshotRaw)
  if (!snapshot) throw new Error('invalid_snapshot')

  const now = new Date().toISOString()
  const idMap = new Map<string, string>()
  const exercises: ExerciseDefinition[] = []

  for (const ex of snapshot.exercises) {
    const newId = generateId()
    idMap.set(ex.id, newId)
    exercises.push({
      id: newId,
      name: ex.name,
      primaryMetric: ex.primaryMetric,
      restDefaultSec: ex.restDefaultSec,
      archived: false,
      createdAt: now,
      updatedAt: now,
    })
  }

  const days = remapPlanDays(snapshot.days, idMap)
  const plan: CustomPlan = {
    id: generateId(),
    name: snapshot.name,
    description: snapshot.description,
    status: 'draft',
    days,
    createdAt: now,
    updatedAt: now,
    source: 'community',
    progression: snapshot.progression ?? null,
    deload: snapshot.deload ?? null,
    communityPublicationId: meta.publicationId,
  }

  await db.transaction('rw', db.exercises, db.customPlans, async () => {
    for (const ex of exercises) {
      await db.exercises.put(ex)
    }
    await db.customPlans.put(plan)
  })

  for (const ex of exercises) {
    await enqueueSync('user_exercises', 'insert', ex)
  }
  await enqueueSync('custom_plans', 'insert', plan)

  let importCount = 0
  let counted = false
  try {
    const res = await recordCommunityImport(meta.publicationId)
    importCount = res.import_count
    counted = res.counted
  } catch (err) {
    console.warn('[community] record_import failed', err)
  }

  try {
    const { runAuthenticatedSync } = await import('@/lib/auth-sync')
    await runAuthenticatedSync({ showSuccessToast: false, showFailureToast: false })
  } catch (err) {
    console.warn('[community] sync after import failed', err)
  }

  return { plan, importCount, counted }
}

export async function hasLocalCommunityImport(publicationId: string): Promise<boolean> {
  const plans = await db.customPlans.toArray()
  return plans.some((p) => p.communityPublicationId === publicationId)
}

export function snapshotExerciseCount(snapshot: CommunitySnapshot): number {
  return snapshot.exercises.length
}

export function snapshotDayCount(snapshot: CommunitySnapshot): number {
  return snapshot.days.length
}
