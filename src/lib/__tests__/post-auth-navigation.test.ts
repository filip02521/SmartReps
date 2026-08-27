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
    const shiftSetupQueue = vi.fn()
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

  it('drains already-configured programs from setup queue', async () => {
    const queue = ['pushups', 'pullups']
    const shiftSetupQueue = vi.fn(() => queue.shift())
    vi.mocked(useAppStore.getState).mockImplementation(() => ({
      setupQueue: queue,
      shiftSetupQueue,
      pendingStart: null,
      clearPendingStart: vi.fn(),
    }) as never)
    vi.mocked(getProgramProgress).mockResolvedValue({ status: 'active' } as never)

    await navigateAfterAuth(navigate)

    expect(shiftSetupQueue).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('is single-flight for concurrent callers', async () => {
    let resolveProgress: (v: unknown) => void = () => undefined
    vi.mocked(useAppStore.getState).mockReturnValue({
      setupQueue: [],
      shiftSetupQueue: vi.fn(),
      pendingStart: {
        program: 'pushups',
        cycleId: 'c1',
        cycleName: 'Test',
        reps: 10,
        navigateToWorkout: false,
      },
      clearPendingStart: vi.fn(),
    } as never)
    vi.mocked(getProgramProgress).mockReturnValue(
      new Promise((resolve) => {
        resolveProgress = resolve
      }) as never,
    )

    // pendingStart path doesn't call getProgramProgress when navigateToWorkout is false
    // Use navigateToWorkout true with delayed progress instead
    vi.mocked(useAppStore.getState).mockReturnValue({
      setupQueue: [],
      shiftSetupQueue: vi.fn(),
      pendingStart: {
        program: 'pushups',
        cycleId: 'c1',
        cycleName: 'Test',
        reps: 10,
        navigateToWorkout: true,
      },
      clearPendingStart: vi.fn(),
    } as never)

    const p1 = navigateAfterAuth(navigate)
    const p2 = navigateAfterAuth(navigate)
    resolveProgress({
      nextWorkoutAfter: null,
      status: 'active',
    })
    await Promise.all([p1, p2])
    expect(navigate).toHaveBeenCalledTimes(1)
  })
})
