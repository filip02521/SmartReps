import { describe, expect, it } from 'vitest'
import { filterCustomHistorySessions } from '@/lib/custom-history-filters'
import type { LocalWorkoutSession } from '@/lib/db'

function session(partial: Partial<LocalWorkoutSession>): LocalWorkoutSession {
  return {
    id: 's1',
    program: 'custom',
    customPlanId: 'p1',
    cycleId: 'custom:p1',
    cycleAttempt: 1,
    dayNumber: 1,
    status: 'completed',
    passed: true,
    startedAt: '2026-01-01T10:00:00Z',
    completedAt: '2026-01-01T10:30:00Z',
    setResults: [],
    exerciseLogs: [],
    ...partial,
  }
}

describe('filterCustomHistorySessions', () => {
  const rows = [
    session({ id: 'a', customPlanId: 'p1', dayNumber: 1, passed: true }),
    session({ id: 'b', customPlanId: 'p1', dayNumber: 2, passed: false }),
    session({ id: 'c', customPlanId: 'p2', dayNumber: 1, passed: true }),
    session({ id: 'd', customPlanId: 'p1', dayNumber: 1, passed: undefined }),
  ]

  it('filters by plan', () => {
    expect(filterCustomHistorySessions(rows, { planId: 'p2', result: 'all' })).toHaveLength(1)
  })

  it('filters failed including null passed', () => {
    const failed = filterCustomHistorySessions(rows, { planId: 'all', result: 'failed' })
    expect(failed.map((s) => s.id).sort()).toEqual(['b', 'd'])
  })

  it('filters by day number', () => {
    expect(
      filterCustomHistorySessions(rows, {
        planId: 'p1',
        result: 'all',
        dayNumber: 2,
      }),
    ).toHaveLength(1)
  })
})
