import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { LocalWorkoutSession } from '@/lib/db'
import { builtinSession } from './test-fixtures'

const sessions: LocalWorkoutSession[] = []

vi.mock('@/lib/db', () => ({
  db: {
    workoutSessions: {
      where: () => ({
        equals: () => ({
          filter: (fn: (s: LocalWorkoutSession) => boolean) => ({
            toArray: async () => sessions.filter(fn),
          }),
        }),
      }),
    },
  },
}))

vi.mock('@/data/plans', () => ({
  getCycleById: () => undefined,
}))

import { getWeeklyVolumeChart } from '@/lib/stats-engine'

beforeEach(() => {
  sessions.length = 0
})

describe('getWeeklyVolumeChart', () => {
  it('returns 12 weeks by default', async () => {
    const points = await getWeeklyVolumeChart('pushups')
    expect(points).toHaveLength(12)
  })

  it('returns requested number of weeks', async () => {
    const points = await getWeeklyVolumeChart('pushups', 4)
    expect(points).toHaveLength(4)
  })

  it('aggregates volume per week', async () => {
    const now = new Date().toISOString()
    sessions.push(builtinSession('s1', now, 20, [10, 10]))
    sessions.push(builtinSession('s2', now, 30, [15, 15]))
    const points = await getWeeklyVolumeChart('pushups', 4)
    const lastWeek = points[points.length - 1]
    expect(lastWeek!.volume).toBe(50) // 20 + 30
  })

  it('returns zero volume for weeks without sessions', async () => {
    const points = await getWeeklyVolumeChart('pushups', 4)
    expect(points.every((p) => p.volume === 0)).toBe(true)
  })

  it('ignores incomplete sessions', async () => {
    const now = new Date().toISOString()
    const s = builtinSession('s1', now, 20, [10, 10])
    s.status = 'in_progress'
    sessions.push(s)
    const points = await getWeeklyVolumeChart('pushups', 4)
    expect(points.every((p) => p.volume === 0)).toBe(true)
  })

  it('generates week labels', async () => {
    const points = await getWeeklyVolumeChart('pushups', 4)
    expect(points.every((p) => p.weekLabel.length > 0)).toBe(true)
    expect(points.every((p) => p.weekKey.match(/^\d{4}-\d{2}-\d{2}$/))).toBe(true)
  })
})
