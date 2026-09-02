import { describe, expect, it } from 'vitest'
import {
  hasAnyProgramRecords,
  isProgressHistorySession,
  sessionTotalReps,
} from '@/lib/progress-history'
import type { LocalWorkoutSession } from '@/lib/db'

function session(partial: Partial<LocalWorkoutSession>): LocalWorkoutSession {
  return {
    id: 's1',
    program: 'pushups',
    cycleId: 'pushups-6-10',
    dayNumber: 1,
    cycleAttempt: 1,
    status: 'completed',
    startedAt: '2026-08-01T10:00:00.000Z',
    setResults: [],
    ...partial,
  }
}

describe('isProgressHistorySession', () => {
  it('includes completed sessions only', () => {
    expect(isProgressHistorySession(session({ status: 'completed' }))).toBe(true)
    expect(isProgressHistorySession(session({ status: 'in_progress' }))).toBe(false)
    expect(isProgressHistorySession(session({ status: 'abandoned' }))).toBe(false)
  })
})

describe('sessionTotalReps', () => {
  it('prefers totalReps when set', () => {
    expect(sessionTotalReps(session({ totalReps: 40, setResults: [] }))).toBe(40)
  })

  it('sums setResults when totalReps missing', () => {
    expect(
      sessionTotalReps(
        session({
          setResults: [
            { setNumber: 1, target: { kind: 'fixed', reps: 5 }, actual: 10, passed: true },
            { setNumber: 2, target: { kind: 'fixed', reps: 5 }, actual: 8, passed: true },
          ],
        }),
      ),
    ).toBe(18)
  })
})

describe('hasAnyProgramRecords', () => {
  it('returns false when all records are null', () => {
    expect(
      hasAnyProgramRecords({
        bestTest: null,
        bestMaxSet: null,
        bestSessionTotal: null,
        highestCycleName: null,
      }),
    ).toBe(false)
  })

  it('returns true when a secondary record exists', () => {
    expect(
      hasAnyProgramRecords({
        bestTest: null,
        bestMaxSet: 12,
        bestSessionTotal: null,
        highestCycleName: null,
      }),
    ).toBe(true)
  })

  it('ignores bestTest alone (shown in strip, not Rekordy grid)', () => {
    expect(
      hasAnyProgramRecords({
        bestTest: 40,
        bestMaxSet: null,
        bestSessionTotal: null,
        highestCycleName: null,
      }),
    ).toBe(false)
  })
})
