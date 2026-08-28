import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { trackAccountDeleted } from '@/lib/analytics'

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'failed' }

export async function deleteRemoteAccount(): Promise<DeleteAccountResult> {
  if (!isSupabaseConfigured) return { ok: false, error: 'failed' }

  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) return { ok: false, error: 'unauthorized' }

  const url = import.meta.env.VITE_SUPABASE_URL as string
  const res = await fetch(`${url}/functions/v1/delete-account`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
      'Content-Type': 'application/json',
    },
  })

  if (res.status === 401) return { ok: false, error: 'unauthorized' }
  if (!res.ok) return { ok: false, error: 'failed' }

  trackAccountDeleted()
  return { ok: true }
}
