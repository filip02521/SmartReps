import { beforeEach, describe, expect, it, vi } from 'vitest'

const settings = {
  timerSound: true,
  timerVibration: true,
}

vi.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: () => ({ settings }),
  },
}))

const vibrateMock = vi.fn()
vi.mock('@/lib/utils', () => ({
  vibrate: (...args: unknown[]) => vibrateMock(...args),
}))

describe('workout-feedback', () => {
  beforeEach(() => {
    settings.timerSound = true
    settings.timerVibration = true
    vibrateMock.mockClear()
    vi.resetModules()
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    })
  })

  it('onSetCompleteFeedback vibrates when vibration enabled', async () => {
    const { onSetCompleteFeedback } = await import('@/lib/workout-feedback')
    onSetCompleteFeedback()
    expect(vibrateMock).toHaveBeenCalledWith(50)
  })

  it('onSetCompleteFeedback skips vibration when disabled', async () => {
    settings.timerVibration = false
    const { onSetCompleteFeedback } = await import('@/lib/workout-feedback')
    onSetCompleteFeedback()
    expect(vibrateMock).not.toHaveBeenCalled()
  })

  it('onSetFailedFeedback vibrates with failure pattern', async () => {
    const { onSetFailedFeedback } = await import('@/lib/workout-feedback')
    onSetFailedFeedback()
    expect(vibrateMock).toHaveBeenCalledWith([80, 40, 80])
  })

  it('onRestComplete uses double vibration when document is hidden', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    })
    const { onRestComplete } = await import('@/lib/workout-feedback')
    onRestComplete()
    expect(vibrateMock).toHaveBeenCalledWith([100, 80, 100])
  })

  it('onRestComplete uses single vibration when visible', async () => {
    const { onRestComplete } = await import('@/lib/workout-feedback')
    onRestComplete()
    expect(vibrateMock).toHaveBeenCalledWith(100)
  })

  it('onRestCountdownFeedback ticks at 3-2-1', async () => {
    const { onRestCountdownFeedback } = await import('@/lib/workout-feedback')
    onRestCountdownFeedback(3)
    onRestCountdownFeedback(2)
    onRestCountdownFeedback(1)
    expect(vibrateMock).toHaveBeenCalledTimes(3)
    expect(vibrateMock).toHaveBeenCalledWith(25)
  })

  it('onAmrapBlockEndFeedback uses prominent vibration', async () => {
    const { onAmrapBlockEndFeedback } = await import('@/lib/workout-feedback')
    onAmrapBlockEndFeedback()
    expect(vibrateMock).toHaveBeenCalledWith([120, 60, 120])
  })

  it('wrapRestTimerCallbacks fires countdown only once per second', async () => {
    const { wrapRestTimerCallbacks } = await import('@/lib/workout-feedback')
    const onTick = vi.fn()
    const wrapped = wrapRestTimerCallbacks({
      getState: () => ({
        mode: 'expanded',
        totalSec: 90,
        remainingSec: 3,
        startedAt: 1000,
      }),
      onTick,
      onComplete: vi.fn(),
    })

    wrapped.onTick(3)
    wrapped.onTick(3)
    wrapped.onTick(2)
    expect(vibrateMock).toHaveBeenCalledTimes(2)
    expect(onTick).toHaveBeenCalledTimes(3)
  })

  it('respects explicit overrides over settings', async () => {
    settings.timerVibration = true
    const { onSetCompleteFeedback } = await import('@/lib/workout-feedback')
    onSetCompleteFeedback({ sound: false, vibration: false })
    expect(vibrateMock).not.toHaveBeenCalled()
  })
})
