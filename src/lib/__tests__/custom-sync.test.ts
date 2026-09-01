import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  customPlans: {
    toArray: vi.fn(),
    delete: vi.fn(),
  },
  customProgramProgress: {
    toArray: vi.fn(),
    where: vi.fn(),
    delete: vi.fn(),
  },
  activeCustomWorkout: {
    toArray: vi.fn(),
    delete: vi.fn(),
  },
  syncQueue: {
    toArray: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/lib/db', () => ({ db: mockDb }))

import {
  reconcileCustomPlansAfterPull,
  reconcileActiveCustomAfterPull,
  reconcileCustomProgressAfterPull,
} from '@/lib/custom-sync'

describe('custom sync reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.syncQueue.toArray.mockResolvedValue([])
    mockDb.customProgramProgress.where.mockReturnValue({
      equals: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(undefined),
      })),
    })
  })

  it('removes local custom plans missing from remote', async () => {
    mockDb.customPlans.toArray.mockResolvedValue([
      { id: 'gone', name: 'Old', updatedAt: '2026-01-01' },
      { id: 'kept', name: 'Keep', updatedAt: '2026-01-01' },
    ])
    await reconcileCustomPlansAfterPull(new Set(['kept']))
    expect(mockDb.customPlans.delete).toHaveBeenCalledWith('gone')
    expect(mockDb.customPlans.delete).not.toHaveBeenCalledWith('kept')
  })

  it('removes local active custom workout when remote cleared', async () => {
    mockDb.activeCustomWorkout.toArray.mockResolvedValue([
      { customPlanId: 'plan-a', sessionId: 's1', updatedAt: '2026-01-01' },
    ])
    await reconcileActiveCustomAfterPull(new Set())
    expect(mockDb.activeCustomWorkout.delete).toHaveBeenCalledWith('plan-a')
  })

  it('skips plan delete when pending upsert in queue', async () => {
    mockDb.customPlans.toArray.mockResolvedValue([{ id: 'new-local', name: 'Draft' }])
    mockDb.syncQueue.toArray.mockResolvedValue([
      {
        table: 'custom_plans',
        action: 'insert',
        payload: JSON.stringify({ id: 'new-local' }),
      },
    ])
    await reconcileCustomPlansAfterPull(new Set())
    expect(mockDb.customPlans.delete).not.toHaveBeenCalled()
  })

  it('removes orphan custom progress when plan gone from remote', async () => {
    mockDb.customProgramProgress.toArray.mockResolvedValue([
      { id: 7, customPlanId: 'gone-plan' },
    ])
    await reconcileCustomProgressAfterPull(new Set())
    expect(mockDb.customProgramProgress.delete).toHaveBeenCalledWith(7)
  })
})
