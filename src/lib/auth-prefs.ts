/** Sticky until next successful login — suppresses "session lost" after voluntary logout. */
export const USER_SIGNED_OUT_PREF_KEY = 'sr-auth-user-signed-out'

export const INTENTIONAL_SIGNOUT_KEY = 'sr-auth-intentional-signout'

function storageHas(key: string): boolean {
  try {
    if (sessionStorage.getItem(key) === '1') return true
  } catch {
    // ignore
  }
  try {
    if (localStorage.getItem(key) === '1') return true
  } catch {
    // ignore
  }
  return false
}

export function hasSignedOutPreference(): boolean {
  return storageHas(USER_SIGNED_OUT_PREF_KEY)
}

export function setSignedOutPreference(): void {
  try {
    sessionStorage.setItem(USER_SIGNED_OUT_PREF_KEY, '1')
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(USER_SIGNED_OUT_PREF_KEY, '1')
  } catch {
    // ignore
  }
}

export function setIntentionalSignOutFlag(): void {
  try {
    sessionStorage.setItem(INTENTIONAL_SIGNOUT_KEY, '1')
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(INTENTIONAL_SIGNOUT_KEY, '1')
  } catch {
    // ignore
  }
}

export function takeIntentionalSignOutFlag(): boolean {
  let marked = false
  try {
    if (sessionStorage.getItem(INTENTIONAL_SIGNOUT_KEY) === '1') {
      marked = true
      sessionStorage.removeItem(INTENTIONAL_SIGNOUT_KEY)
    }
  } catch {
    // ignore
  }
  try {
    if (localStorage.getItem(INTENTIONAL_SIGNOUT_KEY) === '1') {
      marked = true
      localStorage.removeItem(INTENTIONAL_SIGNOUT_KEY)
    }
  } catch {
    // ignore
  }
  return marked
}

export function clearSignedOutPreferenceKeys(): void {
  for (const key of [USER_SIGNED_OUT_PREF_KEY, INTENTIONAL_SIGNOUT_KEY]) {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // ignore
    }
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}
