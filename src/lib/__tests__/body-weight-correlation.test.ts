import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { BodyWeightEntry, LocalWorkoutSession } from '@/lib/db'
import { setDrafts } from './test-fixtures'

const entries: BodyWeightEntry[] = []
const sessions: LocalWorkoutSession[] = []

vi.mock('@/lib/db', () => ({
  db: {
    bodyWeight: {
      toArray: async () => entries,
    },
    workoutSessions: {
      toArray: async () => sessions,
    },
  },
}))

vi.mock('@/lib/custom-session-utils', () => ({
  isCustomWorkoutSession: (s: LocalWorkoutSession) => s.program === 'custom',
}))

import { getBodyWeightPerformanceCorrelation } from '@/lib/body-weight-correlation'

beforeEach(() => {
  entries.length = 0
  sessions.length = 0
})

describe('getBodyWeightPerformanceCorrelation', () => {
  it('returns insufficientData when <3 entries', async () => {
    entries.push({ id: '1', weightKg: 70, measuredAt: '2026-01-01T00:00:00.000Z' })
    entries.push({ id: '2', weightKg: 71, measuredAt: '2026-01-02T00:00:00.000Z' })
    sessions.push({
      id: 's1',
      program: 'pushups',
      cycleId: 'c1',
      dayNumber: 1,
      cycleAttempt: 1,
      status: 'completed',
      startedAt: '2026-01-01T10:00:00.000Z',
      setResults: setDrafts([10]),
    })
    const result = await getBodyWeightPerformanceCorrelation()
    expect(result.insufficientData).toBe(true)
    expect(result.correlation).toBeNull()
  })

  it('returns insufficientData when <3 sessions', async () => {
    for (let i = 0; i < 5; i++) {
      entries.push({ id: `e${i}`, weightKg: 70 + i, measuredAt: `2026-01-0${i + 1}T00:00:00.000Z` })
    }
    sessions.push({
      id: 's1',
      program: 'pushups',
      cycleId: 'c1',
      dayNumber: 1,
      cycleAttempt: 1,
      status: 'completed',
      startedAt: '2026-01-01T10:00:00.000Z',
      setResults: setDrafts([10]),
    })
    const result = await getBodyWeightPerformanceCorrelation()
    expect(result.insufficientData).toBe(true)
  })

  it('computes correlation with sufficient data', async () => {
    // 5 entries over 5 weeks, weight increasing, performance increasing
    for (let i = 0; i < 5; i++) {
      const date = new Date(Date.now() - (4 - i) * 7 * 86400000).toISOString()
      entries.push({ id: `e${i}`, weightKg: 70 + i, measuredAt: date })
      sessions.push({
        id: `s${i}`,
        program: 'pushups',
        cycleId: 'c1',
        dayNumber: 1,
        cycleAttempt: 1,
        status: 'completed',
        startedAt: date,
        setResults: setDrafts([10 + i * 2]),
      })
    }
    const result = await getBodyWeightPerformanceCorrelation()
    expect(result.insufficientData).toBe(false)
    expect(result.correlation).not.toBeNull()
    expect(result.trend).toBe('positive')
    expect(result.points.length).toBeGreaterThanOrEqual(3)
  })

  it('ignores sessions outside ±7 day window', async () => {
    entries.push({ id: 'e1', weightKg: 70, measuredAt: '2026-01-01T00:00:00.000Z' })
    entries.push({ id: 'e2', weightKg: 71, measuredAt: '2026-01-08T00:00:00.000Z' })
    entries.push({ id: 'e3', weightKg: 72, measuredAt: '2026-01-15T00:00:00.000Z' })
    // Sessions 30 days away — outside ±7 day window
    sessions.push({
      id: 's1',
      program: 'pushups',
      cycleId: 'c1',
      dayNumber: 1,
      cycleAttempt: 1,
      status: 'completed',
      startedAt: '2026-02-01T10:00:00.000Z',
      setResults: setDrafts([10]),
    })
    sessions.push({
      id: 's2',
      program: 'pushups',
      cycleId: 'c1',
      dayNumber: 1,
      cycleAttempt: 1,
      status: 'completed',
      startedAt: '2026-02-08T10:00:00.000Z',
      setResults: setDrafts([12]),
    })
    sessions.push({
      id: 's3',
      program: 'pushups',
      cycleId: 'c1',
      dayNumber: 1,
      cycleAttempt: 1,
      status: 'completed',
      startedAt: '2026-02-15T10:00:00.000Z',
      setResults: setDrafts([14]),
    })
    const result = await getBodyWeightPerformanceCorrelation()
    expect(result.insufficientData).toBe(true)
  })
})
