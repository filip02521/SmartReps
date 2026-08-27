import { getCycleById, getCyclesByProgram } from '@/data/plans'
import { selectCycleByTest } from '@/lib/cycle-selector'
import { db } from '@/lib/db'
import { isWorkoutAvailable } from '@/lib/progress-engine'
import { getProgramProgress, initProgramProgress, updateProgramProgress } from '@/lib/program-service'
import type { Cycle, Program } from '@/data/plans/types'

export type LevelChangeContext = {
  currentCycle: Cycle
  lastTestReps: number | null
  /** Baseline for higher-level warning: last-test recommendation or current cycle. */
  warningBaseline: Cycle
}

/** Load current cycle + optional last max-test context for manual level change. */
export async function loadLevelChangeContext(program: Program): Promise<LevelChangeContext | null> {
  const progress = await getProgramProgress(program)
  if (!progress) return null

  const currentCycle = getCycleById(progress.cycleId)
  if (!currentCycle) return null

  const tests = await db.maxTests.where('program').equals(program).toArray()
  const last = tests
    .slice()
    .sort((a, b) => b.testedAt.localeCompare(a.testedAt))[0]

  const lastTestReps = last?.reps ?? null
  const fromTest = lastTestReps != null ? selectCycleByTest(program, lastTestReps) : null
  const warningBaseline = fromTest ?? currentCycle

  return { currentCycle, lastTestReps, warningBaseline }
}

export type ApplyLevelChangeResult = {
  cycle: Cycle
  status: 'active' | 'rest'
  nextWorkoutAfter: string | null
  cycleAttempt: number
  preservedRest: boolean
}

/**
 * Switch cycle without a new max test.
 * - Resets to day 1 of the selected cycle
 * - Does NOT write max_tests
 * - Does NOT apply artificial 2-day post-test rest
 * - Preserves an existing recovery rest gate if still active
 */
export async function applyLevelChange(
  program: Program,
  selectedCycleId: string,
): Promise<ApplyLevelChangeResult> {
  const selected = getCycleById(selectedCycleId)
  if (!selected || selected.program !== program) {
    throw new Error('invalid_cycle')
  }

  const existing = await getProgramProgress(program)
  if (!existing) {
    throw new Error('no_progress')
  }

  await initProgramProgress(program, selected.id)

  const stillResting =
    !!existing.nextWorkoutAfter &&
    !isWorkoutAvailable(new Date(existing.nextWorkoutAfter))

  const sameCycle = selected.id === existing.cycleId
  const cycleAttempt = sameCycle ? (existing.cycleAttempt ?? 0) + 1 : 1

  const nextWorkoutAfter = stillResting ? existing.nextWorkoutAfter : null
  const status = stillResting ? 'rest' : 'active'

  await updateProgramProgress(program, {
    cycleId: selected.id,
    status,
    currentDay: 1,
    cycleAttempt,
    nextWorkoutAfter,
  })

  return {
    cycle: selected,
    status,
    nextWorkoutAfter,
    cycleAttempt,
    preservedRest: stillResting,
  }
}

/** Cycles to show first for a level change (current + nearby), rest via “show all”. */
export function getLevelChangeVisibleCycles(
  program: Program,
  currentCycleId: string,
  showAll: boolean,
): Cycle[] {
  const cycles = getCyclesByProgram(program)
  if (showAll) return cycles

  const current = cycles.find((c) => c.id === currentCycleId)
  if (!current) return cycles.slice(0, 4)

  const nearby = cycles.filter(
    (c) => Math.abs(c.level - current.level) <= 1 || c.id === currentCycleId,
  )
  return nearby.length ? nearby : cycles.slice(0, 4)
}
