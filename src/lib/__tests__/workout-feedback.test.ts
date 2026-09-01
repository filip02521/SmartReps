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

  it('respects explicit overrides over settings', async () => {
    settings.timerVibration = true
    const { onSetCompleteFeedback } = await import('@/lib/workout-feedback')
    onSetCompleteFeedback({ sound: false, vibration: false })
    expect(vibrateMock).not.toHaveBeenCalled()
  })
})
