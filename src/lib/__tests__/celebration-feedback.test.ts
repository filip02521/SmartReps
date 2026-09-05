import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { playCelebrationSound, initCelebrationAudio } from '@/lib/celebration-feedback'

// Mock audio-context module
const scheduleToneMock = vi.fn()
const ensureSharedAudioReadyMock = vi.fn()
const getSharedMasterGainMock = vi.fn()

vi.mock('@/lib/audio-context', () => ({
  ensureSharedAudioReady: (...args: unknown[]) => ensureSharedAudioReadyMock(...args),
  getSharedMasterGain: (...args: unknown[]) => getSharedMasterGainMock(...args),
  scheduleTone: (...args: unknown[]) => scheduleToneMock(...args),
}))

// Mock app store
const getStateMock = vi.fn()
vi.mock('@/stores/app-store', () => ({
  useAppStore: { getState: () => getStateMock() },
}))

// Mock AudioContext methods
const createOscillatorMock = vi.fn()
const createGainMock = vi.fn()
const connectMock = vi.fn()
const startMock = vi.fn()
const stopMock = vi.fn()
const setValueAtTimeMock = vi.fn()
const exponentialRampToValueAtTimeMock = vi.fn()

const fakeCtx = {
  currentTime: 1000,
  createOscillator: () => {
    createOscillatorMock()
    return {
      type: 'sine',
      frequency: { setValueAtTime: setValueAtTimeMock },
      connect: connectMock,
      start: startMock,
      stop: stopMock,
    }
  },
  createGain: () => {
    createGainMock()
    return {
      gain: {
        value: 0.9,
        setValueAtTime: setValueAtTimeMock,
        exponentialRampToValueAtTime: exponentialRampToValueAtTimeMock,
      },
      connect: connectMock,
    }
  },
}

const fakeMasterGain = { connect: connectMock, gain: { value: 0.9 } }

describe('celebration-feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ensureSharedAudioReadyMock.mockResolvedValue(fakeCtx)
    getSharedMasterGainMock.mockReturnValue(fakeMasterGain)
    getStateMock.mockReturnValue({ settings: { timerSound: true } })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('does nothing when timerSound is disabled', async () => {
    getStateMock.mockReturnValue({ settings: { timerSound: false } })
    playCelebrationSound(false)
    await vi.waitFor(() => {
      expect(ensureSharedAudioReadyMock).not.toHaveBeenCalled()
    })
  })

  it('plays default celebration when hasPr is false', async () => {
    playCelebrationSound(false)
    await vi.waitFor(() => {
      expect(ensureSharedAudioReadyMock).toHaveBeenCalled()
      // Default has 4 notes
      expect(createOscillatorMock).toHaveBeenCalledTimes(4)
    })
  })

  it('plays PR fanfare when hasPr is true', async () => {
    playCelebrationSound(true)
    await vi.waitFor(() => {
      expect(ensureSharedAudioReadyMock).toHaveBeenCalled()
      // PR has 6 notes
      expect(createOscillatorMock).toHaveBeenCalledTimes(6)
    })
  })

  it('PR fanfare has more notes than default', async () => {
    playCelebrationSound(false)
    await vi.waitFor(() => expect(createOscillatorMock).toHaveBeenCalledTimes(4))
    vi.clearAllMocks()

    playCelebrationSound(true)
    await vi.waitFor(() => expect(createOscillatorMock).toHaveBeenCalledTimes(6))
  })

  it('does not throw when AudioContext is unavailable', async () => {
    ensureSharedAudioReadyMock.mockResolvedValue(null)
    playCelebrationSound(true)
    await vi.waitFor(() => {
      expect(ensureSharedAudioReadyMock).toHaveBeenCalled()
    })
    // Should not have created oscillators
    expect(createOscillatorMock).not.toHaveBeenCalled()
  })

  it('initCelebrationAudio calls ensureSharedAudioReady', async () => {
    await initCelebrationAudio()
    expect(ensureSharedAudioReadyMock).toHaveBeenCalled()
  })
})
