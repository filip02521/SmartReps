import type {
  CustomPlan,
  DeloadRule,
  ExerciseDefinition,
  PlanDay,
  ProgressionRule,
} from '@/lib/exercise-model'
import { validateCustomPlan } from '@/lib/exercise-model'

export const COMMUNITY_SNAPSHOT_SCHEMA_VERSION = 1 as const

export type CommunitySnapshotExercise = {
  id: string
  name: string
  primaryMetric: ExerciseDefinition['primaryMetric']
  restDefaultSec: number
}

export type CommunitySnapshot = {
  schemaVersion: typeof COMMUNITY_SNAPSHOT_SCHEMA_VERSION
  name: string
  description: string
  days: PlanDay[]
  progression: ProgressionRule | null
  deload: DeloadRule | null
  exercises: CommunitySnapshotExercise[]
}

export type SnapshotBuildError = { code: 'validation' | 'missing_exercise'; message: string }

export function buildCommunitySnapshot(
  plan: CustomPlan,
  exercisesById: Map<string, ExerciseDefinition>,
): { ok: true; snapshot: CommunitySnapshot } | { ok: false; errors: SnapshotBuildError[] } {
  const issues = validateCustomPlan(plan, exercisesById)
  if (issues.length > 0) {
    return {
      ok: false,
      errors: issues.map((i) => ({ code: 'validation' as const, message: `${i.path}: ${i.message}` })),
    }
  }

  const usedIds = new Set<string>()
  for (const day of plan.days) {
    for (const pe of day.exercises) usedIds.add(pe.exerciseId)
  }

  const exercises: CommunitySnapshotExercise[] = []
  for (const id of usedIds) {
    const def = exercisesById.get(id)
    if (!def || def.archived) {
      return {
        ok: false,
        errors: [{ code: 'missing_exercise', message: id }],
      }
    }
    exercises.push({
      id: def.id,
      name: def.name,
      primaryMetric: def.primaryMetric,
      restDefaultSec: def.restDefaultSec,
    })
  }

  return {
    ok: true,
    snapshot: {
      schemaVersion: COMMUNITY_SNAPSHOT_SCHEMA_VERSION,
      name: plan.name,
      description: plan.description ?? '',
      days: plan.days,
      progression: plan.progression ?? null,
      deload: plan.deload ?? null,
      exercises,
    },
  }
}

export function parseCommunitySnapshot(raw: unknown): CommunitySnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.schemaVersion !== COMMUNITY_SNAPSHOT_SCHEMA_VERSION) return null
  if (typeof o.name !== 'string' || !Array.isArray(o.days) || !Array.isArray(o.exercises)) return null
  return {
    schemaVersion: COMMUNITY_SNAPSHOT_SCHEMA_VERSION,
    name: o.name,
    description: typeof o.description === 'string' ? o.description : '',
    days: o.days as PlanDay[],
    progression: (o.progression as ProgressionRule | null) ?? null,
    deload: (o.deload as DeloadRule | null) ?? null,
    exercises: o.exercises as CommunitySnapshotExercise[],
  }
}

export function remapPlanDays(days: PlanDay[], idMap: Map<string, string>): PlanDay[] {
  return days.map((day) => ({
    ...day,
    exercises: day.exercises
      .map((pe) => {
        const nextId = idMap.get(pe.exerciseId)
        if (!nextId) return null
        return { ...pe, exerciseId: nextId }
      })
      .filter((pe): pe is PlanDay['exercises'][number] => pe != null),
  }))
}
