import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { NavigateFunction } from 'react-router-dom'

vi.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: vi.fn(),
  },
}))

vi.mock('@/lib/program-service', () => ({
  getProgramProgress: vi.fn(),
}))

import { useAppStore } from '@/stores/app-store'
import { getProgramProgress } from '@/lib/program-service'
import { navigateAfterAuth } from '@/lib/post-auth-navigation'

describe('navigateAfterAuth', () => {
  const navigate = vi.fn() as unknown as NavigateFunction

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears pendingStart and goes home when rest blocks workout', async () => {
    vi.mocked(useAppStore.getState).mockReturnValue({
      setupQueue: [],
      shiftSetupQueue: vi.fn(),
      pendingStart: {
        program: 'pushups',
        cycleId: 'c1',
        cycleName: 'Test',
        reps: 20,
        navigateToWorkout: true,
      },
      clearPendingStart: vi.fn(),
    } as never)
    vi.mocked(getProgramProgress).mockResolvedValue({
      nextWorkoutAfter: new Date(Date.now() + 86400000).toISOString(),
      status: 'rest',
    } as never)

    await navigateAfterAuth(navigate)

    expect(useAppStore.getState().clearPendingStart).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('starts next setup program from queue when not configured', async () => {
    const shiftSetupQueue = vi.fn().mockReturnValue('pullups')
    vi.mocked(useAppStore.getState).mockReturnValue({
      setupQueue: ['pullups'],
      shiftSetupQueue,
      pendingStart: null,
      clearPendingStart: vi.fn(),
    } as never)
    vi.mocked(getProgramProgress).mockResolvedValue(undefined)

    await navigateAfterAuth(navigate)

    expect(shiftSetupQueue).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/setup/test/pullups')
  })
})
