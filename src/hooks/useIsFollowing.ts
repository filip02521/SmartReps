import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

/**
 * Check if the current user is following a specific target user.
 * Returns null while loading, true/false once resolved.
 * Best-effort — returns false on error (non-critical check for UI state).
 */
export function useIsFollowing(targetUserId: string | null | undefined): boolean | null {
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null)

  useEffect(() => {
    if (!targetUserId) {
      setIsFollowing(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        if (!userData.user || userData.user.id === targetUserId) {
          if (!cancelled) setIsFollowing(null)
          return
        }
        const { data, error } = await supabase
          .from('user_follows')
          .select('followee_id')
          .eq('follower_id', userData.user.id)
          .eq('followee_id', targetUserId)
          .maybeSingle()
        if (!cancelled) {
          if (error) setIsFollowing(false)
          else setIsFollowing(!!data)
        }
      } catch {
        if (!cancelled) setIsFollowing(false)
      }
    })()
    return () => { cancelled = true }
  }, [targetUserId])

  return isFollowing
}
