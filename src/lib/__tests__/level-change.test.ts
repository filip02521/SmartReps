import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/program-service', () => ({
  getProgramProgress: vi.fn(),
  initProgramProgress: vi.fn(),
  updateProgramProgress: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    maxTests: {
      where: vi.fn(),
    },
  },
}))

import { getProgramProgress, initProgramProgress, updateProgramProgress } from '@/lib/program-service'
import { db } from '@/lib/db'
import {
  applyLevelChange,
  getLevelChangeVisibleCycles,
  loadLevelChangeContext,
} from '@/lib/level-change'

describe('getLevelChangeVisibleCycles', () => {
  it('returns nearby cycles around current by default', () => {
    const visible = getLevelChangeVisibleCycles('pushups', 'pushups-11-20', false)
    expect(visible.some((c) => c.id === 'pushups-11-20')).toBe(true)
    expect(visible.length).toBeGreaterThan(0)
    expect(visible.length).toBeLessThanOrEqual(getLevelChangeVisibleCycles('pushups', 'pushups-11-20', true).length)
  })

  it('returns all cycles when showAll', () => {
    const all = getLevelChangeVisibleCycles('pushups', 'pushups-11-20', true)
    expect(all.every((c) => c.program === 'pushups')).toBe(true)
    expect(all.length).toBeGreaterThan(3)
  })
})

describe('applyLevelChange', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('switches cycle to day 1 without post-test rest when not resting', async () => {
    vi.mocked(getProgramProgress).mockResolvedValue({
      program: 'pushups',
      cycleId: 'pushups-6-10',
      status: 'active',
      currentDay: 3,
      cycleAttempt: 2,
      nextWorkoutAfter: null,
      lastWorkoutAt: '2026-01-01T00:00:00.000Z',
    } as never)
    vi.mocked(initProgramProgress).mockResolvedValue(undefined as never)
    vi.mocked(updateProgramProgress).mockResolvedValue(undefined as never)

    const result = await applyLevelChange('pushups', 'pushups-21-25')

    expect(result.cycle.id).toBe('pushups-21-25')
    expect(result.status).toBe('active')
    expect(result.preservedRest).toBe(false)
    expect(result.cycleAttempt).toBe(1)
    expect(updateProgramProgress).toHaveBeenCalledWith(
      'pushups',
      expect.objectContaining({
        cycleId: 'pushups-21-25',
        currentDay: 1,
        cycleAttempt: 1,
        status: 'active',
        nextWorkoutAfter: null,
      }),
    )
  })

  it('preserves recovery rest when still blocked', async () => {
    const future = new Date(Date.now() + 36 * 3600_000).toISOString()
    vi.mocked(getProgramProgress).mockResolvedValue({
      program: 'pushups',
      cycleId: 'pushups-6-10',
      status: 'rest',
      currentDay: 2,
      cycleAttempt: 1,
      nextWorkoutAfter: future,
      lastWorkoutAt: '2026-01-01T00:00:00.000Z',
    } as never)
    vi.mocked(initProgramProgress).mockResolvedValue(undefined as never)
    vi.mocked(updateProgramProgress).mockResolvedValue(undefined as never)

    const result = await applyLevelChange('pushups', 'pushups-11-20')

    expect(result.status).toBe('rest')
    expect(result.preservedRest).toBe(true)
    expect(updateProgramProgress).toHaveBeenCalledWith(
      'pushups',
      expect.objectContaining({
        status: 'rest',
        nextWorkoutAfter: future,
        currentDay: 1,
      }),
    )
  })

  it('increments attempt when restarting the same cycle', async () => {
    vi.mocked(getProgramProgress).mockResolvedValue({
      program: 'pushups',
      cycleId: 'pushups-11-20',
      status: 'active',
      currentDay: 4,
      cycleAttempt: 1,
      nextWorkoutAfter: null,
      lastWorkoutAt: null,
    } as never)
    vi.mocked(initProgramProgress).mockResolvedValue(undefined as never)
    vi.mocked(updateProgramProgress).mockResolvedValue(undefined as never)

    const result = await applyLevelChange('pushups', 'pushups-11-20')
    expect(result.cycleAttempt).toBe(2)
  })
})

describe('loadLevelChangeContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null when program has no progress', async () => {
    vi.mocked(getProgramProgress).mockResolvedValue(undefined)
    expect(await loadLevelChangeContext('pushups')).toBeNull()
  })

  it('uses last test for warning baseline when available', async () => {
    vi.mocked(getProgramProgress).mockResolvedValue({
      program: 'pushups',
      cycleId: 'pushups-21-25',
      status: 'active',
      currentDay: 1,
      cycleAttempt: 1,
      nextWorkoutAfter: null,
      lastWorkoutAt: null,
    } as never)
    vi.mocked(db.maxTests.where).mockReturnValue({
      equals: () => ({
        toArray: async () => [
          {
            id: 1,
            program: 'pushups',
            reps: 8,
            testedAt: '2026-01-02T00:00:00.000Z',
            selectedCycleId: 'pushups-6-10',
            wasManualOverride: false,
          },
        ],
      }),
    } as never)

    const ctx = await loadLevelChangeContext('pushups')
    expect(ctx?.currentCycle.id).toBe('pushups-21-25')
    expect(ctx?.lastTestReps).toBe(8)
    expect(ctx?.warningBaseline.id).toBe('pushups-6-10')
  })
})
