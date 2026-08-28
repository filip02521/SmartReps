import { beforeEach, describe, expect, it, vi } from 'vitest'

const idbData = new Map<string, string>()

function mockIdb() {
  const fakeDb = {
    objectStoreNames: { contains: () => true },
    transaction(_store: string, mode: IDBTransactionMode) {
      const ops: Array<() => void> = []
      const storeApi = {
        get(key: string) {
          const req: { result?: string; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
            onsuccess: null,
            onerror: null,
          }
          queueMicrotask(() => {
            req.result = idbData.get(key)
            req.onsuccess?.()
          })
          return req
        },
        put(value: string, key: string) {
          ops.push(() => idbData.set(key, value))
          return {}
        },
        delete(key: string) {
          ops.push(() => idbData.delete(key))
          return {}
        },
      }
      const tx: {
        objectStore: () => typeof storeApi
        oncomplete: (() => void) | null
        onerror: (() => void) | null
        error: null
      } = {
        objectStore: () => storeApi,
        oncomplete: null,
        onerror: null,
        error: null,
      }
      queueMicrotask(() => {
        if (mode === 'readwrite') ops.forEach((fn) => fn())
        tx.oncomplete?.()
      })
      return tx
    },
    close() {},
  }

  vi.stubGlobal('indexedDB', {
    open() {
      const req: {
        result: typeof fakeDb
        onupgradeneeded: (() => void) | null
        onsuccess: (() => void) | null
        onerror: (() => void) | null
        error: null
      } = {
        result: fakeDb,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        error: null,
      }
      queueMicrotask(() => req.onsuccess?.())
      return req
    },
  })
}

describe('durableAuthStorage', () => {
  beforeEach(async () => {
    idbData.clear()
    localStorage.clear()
    mockIdb()
    vi.resetModules()
    const { __resetDurableAuthMemoryForTests } = await import('@/lib/auth-storage')
    __resetDurableAuthMemoryForTests()
  })

  it('writes to localStorage and restores from IndexedDB when LS + memory are empty', async () => {
    const { durableAuthStorage, __resetDurableAuthMemoryForTests } = await import(
      '@/lib/auth-storage'
    )
    await durableAuthStorage.setItem('sb-auth', '{"access_token":"x"}')
    expect(localStorage.getItem('sb-auth')).toContain('access_token')

    localStorage.removeItem('sb-auth')
    __resetDurableAuthMemoryForTests()

    const restored = await durableAuthStorage.getItem('sb-auth')
    expect(restored).toContain('access_token')
    expect(localStorage.getItem('sb-auth')).toContain('access_token')
  })

  it('removeItem clears both layers and blocks resurrection', async () => {
    const { durableAuthStorage } = await import('@/lib/auth-storage')
    await durableAuthStorage.setItem('sb-auth', 'token')
    // Simulate leftover IDB after a partial failure — remove must still win.
    idbData.set('sb-auth', 'stale-should-not-return')
    await durableAuthStorage.removeItem('sb-auth')
    expect(await durableAuthStorage.getItem('sb-auth')).toBeNull()
  })

  it('does not resurrect IDB value after removeItem while mirror was queued', async () => {
    const { durableAuthStorage, __resetDurableAuthMemoryForTests } = await import(
      '@/lib/auth-storage'
    )
    await durableAuthStorage.setItem('sb-auth', 'alive')
    // Warm LS hit schedules a mirror; remove immediately after.
    await durableAuthStorage.getItem('sb-auth')
    await durableAuthStorage.removeItem('sb-auth')
    __resetDurableAuthMemoryForTests()
    localStorage.clear()
    // Tombstone is cleared on reset; ensure IDB was actually deleted by removeItem.
    expect(idbData.has('sb-auth')).toBe(false)
  })
})

describe('auth lifecycle intentional sign-out', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.resetModules()
  })

  it('suppresses session-lost toast after voluntary logout preference', async () => {
    vi.doMock('@/stores/app-store', () => ({
      useAppStore: Object.assign(vi.fn(), {
        getState: () => ({ lastAuthUserId: 'user-a' }),
        persist: {
          hasHydrated: () => true,
          onFinishHydration: () => () => undefined,
        },
      }),
    }))
    const showToast = vi.fn()
    vi.doMock('@/stores/toast-store', () => ({ showToast }))
    vi.doMock('@/lib/supabase/client', () => ({
      isSupabaseConfigured: true,
      supabase: {
        auth: {
          signOut: vi.fn().mockResolvedValue({ error: null }),
          getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        },
      },
    }))

    const { markIntentionalSignOut, notifyUnexpectedSessionLoss } = await import(
      '@/lib/auth-lifecycle'
    )
    markIntentionalSignOut()
    await notifyUnexpectedSessionLoss()
    expect(showToast).not.toHaveBeenCalled()
  })

  it('toasts when session is lost without voluntary logout', async () => {
    vi.doMock('@/stores/app-store', () => ({
      useAppStore: Object.assign(vi.fn(), {
        getState: () => ({ lastAuthUserId: 'user-a' }),
        persist: {
          hasHydrated: () => true,
          onFinishHydration: () => () => undefined,
        },
      }),
    }))
    const showToast = vi.fn()
    vi.doMock('@/stores/toast-store', () => ({ showToast }))
    vi.doMock('@/lib/supabase/client', () => ({
      isSupabaseConfigured: true,
      supabase: {
        auth: {
          signOut: vi.fn().mockResolvedValue({ error: null }),
          getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        },
      },
    }))

    const { notifyUnexpectedSessionLoss } = await import('@/lib/auth-lifecycle')
    await notifyUnexpectedSessionLoss()
    expect(showToast).toHaveBeenCalledOnce()
  })
})
