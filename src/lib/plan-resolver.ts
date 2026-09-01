import type { Cycle, Program, SetTarget } from '@/data/plans/types'
import { getCycleById } from '@/data/plans'
import type {
  CustomPlan,
  ExerciseDefinition,
  MetricTarget,
  PlannedExercise,
  PlanDay,
  SetPrescription,
} from '@/lib/exercise-model'
import { setTargetToMetricTarget } from '@/lib/exercise-model'

export const BUILTIN_EXERCISE_IDS: Record<Program, string> = {
  pushups: 'builtin:pushups',
  pullups: 'builtin:pullups',
}

export type BuiltinPlanContext = {
  kind: 'builtin'
  program: Program
  cycle: Cycle
}

export type CustomPlanContext = {
  kind: 'custom'
  plan: CustomPlan
  exercises: Map<string, ExerciseDefinition>
}

export type PlanContext = BuiltinPlanContext | CustomPlanContext

export function resolveBuiltin(program: Program, cycleId: string): BuiltinPlanContext | null {
  const cycle = getCycleById(cycleId)
  if (!cycle || cycle.program !== program) return null
  return { kind: 'builtin', program, cycle }
}

export function resolveCustom(
  plan: CustomPlan,
  exercises: ExerciseDefinition[],
): CustomPlanContext {
  return {
    kind: 'custom',
    plan,
    exercises: new Map(exercises.map((e) => [e.id, e])),
  }
}

function legacySetsToPrescriptions(sets: SetTarget[]): SetPrescription[] {
  return sets.map((target) => ({
    reps: setTargetToMetricTarget(target),
  }))
}

/** Unified day view for builtin (single implicit exercise) and custom plans. */
export function getDayPlan(context: PlanContext, dayNumber: number): PlanDay | null {
  if (context.kind === 'builtin') {
    const day = context.cycle.days.find((d) => d.dayNumber === dayNumber)
    if (!day) return null
    const planned: PlannedExercise = {
      exerciseId: BUILTIN_EXERCISE_IDS[context.program],
      order: 0,
      sets: legacySetsToPrescriptions(day.sets),
      restBetweenSetsSec: day.restBetweenSetsSec,
    }
    return {
      dayNumber: day.dayNumber,
      exercises: [planned],
      restAfterDay: day.restAfterDay,
    }
  }

  return context.plan.days.find((d) => d.dayNumber === dayNumber) ?? null
}

export function getBuiltinExerciseDefinition(program: Program): ExerciseDefinition {
  const now = new Date(0).toISOString()
  return {
    id: BUILTIN_EXERCISE_IDS[program],
    name: program === 'pushups' ? 'Pompki' : 'Podciąganie',
    primaryMetric: 'reps',
    restDefaultSec: 90,
    archived: false,
    createdAt: now,
    updatedAt: now,
  }
}

export function metricTargetDisplayValue(target: MetricTarget): number {
  return target.kind === 'max' ? target.minValue : target.value
}
