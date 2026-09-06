import { supabase } from '@/lib/supabase/client'

export type PublicProfile = {
  user_id: string
  display_name: string
  bio: string
  is_public: boolean
  total_sessions: number
  total_reps: number
  current_streak_weeks: number
  best_streak_weeks: number
  pushup_max: number
  pullup_max: number
  updated_at?: string
}

export type FolloweeProfile = {
  followee_id: string
  display_name: string
  bio: string
  total_sessions: number
  total_reps: number
  current_streak_weeks: number
  best_streak_weeks: number
  pushup_max: number
  pullup_max: number
  followed_at: string
}

export type FollowerProfile = {
  follower_id: string
  display_name: string
  bio: string
  total_sessions: number
  total_reps: number
  current_streak_weeks: number
  best_streak_weeks: number
  pushup_max: number
  pullup_max: number
  followed_at: string
}

export type FollowCounts = {
  followers: number
  following: number
}

export type ToggleFollowResult = {
  following: boolean
  follower_count: number
}

/**
 * Toggle follow status for a user.
 */
export async function toggleFollow(
  followeeId: string,
): Promise<ToggleFollowResult> {
  const { data, error } = await supabase.rpc('toggle_follow', {
    p_followee_id: followeeId,
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('not_authenticated')) throw new Error('not_authenticated')
    if (msg.includes('cannot_follow_self')) throw new Error('cannot_follow_self')
    if (msg.includes('user_not_public')) throw new Error('user_not_public')
    throw error
  }
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return raw as ToggleFollowResult
}

/**
 * Get list of users I follow (with their public stats).
 */
export async function getFollowing(limit = 50): Promise<FolloweeProfile[]> {
  const { data, error } = await supabase.rpc('get_following', { p_limit: limit })
  if (error) throw error
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  if (!Array.isArray(raw)) return []
  return raw as FolloweeProfile[]
}

/**
 * Get list of users who follow me (with their public stats).
 */
export async function getFollowers(limit = 50): Promise<FollowerProfile[]> {
  const { data, error } = await supabase.rpc('get_followers', { p_limit: limit })
  if (error) throw error
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  if (!Array.isArray(raw)) return []
  return raw as FollowerProfile[]
}

/**
 * Get follower + following counts for a user.
 */
export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const { data, error } = await supabase.rpc('get_follow_counts', {
    p_user_id: userId,
  })
  if (error) throw error
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return {
    followers: Number((raw as FollowCounts)?.followers ?? 0),
    following: Number((raw as FollowCounts)?.following ?? 0),
  }
}

/**
 * Upsert the current user's public profile.
 */
export async function upsertMyPublicProfile(args: {
  displayName?: string
  bio?: string
  isPublic?: boolean
}): Promise<PublicProfile> {
  const { data, error } = await supabase.rpc('upsert_my_public_profile', {
    p_display_name: args.displayName ?? '',
    p_bio: args.bio ?? '',
    p_is_public: args.isPublic ?? false,
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('not_authenticated')) throw new Error('not_authenticated')
    if (msg.includes('display_name_too_long')) throw new Error('display_name_too_long')
    if (msg.includes('bio_too_long')) throw new Error('bio_too_long')
    throw error
  }
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return raw as PublicProfile
}

/**
 * Get the current user's public profile (if any).
 */
export async function getMyPublicProfile(): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('get_my_public_profile')
  if (error) throw error
  if (!data) return null
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return raw as PublicProfile
}

/**
 * Get a public profile by user id (with is_following flag).
 */
export async function getPublicProfile(
  userId: string,
): Promise<(PublicProfile & { is_following: boolean }) | null> {
  const { data, error } = await supabase.rpc('get_public_profile', {
    p_user_id: userId,
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('profile_not_public')) throw new Error('profile_not_public')
    throw error
  }
  if (!data) return null
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return raw as PublicProfile & { is_following: boolean }
}

/**
 * Refresh the current user's public profile stats from workout_sessions + max_tests.
 * Called automatically when user opens the Follow section.
 */
export async function refreshMyPublicProfileStats(): Promise<{
  total_sessions: number
  total_reps: number
  current_streak_weeks: number
  best_streak_weeks: number
  pushup_max: number
  pullup_max: number
} | null> {
  const { data, error } = await supabase.rpc('refresh_my_public_profile_stats')
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('not_authenticated')) throw new Error('not_authenticated')
    throw error
  }
  if (!data) return null
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return raw as {
    total_sessions: number
    total_reps: number
    current_streak_weeks: number
    best_streak_weeks: number
    pushup_max: number
    pullup_max: number
  }
}
