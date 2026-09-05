/**
 * AI Plan Generator — converts AI response into a valid CustomPlan.
 *
 * IMPORTANT: Exercises are NOT persisted during generation. They are kept as
 * temporary definitions and only saved to the library when the user imports
 * the plan via `commitGeneratedPlan()`. This prevents orphan exercises when
 * the user discards a generated plan.
 */

import type {
  CustomPlan,
  ExerciseDefinition,
  MetricTarget,
  MuscleGroup,
  PlannedExercise,
  PrimaryMetric,
  SetPrescription,
} from '@/lib/exercise-model'
import { saveExercise } from '@/lib/custom-plan-service'
import { saveCustomPlan } from '@/lib/custom-plan-service'
import { generateId } from '@/lib/utils'
import { db } from '@/lib/db'
import { pl } from '@/i18n/pl'
import { chatCompletion, parseJsonResponse, AiApiError, resolveReasoningEffort } from './ai-client'
import { buildPlanGenerationPrompt, type AiPlanResponse, type PlanGenerationInput } from './prompts'

const DEFAULT_MODEL = 'gpt-4o-mini'

const VALID_METRICS = ['reps', 'reps_weight', 'duration_sec'] as const
const VALID_MUSCLE_GROUPS = [
  'chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'full_body', 'cardio', 'other',
] as const
const VALID_KINDS = ['fixed', 'max', 'min', 'exact'] as const

// Hard limits matching validateCustomPlan in exercise-model.ts
const MAX_DAYS = 14
const MAX_EXERCISES_PER_DAY = 20
const MAX_SETS_PER_EXERCISE = 30
const MIN_REST_SEC = 10
const MAX_REST_SEC = 600

function sanitizeMetric(value: string): PrimaryMetric {
  return (VALID_METRICS as readonly string[]).includes(value) ? value as PrimaryMetric : 'reps'
}

function sanitizeMuscleGroup(value: string | undefined): MuscleGroup | undefined {
  if (!value) return undefined
  return (VALID_MUSCLE_GROUPS as readonly string[]).includes(value) ? value as MuscleGroup : 'other'
}

function sanitizeKind(value: string): 'fixed' | 'max' | 'min' | 'exact' {
  return (VALID_KINDS as readonly string[]).includes(value) ? value as 'fixed' | 'max' | 'min' | 'exact' : 'fixed'
}

function clampRest(sec: unknown, fallback: number): number {
  const n = Number(sec)
  if (!Number.isFinite(n) || n < MIN_REST_SEC) return fallback
  return Math.min(MAX_REST_SEC, Math.round(n))
}

/**
 * Convert AI-returned metric target into a valid MetricTarget.
 * Handles: fixed, max, min, exact, range, toFailure (AI invents these).
 * - "range" with {min, max} → "min" with max value (aim for max, at least min)
 * - "toFailure" / "amrap" → "max" with min value (do as many as possible)
 * - "max" → {kind: "max", minValue: value}
 * - others → {kind, value}
 */
function sanitizeMetricTarget(
  raw: { kind: string; value?: number; min?: number; max?: number },
  clampMax: number,
): MetricTarget {
  const kind = raw.kind

  // Handle "range" — AI invents this format: {kind: "range", min: 8, max: 12}
  if (kind === 'range') {
    const minVal = Number(raw.min) || Number(raw.value) || 0
    const maxVal = Number(raw.max) || minVal
    const target = Math.max(0, Math.min(clampMax, maxVal))
    return { kind: 'min', value: target }
  }

  // Handle "toFailure" / "amrap" — as many reps as possible
  if (kind === 'toFailure' || kind === 'amrap' || kind === 'to_failure') {
    const v = Number(raw.value ?? raw.min) || 5
    return { kind: 'max', minValue: Math.max(0, Math.min(clampMax, v)) }
  }

  const sanitizedKind = sanitizeKind(kind)
  if (sanitizedKind === 'max') {
    const v = Number(raw.value ?? raw.min) || 0
    return { kind: 'max', minValue: Math.max(0, Math.min(clampMax, v)) }
  }

  const v = Number(raw.value ?? raw.min) || 0
  return { kind: sanitizedKind, value: Math.max(0, Math.min(clampMax, v)) }
}

export type PlanGenerationResult = {
  plan: CustomPlan
  rationale: string
  /** Temporary exercise definitions — NOT yet persisted. Persisted on import. */
  newExercises: ExerciseDefinition[]
}

export async function generatePlan(
  input: PlanGenerationInput,
  context: {
    apiKey: string
    model?: string
    library: ExerciseDefinition[]
    baseURL?: string
    reasoningEffort?: 'auto' | 'low' | 'medium' | 'high'
    signal?: AbortSignal
  },
): Promise<PlanGenerationResult> {
  const { system, user } = buildPlanGenerationPrompt(input, context.library)

  const isGemini = context.baseURL?.includes('gemini') || context.baseURL?.includes('googleapis')

  const result = await chatCompletion({
    apiKey: context.apiKey,
    model: context.model || DEFAULT_MODEL,
    messages: [system, user],
    jsonMode: true,
    temperature: 0.7,
    maxTokens: isGemini ? 16000 : 8000,
    reasoningEffort: resolveReasoningEffort(context.model || DEFAULT_MODEL, context.reasoningEffort),
    baseURL: context.baseURL,
    signal: context.signal,
  })

  const parsed = parseJsonResponse<AiPlanResponse>(result.content)
  if (!parsed?.plan?.days?.length) {
    throw new AiApiError(pl.aiErrorParsePlan, undefined, 'parse')
  }

  const now = new Date().toISOString()
  const newExercises: ExerciseDefinition[] = []

  // Build exercise lookup (name → existing def, case-insensitive)
  const existingByName = new Map(
    context.library.map((e) => [e.name.toLowerCase().trim(), e]),
  )

  // Track temporary definitions by name (for dedup within same plan)
  const tempByName = new Map<string, ExerciseDefinition>()

  // Process each exercise in the plan — create TEMP defs if needed (not persisted yet)
  const days: CustomPlan['days'] = []

  // Clamp days to MAX_DAYS
  const aiDays = parsed.plan.days.slice(0, MAX_DAYS)

  for (const aiDay of aiDays) {
    const exercises: PlannedExercise[] = []

    // Clamp exercises per day
    const aiExercises = (aiDay.exercises ?? []).slice(0, MAX_EXERCISES_PER_DAY)

    for (let exIdx = 0; exIdx < aiExercises.length; exIdx++) {
      const aiEx = aiExercises[exIdx]!
      const rawName = aiEx.exerciseName ?? ''
      const nameKey = rawName.toLowerCase().trim()
      const cleanName = rawName.trim().slice(0, 80)

      if (!cleanName) continue

      // Check existing library first
      let def = existingByName.get(nameKey)

      // Then check temp defs (same exercise in different days)
      if (!def) def = tempByName.get(nameKey)

      if (!def) {
        // Create a TEMPORARY exercise definition (NOT persisted yet)
        const metric = sanitizeMetric(aiEx.primaryMetric)
        const restDefault = clampRest(aiEx.restBetweenSetsSec, 90)
        def = {
          id: generateId(),
          name: cleanName,
          primaryMetric: metric,
          restDefaultSec: restDefault,
          archived: false,
          muscleGroup: sanitizeMuscleGroup(aiEx.muscleGroup),
          createdAt: now,
          updatedAt: now,
        }
        newExercises.push(def)
        tempByName.set(nameKey, def)
      }

      // Build sets with validation — targets MUST match the exercise's primaryMetric
      const rawSets = (aiEx.sets ?? []).slice(0, MAX_SETS_PER_EXERCISE)
      const sets: SetPrescription[] = rawSets.map((s) => {
        const sp: SetPrescription = {}

        // Parse all targets AI provided
        const repsTarget = s.reps ? sanitizeMetricTarget(s.reps, 1000) : undefined
        const durationTarget = s.durationSec ? sanitizeMetricTarget(s.durationSec, 7200) : undefined
        const weightTarget = s.weightKg ? sanitizeMetricTarget(s.weightKg, 1000) : undefined

        // Assign targets based on the exercise's primaryMetric
        // validateSetPrescription requires:
        //   - reps/reps_weight → set.reps must be present
        //   - duration_sec → set.durationSec must be present
        if (def.primaryMetric === 'duration_sec') {
          // Exercise uses duration — use durationSec, or convert reps to duration
          if (durationTarget) {
            sp.durationSec = durationTarget
          } else if (repsTarget) {
            // AI gave reps but exercise needs duration — convert: 1 rep ≈ 3 sec as fallback
            const repValue = repsTarget.kind === 'max' ? repsTarget.minValue : repsTarget.value
            sp.durationSec = { kind: repsTarget.kind === 'max' ? 'max' : 'fixed', value: Math.max(10, repValue * 3) } as MetricTarget
          } else {
            // No target at all — default 30 sec
            sp.durationSec = { kind: 'fixed', value: 30 }
          }
        } else {
          // Exercise uses reps or reps_weight — use reps
          if (repsTarget) {
            sp.reps = repsTarget
          } else if (durationTarget) {
            // AI gave duration but exercise needs reps — convert: 3 sec ≈ 1 rep
            const durValue = durationTarget.kind === 'max' ? durationTarget.minValue : durationTarget.value
            sp.reps = { kind: durationTarget.kind === 'max' ? 'max' : 'fixed', value: Math.max(1, Math.round(durValue / 3)) } as MetricTarget
          } else {
            sp.reps = { kind: 'fixed', value: 8 }
          }
          // weightKg is optional, only for reps_weight
          if (weightTarget) {
            sp.weightKg = weightTarget
          }
        }

        return sp
      })

      // Fallback sets must match primaryMetric
      const fallbackSets: SetPrescription[] =
        def.primaryMetric === 'duration_sec'
          ? [{ durationSec: { kind: 'fixed', value: 30 } }]
          : [{ reps: { kind: 'fixed', value: 8 } }]

      exercises.push({
        exerciseId: def.id,
        order: exIdx,
        sets: sets.length > 0 ? sets : fallbackSets,
        restBetweenSetsSec: clampRest(aiEx.restBetweenSetsSec, def.restDefaultSec || 90),
        restAfterExerciseSec: clampRest(aiEx.restAfterExerciseSec, 120),
        note: aiEx.note?.trim().slice(0, 500) || undefined,
      })
    }

    // Validate restAfterDay — must be 1 or 2
    const restAfterDay: 1 | 2 = aiDay.restAfterDay === 2 ? 2 : 1

    days.push({
      dayNumber: aiDay.dayNumber || days.length + 1,
      exercises,
      restAfterDay,
    })
  }

  // Renumber days sequentially
  days.forEach((d, i) => {
    d.dayNumber = i + 1
  })

  // Validate progression values
  const progression = parsed.plan.progression?.enabled
    ? {
        enabled: true,
        afterCycleComplete: parsed.plan.progression.afterCycleComplete ?? true,
        repsDelta: Math.max(0, Math.min(10, Number(parsed.plan.progression.repsDelta) || 1)),
        weightKgDelta: Math.max(0, Math.min(50, Number(parsed.plan.progression.weightKgDelta) || 2.5)),
        durationSecDelta: Math.max(0, Math.min(300, Number(parsed.plan.progression.durationSecDelta) || 5)),
      }
    : null

  const plan: CustomPlan = {
    id: generateId(),
    name: (parsed.plan.name ?? '').trim().slice(0, 100) || pl.aiPlanFallbackName,
    description: (parsed.plan.description ?? '').trim().slice(0, 500),
    status: 'draft',
    source: 'user',
    days,
    createdAt: now,
    updatedAt: now,
    progression,
    deload: null,
  }

  return {
    plan,
    rationale: parsed.plan.rationale?.trim().slice(0, 1000) ?? '',
    newExercises,
  }
}

/**
 * Fix a set prescription to match the exercise's actual primaryMetric.
 * Used when dedup remaps to an existing exercise with a different metric.
 */
function fixSetForMetric(set: SetPrescription, metric: PrimaryMetric): SetPrescription {
  if (metric === 'duration_sec') {
    if (set.durationSec) return set
    // Convert reps to duration
    if (set.reps) {
      const repValue = set.reps.kind === 'max' ? set.reps.minValue : set.reps.value
      const durValue = Math.max(10, Math.round(repValue * 3))
      return {
        durationSec: set.reps.kind === 'max'
          ? { kind: 'max', minValue: durValue }
          : { kind: set.reps.kind, value: durValue },
      }
    }
    return { durationSec: { kind: 'fixed', value: 30 } }
  }
  // reps or reps_weight
  if (set.reps) return set
  if (set.durationSec) {
    const durValue = set.durationSec.kind === 'max' ? set.durationSec.minValue : set.durationSec.value
    const repValue = Math.max(1, Math.round(durValue / 3))
    return {
      reps: set.durationSec.kind === 'max'
        ? { kind: 'max', minValue: repValue }
        : { kind: set.durationSec.kind, value: repValue },
      ...(set.weightKg ? { weightKg: set.weightKg } : {}),
    }
  }
  return { reps: { kind: 'fixed', value: 8 } }
}

/**
 * Persist a generated plan: save all new exercises to the library, then save the plan.
 * Called only when the user clicks "Import" — not during generation.
 */
export async function commitGeneratedPlan(result: PlanGenerationResult): Promise<CustomPlan> {
  const { plan, newExercises } = result

  // Save all new exercises to the library
  // saveExercise handles dedup — if an exercise with the same name+metric already
  // exists, it returns the existing one and we need to remap the exerciseId in the plan
  const idRemap = new Map<string, string>()

  for (const tempEx of newExercises) {
    try {
      const saved = await saveExercise({
        name: tempEx.name,
        primaryMetric: tempEx.primaryMetric,
        restDefaultSec: tempEx.restDefaultSec,
        muscleGroup: tempEx.muscleGroup,
      })
      // If saveExercise returned a different ID (dedup hit), remap
      if (saved.id !== tempEx.id) {
        idRemap.set(tempEx.id, saved.id)
      }
    } catch {
      // If save fails (e.g. metric locked), try with safe default
      try {
        const saved = await saveExercise({
          name: tempEx.name,
          primaryMetric: 'reps',
          restDefaultSec: tempEx.restDefaultSec,
          muscleGroup: tempEx.muscleGroup,
        })
        if (saved.id !== tempEx.id) {
          idRemap.set(tempEx.id, saved.id)
        }
      } catch {
        // Skip — exercise will be invalid in plan, user can fix in editor
      }
    }
  }

  // Remap exercise IDs in the plan if dedup changed them
  // Also fix set targets if the existing exercise has a different primaryMetric
  if (idRemap.size > 0) {
    // Build a map of remapped exercise IDs → their actual primaryMetric
    const remappedMetrics = new Map<string, PrimaryMetric>()
    for (const tempEx of newExercises) {
      const newId = idRemap.get(tempEx.id)
      if (newId) {
        // Fetch the actual metric from the saved exercise
        const saved = await db.exercises.get(newId)
        if (saved) remappedMetrics.set(newId, saved.primaryMetric)
      }
    }

    for (const day of plan.days) {
      for (const ex of day.exercises) {
        const newId = idRemap.get(ex.exerciseId)
        if (newId) {
          ex.exerciseId = newId
          // Fix set targets if the existing exercise has a different primaryMetric
          const actualMetric = remappedMetrics.get(newId)
          if (actualMetric) {
            // Check if current sets match the metric
            const needsFix =
              (actualMetric === 'duration_sec' && !ex.sets.some((s) => s.durationSec)) ||
              (actualMetric !== 'duration_sec' && !ex.sets.some((s) => s.reps))
            if (needsFix) {
              ex.sets = ex.sets.map((s) => fixSetForMetric(s, actualMetric))
            }
          }
        }
      }
    }
  }

  // Save the plan
  const saved = await saveCustomPlan(plan, { skipValidation: true })
  return saved
}
