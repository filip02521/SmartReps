import { useCallback, useEffect, useRef, useState } from 'react'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { useOnline } from '@/hooks/useOnline'
import {
  getFollowing,
  getFollowers,
  getMyPublicProfile,
  getFollowCounts,
  refreshMyPublicProfileStats,
  toggleFollow,
  type FolloweeProfile,
  type FollowerProfile,
  type PublicProfile,
  type FollowCounts,
} from '@/lib/follow-system'
import { showToast } from '@/stores/toast-store'
import { pl } from '@/i18n/pl'

export interface FollowData {
  profile: PublicProfile | null
  following: FolloweeProfile[]
  followers: FollowerProfile[]
  counts: FollowCounts
  loading: boolean
  currentUserId: string | null
  reload: () => Promise<void>
  unfollow: (followeeId: string) => Promise<void>
}

export function useFollowData(): FollowData {
  const online = useOnline()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [following, setFollowing] = useState<FolloweeProfile[]>([])
  const [followers, setFollowers] = useState<FollowerProfile[]>([])
  const [counts, setCounts] = useState<FollowCounts>({ followers: 0, following: 0 })
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const requestIdRef = useRef(0)

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured || !online) {
      setLoading(false)
      return
    }
    const reqId = ++requestIdRef.current
    try {
      const { data } = await supabase.auth.getUser()
      if (!mountedRef.current || reqId !== requestIdRef.current) return
      const uid = data.user?.id ?? null
      setCurrentUserId(uid)

      // Refresh stats first (so profile has fresh data)
      await refreshMyPublicProfileStats().catch(() => undefined)
      if (!mountedRef.current || reqId !== requestIdRef.current) return

      const [myProfile, followingList, followersList] = await Promise.all([
        getMyPublicProfile(),
        getFollowing(),
        getFollowers(),
      ])
      if (!mountedRef.current || reqId !== requestIdRef.current) return
      setProfile(myProfile)
      setFollowing(followingList)
      setFollowers(followersList)
      if (uid) {
        const c = await getFollowCounts(uid)
        if (!mountedRef.current || reqId !== requestIdRef.current) return
        setCounts(c)
      }
    } catch {
      // Offline or error
    } finally {
      if (mountedRef.current && reqId === requestIdRef.current) setLoading(false)
    }
  }, [online])

  useEffect(() => {
    void reload()
  }, [reload])

  // Refresh on window focus
  useEffect(() => {
    if (!online) return
    const onFocus = () => void reload()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [reload, online])

  const unfollow = useCallback(async (followeeId: string) => {
    try {
      await toggleFollow(followeeId)
      if (!mountedRef.current) return
      await reload()
      if (mountedRef.current) showToast(pl.unfollowDone, 'success')
    } catch {
      if (mountedRef.current) showToast(pl.followErrorGeneric, 'error')
    }
  }, [reload])

  return {
    profile,
    following,
    followers,
    counts,
    loading,
    currentUserId,
    reload,
    unfollow,
  }
}
