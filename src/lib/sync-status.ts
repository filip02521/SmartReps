import type { Session } from '@supabase/supabase-js'
import { hasSignedOutPreference } from '@/lib/auth-prefs'
import { db } from '@/lib/db'
import { getDeadLetterCount, type SyncFailureReason } from '@/lib/sync'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { useAppStore } from '@/stores/app-store'

export type SyncAccountState =
  | 'local_only'
  | 'logged_in'
  | 'logged_out_locally'
  | 'session_expired'
  | 'syncing'
  | 'sync_error'

export type SyncStatusSnapshot = {
  accountState: SyncAccountState
  lastSyncedAt: string | null
  deadLetterCount: number
  queuePendingCount: number
  online: boolean
  email: string | null
  lastSyncFailureReason: SyncFailureReason | null
}

const DEAD_LETTER_ATTEMPTS = 5

export type ResolveAccountStateInput = {
  session: Session | null
  lastAuthUserId: string | null
  signedOutPref: boolean
  syncing: boolean
  lastSyncFailureReason: string | null
}

/** Pure account/sync badge state — testable without I/O. */
export function resolveAccountState(input: ResolveAccountStateInput): SyncAccountState {
  const { session, lastAuthUserId, signedOutPref, syncing, lastSyncFailureReason } = input

  if (syncing) return 'syncing'

  if (session?.user) {
    if (lastSyncFailureReason) return 'sync_error'
    return 'logged_in'
  }

  if (!lastAuthUserId) return 'local_only'
  if (signedOutPref) return 'logged_out_locally'
  return 'session_expired'
}

async function getQueuePendingCount(): Promise<number> {
  const items = await db.syncQueue.toArray()
  return items.filter((i) => (i.attempts ?? 0) < DEAD_LETTER_ATTEMPTS).length
}

export async function getSyncStatusSnapshot(opts?: {
  syncing?: boolean
  online?: boolean
}): Promise<SyncStatusSnapshot> {
  const { lastAuthUserId, lastSyncedAt, lastSyncFailureReason } = useAppStore.getState()
  const signedOutPref = hasSignedOutPreference()

  let session: Session | null = null
  let email: string | null = null
  if (isSupabaseConfigured) {
    const { data } = await supabase.auth.getSession()
    session = data.session
    email = session?.user?.email ?? null
  }

  const [deadLetterCount, queuePendingCount] = await Promise.all([
    getDeadLetterCount(),
    getQueuePendingCount(),
  ])

  const accountState = resolveAccountState({
    session,
    lastAuthUserId,
    signedOutPref,
    syncing: opts?.syncing ?? false,
    lastSyncFailureReason,
  })

  return {
    accountState,
    lastSyncedAt,
    deadLetterCount,
    queuePendingCount,
    online: opts?.online ?? (typeof navigator !== 'undefined' ? navigator.onLine : true),
    email,
    lastSyncFailureReason: lastSyncFailureReason as SyncFailureReason | null,
  }
}
