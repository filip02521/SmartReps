import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  needsAccountSwitchConfirm,
  setAccountSwitchPending,
  clearAccountSwitchPending,
  getAccountSwitchPending,
} from '@/lib/account-switch-gate'

const mockGetState = vi.fn()
const mockCount = vi.fn()

vi.mock('@/stores/app-store', () => ({
  useAppStore: {
    getState: () => mockGetState(),
    persist: { rehydrate: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({
  db: {
    programProgress: {
      count: () => mockCount(),
    },
  },
}))

describe('account-switch-gate', () => {
  beforeEach(() => {
    clearAccountSwitchPending()
    mockGetState.mockReturnValue({ lastAuthUserId: 'user-a' })
    mockCount.mockResolvedValue(1)
  })

  it('needs confirm when different user and local progress', async () => {
    expect(await needsAccountSwitchConfirm('user-b')).toBe(true)
  })

  it('no confirm for same user', async () => {
    expect(await needsAccountSwitchConfirm('user-a')).toBe(false)
  })

  it('no confirm when no local progress', async () => {
    mockCount.mockResolvedValue(0)
    expect(await needsAccountSwitchConfirm('user-b')).toBe(false)
  })

  it('pending state set and clear', () => {
    setAccountSwitchPending({ userId: 'user-b' })
    expect(getAccountSwitchPending()?.userId).toBe('user-b')
    clearAccountSwitchPending()
    expect(getAccountSwitchPending()).toBeNull()
  })
})
