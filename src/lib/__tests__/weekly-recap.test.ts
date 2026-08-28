import { describe, expect, it } from 'vitest'
import { startOfWeek, subWeeks } from 'date-fns'
import {
  buildActivityInsights,
  computeBestStreakWeeks,
  computeRepsChangePct,
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

describe('computeRepsChangePct', () => {
  it('returns rounded percent change', () => {
    expect(computeRepsChangePct(150, 100)).toBe(50)
    expect(computeRepsChangePct(75, 100)).toBe(-25)
    expect(computeRepsChangePct(100, 100)).toBe(0)
  })

  it('returns null when previous period had zero reps', () => {
    expect(computeRepsChangePct(50, 0)).toBeNull()
    expect(computeRepsChangePct(0, 0)).toBeNull()
  })
})

describe('buildActivityInsights', () => {
  it('compares current 14d window with previous 14d', () => {
    const now = new Date('2026-03-15T12:00:00')
    const sessions = [
      session({ id: 'recent', startedAt: '2026-03-10T10:00:00.000Z', totalReps: 60 }),
      session({ id: 'recent2', startedAt: '2026-03-12T10:00:00.000Z', totalReps: 40 }),
      session({ id: 'old', startedAt: '2026-02-20T10:00:00.000Z', totalReps: 50 }),
    ]
    const insights = buildActivityInsights(sessions, now)
    expect(insights.sessions14d).toBe(2)
    expect(insights.reps14d).toBe(100)
    expect(insights.sessionsPrev14d).toBe(1)
    expect(insights.repsPrev14d).toBe(50)
    expect(insights.repsChangePct).toBe(100)
    expect(insights.sessionsDelta14d).toBe(1)
  })

  it('handles zero reps after an active prior window', () => {
    const now = new Date('2026-03-15T12:00:00')
    const sessions = [
      session({ id: 'old', startedAt: '2026-02-25T10:00:00.000Z', totalReps: 80 }),
    ]
    const insights = buildActivityInsights(sessions, now)
    expect(insights.reps14d).toBe(0)
    expect(insights.repsPrev14d).toBe(80)
    expect(insights.repsChangePct).toBe(-100)
  })
})

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
