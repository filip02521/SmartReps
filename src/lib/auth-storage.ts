/**
 * Durable auth storage for iOS Safari / PWA.
 * Mirrors Supabase session to IndexedDB so a localStorage wipe (ITP, storage
 * pressure, "Clear Website Data") does not silently drop the login when IDB survives.
 */

const IDB_NAME = 'SmartRepsAuth'
const IDB_STORE = 'kv'
const IDB_VERSION = 1

const memory = new Map<string, string>()

function openAuthDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
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
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'))
  })
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openAuthDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly')
      const req = tx.objectStore(IDB_STORE).get(key)
      req.onsuccess = () => {
        const v = req.result
        resolve(typeof v === 'string' ? v : v == null ? null : String(v))
      }
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openAuthDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

async function idbDel(key: string): Promise<void> {
  const db = await openAuthDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite')
      tx.objectStore(IDB_STORE).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
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

/** Supabase SupportedStorage — async restore from IndexedDB when localStorage is empty. */
export const durableAuthStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const fromLs = lsGet(key)
    if (fromLs != null) {
      memory.set(key, fromLs)
      void idbSet(key, fromLs).catch(() => undefined)
      return fromLs
    }

    try {
      const fromIdb = await idbGet(key)
      if (fromIdb != null) {
        memory.set(key, fromIdb)
        lsSet(key, fromIdb)
        return fromIdb
      }
    } catch {
      // IDB blocked — fall through
    }

    return memory.get(key) ?? null
  },

  setItem: async (key: string, value: string): Promise<void> => {
    memory.set(key, value)
    lsSet(key, value)
    try {
      await idbSet(key, value)
    } catch {
      // best-effort mirror
    }
  },

  removeItem: async (key: string): Promise<void> => {
    memory.delete(key)
    lsDel(key)
    try {
      await idbDel(key)
    } catch {
      // best-effort
    }
  },
}
