import { supabase } from '@/lib/supabase/client'

export type WeeklyChallenge = {
  id: string
  week_key: string
  program: 'pushups' | 'pullups'
  target_reps: number
  title: string
  description: string
  starts_at: string
  ends_at: string
}

export type ChallengeEntry = {
  id: string
  challenge_id: string
  total_reps: number
  display_name: string
  created_at: string
  updated_at: string
}

export type LeaderboardEntry = ChallengeEntry & {
  user_id: string
  rank: number
}

export type SubmitResult = {
  id: string
  challenge_id: string
  total_reps: number
  display_name: string
  created_at: string
  updated_at: string
  is_new_best: boolean
}

/**
 * Get the currently active weekly challenge (if any).
 */
export async function getActiveWeeklyChallenge(): Promise<WeeklyChallenge | null> {
  const { data, error } = await supabase.rpc('get_active_weekly_challenge')
  if (error) throw error
  if (!data) return null
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return raw as WeeklyChallenge
}

/**
 * Submit or update the current user's entry for a challenge.
 * Only updates if the new result is better than the existing one.
 */
export async function submitWeeklyChallengeEntry(args: {
  challengeId: string
  totalReps: number
  displayName?: string
}): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_weekly_challenge_entry', {
    p_challenge_id: args.challengeId,
    p_total_reps: args.totalReps,
    p_display_name: args.displayName ?? '',
  })
  if (error) {
    const msg = error.message ?? ''
    if (msg.includes('not_authenticated')) throw new Error('not_authenticated')
    if (msg.includes('invalid_reps')) throw new Error('invalid_reps')
    if (msg.includes('challenge_not_active')) throw new Error('challenge_not_active')
    if (msg.includes('display_name_too_long')) throw new Error('display_name_too_long')
    throw error
  }
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return raw as SubmitResult
}

/**
 * Get leaderboard (top entries) for a challenge.
 */
export async function getWeeklyChallengeLeaderboard(
  challengeId: string,
  limit = 50,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_weekly_challenge_leaderboard', {
    p_challenge_id: challengeId,
    p_limit: limit,
  })
  if (error) throw error
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  if (!Array.isArray(raw)) return []
  return raw as LeaderboardEntry[]
}

/**
 * Get the current user's entry for a challenge (if any).
 */
export async function getMyWeeklyChallengeEntry(
  challengeId: string,
): Promise<ChallengeEntry | null> {
  const { data, error } = await supabase.rpc('get_my_weekly_challenge_entry', {
    p_challenge_id: challengeId,
  })
  if (error) throw error
  if (!data) return null
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  return raw as ChallengeEntry
}

/**
 * Get participant count for a challenge.
 */
export async function getWeeklyChallengeParticipantCount(
  challengeId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('get_weekly_challenge_participant_count', {
    p_challenge_id: challengeId,
  })
  if (error) throw error
  return Number(data ?? 0)
}

/**
 * Get ISO week key for a date (e.g. "2025-W03").
 */
export function getWeekKey(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
