import { describe, expect, it, beforeEach, vi } from 'vitest'

const mockGetState = vi.fn()
const mockSetState = vi.fn()

vi.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: () => mockGetState(),
    setState: (...args: unknown[]) => mockSetState(...args),
  },
}))

import {
  mergeEnabledProgramsFromProfile,
  mergeEnabledProgramsFromProgress,
  parseEnabledPrograms,
} from '@/lib/enabled-programs-sync'

describe('parseEnabledPrograms', () => {
  it('filters invalid programs and defaults to pushups', () => {
    expect(parseEnabledPrograms(['pushups', 'pullups', 'invalid'])).toEqual(['pushups', 'pullups'])
    expect(parseEnabledPrograms([])).toEqual(['pushups'])
    expect(parseEnabledPrograms(null)).toEqual(['pushups'])
  })
})

describe('mergeEnabledProgramsFromProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      settings: { enabledPrograms: ['pushups'] },
      enabledProgramsUpdatedAt: '2026-01-01T00:00:00.000Z',
    })
  })

  it('applies remote when newer than local', () => {
    const changed = mergeEnabledProgramsFromProfile({
      enabled_programs: ['pushups', 'pullups'],
      enabled_programs_updated_at: '2026-06-01T00:00:00.000Z',
    })
    expect(changed).toBe(true)
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ enabledPrograms: ['pushups', 'pullups'] }),
        enabledProgramsUpdatedAt: '2026-06-01T00:00:00.000Z',
      }),
    )
  })

  it('ignores remote when older than local', () => {
    const changed = mergeEnabledProgramsFromProfile({
      enabled_programs: ['pullups'],
      enabled_programs_updated_at: '2025-01-01T00:00:00.000Z',
    })
    expect(changed).toBe(false)
    expect(mockSetState).not.toHaveBeenCalled()
  })
})

describe('mergeEnabledProgramsFromProgress', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      settings: { enabledPrograms: ['pushups'] },
    })
  })

  it('adds programs with remote progress as legacy fallback', () => {
    mergeEnabledProgramsFromProgress(['pullups'])
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({ enabledPrograms: ['pushups', 'pullups'] }),
      }),
    )
  })
})
