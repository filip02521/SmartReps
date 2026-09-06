import { db, type LocalWorkoutSession } from '@/lib/db'
import type {
  CustomPlan,
  ExerciseDefinition,
  MetricTarget,
  MuscleGroup,
  PlanDay,
  PrimaryMetric,
  SetPrescription,
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
  // Klatka piersiowa
  benchPress: pl.exerciseStarterBenchPress,
  inclineBenchPress: pl.exerciseStarterInclineBenchPress,
  dumbbellFlyes: pl.exerciseStarterDumbbellFlyes,
  dips: pl.exerciseStarterDips,
  pushupWide: pl.exerciseStarterPushupWide,
  // Plecy
  barbellRow: pl.exerciseStarterBarbellRow,
  latPulldown: pl.exerciseStarterLatPulldown,
  deadlift: pl.exerciseStarterDeadlift,
  seatedRow: pl.exerciseStarterSeatedRow,
  facePulls: pl.exerciseStarterFacePulls,
  // Barki
  overheadPress: pl.exerciseStarterOverheadPress,
  lateralRaise: pl.exerciseStarterLateralRaise,
  frontRaise: pl.exerciseStarterFrontRaise,
  rearDeltFlyes: pl.exerciseStarterRearDeltFlyes,
  arnoldPress: pl.exerciseStarterArnoldPress,
  // Ramiona
  barbellCurl: pl.exerciseStarterBarbellCurl,
  dumbbellCurl: pl.exerciseStarterDumbbellCurl,
  hammerCurl: pl.exerciseStarterHammerCurl,
  tricepPushdown: pl.exerciseStarterTricepPushdown,
  skullCrusher: pl.exerciseStarterSkullCrusher,
  closeGripBench: pl.exerciseStarterCloseGripBench,
  // Nogi
  legPress: pl.exerciseStarterLegPress,
  lunges: pl.exerciseStarterLunges,
  romanianDeadlift: pl.exerciseStarterRomanianDeadlift,
  legExtension: pl.exerciseStarterLegExtension,
  legCurl: pl.exerciseStarterLegCurl,
  calfRaise: pl.exerciseStarterCalfRaise,
  gobletSquat: pl.exerciseStarterGobletSquat,
  hipThrust: pl.exerciseStarterHipThrust,
  // Core
  crunches: pl.exerciseStarterCrunches,
  hangingLegRaise: pl.exerciseStarterHangingLegRaise,
  russianTwist: pl.exerciseStarterRussianTwist,
  mountainClimbers: pl.exerciseStarterMountainClimbers,
  deadBug: pl.exerciseStarterDeadBug,
  // Całe ciało
  burpees: pl.exerciseStarterBurpees,
  kettlebellSwing: pl.exerciseStarterKettlebellSwing,
  thrusters: pl.exerciseStarterThrusters,
  cleanAndPress: pl.exerciseStarterCleanAndPress,
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

/** When the library is empty, seed the default starter pack (idempotent).
 *  Also backfills any missing starter exercises for existing users,
 *  and backfills muscleGroup on existing starter exercises that lack it. */
export async function ensureDefaultExercises(): Promise<{
  seeded: boolean
  created: ExerciseDefinition[]
}> {
  const all = await db.exercises.toArray()
  const active = all.filter((e) => !e.archived)
  if (active.length === 0) {
    const { created } = await seedStarterExercises()
    return { seeded: created.length > 0, created }
  }
  // Backfill muscleGroup on existing starter exercises that lack it.
  await backfillStarterMuscleGroups(active)
  // Backfill: if user has fewer exercises than the starter pack, add missing ones.
  const byName = new Set(active.map((e) => e.name.trim().toLowerCase()))
  const missing = EXERCISE_STARTERS.some(
    (s) => !byName.has(STARTER_LABELS[s.key].toLowerCase()),
  )
  if (missing) {
    const { created } = await seedStarterExercises()
    return { seeded: created.length > 0, created }
  }
  return { seeded: false, created: [] }
}

/**
 * Backfills muscleGroup on existing starter exercises that are missing it.
 * Runs on every library load so users who had exercises before muscleGroup
 * was introduced get the tag applied automatically.
 */
async function backfillStarterMuscleGroups(active: ExerciseDefinition[]): Promise<void> {
  const byName = new Map(active.map((e) => [e.name.trim().toLowerCase(), e]))
  for (const starter of EXERCISE_STARTERS) {
    const name = STARTER_LABELS[starter.key]
    const match = byName.get(name.toLowerCase())
    if (match && !match.muscleGroup) {
      const updated: ExerciseDefinition = {
        ...match,
        muscleGroup: starter.muscleGroup,
        updatedAt: new Date().toISOString(),
      }
      await db.exercises.put(updated)
      await enqueueSync('user_exercises', 'update', updated)
      byName.set(name.toLowerCase(), updated)
    }
  }
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
    muscleGroup?: MuscleGroup
    /** Origin — defaults to 'user'. Set to 'ai' when saving from AI plan generator. */
    source?: 'user' | 'ai'
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
    muscleGroup: input.muscleGroup ?? existing?.muscleGroup,
    source: input.source ?? existing?.source ?? 'user',
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

/** Idempotent: creates only starters whose names are missing.
 *  Also backfills muscleGroup on existing starter exercises that lack it. */
export async function seedStarterExercises(): Promise<{
  created: ExerciseDefinition[]
  all: ExerciseDefinition[]
}> {
  const existing = await db.exercises.toArray()
  const active = existing.filter((e) => !e.archived)
  await backfillStarterMuscleGroups(active)
  const byName = new Map(active.map((e) => [e.name.trim().toLowerCase(), e]))
  const created: ExerciseDefinition[] = []

  for (const starter of EXERCISE_STARTERS) {
    const name = STARTER_LABELS[starter.key]
    if (byName.has(name.toLowerCase())) continue
    const ex = await saveExercise({
      name,
      primaryMetric: starter.primaryMetric,
      restDefaultSec: starter.restDefaultSec,
      muscleGroup: starter.muscleGroup,
    })
    created.push(ex)
    byName.set(name.toLowerCase(), ex)
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
    // Duplicated plans must not reference the original community publication.
    communityPublicationId: null,
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
  // Store tombstone BEFORE local delete to prevent resurrection by cross-device sync
  const now = new Date().toISOString()
  await db.customPlanTombstones.put({ planId, deletedAt: now })
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

  // Catalog entries are not FK-linked — unpublish so the snapshot does not outlive the plan.
  try {
    const { isSupabaseConfigured, supabase } = await import('@/lib/supabase/client')
    if (isSupabaseConfigured) {
      const { data } = await supabase.auth.getUser()
      if (data.user) {
        const { fetchMyPublicationForPlan, unpublishCommunityPlan } = await import(
          '@/lib/community-api'
        )
        const pub = await fetchMyPublicationForPlan(planId)
        if (pub && pub.status === 'published') {
          await unpublishCommunityPlan(pub.id)
          const { clearCommunityListCache } = await import('@/lib/community-list-cache')
          clearCommunityListCache()
        }
      }
    }
  } catch (err) {
    console.warn('[community] unpublish on plan delete failed', err)
  }

  // Re-evaluate achievements — customPlansCount and workshop_custom may have changed
  const { scheduleAchievementCheck } = await import('@/lib/achievements/schedule')
  scheduleAchievementCheck()
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
  const raw = parsed as Partial<CustomPlan> & {
    exercises?: Array<Partial<ExerciseDefinition>>
  }
  if (!raw.name || !Array.isArray(raw.days)) throw new Error(pl.importInvalid)

  const now = new Date().toISOString()
  const idMap = new Map<string, string>()
  const createdExercises: ExerciseDefinition[] = []

  if (Array.isArray(raw.exercises) && raw.exercises.length > 0) {
    for (const ex of raw.exercises) {
      if (!ex || typeof ex !== 'object' || !ex.id || !ex.name) continue
      const metric = ex.primaryMetric
      if (metric !== 'reps' && metric !== 'duration_sec' && metric !== 'reps_weight') continue
      const newId = generateId()
      idMap.set(String(ex.id), newId)
      createdExercises.push({
        id: newId,
        name: String(ex.name).trim().slice(0, 80),
        primaryMetric: metric,
        restDefaultSec:
          typeof ex.restDefaultSec === 'number' && Number.isFinite(ex.restDefaultSec)
            ? Math.max(0, ex.restDefaultSec)
            : 90,
        archived: false,
        createdAt: now,
        updatedAt: now,
      })
    }
  }

  const days: PlanDay[] =
    idMap.size > 0
      ? (raw.days as PlanDay[]).map((day) => ({
          ...day,
          exercises: (day.exercises ?? []).map((pe) => ({
            ...pe,
            exerciseId: idMap.get(pe.exerciseId) ?? pe.exerciseId,
          })),
        }))
      : (raw.days as PlanDay[])

  const plan: CustomPlan = {
    id: generateId(),
    name: String(raw.name).trim(),
    description: typeof raw.description === 'string' ? raw.description : '',
    status: 'draft',
    days,
    createdAt: now,
    updatedAt: now,
    source: 'import',
    progression: raw.progression ?? null,
    deload: raw.deload ?? null,
  }

  // Always validate the plan, whether or not exercises were bundled.
  // Build the exercise map from both created exercises and existing local exercises.
  const existingExercises = await db.exercises.toArray()
  const byId = new Map<string, ExerciseDefinition>([
    ...existingExercises.map((e) => [e.id, e] as const),
    ...createdExercises.map((e) => [e.id, e] as const),
  ])
  const issues = validateCustomPlan(plan, byId)
  if (issues.length > 0) throw new Error(pl.importInvalid)

  if (createdExercises.length > 0) {
    await db.transaction('rw', db.exercises, db.customPlans, async () => {
      for (const ex of createdExercises) {
        await db.exercises.put(ex)
      }
      await db.customPlans.put(plan)
    })
    for (const ex of createdExercises) {
      await enqueueSync('user_exercises', 'insert', ex)
    }
  } else {
    await db.customPlans.put(plan)
  }

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
  // cycleAttempt was already incremented by finalizeCustomDay before calling this.
  // Use it directly for deload/progression math.
  const nextCycleAttempt = progress?.cycleAttempt ?? 2
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

/**
 * Repair all plans where set targets don't match the exercise's primaryMetric.
 * Fixes: duration_sec exercises with reps targets, and reps exercises with durationSec targets.
 * Returns count of fixed plans and sets.
 */
export async function repairPlanSetMetrics(): Promise<{ fixedPlans: number; fixedSets: number }> {
  const exercises = await db.exercises.toArray()
  const exById = new Map(exercises.map((e) => [e.id, e]))
  const plans = await db.customPlans.toArray()

  let fixedPlans = 0
  let fixedSets = 0

  function fixSet(set: SetPrescription, metric: PrimaryMetric): SetPrescription {
    if (metric === 'duration_sec') {
      if (set.durationSec) return set
      if (set.reps) {
        const v = set.reps.kind === 'max' ? set.reps.minValue : set.reps.value
        const dur = Math.max(10, Math.round(v * 3))
        const target: MetricTarget =
          set.reps.kind === 'max' ? { kind: 'max', minValue: dur } : { kind: set.reps.kind, value: dur }
        return { durationSec: target }
      }
      return { durationSec: { kind: 'fixed', value: 30 } }
    }
    // reps or reps_weight
    if (set.reps) return set
    if (set.durationSec) {
      const v = set.durationSec.kind === 'max' ? set.durationSec.minValue : set.durationSec.value
      const reps = Math.max(1, Math.round(v / 3))
      const target: MetricTarget =
        set.durationSec.kind === 'max' ? { kind: 'max', minValue: reps } : { kind: set.durationSec.kind, value: reps }
      return { reps: target, ...(set.weightKg ? { weightKg: set.weightKg } : {}) }
    }
    return { reps: { kind: 'fixed', value: 8 } }
  }

  for (const plan of plans) {
    let changed = false
    for (const day of plan.days) {
      for (const ex of day.exercises) {
        const def = exById.get(ex.exerciseId)
        if (!def) continue
        const newSets = ex.sets.map((s) => {
          const needsFix =
            (def.primaryMetric === 'duration_sec' && !s.durationSec) ||
            (def.primaryMetric !== 'duration_sec' && !s.reps)
          if (needsFix) {
            fixedSets++
            return fixSet(s, def.primaryMetric)
          }
          return s
        })
        if (JSON.stringify(newSets) !== JSON.stringify(ex.sets)) {
          ex.sets = newSets
          changed = true
        }
      }
    }
    if (changed) {
      plan.updatedAt = new Date().toISOString()
      await db.customPlans.put(plan)
      // Enqueue sync so repaired plan is pushed to cloud
      await enqueueSync('custom_plans', 'update', plan)
      fixedPlans++
    }
  }

  return { fixedPlans, fixedSets }
}

