import { describe, expect, it, vi, beforeEach } from 'vitest'
import { isProgram, hasIncompleteSetup, drainIncompleteSetup } from '@/lib/setup-flow'

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

describe('setup-flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts only pushups and pullups', () => {
    expect(isProgram('pushups')).toBe(true)
    expect(isProgram('pullups')).toBe(true)
    expect(isProgram('foo')).toBe(false)
    expect(isProgram(undefined)).toBe(false)
    expect(isProgram(null)).toBe(false)
  })

  it('hasIncompleteSetup is false for unconfigured enabled programs without chain', async () => {
    vi.mocked(useAppStore.getState).mockReturnValue({
      pendingTest: null,
      pendingStart: null,
      setupQueue: [],
      settings: { enabledPrograms: ['pushups', 'pullups'] },
    } as never)
    vi.mocked(getProgramProgress).mockResolvedValue(undefined)
    expect(await hasIncompleteSetup()).toBe(false)
  })

  it('hasIncompleteSetup is true when setupQueue has program without progress', async () => {
    vi.mocked(useAppStore.getState).mockReturnValue({
      pendingTest: null,
      pendingStart: null,
      setupQueue: ['pullups'],
      settings: { enabledPrograms: ['pushups', 'pullups'] },
    } as never)
    vi.mocked(getProgramProgress).mockResolvedValue(undefined)
    expect(await hasIncompleteSetup()).toBe(true)
  })

  it('hasIncompleteSetup is true with pendingTest', async () => {
    vi.mocked(useAppStore.getState).mockReturnValue({
      pendingTest: { program: 'pushups', reps: 10, cycleId: 'c1' },
      pendingStart: null,
      setupQueue: [],
      settings: { enabledPrograms: ['pushups'] },
    } as never)
    expect(await hasIncompleteSetup()).toBe(true)
  })

  it('hasIncompleteSetup is true with pendingStart', async () => {
    vi.mocked(useAppStore.getState).mockReturnValue({
      pendingTest: null,
      pendingStart: {
        program: 'pushups',
        cycleId: 'c1',
        cycleName: 'Test',
        reps: 10,
      },
      setupQueue: [],
      settings: { enabledPrograms: ['pushups'] },
    } as never)
    expect(await hasIncompleteSetup()).toBe(true)
  })

  it('drainIncompleteSetup does not scan enabledPrograms when queue empty', async () => {
    const navigate = vi.fn()
    const setSetupQueue = vi.fn()
    vi.mocked(useAppStore.getState).mockReturnValue({
      pendingTest: null,
      pendingStart: null,
      setupQueue: [],
      setSetupQueue,
      settings: { enabledPrograms: ['pushups', 'pullups'] },
    } as never)
    vi.mocked(getProgramProgress).mockResolvedValue(undefined)
    expect(await drainIncompleteSetup(navigate)).toBe(false)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('drainIncompleteSetup resumes cycle when pendingTest exists', async () => {
    const navigate = vi.fn()
    vi.mocked(useAppStore.getState).mockReturnValue({
      pendingTest: { program: 'pushups', reps: 12, cycleId: 'c1' },
      pendingStart: null,
      setupQueue: [],
      setSetupQueue: vi.fn(),
    } as never)
    expect(await drainIncompleteSetup(navigate)).toBe(true)
    expect(navigate).toHaveBeenCalledWith('/setup/cycle/pushups', { replace: true })
  })

  it('drainIncompleteSetup navigates to queued program without progress', async () => {
    const navigate = vi.fn()
    const setSetupQueue = vi.fn()
    vi.mocked(useAppStore.getState).mockReturnValue({
      pendingTest: null,
      pendingStart: null,
      setupQueue: ['pullups'],
      setSetupQueue,
      settings: { enabledPrograms: ['pushups', 'pullups'] },
    } as never)
    vi.mocked(getProgramProgress).mockResolvedValue(undefined)
    expect(await drainIncompleteSetup(navigate)).toBe(true)
    expect(navigate).toHaveBeenCalledWith('/setup/test/pullups', { replace: true })
    expect(setSetupQueue).toHaveBeenCalledWith([])
  })
})
