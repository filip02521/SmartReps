import type { CustomPlan, DeloadRule, ProgressionRule, SetPrescription } from '@/lib/exercise-model'

function bumpTarget(
  prescription: SetPrescription,
  rule: ProgressionRule | DeloadRule,
): SetPrescription {
  const next = { ...prescription }
  if (next.reps && rule.repsDelta) {
    if (next.reps.kind === 'max') {
      next.reps = { kind: 'max', minValue: Math.max(0, next.reps.minValue + rule.repsDelta) }
    } else {
      next.reps = { ...next.reps, value: Math.max(0, next.reps.value + rule.repsDelta) }
    }
  }
  if (next.durationSec && rule.durationSecDelta) {
    if (next.durationSec.kind === 'max') {
      next.durationSec = {
        kind: 'max',
        minValue: Math.max(0, next.durationSec.minValue + rule.durationSecDelta),
      }
    } else {
      next.durationSec = {
        ...next.durationSec,
        value: Math.max(0, next.durationSec.value + rule.durationSecDelta),
      }
    }
  }
  if (next.weightKg && rule.weightKgDelta) {
    if (next.weightKg.kind === 'max') {
      next.weightKg = {
        kind: 'max',
        minValue: Math.max(0, next.weightKg.minValue + rule.weightKgDelta),
      }
    } else {
      next.weightKg = {
        ...next.weightKg,
        value: Math.max(0, next.weightKg.value + rule.weightKgDelta),
      }
    }
  }
  return next
}

function effectiveRuleForExercise(
  plan: CustomPlan,
  exerciseProgression: ProgressionRule | null | undefined,
  useDeload: boolean,
): ProgressionRule | DeloadRule | null {
  if (useDeload && plan.deload?.enabled) return plan.deload
  if (exerciseProgression != null) {
    if (!exerciseProgression.enabled) return null
    return exerciseProgression
  }
  const rule = plan.progression
  if (!rule?.enabled) return null
  return rule
}

export type ApplyProgressionOptions = {
  /** Upcoming cycle number after the one just completed. */
  nextCycleAttempt?: number
}

/** Whether the upcoming cycle should use deload instead of progression. */
export function shouldApplyDeload(plan: CustomPlan, nextCycleAttempt: number): boolean {
  const deload = plan.deload
  if (!deload?.enabled || deload.everyNCycles < 2) return false
  return nextCycleAttempt % deload.everyNCycles === 0
}

/** Generate next cycle targets from progression rules (Faza 5 + per-exercise + deload). */
export function applyProgressionToPlan(
  plan: CustomPlan,
  rule: ProgressionRule,
  options?: ApplyProgressionOptions,
): CustomPlan {
  const nextCycle = options?.nextCycleAttempt ?? 1
  const useDeload = shouldApplyDeload(plan, nextCycle)
  const now = new Date().toISOString()
  const planForRules = { ...plan, progression: plan.progression ?? rule }

  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => {
        const effective = effectiveRuleForExercise(planForRules, ex.progression, useDeload)
        if (!effective) return ex
        return {
          ...ex,
          sets: ex.sets.map((s) => bumpTarget(s, effective)),
        }
      }),
    })),
    updatedAt: now,
  }
}

export function previewProgressionDiff(
  plan: CustomPlan,
  rule: ProgressionRule,
  options?: ApplyProgressionOptions,
): { dayNumber: number; exerciseOrder: number; before: SetPrescription[]; after: SetPrescription[] }[] {
  const next = applyProgressionToPlan(plan, rule, options)
  const diffs: {
    dayNumber: number
    exerciseOrder: number
    before: SetPrescription[]
    after: SetPrescription[]
  }[] = []
  for (let di = 0; di < plan.days.length; di++) {
    const beforeDay = plan.days[di]!
    const afterDay = next.days[di]!
    for (let ei = 0; ei < beforeDay.exercises.length; ei++) {
      const before = beforeDay.exercises[ei]!.sets
      const after = afterDay.exercises[ei]!.sets
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        diffs.push({
          dayNumber: beforeDay.dayNumber,
          exerciseOrder: beforeDay.exercises[ei]!.order,
          before,
          after,
        })
      }
    }
  }
  return diffs
}
