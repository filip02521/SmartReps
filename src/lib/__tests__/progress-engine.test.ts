import { describe, it, expect } from 'vitest'
import {
  validateSet,
  getNextWorkoutDate,
  getCelebrationBadge,
} from '@/lib/progress-engine'
import { selectCycleByTest } from '@/lib/cycle-selector'

describe('progress-engine', () => {
  it('validates fixed sets', () => {
    expect(validateSet({ kind: 'fixed', reps: 9 }, 9)).toBe(true)
    expect(validateSet({ kind: 'fixed', reps: 9 }, 8)).toBe(false)
  })

  it('validates max sets', () => {
    expect(validateSet({ kind: 'max', minReps: 10 }, 12)).toBe(true)
    expect(validateSet({ kind: 'max', minReps: 10 }, 9)).toBe(false)
  })

  it('validates exact sets with >=', () => {
    expect(validateSet({ kind: 'exact', reps: 7 }, 7)).toBe(true)
    expect(validateSet({ kind: 'exact', reps: 7 }, 8)).toBe(true)
    expect(validateSet({ kind: 'exact', reps: 7 }, 6)).toBe(false)
  })

  it('calculates next workout date', () => {
    const last = new Date('2026-08-26')
    const next = getNextWorkoutDate(last, 1)
    expect(next.getDate()).toBe(28)
  })

  it('celebration badges', () => {
    expect(getCelebrationBadge('pushups', 100)).toContain('100')
    expect(getCelebrationBadge('pullups', 30)).toContain('główny')
    expect(getCelebrationBadge('pullups', 50)).toContain('ambicji')
  })
})

describe('cycle-selector', () => {
  it('maps pushups 5 to 6-10', () => {
    const c = selectCycleByTest('pushups', 5)
    expect(c.id).toBe('pushups-6-10')
  })

  it('maps pushups 0 to ponizej-5', () => {
    const c = selectCycleByTest('pushups', 0)
    expect(c.id).toBe('pushups-ponizej-5')
  })

  it('maps pullups 5 to 4-5', () => {
    const c = selectCycleByTest('pullups', 5)
    expect(c.id).toBe('pullups-4-5')
  })
})
