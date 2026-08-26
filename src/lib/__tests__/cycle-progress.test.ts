import { describe, it, expect } from 'vitest'
import { getCycleDayStatus, getCompletedDaysInCycle } from '@/lib/cycle-progress'
import type { LocalProgramProgress } from '@/lib/db'

const baseProgress = (overrides: Partial<LocalProgramProgress>): LocalProgramProgress => ({
  program: 'pushups',
  cycleId: 'pushups-6-10',
  currentDay: 3,
  status: 'rest',
  cycleAttempt: 1,
  lastWorkoutAt: null,
  nextWorkoutAfter: null,
  updatedAt: new Date().toISOString(),
  ...overrides,
})

describe('cycle-progress', () => {
  it('marks all days completed when test_pending', () => {
    const progress = baseProgress({ status: 'test_pending', currentDay: 1 })
    expect(getCycleDayStatus(progress, 1, 6)).toBe('completed')
    expect(getCycleDayStatus(progress, 6, 6)).toBe('completed')
    expect(getCompletedDaysInCycle(progress, { days: [{ dayNumber: 1 }, { dayNumber: 2 }, { dayNumber: 3 }] } as never)).toBe(3)
  })

  it('tracks current and completed days during active cycle', () => {
    const progress = baseProgress({ currentDay: 3 })
    expect(getCycleDayStatus(progress, 2, 6)).toBe('completed')
    expect(getCycleDayStatus(progress, 3, 6)).toBe('current')
    expect(getCycleDayStatus(progress, 4, 6)).toBe('future')
    expect(getCompletedDaysInCycle(progress, { days: Array.from({ length: 6 }, (_, i) => ({ dayNumber: i + 1 })) } as never)).toBe(2)
  })
})
