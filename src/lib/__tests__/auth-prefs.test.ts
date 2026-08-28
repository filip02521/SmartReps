import { describe, it, expect, beforeEach } from 'vitest'
import {
  USER_SIGNED_OUT_PREF_KEY,
  INTENTIONAL_SIGNOUT_KEY,
  hasSignedOutPreference,
  setSignedOutPreference,
  setIntentionalSignOutFlag,
  takeIntentionalSignOutFlag,
  clearSignedOutPreferenceKeys,
} from '@/lib/auth-prefs'

describe('auth-prefs', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('hasSignedOutPreference returns false when unset', () => {
    expect(hasSignedOutPreference()).toBe(false)
  })

  it('setSignedOutPreference persists to localStorage', () => {
    setSignedOutPreference()
    expect(localStorage.getItem(USER_SIGNED_OUT_PREF_KEY)).toBe('1')
    expect(hasSignedOutPreference()).toBe(true)
  })

  it('clearSignedOutPreferenceKeys removes both keys', () => {
    setSignedOutPreference()
    setIntentionalSignOutFlag()
    clearSignedOutPreferenceKeys()
    expect(hasSignedOutPreference()).toBe(false)
    expect(localStorage.getItem(INTENTIONAL_SIGNOUT_KEY)).toBeNull()
  })

  it('takeIntentionalSignOutFlag consumes flag once', () => {
    setIntentionalSignOutFlag()
    expect(takeIntentionalSignOutFlag()).toBe(true)
    expect(takeIntentionalSignOutFlag()).toBe(false)
  })
})
