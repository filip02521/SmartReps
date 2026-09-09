import { describe, it, expect } from 'vitest'
import { getRetestOptions, isHigherCycle, isLowerCycle, selectCycleByTest } from '@/lib/cycle-selector'
import { getCycleById, squatCycles } from '@/data/plans'

describe('getRetestOptions', () => {
  it('recommends matched lower cycle when test score dropped below current', () => {
    const opts = getRetestOptions('pushups', 8, 'pushups-21-25')
    expect(opts.recommended.id).toBe('pushups-6-10')
    expect(opts.alternatives.some((c) => c.id === 'pushups-21-25')).toBe(true)
  })

  it('recommends matched cycle on improvement', () => {
    const opts = getRetestOptions('pullups', 12, 'pullups-4-5')
    expect(opts.recommended.id).toBe('pullups-12-15')
  })

  it('includes alternatives from same program', () => {
    const opts = getRetestOptions('pushups', 20, 'pushups-6-10')
    expect(opts.alternatives.every((c) => c.program === 'pushups')).toBe(true)
    expect(opts.alternatives.some((c) => c.id === opts.recommended.id)).toBe(false)
  })
})

describe('cycle ordering helpers', () => {
  it('detects higher and lower cycles', () => {
    const low = getCycleById('pushups-6-10')!
    const high = getCycleById('pushups-21-25')!
    expect(isHigherCycle(high, low)).toBe(true)
    expect(isLowerCycle(low, high)).toBe(true)
  })
})

describe('selectCycleByTest — squats', () => {
  it('selects first cycle for 1 rep', () => {
    const cycle = selectCycleByTest('squats', 1)
    expect(cycle.id).toBe('squats-1-20')
  })

  it('selects first cycle at boundary 20', () => {
    const cycle = selectCycleByTest('squats', 20)
    expect(cycle.id).toBe('squats-1-20')
  })

  it('selects second cycle at boundary 21', () => {
    const cycle = selectCycleByTest('squats', 21)
    expect(cycle.id).toBe('squats-21-40')
  })

  it('selects final cycle at 300', () => {
    const cycle = selectCycleByTest('squats', 300)
    expect(cycle.id).toBe('squats-291-300')
  })

  it('selects final cycle above 300', () => {
    const cycle = selectCycleByTest('squats', 500)
    expect(cycle.id).toBe('squats-291-300')
  })

  it('selects seven-set cycle at 221', () => {
    const cycle = selectCycleByTest('squats', 221)
    expect(cycle.id).toBe('squats-221-240')
    // 7 sets = 6 fixed + 1 max
    expect(cycle.days[0].sets.length).toBe(7)
  })

  it('selects five-set cycle at 220', () => {
    const cycle = selectCycleByTest('squats', 220)
    expect(cycle.id).toBe('squats-201-220')
    // 5 sets = 4 fixed + 1 max
    expect(cycle.days[0].sets.length).toBe(5)
  })
})

describe('squat cycle data integrity', () => {
  it('has all 15 squat cycles', () => {
    // squatCycles imported at top
    expect(squatCycles.length).toBe(15)
  })

  it('all squat cycles use 60s rest between sets', () => {
    // squatCycles imported at top
    for (const cycle of squatCycles) {
      for (const day of cycle.days) {
        expect(day.restBetweenSetsSec).toBe(60)
      }
    }
  })

  it('cycles 1-10 use 5 sets (4 fixed + 1 max)', () => {
    // squatCycles imported at top
    for (let i = 0; i < 10; i++) {
      const cycle = squatCycles[i]
      for (const day of cycle.days) {
        expect(day.sets.length).toBe(5)
      }
    }
  })

  it('cycles 11-15 use 7 sets (6 fixed + 1 max)', () => {
    // squatCycles imported at top
    for (let i = 10; i < 15; i++) {
      const cycle = squatCycles[i]
      for (const day of cycle.days) {
        expect(day.sets.length).toBe(7)
      }
    }
  })

  it('last set of every squat day is max with minReps > 0', () => {
    // squatCycles imported at top
    for (const cycle of squatCycles) {
      for (const day of cycle.days) {
        const lastSet = day.sets[day.sets.length - 1]
        expect(lastSet.kind).toBe('max')
        if (lastSet.kind === 'max') {
          expect(lastSet.minReps).toBeGreaterThan(0)
        }
      }
    }
  })
})
