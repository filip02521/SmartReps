import { createClient } from '@supabase/supabase-js'
import { durableAuthStorage } from '@/lib/auth-storage'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export const isSupabaseConfigured = Boolean(url && key)

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
