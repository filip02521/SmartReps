import { db, type LocalWorkoutSession } from '@/lib/db'
import type {
  CustomPlan,
  ExerciseDefinition,
  PlanDay,
  PrimaryMetric,
} from '@/lib/exercise-model'
import {
  EXERCISE_STARTERS,
  type ExerciseStarterKey,
  validateCustomPlan,
  validateExerciseDefinition,
} from '@/lib/exercise-model'
import { generateId } from '@/lib/utils'
import { enqueueSync, enqueueActiveCustomWorkoutSync } from '@/lib/sync'
import { useAppStore } from '@/stores/app-store'
import { pruneEnabledCustomPlanIds } from '@/lib/enabled-custom-plans'
import { applyProgressionToPlan, shouldApplyDeload } from '@/lib/custom-progression'
import { isWorkoutAvailable } from '@/lib/progress-engine'
import { pl } from '@/i18n/pl'
import {
  findActiveExerciseByDedupKey,
  mergeDuplicateExercises,
} from '@/lib/custom-exercise-dedup'

const STARTER_LABELS: Record<ExerciseStarterKey, string> = {
  pushups: pl.exerciseStarterPushups,
  pullups: pl.exerciseStarterPullups,
  squats: pl.exerciseStarterSquats,
  plank: pl.exerciseStarterPlank,
  sidePlank: pl.exerciseStarterSidePlank,
  press: pl.exerciseStarterPress,
}

export function shouldPersistDraft(plan: CustomPlan): boolean {
  if (plan.name.trim().length > 0) return true
  if (plan.description.trim().length > 0) return true
  if (plan.progression?.enabled) return true
  return plan.days.some((d) => d.exercises.length > 0)
}

export function isEmptyOrphanDraft(plan: CustomPlan): boolean {
  return plan.status === 'draft' && !shouldPersistDraft(plan)
}

/** When the library is empty, seed the default starter pack (idempotent). */
export async function ensureDefaultExercises(): Promise<{
  seeded: boolean
  created: ExerciseDefinition[]
}> {
  const all = await db.exercises.toArray()
  const active = all.filter((e) => !e.archived)
  if (active.length > 0) {
    return { seeded: false, created: [] }
  }
  const { created } = await seedStarterExercises()
  return { seeded: created.length > 0, created }
}

export async function listExercises(includeArchived = false): Promise<ExerciseDefinition[]> {
  if (!includeArchived) {
    await ensureDefaultExercises()
    await mergeDuplicateExercises()
  }
  const all = await db.exercises.toArray()
  const filtered = includeArchived ? all : all.filter((e) => !e.archived)
  return filtered.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
}

export async function getExercise(id: string): Promise<ExerciseDefinition | undefined> {
  return db.exercises.get(id)
}

export async function saveExercise(
  input: {
    id?: string
    name: string
    primaryMetric: PrimaryMetric
    restDefaultSec: number
    archived?: boolean
  },
): Promise<ExerciseDefinition> {
  const now = new Date().toISOString()
  let resolvedId = input.id
  if (!resolvedId) {
    const duplicate = await findActiveExerciseByDedupKey(input.name, input.primaryMetric)
    if (duplicate) resolvedId = duplicate.id
  }
  const existing = resolvedId ? await db.exercises.get(resolvedId) : undefined
  if (
    existing &&
    existing.primaryMetric !== input.primaryMetric &&
    (await countPlansUsingExercise(existing.id)) > 0
  ) {
    throw new Error(pl.exerciseMetricLocked)
  }
  const ex: ExerciseDefinition = {
    id: existing?.id ?? resolvedId ?? generateId(),
    name: input.name.trim(),
    primaryMetric: input.primaryMetric,
    restDefaultSec: input.restDefaultSec,
    archived: input.archived ?? existing?.archived ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }
  const issues = validateExerciseDefinition(ex)
  if (issues.length) throw new Error(issues[0]!.message)
  await db.exercises.put(ex)
  await enqueueSync('user_exercises', existing ? 'update' : 'insert', ex)
  return ex
}

export async function archiveExercise(id: string): Promise<{ ok: true } | { ok: false; usedIn: number }> {
  const usedIn = await countPlansUsingExercise(id)
  if (usedIn > 0) return { ok: false, usedIn }
  const ex = await db.exercises.get(id)
  if (!ex) throw new Error('not_found')
  await saveExercise({ ...ex, archived: true })
  return { ok: true }
}

export async function countPlansUsingExercise(exerciseId: string): Promise<number> {
  const plans = await db.customPlans.toArray()
  return plans.filter((p) =>
    p.days.some((d) => d.exercises.some((e) => e.exerciseId === exerciseId)),
  ).length
}

/** Idempotent: creates only starters whose names are missing. */
export async function seedStarterExercises(): Promise<{
  created: ExerciseDefinition[]
  all: ExerciseDefinition[]
}> {
  const existing = await db.exercises.toArray()
  const active = existing.filter((e) => !e.archived)
  const byName = new Set(active.map((e) => e.name.trim().toLowerCase()))
  const created: ExerciseDefinition[] = []
  for (const starter of EXERCISE_STARTERS) {
    const name = STARTER_LABELS[starter.key]
    if (byName.has(name.toLowerCase())) continue
    const ex = await saveExercise({
      name,
      primaryMetric: starter.primaryMetric,
      restDefaultSec: starter.restDefaultSec,
    })
    created.push(ex)
    byName.add(name.toLowerCase())
  }
  return { created, all: await listExercises() }
}

export async function listCustomPlans(): Promise<CustomPlan[]> {
  const plans = await db.customPlans.toArray()
  return plans
    .filter((p) => !isEmptyOrphanDraft(p))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function getCustomPlan(id: string): Promise<CustomPlan | undefined> {
  return db.customPlans.get(id)
}

export async function saveCustomPlan(
  plan: CustomPlan,
  opts?: { activate?: boolean; skipValidation?: boolean },
): Promise<CustomPlan> {
  const exercises = await db.exercises.toArray()
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const next: CustomPlan = {
    ...plan,
    name: plan.name.trim(),
    status: opts?.activate ? 'active' : plan.status,
    updatedAt: new Date().toISOString(),
  }
  const shouldValidate = opts?.activate || (next.status === 'active' && !opts?.skipValidation)
  if (shouldValidate) {
    const issues = validateCustomPlan(next, byId)
    if (issues.length) throw new Error(issues[0]!.message)
  }
  const existing = await db.customPlans.get(plan.id)
  await db.customPlans.put(next)
  await enqueueSync('custom_plans', existing ? 'update' : 'insert', next)
  return next
}

export function createEmptyDraftPlan(): CustomPlan {
  const now = new Date().toISOString()
  return {
    id: generateId(),
    name: '',
    description: '',
    status: 'draft',
    days: [
      {
        dayNumber: 1,
        restAfterDay: 1,
        exercises: [],
      },
    ],
    createdAt: now,
    updatedAt: now,
    source: 'user',
  }
}

export async function adjustCustomProgressAfterDayDelete(
  planId: string,
  days: PlanDay[],
): Promise<void> {
  const prog = await db.customProgramProgress.where('customPlanId').equals(planId).first()
  if (!prog) return
  const maxDay = days.length > 0 ? Math.max(...days.map((d) => d.dayNumber)) : 1
  const nextDay = Math.min(Math.max(1, prog.currentDay), maxDay)
  if (nextDay === prog.currentDay) return
  const updated = { ...prog, currentDay: nextDay, updatedAt: new Date().toISOString() }
  await db.customProgramProgress.put(updated)
  await enqueueSync('custom_program_progress', 'update', updated)
}

export async function duplicateCustomPlan(planId: string): Promise<CustomPlan> {
  const plan = await db.customPlans.get(planId)
  if (!plan) throw new Error('not_found')
  const now = new Date().toISOString()
  const copy: CustomPlan = {
    ...structuredClone(plan),
    id: generateId(),
    name: `${plan.name}${pl.planDuplicateCopySuffix}`,
    status: 'draft',
    source: 'duplicate',
    createdAt: now,
    updatedAt: now,
  }
  await db.customPlans.put(copy)
  await enqueueSync('custom_plans', 'insert', copy)
  return copy
}

export function duplicatePlanDay(day: PlanDay, nextDayNumber: number): PlanDay {
  return {
    ...structuredClone(day),
    dayNumber: nextDayNumber,
  }
}

export async function deleteCustomPlan(planId: string): Promise<void> {
  const sessions = await db.workoutSessions.where('customPlanId').equals(planId).toArray()
  for (const s of sessions) {
    if (s.status === 'in_progress') {
      const abandoned: LocalWorkoutSession = {
        ...s,
        status: 'abandoned',
        completedAt: new Date().toISOString(),
      }
      await db.workoutSessions.put(abandoned)
      await enqueueSync('workout_sessions', 'update', abandoned)
    }
  }
  const prog = await db.customProgramProgress.where('customPlanId').equals(planId).first()
  await db.customPlans.delete(planId)
  if (prog?.id != null) {
    await db.customProgramProgress.delete(prog.id)
    await enqueueSync('custom_program_progress', 'delete', { customPlanId: planId })
  }
  await db.activeCustomWorkout.delete(planId)
  await enqueueActiveCustomWorkoutSync(planId, null)
  await enqueueSync('custom_plans', 'delete', { id: planId })

  const { settings, setSettings } = useAppStore.getState()
  if (settings.enabledCustomPlanIds.includes(planId)) {
    setSettings({
      enabledCustomPlanIds: pruneEnabledCustomPlanIds(settings.enabledCustomPlanIds, planId),
    })
  }
}

export async function setCustomPlanPaused(planId: string, paused: boolean): Promise<void> {
  let prog = await db.customProgramProgress.where('customPlanId').equals(planId).first()
  if (!prog) {
    if (!paused) return
    prog = await getOrCreateCustomProgress(planId)
  }
  const updated = paused
    ? { ...prog, status: 'paused' as const, updatedAt: new Date().toISOString() }
    : {
        ...prog,
        status: (isWorkoutAvailable(
          prog.nextWorkoutAfter ? new Date(prog.nextWorkoutAfter) : null,
        )
          ? 'active'
          : 'rest') as typeof prog.status,
        updatedAt: new Date().toISOString(),
      }
  await db.customProgramProgress.put(updated)
  await enqueueSync('custom_program_progress', 'update', updated)
}

export async function hasActiveCustomWorkout(planId: string): Promise<boolean> {
  const active = await db.activeCustomWorkout.get(planId)
  if (!active) return false
  const session = await db.workoutSessions.get(active.sessionId)
  return session?.status === 'in_progress'
}

export async function importCustomPlanFromJson(text: string): Promise<CustomPlan> {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(pl.importInvalid)
  }
  if (!parsed || typeof parsed !== 'object') throw new Error(pl.importInvalid)
  const raw = parsed as Partial<CustomPlan>
  if (!raw.name || !Array.isArray(raw.days)) throw new Error(pl.importInvalid)

  const now = new Date().toISOString()
  const plan: CustomPlan = {
    id: generateId(),
    name: String(raw.name).trim(),
    description: typeof raw.description === 'string' ? raw.description : '',
    status: 'draft',
    days: raw.days,
    createdAt: now,
    updatedAt: now,
    source: 'import',
    progression: raw.progression ?? null,
  }
  await db.customPlans.put(plan)
  await enqueueSync('custom_plans', 'insert', plan)
  return plan
}

export async function getOrCreateCustomProgress(planId: string) {
  const existing = await db.customProgramProgress.where('customPlanId').equals(planId).first()
  if (existing) return existing
  const row = {
    customPlanId: planId,
    currentDay: 1,
    status: 'active' as const,
    cycleAttempt: 1,
    lastWorkoutAt: null,
    nextWorkoutAfter: null,
    updatedAt: new Date().toISOString(),
  }
  const id = await db.customProgramProgress.add(row)
  const created = { ...row, id }
  await enqueueSync('custom_program_progress', 'insert', created)
  return created
}

export async function applyCycleProgression(planId: string): Promise<CustomPlan | null> {
  const plan = await db.customPlans.get(planId)
  if (!plan) return null
  if (!plan.progression?.enabled || !plan.progression.afterCycleComplete) {
    if (!plan.deload?.enabled) return null
  }
  const progress = await db.customProgramProgress.where('customPlanId').equals(planId).first()
  const nextCycleAttempt = (progress?.cycleAttempt ?? 1) + 1
  const rule = plan.progression ?? {
    enabled: true,
    afterCycleComplete: true,
    repsDelta: 0,
    weightKgDelta: 0,
    durationSecDelta: 0,
  }
  if (!rule.enabled && !shouldApplyDeload(plan, nextCycleAttempt)) return null
  const next = applyProgressionToPlan(plan, rule, { nextCycleAttempt })
  return saveCustomPlan(next, { activate: true })
}
