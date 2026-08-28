/**
 * Durable auth storage for iOS Safari / PWA.
 * Mirrors Supabase session to IndexedDB so a localStorage wipe (ITP, storage
 * pressure, "Clear Website Data") does not silently drop the login when IDB survives.
 *
 * Per-key write queue + in-realm tombstones prevent a stale getItem→mirror from
 * resurrecting a session after removeItem (sign-out).
 */

const IDB_NAME = 'SmartRepsAuth'
const IDB_STORE = 'kv'
const IDB_VERSION = 1

const memory = new Map<string, string>()
/** Keys deleted in this JS realm until IDB delete completes. */
const deletedKeys = new Set<string>()
const keyChains = new Map<string, Promise<void>>()

let sharedDb: IDBDatabase | null = null
let opening: Promise<IDBDatabase> | null = null

function enqueueKey(key: string, op: () => Promise<void>): Promise<void> {
  const prev = keyChains.get(key) ?? Promise.resolve()
  const next = prev.then(op, op).catch(() => undefined)
  keyChains.set(key, next)
  return next
}

function openAuthDb(): Promise<IDBDatabase> {
  if (sharedDb) return Promise.resolve(sharedDb)
  if (opening) return opening

  opening = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      opening = null
      reject(new Error('indexedDB unavailable'))
      return
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE)
      }
    }
    req.onsuccess = () => {
      sharedDb = req.result
      sharedDb.onversionchange = () => {
        sharedDb?.close()
        sharedDb = null
      }
      opening = null
      resolve(sharedDb)
    }
    req.onerror = () => {
      opening = null
      reject(req.error ?? new Error('indexedDB open failed'))
    }
  })

  return opening
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openAuthDb()
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => {
      const v = req.result
      resolve(typeof v === 'string' ? v : v == null ? null : String(v))
    }
    req.onerror = () => reject(req.error)
  })
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openAuthDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

async function idbDel(key: string): Promise<void> {
  const db = await openAuthDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).delete(key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // quota / private mode — memory + IDB still hold the session
  }
}

function lsDel(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

/** Re-mirror LS → IDB only if the value was not signed out meanwhile. */
function scheduleMirrorFromLs(key: string, expected: string): void {
  void enqueueKey(key, async () => {
    if (deletedKeys.has(key)) return
    if (lsGet(key) !== expected) return
    if (memory.get(key) !== expected) return
    await idbSet(key, expected)
  })
}

/** Supabase SupportedStorage — async restore from IndexedDB when localStorage is empty. */
export const durableAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const fromLs = lsGet(key)
    if (fromLs != null) {
      memory.set(key, fromLs)
      deletedKeys.delete(key)
      scheduleMirrorFromLs(key, fromLs)
      return fromLs
    }

    if (deletedKeys.has(key)) return null

    let fromIdb: string | null = null
    try {
      await enqueueKey(key, async () => {
        if (deletedKeys.has(key)) {
          fromIdb = null
          return
        }
        fromIdb = await idbGet(key)
      })
    } catch {
      fromIdb = null
    }

    if (deletedKeys.has(key)) return null

    if (fromIdb != null) {
      const raced = lsGet(key)
      if (raced != null) {
        memory.set(key, raced)
        return raced
      }
      memory.set(key, fromIdb)
      lsSet(key, fromIdb)
      void import('@/lib/analytics').then(({ trackSessionRestoredFromIdb }) => {
        trackSessionRestoredFromIdb()
      })
      return fromIdb
    }

    return memory.get(key) ?? null
  },

  setItem: async (key: string, value: string): Promise<void> => {
    deletedKeys.delete(key)
    memory.set(key, value)
    lsSet(key, value)
    await enqueueKey(key, async () => {
      if (deletedKeys.has(key)) return
      if (memory.get(key) !== value) return
      await idbSet(key, value)
    })
  },

  removeItem: async (key: string): Promise<void> => {
    // Sync layers first so concurrent getItem cannot schedule a mirror of the old token.
    memory.delete(key)
    lsDel(key)
    deletedKeys.add(key)
    await enqueueKey(key, async () => {
      await idbDel(key)
      // Keep tombstone: prevents later IDB read of a value written by a raced mirror
      // that somehow slipped through. Cleared on next setItem/getItem LS hit.
    })
  },
}

/** Wipe all mirrored auth keys (LS + IDB + memory). Used after successful sign-out. */
export async function wipeDurableAuthStorage(): Promise<void> {
  memory.clear()
  deletedKeys.clear()

  // Clear known Supabase auth keys from localStorage.
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k) continue
      if (
        k.includes('-auth-token') ||
        (k.startsWith('sb-') && k.includes('auth')) ||
        k === 'supabase.auth.token'
      ) {
        toRemove.push(k)
      }
    }
    for (const k of toRemove) {
      deletedKeys.add(k)
      lsDel(k)
    }
  } catch {
    // ignore
  }

  try {
    const db = await openAuthDb()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // best-effort
  }
}

/** Test-only: drop in-memory cache between cases. */
export function __resetDurableAuthMemoryForTests(): void {
  memory.clear()
  deletedKeys.clear()
}
