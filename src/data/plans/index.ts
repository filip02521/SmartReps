import type { Cycle, Program } from './types'
import { pushupCycles } from './pushups'
import { pullupCycles } from './pullups'

export type { Cycle, CycleLayout, Program, SetTarget, TrainingDay } from './types'

export { pushupCycles } from './pushups'
export { pullupCycles } from './pullups'

export const allCycles: Cycle[] = [...pushupCycles, ...pullupCycles]

export function getCycleById(id: string): Cycle | undefined {
  return allCycles.find((cycle) => cycle.id === id)
}

export function getCyclesByProgram(program: Program): Cycle[] {
  return allCycles.filter((cycle) => cycle.program === program)
}
