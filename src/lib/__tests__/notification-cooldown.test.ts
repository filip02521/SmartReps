import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isSessionExpiredToastInCooldown,
  markSessionExpiredToastShown,
  resetSessionExpiredToastCooldown,
  __resetSessionExpiredCooldownForTests,
} from '@/lib/notification-cooldown'

describe('notification-cooldown', () => {
  beforeEach(() => {
    __resetSessionExpiredCooldownForTests()
  })

  it('is not in cooldown initially', () => {
    expect(isSessionExpiredToastInCooldown()).toBe(false)
  })

  it('enters cooldown after markSessionExpiredToastShown', () => {
    markSessionExpiredToastShown()
    expect(isSessionExpiredToastInCooldown()).toBe(true)
  })

  it('exits cooldown after resetSessionExpiredToastCooldown', () => {
    markSessionExpiredToastShown()
    expect(isSessionExpiredToastInCooldown()).toBe(true)
    resetSessionExpiredToastCooldown()
    expect(isSessionExpiredToastInCooldown()).toBe(false)
  })

  it('exits cooldown after 5 minutes (mocked)', () => {
    markSessionExpiredToastShown()
    expect(isSessionExpiredToastInCooldown()).toBe(true)

    // Advance time by 5 minutes + 1 second
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 5 * 60 * 1000 + 1000)
    expect(isSessionExpiredToastInCooldown()).toBe(false)
    vi.useRealTimers()
  })

  it('still in cooldown just before 5 minutes (mocked)', () => {
    markSessionExpiredToastShown()
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 4 * 60 * 1000 + 59000)
    expect(isSessionExpiredToastInCooldown()).toBe(true)
    vi.useRealTimers()
  })
})
