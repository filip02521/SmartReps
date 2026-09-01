import type { CustomPlan, ProgressionRule, SetPrescription } from '@/lib/exercise-model'

function bumpTarget(
  prescription: SetPrescription,
  rule: ProgressionRule,
): SetPrescription {
  const next = { ...prescription }
  if (next.reps && rule.repsDelta) {
    if (next.reps.kind === 'max') {
      next.reps = { kind: 'max', minValue: next.reps.minValue + rule.repsDelta }
    } else {
      next.reps = { ...next.reps, value: next.reps.value + rule.repsDelta }
    }
  }
  if (next.durationSec && rule.durationSecDelta) {
    if (next.durationSec.kind === 'max') {
      next.durationSec = {
        kind: 'max',
        minValue: next.durationSec.minValue + rule.durationSecDelta,
      }
    } else {
      next.durationSec = {
        ...next.durationSec,
        value: next.durationSec.value + rule.durationSecDelta,
      }
    }
  }
  if (next.weightKg && rule.weightKgDelta) {
    if (next.weightKg.kind === 'max') {
      next.weightKg = {
        kind: 'max',
        minValue: next.weightKg.minValue + rule.weightKgDelta,
      }
    } else {
      next.weightKg = {
        ...next.weightKg,
        value: next.weightKg.value + rule.weightKgDelta,
      }
    }
  }
  return next
}

/** Generate next cycle targets from progression rules (Faza 5). */
export function applyProgressionToPlan(plan: CustomPlan, rule: ProgressionRule): CustomPlan {
  if (!rule.enabled) return plan
  const now = new Date().toISOString()
  return {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      exercises: day.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => bumpTarget(s, rule)),
      })),
    })),
    updatedAt: now,
  }
}

export function previewProgressionDiff(
  plan: CustomPlan,
  rule: ProgressionRule,
): { dayNumber: number; exerciseOrder: number; before: SetPrescription[]; after: SetPrescription[] }[] {
  const next = applyProgressionToPlan(plan, rule)
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
      diffs.push({
        dayNumber: beforeDay.dayNumber,
        exerciseOrder: beforeDay.exercises[ei]!.order,
        before,
        after,
      })
    }
  }
  return diffs
}
