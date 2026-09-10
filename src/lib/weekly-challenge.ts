import { supabase } from '@/lib/supabase/client'
import { db } from '@/lib/db'
import { allSetsPassed } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'
import type { LocalWorkoutSession } from '@/lib/db'

// ── Types ──

export type ChallengeType = 'volume' | 'consistency' | 'precision' | 'personal_best'

export type WeeklyChallenge = {
  id: string
  week_key: string
  program: 'pushups' | 'pullups' | 'squats'
  challenge_type: ChallengeType
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

/** Leaderboard row — matches the RPC output shape exactly. */
export type LeaderboardEntry = {
  id: string
  user_id: string
  total_reps: number
  display_name: string
  created_at: string
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

/** Auto-calculated progress for a challenge, derived from local session data. */
export type ChallengeProgress = {
  challengeId: string
  challengeType: ChallengeType
  program: Program
  current: number
  target: number
  achieved: boolean
  pct: number
}

/** Max display name length enforced by the backend CHECK constraint. */
export const MAX_DISPLAY_NAME_LENGTH = 60

// ── Server functions ──

/**
 * Get all active weekly challenges for the current week.
 * Falls back to the legacy singular RPC if the new plural RPC
 * hasn't been deployed yet (migration 062 not applied).
 */
export async function getActiveWeeklyChallenges(): Promise<WeeklyChallenge[]> {
  const { data, error } = await supabase.rpc('get_active_weekly_challenges')
  if (error) {
    // Fallback: try legacy singular RPC (pre-migration 062)
    const { data: legacyData, error: legacyError } = await supabase.rpc('get_active_weekly_challenge')
    if (legacyError) throw error // throw original error
    if (!legacyData) return []
    const raw = typeof legacyData === 'string' ? (JSON.parse(legacyData) as unknown) : legacyData
    const ch = raw as Omit<WeeklyChallenge, 'challenge_type'>
    // Legacy challenges are always 'volume' type
    return [{ ...ch, challenge_type: 'volume' as ChallengeType }]
  }
  const raw = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
  if (!Array.isArray(raw)) return []
  return raw as WeeklyChallenge[]
}

/**
 * Submit auto-calculated progress for a challenge (upsert — best wins).
 * Falls back to the legacy submit_weekly_challenge_entry RPC if the new
 * submit_challenge_progress RPC hasn't been deployed yet.
 */
export async function submitChallengeProgress(args: {
  challengeId: string
  progressValue: number
  displayName?: string
}): Promise<SubmitResult> {
  const { data, error } = await supabase.rpc('submit_challenge_progress', {
    p_challenge_id: args.challengeId,
    p_progress_value: args.progressValue,
    p_display_name: (args.displayName ?? '').slice(0, MAX_DISPLAY_NAME_LENGTH),
  })
  if (error) {
    const msg = error.message ?? ''
    // If the function doesn't exist, fall back to legacy RPC
    if (msg.includes('Could not find the function') || msg.includes('function does not exist')) {
      const { data: legacyData, error: legacyError } = await supabase.rpc('submit_weekly_challenge_entry', {
        p_challenge_id: args.challengeId,
        p_total_reps: args.progressValue,
        p_display_name: (args.displayName ?? '').slice(0, MAX_DISPLAY_NAME_LENGTH),
      })
      if (legacyError) {
        const lmsg = legacyError.message ?? ''
        if (lmsg.includes('not_authenticated')) throw new Error('not_authenticated')
        if (lmsg.includes('invalid_reps')) throw new Error('invalid_reps')
        if (lmsg.includes('challenge_not_active')) throw new Error('challenge_not_active')
        if (lmsg.includes('display_name_too_long')) throw new Error('display_name_too_long')
        throw legacyError
      }
      const lraw = typeof legacyData === 'string' ? (JSON.parse(legacyData) as unknown) : legacyData
      return lraw as SubmitResult
    }
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
 * Ensure challenges exist for the current week.
 * Calls the Supabase RPC which creates them if none exist (idempotent).
 */
export async function ensureWeeklyChallenge(): Promise<boolean> {
  const { error } = await supabase.rpc('ensure_weekly_challenge')
  if (error) return false
  return true
}

// ── Progress calculation (client-side, anti-cheat) ──

/**
 * Get completed sessions for a program within a date range.
 * Uses the Dexie compound index [program+status] for fast lookup.
 */
async function getCompletedSessionsInRange(
  program: Program,
  startsAt: string,
  endsAt: string,
): Promise<LocalWorkoutSession[]> {
  const startMs = new Date(startsAt).getTime()
  const endMs = new Date(endsAt).getTime()
  const all = await db.workoutSessions
    .where('[program+status]')
    .equals([program, 'completed'])
    .toArray()
  return all.filter((s) => {
    const t = new Date(s.startedAt).getTime()
    return t >= startMs && t < endMs
  })
}

/**
 * Calculate progress for a single challenge from local session data.
 * This is the anti-cheat layer — progress is derived from actual workouts,
 * not manually entered by the user.
 */
export async function calculateChallengeProgress(
  challenge: WeeklyChallenge,
): Promise<ChallengeProgress> {
  const program = challenge.program as Program
  const sessions = await getCompletedSessionsInRange(
    program,
    challenge.starts_at,
    challenge.ends_at,
  )
  const target = challenge.target_reps

  let current = 0

  switch (challenge.challenge_type) {
    case 'volume': {
      // Sum actual reps from all completed sessions
      for (const s of sessions) {
        for (const r of s.setResults) {
          current += Math.max(0, r.actual ?? 0)
        }
      }
      break
    }

    case 'consistency': {
      // Count completed sessions this week
      current = sessions.length
      break
    }

    case 'precision': {
      // 1 if any session has all sets passed, 0 otherwise
      current = sessions.some((s) => s.setResults.length > 0 && allSetsPassed(s.setResults))
        ? 1
        : 0
      break
    }

    case 'personal_best': {
      // Check if any session this week has a higher max than previous sessions
      // (excluding this week's sessions). The "current" is the highest single-set
      // actual from this week's sessions.
      let maxThisWeek = 0
      for (const s of sessions) {
        for (const r of s.setResults) {
          const actual = r.actual ?? 0
          if (actual > maxThisWeek) maxThisWeek = actual
        }
      }
      // Get previous max (from sessions before this week)
      const prevSessions = await db.workoutSessions
        .where('[program+status]')
        .equals([program, 'completed'])
        .toArray()
      const weekStartMs = new Date(challenge.starts_at).getTime()
      let prevMax = 0
      for (const s of prevSessions) {
        if (new Date(s.startedAt).getTime() >= weekStartMs) continue
        for (const r of s.setResults) {
          const actual = r.actual ?? 0
          if (actual > prevMax) prevMax = actual
        }
      }
      // Progress = how many reps above previous max (0 if not beaten)
      current = maxThisWeek > prevMax ? maxThisWeek - prevMax : 0
      break
    }
  }

  const achieved = current >= target
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0

  return {
    challengeId: challenge.id,
    challengeType: challenge.challenge_type,
    program,
    current,
    target,
    achieved,
    pct,
  }
}

/**
 * Calculate progress for all active challenges.
 */
export async function calculateAllChallengeProgress(
  challenges: WeeklyChallenge[],
): Promise<ChallengeProgress[]> {
  return Promise.all(challenges.map((c) => calculateChallengeProgress(c)))
}

/**
 * Auto-submit progress for all challenges where the user has made progress.
 * Called when the challenge card loads or after a session is completed.
 * Only submits if progress > 0 to avoid creating empty entries.
 */
export async function autoSubmitChallengeProgress(
  challenges: WeeklyChallenge[],
  progress: ChallengeProgress[],
  displayName: string,
): Promise<void> {
  const submissions = challenges.map((ch, i) => {
    const p = progress[i]
    if (!p || p.current <= 0) return null
    return submitChallengeProgress({
      challengeId: ch.id,
      progressValue: p.current,
      displayName,
    }).catch(() => {
      // Non-critical — leaderboard just won't update
    })
  }).filter(Boolean)

  await Promise.all(submissions)
}

// ── Personalized challenge selection ──

/**
 * Recent average context for a challenge — shows the user's typical performance
 * so they can judge whether the target is achievable.
 */
export type ChallengeContext = {
  /** User's average weekly metric over the last 4 weeks (reps for volume, sessions for consistency). */
  recentAverage: number
  /** Previous max single-set reps (for personal_best only). */
  previousMax: number
  /** Difficulty rating based on comparing target to recent average. */
  difficulty: 'easy' | 'challenging' | 'hard' | 'unknown'
}

/**
 * Calculate the user's recent average for a challenge's metric.
 * Looks at the last 4 weeks of completed sessions.
 */
export async function getChallengeContext(
  challenge: WeeklyChallenge,
): Promise<ChallengeContext> {
  const program = challenge.program as Program
  const weekStartMs = new Date(challenge.starts_at).getTime()
  const fourWeeksAgoMs = weekStartMs - 4 * 7 * 86400000

  const allSessions = await db.workoutSessions
    .where('[program+status]')
    .equals([program, 'completed'])
    .toArray()

  // Sessions in the last 4 weeks (before this week)
  const recentSessions = allSessions.filter((s) => {
    const t = new Date(s.startedAt).getTime()
    return t >= fourWeeksAgoMs && t < weekStartMs
  })

  let recentAverage = 0
  let previousMax = 0

  switch (challenge.challenge_type) {
    case 'volume': {
      // Average weekly reps over last 4 weeks
      let totalReps = 0
      for (const s of recentSessions) {
        for (const r of s.setResults) {
          totalReps += Math.max(0, r.actual ?? 0)
        }
      }
      recentAverage = recentSessions.length > 0 ? Math.round(totalReps / 4) : 0
      break
    }
    case 'consistency': {
      // Average weekly sessions over last 4 weeks
      recentAverage = Math.round(recentSessions.length / 4)
      break
    }
    case 'precision': {
      // Average weekly perfect sessions over last 4 weeks
      let perfectCount = 0
      for (const s of recentSessions) {
        if (s.setResults.length > 0 && allSetsPassed(s.setResults)) perfectCount++
      }
      recentAverage = Math.round(perfectCount / 4)
      break
    }
    case 'personal_best': {
      // Previous max from all sessions before this week
      for (const s of allSessions) {
        if (new Date(s.startedAt).getTime() >= weekStartMs) continue
        for (const r of s.setResults) {
          const actual = r.actual ?? 0
          if (actual > previousMax) previousMax = actual
        }
      }
      recentAverage = previousMax
      break
    }
  }

  // Difficulty rating
  let difficulty: ChallengeContext['difficulty'] = 'unknown'
  if (recentAverage > 0 && challenge.target_reps > 0) {
    const ratio = challenge.target_reps / recentAverage
    if (ratio <= 0.8) difficulty = 'easy'
    else if (ratio <= 1.2) difficulty = 'challenging'
    else difficulty = 'hard'
  }

  return { recentAverage, previousMax, difficulty }
}

/**
 * Scored challenge for personalized selection.
 */
export type ScoredChallenge = {
  challenge: WeeklyChallenge
  score: number
  context: ChallengeContext
  recommended: boolean
}

/**
 * Score and rank challenges by relevance to the user.
 * Factors:
 * - Recent activity in the program (+2 per session in last 2 weeks, max +6)
 * - Challenge not yet achieved (+3)
 * - Type diversity (penalize same type across programs: -2 per duplicate)
 * - Difficulty sweet spot: "challenging" gets +2, "easy" gets +1, "hard" gets +0.5, "unknown" gets +1
 */
export async function scoreChallenges(
  challenges: WeeklyChallenge[],
  progress: ChallengeProgress[],
): Promise<ScoredChallenge[]> {
  // Get recent sessions for activity scoring (last 2 weeks)
  const twoWeeksAgoMs = Date.now() - 14 * 86400000
  const allRecentSessions = await db.workoutSessions
    .where('status')
    .equals('completed')
    .toArray()
  const recentByProgram = new Map<Program, number>()
  for (const s of allRecentSessions) {
    if (new Date(s.startedAt).getTime() < twoWeeksAgoMs) continue
    const prog = s.program as Program
    recentByProgram.set(prog, (recentByProgram.get(prog) ?? 0) + 1)
  }

  // Track type counts for diversity penalty
  const typeCounts = new Map<ChallengeType, number>()
  for (const ch of challenges) {
    typeCounts.set(ch.challenge_type, (typeCounts.get(ch.challenge_type) ?? 0) + 1)
  }

  const scored: ScoredChallenge[] = []

  for (let i = 0; i < challenges.length; i++) {
    const ch = challenges[i]
    const p = progress[i]
    const context = await getChallengeContext(ch)
    const prog = ch.program as Program

    let score = 0

    // Recent activity in this program
    const activityCount = recentByProgram.get(prog) ?? 0
    score += Math.min(6, activityCount * 2)

    // Not yet achieved
    if (p && !p.achieved) score += 3
    if (p && p.achieved) score -= 1 // Already done — lower priority

    // Difficulty sweet spot
    switch (context.difficulty) {
      case 'challenging': score += 2; break
      case 'easy': score += 1; break
      case 'unknown': score += 1; break
      case 'hard': score += 0.5; break
    }

    // Type diversity penalty (if multiple challenges have same type, penalize duplicates)
    const typeCount = typeCounts.get(ch.challenge_type) ?? 1
    if (typeCount > 1) score -= 1

    scored.push({ challenge: ch, score, context, recommended: false })
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score)

  // Mark top challenge as recommended
  if (scored.length > 0) {
    scored[0].recommended = true
  }

  return scored
}

/**
 * Select the top N most relevant challenges for the user.
 * Limits to 3 to keep the dashboard focused.
 */
export async function selectRelevantChallenges(
  challenges: WeeklyChallenge[],
  progress: ChallengeProgress[],
  limit = 3,
): Promise<ScoredChallenge[]> {
  const scored = await scoreChallenges(challenges, progress)
  return scored.slice(0, limit)
}
