import { describe, expect, it } from 'vitest'
import { shouldPreferLocalProgress } from '@/lib/progress-sync-merge'
import type { LocalProgramProgress } from '@/lib/db'
import type { RemoteProgressRow } from '@/lib/sync-mappers'

const baseLocal: LocalProgramProgress = {
  program: 'pushups',
  cycleId: 'pushups-6-10',
  currentDay: 3,
  status: 'rest',
  cycleAttempt: 1,
  lastWorkoutAt: '2026-03-01T10:00:00.000Z',
  nextWorkoutAfter: '2026-03-02T10:00:00.000Z',
  updatedAt: '2026-03-01T10:00:00.000Z',
}

const baseRemote: RemoteProgressRow = {
  program: 'pushups',
  cycle_id: 'pushups-6-10',
  current_day: 4,
  status: 'rest',
  cycle_attempt: 1,
  last_workout_at: '2026-03-01T11:00:00.000Z',
  next_workout_after: '2026-03-02T11:00:00.000Z',
  updated_at: '2026-03-01T11:00:00.000Z',
}

describe('shouldPreferLocalProgress', () => {
  it('prefers remote when local day is behind in same cycle', () => {
    expect(shouldPreferLocalProgress(baseLocal, baseRemote)).toBe(false)
  })

  it('prefers local when local day is ahead even if updatedAt is older (pause bump)', () => {
    const local: LocalProgramProgress = {
      ...baseLocal,
      currentDay: 5,
      updatedAt: '2026-03-01T09:00:00.000Z',
    }
    const remote: RemoteProgressRow = {
      ...baseRemote,
      current_day: 4,
      updated_at: '2026-03-01T11:00:00.000Z',
    }
    expect(shouldPreferLocalProgress(local, remote)).toBe(true)
  })

  it('prefers newer updatedAt when cycle context differs', () => {
    const local: LocalProgramProgress = {
      ...baseLocal,
      cycleId: 'pushups-11-15',
      currentDay: 1,
      updatedAt: '2026-03-02T12:00:00.000Z',
    }
    const remote: RemoteProgressRow = {
      ...baseRemote,
      cycle_id: 'pushups-6-10',
      current_day: 10,
      updated_at: '2026-03-01T08:00:00.000Z',
    }
    expect(shouldPreferLocalProgress(local, remote)).toBe(true)
  })

  it('prefers local when no remote row exists', () => {
    expect(shouldPreferLocalProgress(baseLocal, null)).toBe(true)
  })

  it('prefers remote when local has newer updatedAt but lower day (stale device pause)', () => {
    const local: LocalProgramProgress = {
      ...baseLocal,
      currentDay: 3,
      updatedAt: '2026-03-02T12:00:00.000Z',
    }
    const remote: RemoteProgressRow = {
      ...baseRemote,
      current_day: 4,
      updated_at: '2026-03-01T10:00:00.000Z',
    }
    expect(shouldPreferLocalProgress(local, remote)).toBe(false)
  })

  it('prefers remote when same day but remote updatedAt is newer', () => {
    const local: LocalProgramProgress = {
      ...baseLocal,
      status: 'active',
      updatedAt: '2026-03-01T09:00:00.000Z',
    }
    const remote: RemoteProgressRow = {
      ...baseRemote,
      current_day: 3,
      status: 'rest',
      updated_at: '2026-03-01T11:00:00.000Z',
    }
    expect(shouldPreferLocalProgress(local, remote)).toBe(false)
  })
})
