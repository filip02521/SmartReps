import { supabase } from '@/lib/supabase/client'
import { safeJsonParse } from '@/lib/utils'

export type PublicAchievementBadge = {
  achievement_id: string
  tier_level: number
  unlocked_at?: string
}

export type PublicProfile = {
  user_id: string
  display_name: string
  bio: string
  is_public: boolean
  total_sessions: number
  total_reps: number
  current_streak_weeks: number
  best_streak_weeks: number
  achievement_count: number
  top_achievements: PublicAchievementBadge[]
  showcase_slots: string[] | null
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
  achievement_count: number
  top_achievements: PublicAchievementBadge[]
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
  achievement_count: number
  top_achievements: PublicAchievementBadge[]
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
  const raw = safeJsonParse<ToggleFollowResult>(data)
  if (!raw) throw new Error('parse_error')
  return raw
}

/**
 * Get list of users I follow (with their public stats).
 */
export async function getFollowing(limit = 50): Promise<FolloweeProfile[]> {
  const { data, error } = await supabase.rpc('get_following', { p_limit: limit })
  if (error) throw error
  const raw = safeJsonParse(data)
  if (!Array.isArray(raw)) return []
  return raw as FolloweeProfile[]
}

/**
 * Get list of users who follow me (with their public stats).
 */
export async function getFollowers(limit = 50): Promise<FollowerProfile[]> {
  const { data, error } = await supabase.rpc('get_followers', { p_limit: limit })
  if (error) throw error
  const raw = safeJsonParse(data)
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
  const raw = safeJsonParse<FollowCounts>(data)
  return {
    followers: Number(raw?.followers ?? 0),
    following: Number(raw?.following ?? 0),
  }
}

/**
 * Upsert the current user's public profile.
 */
export async function upsertMyPublicProfile(args: {
  displayName?: string
  bio?: string
  isPublic?: boolean
  showcaseSlots?: string[] | null
}): Promise<PublicProfile> {
  const { data, error } = await supabase.rpc('upsert_my_public_profile', {
    p_display_name: args.displayName ?? '',
    p_bio: args.bio ?? '',
    p_is_public: args.isPublic ?? false,
    p_showcase_slots: args.showcaseSlots ?? null,
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('not_authenticated')) throw new Error('not_authenticated')
    if (msg.includes('display_name_too_long')) throw new Error('display_name_too_long')
    if (msg.includes('bio_too_long')) throw new Error('bio_too_long')
    throw error
  }
  const raw = safeJsonParse<PublicProfile>(data)
  if (!raw) throw new Error('parse_error')
  return raw
}

/**
 * Get the current user's public profile (if any).
 */
export async function getMyPublicProfile(): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc('get_my_public_profile')
  if (error) throw error
  if (!data) return null
  const raw = safeJsonParse<PublicProfile>(data)
  return raw
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
  const raw = safeJsonParse<PublicProfile & { is_following: boolean }>(data)
  return raw
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
  const raw = safeJsonParse<{
    total_sessions: number
    total_reps: number
    current_streak_weeks: number
    best_streak_weeks: number
    pushup_max: number
    pullup_max: number
  }>(data)
  return raw
}
