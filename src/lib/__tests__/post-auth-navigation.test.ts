import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { NavigateFunction } from 'react-router-dom'

vi.mock('@/stores/app-store', () => ({
  useAppStore: Object.assign(
    vi.fn(),
    {
      getState: vi.fn(),
      persist: {
        hasHydrated: () => true,
        onFinishHydration: () => () => undefined,
      },
    },
  ),
}))

vi.mock('@/lib/program-service', () => ({
  getProgramProgress: vi.fn(),
  getActiveWorkout: vi.fn(),
  clearActiveWorkout: vi.fn(),
}))

import { useAppStore } from '@/stores/app-store'
import { getProgramProgress } from '@/lib/program-service'
import { navigateAfterAuth } from '@/lib/post-auth-navigation'

function mockState(partial: Record<string, unknown>) {
  vi.mocked(useAppStore.getState).mockReturnValue({
    settings: { enabledPrograms: ['pushups', 'pullups'], onboardingComplete: true },
    setupQueue: [],
    setSetupQueue: vi.fn(),
    shiftSetupQueue: vi.fn(),
    pendingStart: null,
    clearPendingStart: vi.fn(),
    ...partial,
  } as never)
}

describe('navigateAfterAuth', () => {
  const navigate = vi.fn() as unknown as NavigateFunction

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('clears pendingStart and goes home when rest blocks workout', async () => {
    mockState({
      pendingStart: {
        program: 'pushups',
        cycleId: 'c1',
        cycleName: 'Test',
        reps: 20,
        navigateToWorkout: true,
      },
      clearPendingStart: vi.fn(),
    })
    vi.mocked(getProgramProgress).mockResolvedValue({
      nextWorkoutAfter: new Date(Date.now() + 86400000).toISOString(),
      status: 'rest',
    } as never)

    await navigateAfterAuth(navigate)

    expect(useAppStore.getState().clearPendingStart).toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('starts next incomplete enabled program', async () => {
    mockState({ pendingStart: null })
    vi.mocked(getProgramProgress).mockImplementation(async (program) => {
      if (program === 'pushups') return { status: 'active' } as never
      return undefined
    })

    await navigateAfterAuth(navigate)

    expect(navigate).toHaveBeenCalledWith('/setup/test/pullups', { replace: true })
  })

  it('goes home when all enabled programs are configured', async () => {
    const setSetupQueue = vi.fn()
    mockState({
      setupQueue: ['pullups'],
      setSetupQueue,
      pendingStart: null,
    })
    vi.mocked(getProgramProgress).mockResolvedValue({ status: 'active' } as never)

    await navigateAfterAuth(navigate)

    expect(setSetupQueue).toHaveBeenCalledWith([])
    expect(navigate).toHaveBeenCalledWith('/', { replace: true })
  })

  it('is single-flight for concurrent callers', async () => {
    let resolveProgress: (v: unknown) => void = () => undefined
    mockState({
      pendingStart: {
        program: 'pushups',
        cycleId: 'c1',
        cycleName: 'Test',
        reps: 10,
        navigateToWorkout: true,
      },
      clearPendingStart: vi.fn(),
    })
    vi.mocked(getProgramProgress).mockReturnValue(
      new Promise((resolve) => {
        resolveProgress = resolve
      }) as never,
    )

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
