import {
  allCycles,
  getCycleById,
  getCyclesByProgram,
  pushupCycles,
  pullupCycles,
} from '../src/data/plans/index'
import type { Cycle, CycleLayout, Program } from '../src/data/plans/types'

const LAYOUT_DAY_COUNTS: Record<CycleLayout, number> = {
  standard_6day: 6,
  compact_3day: 3,
  extended_9day: 9,
}

const STANDARD_6_REST_AFTER = [1, 1, 2, 1, 1, 2] as const
const EXTENDED_9_REST_AFTER = [1, 1, 2, 1, 1, 2, 1, 1, 2] as const

type ValidationError = { cycleId: string; message: string }

function validateCycle(cycle: Cycle): ValidationError[] {
  const errors: ValidationError[] = []
  const { id } = cycle

  if (!id.startsWith(`${cycle.program}-`)) {
    errors.push({ cycleId: id, message: `id must start with "${cycle.program}-"` })
  }

  const expectedDays = LAYOUT_DAY_COUNTS[cycle.layout]
  if (cycle.days.length !== expectedDays) {
    errors.push({
      cycleId: id,
      message: `layout "${cycle.layout}" expects ${expectedDays} days, got ${cycle.days.length}`,
    })
  }

  if (cycle.estimatedWeeks[0] > cycle.estimatedWeeks[1]) {
    errors.push({
      cycleId: id,
      message: `estimatedWeeks min (${cycle.estimatedWeeks[0]}) exceeds max (${cycle.estimatedWeeks[1]})`,
    })
  }

  if (cycle.testRange.max !== null && cycle.testRange.min > cycle.testRange.max) {
    errors.push({
      cycleId: id,
      message: `testRange min (${cycle.testRange.min}) exceeds max (${cycle.testRange.max})`,
    })
  }

  const expectedRestAfter =
    cycle.layout === 'extended_9day'
      ? EXTENDED_9_REST_AFTER
      : cycle.layout === 'standard_6day'
        ? STANDARD_6_REST_AFTER
        : null

  cycle.days.forEach((day, index) => {
    const expectedDayNumber = index + 1
    if (day.dayNumber !== expectedDayNumber) {
      errors.push({
        cycleId: id,
        message: `day ${index + 1} has dayNumber ${day.dayNumber}, expected ${expectedDayNumber}`,
      })
    }

    if (day.restBetweenSetsSec <= 0) {
      errors.push({
        cycleId: id,
        message: `day ${day.dayNumber} has invalid restBetweenSetsSec (${day.restBetweenSetsSec})`,
      })
    }

    if (day.restAfterDay !== 1 && day.restAfterDay !== 2) {
      errors.push({
        cycleId: id,
        message: `day ${day.dayNumber} has invalid restAfterDay (${day.restAfterDay})`,
      })
    }

    if (expectedRestAfter && day.restAfterDay !== expectedRestAfter[index]) {
      errors.push({
        cycleId: id,
        message: `day ${day.dayNumber} restAfterDay should be ${expectedRestAfter[index]}, got ${day.restAfterDay}`,
      })
    }

    if (cycle.layout === 'compact_3day' && index > 0) {
      const isPowyzej60Day3 = id === 'pushups-powyzej-60' && index === 2
      const expectedRest = isPowyzej60Day3 ? 35 : 45
      if (day.restBetweenSetsSec !== expectedRest) {
        errors.push({
          cycleId: id,
          message: `compact day ${day.dayNumber} should use ${expectedRest}s rest, got ${day.restBetweenSetsSec}`,
        })
      }
    }

    if (cycle.program === 'pullups' && day.restBetweenSetsSec !== 120) {
      errors.push({
        cycleId: id,
        message: `pullup day ${day.dayNumber} should use 120s rest, got ${day.restBetweenSetsSec}`,
      })
    }

    if (day.sets.length === 0) {
      errors.push({
        cycleId: id,
        message: `day ${day.dayNumber} has no sets`,
      })
    }

    day.sets.forEach((set, setIndex) => {
      if (set.kind === 'fixed' && set.reps <= 0) {
        errors.push({
          cycleId: id,
          message: `day ${day.dayNumber} set ${setIndex + 1} has invalid fixed reps (${set.reps})`,
        })
      }
      if (set.kind === 'max' && set.minReps <= 0) {
        errors.push({
          cycleId: id,
          message: `day ${day.dayNumber} set ${setIndex + 1} has invalid max minReps (${set.minReps})`,
        })
      }
      if (set.kind === 'exact' && set.reps <= 0) {
        errors.push({
          cycleId: id,
          message: `day ${day.dayNumber} set ${setIndex + 1} has invalid exact reps (${set.reps})`,
        })
      }
    })

    const lastSet = day.sets[day.sets.length - 1]
    if (cycle.variant === 'negative' && lastSet?.kind !== 'exact') {
      errors.push({
        cycleId: id,
        message: `negative variant day ${day.dayNumber} last set must be exact`,
      })
    }
  })

  return errors
}

function validateTestRanges(cycles: Cycle[]): ValidationError[] {
  const errors: ValidationError[] = []
  const byProgram = new Map<Program, Cycle[]>()

  for (const cycle of cycles) {
    const group = byProgram.get(cycle.program) ?? []
    group.push(cycle)
    byProgram.set(cycle.program, group)
  }

  for (const [program, programCycles] of byProgram) {
    const sorted = [...programCycles].sort((a, b) => a.level - b.level)

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]
      const next = sorted[i + 1]

      if (current.testRange.max === null) {
        errors.push({
          cycleId: current.id,
          message: `only the final ${program} cycle may have an open-ended testRange`,
        })
      } else if (current.testRange.max >= next.testRange.min) {
        errors.push({
          cycleId: next.id,
          message: `testRange overlaps: previous max (${current.testRange.max}) >= next min (${next.testRange.min}) for ${program}`,
        })
      }
    }

    const last = sorted[sorted.length - 1]
    if (last && last.testRange.max !== null) {
      errors.push({
        cycleId: last.id,
        message: `final ${program} cycle should have open-ended testRange (max: null)`,
      })
    }
  }

  return errors
}

function main(): void {
  const errors: ValidationError[] = []

  if (pushupCycles.length !== 12) {
    errors.push({
      cycleId: 'pushups',
      message: `expected 12 pushup cycles, got ${pushupCycles.length}`,
    })
  }

  if (pullupCycles.length !== 11) {
    errors.push({
      cycleId: 'pullups',
      message: `expected 11 pullup cycles, got ${pullupCycles.length}`,
    })
  }

  const ids = new Set<string>()
  for (const cycle of allCycles) {
    if (ids.has(cycle.id)) {
      errors.push({ cycleId: cycle.id, message: 'duplicate cycle id' })
    }
    ids.add(cycle.id)
    errors.push(...validateCycle(cycle))
  }

  errors.push(...validateTestRanges(allCycles))

  for (const cycle of allCycles) {
    if (getCycleById(cycle.id) !== cycle) {
      errors.push({
        cycleId: cycle.id,
        message: 'getCycleById lookup failed',
      })
    }
    const byProgram = getCyclesByProgram(cycle.program)
    if (!byProgram.some((c) => c.id === cycle.id)) {
      errors.push({
        cycleId: cycle.id,
        message: 'getCyclesByProgram lookup failed',
      })
    }
  }

  if (errors.length > 0) {
    console.error(`Validation failed with ${errors.length} error(s):\n`)
    for (const error of errors) {
      console.error(`  [${error.cycleId}] ${error.message}`)
    }
    process.exit(1)
  }

  console.log(`Validated ${allCycles.length} cycles successfully.`)
  console.log(`  Pushups: ${pushupCycles.length}`)
  console.log(`  Pullups: ${pullupCycles.length}`)
}

main()
