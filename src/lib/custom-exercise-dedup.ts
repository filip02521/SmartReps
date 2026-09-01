import { db, type ActiveCustomWorkoutState, type LocalWorkoutSession } from '@/lib/db'
import type { CustomPlan, ExerciseDefinition, PrimaryMetric } from '@/lib/exercise-model'
import { enqueueActiveCustomWorkoutSync, enqueueSync } from '@/lib/sync'

export function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function exerciseDedupKey(name: string, metric: PrimaryMetric): string {
  return `${normalizeExerciseName(name)}\0${metric}`
}

export function groupExerciseDuplicates(exercises: ExerciseDefinition[]): ExerciseDefinition[][] {
  const byKey = new Map<string, ExerciseDefinition[]>()
  for (const ex of exercises) {
    if (ex.archived) continue
    const key = exerciseDedupKey(ex.name, ex.primaryMetric)
    const group = byKey.get(key) ?? []
    group.push(ex)
    byKey.set(key, group)
  }
  return [...byKey.values()].filter((group) => group.length > 1)
}

export function buildExerciseReferenceCounts(
  plans: CustomPlan[],
  sessions: LocalWorkoutSession[],
  activeWorkouts: ActiveCustomWorkoutState[],
): Map<string, number> {
  const counts = new Map<string, number>()
  const bump = (exerciseId: string) => {
    counts.set(exerciseId, (counts.get(exerciseId) ?? 0) + 1)
  }

  for (const plan of plans) {
    for (const day of plan.days) {
      for (const planned of day.exercises) bump(planned.exerciseId)
    }
  }
  for (const session of sessions) {
    for (const log of session.exerciseLogs ?? []) bump(log.exerciseId)
  }
  for (const active of activeWorkouts) {
    for (const log of active.exerciseLogs) bump(log.exerciseId)
  }
  return counts
}

/** Prefer the exercise with the most references; tie-break by age then id. */
export function pickCanonicalExercise(
  group: ExerciseDefinition[],
  refCounts: Map<string, number>,
): ExerciseDefinition {
  return [...group].sort((a, b) => {
    const refDiff = (refCounts.get(b.id) ?? 0) - (refCounts.get(a.id) ?? 0)
    if (refDiff !== 0) return refDiff
    const ageDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (ageDiff !== 0) return ageDiff
    return a.id.localeCompare(b.id)
  })[0]!
}

export async function findActiveExerciseByDedupKey(
  name: string,
  metric: PrimaryMetric,
): Promise<ExerciseDefinition | undefined> {
  const key = exerciseDedupKey(name, metric)
  const all = await db.exercises.toArray()
  return all.find((ex) => !ex.archived && exerciseDedupKey(ex.name, ex.primaryMetric) === key)
}

async function remapExerciseIdInPlans(fromId: string, toId: string): Promise<void> {
  const plans = await db.customPlans.toArray()
  for (const plan of plans) {
    let changed = false
    const days = plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((planned) => {
        if (planned.exerciseId !== fromId) return planned
        changed = true
        return { ...planned, exerciseId: toId }
      }),
    }))
    if (!changed) continue
    const next: CustomPlan = {
      ...plan,
      days,
      updatedAt: new Date().toISOString(),
    }
    await db.customPlans.put(next)
    await enqueueSync('custom_plans', 'update', next)
  }
}

async function remapExerciseIdInSessions(fromId: string, toId: string): Promise<void> {
  const sessions = await db.workoutSessions.toArray()
  for (const session of sessions) {
    const logs = session.exerciseLogs
    if (!logs?.some((log) => log.exerciseId === fromId)) continue
    const next: LocalWorkoutSession = {
      ...session,
      exerciseLogs: logs.map((log) =>
        log.exerciseId === fromId ? { ...log, exerciseId: toId } : log,
      ),
    }
    await db.workoutSessions.put(next)
    await enqueueSync('workout_sessions', 'update', next)
  }
}

async function remapExerciseIdInActiveWorkouts(fromId: string, toId: string): Promise<void> {
  const activeWorkouts = await db.activeCustomWorkout.toArray()
  for (const active of activeWorkouts) {
    if (!active.exerciseLogs.some((log) => log.exerciseId === fromId)) continue
    const next: ActiveCustomWorkoutState = {
      ...active,
      exerciseLogs: active.exerciseLogs.map((log) =>
        log.exerciseId === fromId ? { ...log, exerciseId: toId } : log,
      ),
      updatedAt: new Date().toISOString(),
    }
    await db.activeCustomWorkout.put(next)
    await enqueueActiveCustomWorkoutSync(active.customPlanId, next)
  }
}

async function archiveMergedExercise(exercise: ExerciseDefinition): Promise<void> {
  const archived: ExerciseDefinition = {
    ...exercise,
    archived: true,
    updatedAt: new Date().toISOString(),
  }
  await db.exercises.put(archived)
  await enqueueSync('user_exercises', 'update', archived)
}

/** Idempotent: merges active duplicates by normalized name + metric. */
export async function mergeDuplicateExercises(): Promise<{ mergedGroups: number }> {
  const all = await db.exercises.toArray()
  const groups = groupExerciseDuplicates(all)
  if (groups.length === 0) return { mergedGroups: 0 }

  const [plans, sessions, activeWorkouts] = await Promise.all([
    db.customPlans.toArray(),
    db.workoutSessions.toArray(),
    db.activeCustomWorkout.toArray(),
  ])
  const refCounts = buildExerciseReferenceCounts(plans, sessions, activeWorkouts)

  for (const group of groups) {
    const canonical = pickCanonicalExercise(group, refCounts)
    for (const duplicate of group) {
      if (duplicate.id === canonical.id) continue
      await remapExerciseIdInPlans(duplicate.id, canonical.id)
      await remapExerciseIdInSessions(duplicate.id, canonical.id)
      await remapExerciseIdInActiveWorkouts(duplicate.id, canonical.id)
      await archiveMergedExercise(duplicate)
    }
  }

  return { mergedGroups: groups.length }
}
