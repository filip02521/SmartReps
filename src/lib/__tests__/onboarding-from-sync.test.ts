import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    programProgress: {
      count: vi.fn(),
    },
  },
}))

const mockGetState = vi.fn()
const mockSetSettings = vi.fn()

vi.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: () => mockGetState(),
  },
}))

import { db } from '@/lib/db'
import { completeOnboardingIfSynced } from '@/lib/onboarding-from-sync'

describe('completeOnboardingIfSynced', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetState.mockReturnValue({
      settings: { onboardingComplete: false },
      setSettings: mockSetSettings,
    })
  })

  it('returns false when no local progress', async () => {
    vi.mocked(db.programProgress.count).mockResolvedValue(0)
    expect(await completeOnboardingIfSynced()).toBe(false)
    expect(mockSetSettings).not.toHaveBeenCalled()
  })

  it('marks onboarding complete when progress was restored', async () => {
    vi.mocked(db.programProgress.count).mockResolvedValue(1)
    expect(await completeOnboardingIfSynced()).toBe(true)
    expect(mockSetSettings).toHaveBeenCalledWith({ onboardingComplete: true })
  })

  it('returns true without updating when already complete', async () => {
    mockGetState.mockReturnValue({
      settings: { onboardingComplete: true },
      setSettings: mockSetSettings,
    })
    vi.mocked(db.programProgress.count).mockResolvedValue(2)
    expect(await completeOnboardingIfSynced()).toBe(true)
    expect(mockSetSettings).not.toHaveBeenCalled()
  })
})
