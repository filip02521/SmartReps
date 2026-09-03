import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { LocalWorkoutSession, LocalMaxTest } from '@/lib/db'

const sessions: LocalWorkoutSession[] = []
const tests: LocalMaxTest[] = []

vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      where: () => ({
        equals: () => ({
          toArray: async () => sessions,
          filter: () => ({
            toArray: async () => sessions,
          }),
        }),
      }),
    },
    maxTests: {
      where: () => ({
        equals: () => ({
          toArray: async () => tests,
        }),
      }),
    },
  },
}))

vi.mock('@/data/plans', () => ({
  getCycleById: () => undefined,
}))

import {
  getMaxSetPerSession,
  getProgramRecordsWithDates,
  getProgramVolumeStats,
  getDayCycleTrend,
} from '@/lib/stats-engine'

function session(
  id: string,
  daysAgo: number,
  dayNumber: number,
  lastSetActual: number,
  totalReps: number,
  cycleAttempt = 1,
  passed = true,
): LocalWorkoutSession {
  const at = new Date(Date.now() - daysAgo * 86400000).toISOString()
  return {
    id,
    program: 'pushups',
    cycleId: 'pushups-1-1',
    cycleAttempt,
    dayNumber,
    status: 'completed',
    passed,
    startedAt: at,
    completedAt: at,
    totalReps,
    setResults: [
      { setNumber: 1, target: { kind: 'fixed', reps: 8 }, actual: 8, passed: true },
      { setNumber: 2, target: { kind: 'fixed', reps: 8 }, actual: lastSetActual, passed: true },
    ],
  }
}

describe('stats-engine — progress functions', () => {
  beforeEach(() => {
    sessions.length = 0
    tests.length = 0
  })

  it('getMaxSetPerSession returns last-set actual per session chronologically', async () => {
    sessions.push(session('s1', 10, 1, 8, 16))
    sessions.push(session('s2', 5, 2, 10, 18))
    const points = await getMaxSetPerSession('pushups')
    expect(points).toHaveLength(2)
    expect(points[0]!.value).toBe(8)
    expect(points[1]!.value).toBe(10)
    expect(points[0]!.date < points[1]!.date).toBe(true)
  })

  it('getProgramRecordsWithDates dates each record', async () => {
    sessions.push(session('s1', 10, 1, 8, 16))
    sessions.push(session('s2', 5, 2, 12, 24))
    tests.push({
      id: 1,
      program: 'pushups',
      reps: 15,
      testedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      selectedCycleId: 'pushups-1-1',
      wasManualOverride: false,
    })
    const rec = await getProgramRecordsWithDates('pushups')
    expect(rec.bestTest).toBe(15)
    expect(rec.bestTestDate).toBeTruthy()
    expect(rec.bestMaxSet).toBe(12)
    expect(rec.bestMaxSetDate).toBe(sessions[1]!.completedAt!)
    expect(rec.bestSessionTotal).toBe(24)
    expect(rec.bestSessionTotalDate).toBe(sessions[1]!.completedAt!)
  })

  it('getProgramVolumeStats computes 14d volume and avg', async () => {
    sessions.push(session('s1', 5, 1, 8, 16))
    sessions.push(session('s2', 1, 2, 10, 20))
    sessions.push(session('s3', 20, 1, 6, 12)) // outside 14d
    const v = await getProgramVolumeStats('pushups')
    expect(v.volume14d).toBe(36) // 16 + 20
    expect(v.avgRepsPerSession).toBe(16) // (16+20+12)/3 = 16
    expect(v.sessionsLast30d).toBe(3) // all three within 30d (s3 at 20d)
  })

  it('getDayCycleTrend compares current vs previous attempt', async () => {
    sessions.push(session('s1', 20, 1, 8, 16, 1)) // prev attempt
    sessions.push(session('s2', 5, 1, 10, 20, 2)) // current attempt
    const trend = await getDayCycleTrend('pushups', 'pushups-1-1', 2)
    expect(trend).toHaveLength(1)
    expect(trend[0]!.dayNumber).toBe(1)
    expect(trend[0]!.previous).toBe(8)
    expect(trend[0]!.current).toBe(10)
    expect(trend[0]!.delta).toBe(2)
  })
})
