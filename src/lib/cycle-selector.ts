import { allCycles } from '@/data/plans'
import type { Cycle, Program } from '@/data/plans/types'

export function selectCycleByTest(program: Program, reps: number): Cycle {
  const cycles = allCycles
    .filter((c) => c.program === program)
    .sort((a, b) => a.level - b.level)

  // Edge case: 5 pushups → 6-10 (gap between ponizej-5 and 6-10)
  if (program === 'pushups' && reps === 5) {
    return cycles.find((c) => c.id === 'pushups-6-10') ?? cycles[0]
  }

  const match = cycles.find(
    (c) =>
      reps >= c.testRange.min &&
      (c.testRange.max === null || reps <= c.testRange.max),
  )

  return match ?? cycles[0]
}

export function isHigherCycle(cycle: Cycle, recommended: Cycle): boolean {
  return cycle.level > recommended.level
}

export function isLowerCycle(cycle: Cycle, recommended: Cycle): boolean {
  return cycle.level < recommended.level
}

export function getRetestOptions(
  program: Program,
  testReps: number,
  currentCycleId: string,
): { recommended: Cycle; alternatives: Cycle[] } {
  const recommended = selectCycleByTest(program, testReps)
  const current = allCycles.find((c) => c.id === currentCycleId)
  const alternatives = allCycles
    .filter((c) => c.program === program && c.id !== recommended.id)
    .sort((a, b) => a.level - b.level)

  if (current && testReps < (current.testRange.min ?? 0)) {
    return {
      recommended: current,
      alternatives: alternatives.filter((c) => c.level <= (current?.level ?? 0)),
    }
  }

  return { recommended, alternatives }
}
