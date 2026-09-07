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

  it('keeps local custom plans missing from remote (no pending delete)', async () => {
    // Plans missing from remote are kept — they may have been created locally
    // and not yet pushed. Tombstones handle cross-device deletion.
    mockDb.customPlans.toArray.mockResolvedValue([
      { id: 'local-only', name: 'Draft', updatedAt: '2026-01-01' },
      { id: 'kept', name: 'Keep', updatedAt: '2026-01-01' },
    ])
    await reconcileCustomPlansAfterPull(new Set(['kept']))
    expect(mockDb.customPlans.delete).not.toHaveBeenCalled()
  })

  it('deletes local custom plan when pending delete in queue', async () => {
    mockDb.customPlans.toArray.mockResolvedValue([
      { id: 'doomed', name: 'Old', updatedAt: '2026-01-01' },
    ])
    mockDb.syncQueue.toArray.mockResolvedValue([
      {
        table: 'custom_plans',
        action: 'delete',
        payload: JSON.stringify({ id: 'doomed' }),
      },
    ])
    await reconcileCustomPlansAfterPull(new Set())
    expect(mockDb.customPlans.delete).toHaveBeenCalledWith('doomed')
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

  it('keeps local active custom workout when remote cleared (no pending delete)', async () => {
    // Active workout missing from remote is kept — it may have been started
    // locally and not yet pushed.
    mockDb.activeCustomWorkout.toArray.mockResolvedValue([
      { customPlanId: 'plan-a', sessionId: 's1', updatedAt: '2026-01-01' },
    ])
    await reconcileActiveCustomAfterPull(new Set())
    expect(mockDb.activeCustomWorkout.delete).not.toHaveBeenCalled()
  })

  it('deletes local active custom workout when pending delete in queue', async () => {
    mockDb.activeCustomWorkout.toArray.mockResolvedValue([
      { customPlanId: 'plan-a', sessionId: 's1', updatedAt: '2026-01-01' },
    ])
    mockDb.syncQueue.toArray.mockResolvedValue([
      {
        table: 'active_custom_workout',
        action: 'delete',
        payload: JSON.stringify({ customPlanId: 'plan-a' }),
      },
    ])
    await reconcileActiveCustomAfterPull(new Set())
    expect(mockDb.activeCustomWorkout.delete).toHaveBeenCalledWith('plan-a')
  })

  it('keeps orphan custom progress when plan gone from remote (no pending delete)', async () => {
    // Progress missing from remote is kept — it may have been created locally
    // and not yet pushed.
    mockDb.customProgramProgress.toArray.mockResolvedValue([
      { id: 7, customPlanId: 'local-only-plan' },
    ])
    await reconcileCustomProgressAfterPull(new Set())
    expect(mockDb.customProgramProgress.delete).not.toHaveBeenCalled()
  })

  it('deletes orphan custom progress when pending plan delete in queue', async () => {
    mockDb.customProgramProgress.toArray.mockResolvedValue([
      { id: 7, customPlanId: 'doomed-plan' },
    ])
    mockDb.syncQueue.toArray.mockResolvedValue([
      {
        table: 'custom_plans',
        action: 'delete',
        payload: JSON.stringify({ id: 'doomed-plan' }),
      },
    ])
    await reconcileCustomProgressAfterPull(new Set())
    expect(mockDb.customProgramProgress.delete).toHaveBeenCalledWith(7)
  })
})
