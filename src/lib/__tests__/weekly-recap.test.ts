import { describe, expect, it } from 'vitest'
import { startOfWeek, subWeeks } from 'date-fns'
import {
  computeBestStreakWeeks,
  daysSinceLastPassedSession,
} from '@/lib/weekly-recap'
import type { LocalWorkoutSession } from '@/lib/db'

function session(partial: Partial<LocalWorkoutSession> & Pick<LocalWorkoutSession, 'startedAt'>): LocalWorkoutSession {
  return {
    id: partial.id ?? 's1',
    program: 'pushups',
    cycleId: 'pushups-6-10',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'completed',
    passed: true,
    totalReps: 30,
    setResults: [],
    ...partial,
  }
}

describe('daysSinceLastPassedSession', () => {
  it('returns null when no sessions', () => {
    expect(daysSinceLastPassedSession([])).toBeNull()
  })

  it('counts calendar days since last passed', () => {
    const now = new Date('2026-03-10T12:00:00')
    const sessions = [session({ startedAt: '2026-03-01T10:00:00.000Z' })]
    expect(daysSinceLastPassedSession(sessions, now)).toBe(9)
  })
})

describe('computeBestStreakWeeks', () => {
  it('finds longest consecutive ISO weeks', () => {
    const mon1 = startOfWeek(new Date('2026-01-12'), { weekStartsOn: 1 })
    const mon2 = startOfWeek(subWeeks(mon1, 1), { weekStartsOn: 1 })
    const mon4 = startOfWeek(subWeeks(mon1, 3), { weekStartsOn: 1 })
    const sessions = [
      session({ id: 'a', startedAt: mon1.toISOString() }),
      session({ id: 'b', startedAt: mon2.toISOString() }),
      session({ id: 'c', startedAt: mon4.toISOString() }),
    ]
    expect(computeBestStreakWeeks(sessions)).toBe(2)
  })
})
