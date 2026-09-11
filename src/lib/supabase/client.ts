import { createClient } from '@supabase/supabase-js'
import { durableAuthStorage, wipeDurableAuthStorage } from '@/lib/auth-storage'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured = Boolean(url && key)

/**
 * Extract project ref from Supabase URL (e.g. "https://abc.supabase.co" → "abc").
 * Used to detect when the project has changed and stale auth tokens must be cleared.
 */
function projectRefFromUrl(u: string): string | null {
  try {
    const match = u.match(/https?:\/\/([a-z0-9]+)\.supabase\.(co|in|net)/i)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

/**
 * One-time cleanup: when the Supabase project URL changes (e.g. migration to a new
 * project), old auth tokens in localStorage / IndexedDB are orphaned. The new client
 * looks for a different key and never finds a session, so the user appears logged
 * out with no explanation. This removes stale tokens from the previous project so
 * the user gets a clean login flow instead of a confusing "session expired" loop.
 */
function cleanupStaleAuthTokens(): void {
  if (typeof window === 'undefined') return
  const currentRef = projectRefFromUrl(url)
  if (!currentRef) return

  const STALE_REF_KEY = 'sr:supabase-project-ref'
  let storedRef: string | null = null
  let canWrite = true

  try {
    storedRef = localStorage.getItem(STALE_REF_KEY)
  } catch {
    // localStorage unavailable (private mode, quota) — can't detect change
    canWrite = false
  }

  if (storedRef && storedRef !== currentRef) {
    // Project changed — wipe all auth tokens (localStorage + IndexedDB)
    void wipeDurableAuthStorage()
  }

  if (canWrite) {
    try {
      localStorage.setItem(STALE_REF_KEY, currentRef)
    } catch {
      // best-effort — next reload will retry the cleanup
    }
  }
}

if (isSupabaseConfigured) {
  cleanupStaleAuthTokens()
}

export const supabase = isSupabaseConfigured
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: durableAuthStorage,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>)
