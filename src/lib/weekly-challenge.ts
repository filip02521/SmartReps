import { supabase } from '@/lib/supabase/client'
import { safeJsonParse } from '@/lib/utils'
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
    const raw = safeJsonParse<Omit<WeeklyChallenge, 'challenge_type'>>(legacyData)
    if (!raw) return []
    // Legacy challenges are always 'volume' type
    return [{ ...raw, challenge_type: 'volume' as ChallengeType }]
  }
  const raw = safeJsonParse(data)
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
      const lraw = safeJsonParse<SubmitResult>(legacyData)
      if (!lraw) throw new Error('parse_error')
      return lraw
    }
    if (msg.includes('not_authenticated')) throw new Error('not_authenticated')
    if (msg.includes('invalid_reps')) throw new Error('invalid_reps')
    if (msg.includes('challenge_not_active')) throw new Error('challenge_not_active')
    if (msg.includes('display_name_too_long')) throw new Error('display_name_too_long')
    throw error
  }
  const raw = safeJsonParse<SubmitResult>(data)
  if (!raw) throw new Error('parse_error')
  return raw
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
  const raw = safeJsonParse(data)
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
  const raw = safeJsonParse<ChallengeEntry>(data)
  return raw
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
 * Number of DISTINCT users participating in any active challenge this week.
 * Returns null when the RPC isn't deployed yet (migration 065) so callers
 * can fall back to summing per-challenge counts.
 */
export async function getActiveWeekParticipantCount(): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_active_weekly_participant_count')
  if (error) return null
  const n = Number(data)
  return Number.isFinite(n) ? n : null
}

/** Monthly leaderboard row — matches get_monthly_challenge_leaderboard RPC. */
export type MonthlyLeaderboardEntry = {
  user_id: string
  display_name: string
  /** Points: 100 per completed challenge + overage bonus; partial = % of target. */
  points: number
  /** How many challenges this user completed in the month. */
  completed: number
  rank: number
}

/**
 * Monthly cross-week leaderboard (migration 066).
 * Returns null when the RPC isn't deployed yet so callers can hide the view.
 * @param monthFirstDay optional first-of-month date (YYYY-MM-DD); defaults to current month.
 */
export async function getMonthlyChallengeLeaderboard(
  monthFirstDay?: string,
  limit = 50,
): Promise<MonthlyLeaderboardEntry[] | null> {
  const { data, error } = await supabase.rpc('get_monthly_challenge_leaderboard', {
    p_month: monthFirstDay ?? null,
    p_limit: limit,
  })
  if (error) return null
  const raw = safeJsonParse(data)
  if (!Array.isArray(raw)) return []
  return raw as MonthlyLeaderboardEntry[]
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

/** All completed sessions across programs — fetched once per card load and
 *  shared across per-challenge calculations (previously each challenge did
 *  its own full-table scan → ~24 scans for 12 challenges). */
async function getAllCompletedSessions(): Promise<LocalWorkoutSession[]> {
  return db.workoutSessions.where('status').equals('completed').toArray()
}

function sessionsInRange(
  sessions: LocalWorkoutSession[],
  program: Program,
  startsAt: string,
  endsAt: string,
): LocalWorkoutSession[] {
  const startMs = new Date(startsAt).getTime()
  const endMs = new Date(endsAt).getTime()
  return sessions.filter((s) => {
    if (s.program !== program) return false
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
  allSessions?: LocalWorkoutSession[],
): Promise<ChallengeProgress> {
  const program = challenge.program as Program
  const all = allSessions ?? (await getAllCompletedSessions())
  const sessions = sessionsInRange(all, program, challenge.starts_at, challenge.ends_at)
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
      // Count completed sessions this week — a session with no recorded
      // sets carries no training signal and must not count.
      current = sessions.filter((s) => s.setResults.length > 0).length
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
      // Progress = how many reps above the pre-week single-set record.
      let maxThisWeek = 0
      for (const s of sessions) {
        for (const r of s.setResults) {
          const actual = r.actual ?? 0
          if (actual > maxThisWeek) maxThisWeek = actual
        }
      }
      const weekStartMs = new Date(challenge.starts_at).getTime()
      let prevMax = 0
      for (const s of all) {
        if (s.program !== program) continue
        if (new Date(s.startedAt).getTime() >= weekStartMs) continue
        for (const r of s.setResults) {
          const actual = r.actual ?? 0
          if (actual > prevMax) prevMax = actual
        }
      }
      // No baseline record → nothing to beat. The first week establishes
      // the record instead of auto-completing the challenge (a raw max
      // value on the leaderboard would be incomparable to others' deltas).
      current = prevMax > 0 && maxThisWeek > prevMax ? maxThisWeek - prevMax : 0
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
  allSessions?: LocalWorkoutSession[],
): Promise<ChallengeProgress[]> {
  const all = allSessions ?? (await getAllCompletedSessions())
  return Promise.all(challenges.map((c) => calculateChallengeProgress(c, all)))
}

/**
 * Auto-submit progress for all challenges where the user has made progress.
 * Called when the challenge card loads or after a session is completed.
 * Only submits if progress > 0 to avoid creating empty entries.
 * Returns the ids of challenges whose progress was successfully submitted,
 * so callers can skip re-submitting unchanged values.
 */
export async function autoSubmitChallengeProgress(
  challenges: WeeklyChallenge[],
  progress: ChallengeProgress[],
  displayName: string,
): Promise<Set<string>> {
  const submitted = new Set<string>()
  const submissions = challenges.map((ch, i) => {
    const p = progress[i]
    if (!p || p.current <= 0) return null
    return submitChallengeProgress({
      challengeId: ch.id,
      progressValue: p.current,
      displayName,
    })
      .then(() => submitted.add(ch.id))
      .catch(() => {
        // Non-critical — leaderboard just won't update
      })
  }).filter(Boolean)

  await Promise.all(submissions)
  return submitted
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
  allSessionsInput?: LocalWorkoutSession[],
): Promise<ChallengeContext> {
  const program = challenge.program as Program
  const weekStartMs = new Date(challenge.starts_at).getTime()
  const fourWeeksAgoMs = weekStartMs - 4 * 7 * 86400000

  const allSessions = (allSessionsInput ?? (await getAllCompletedSessions()))
    .filter((s) => s.program === program)

  // Sessions in the last 4 weeks (before this week)
  const recentSessions = allSessions.filter((s) => {
    const t = new Date(s.startedAt).getTime()
    return t >= fourWeeksAgoMs && t < weekStartMs
  })

  // Average is per ACTIVE week — dividing by 4 flat would understate the
  // typical week for users who started training recently (e.g. 1 week of
  // data → total/4 → difficulty mislabeled "hard").
  const activeWeeks = new Set(
    recentSessions.map((s) => {
      const d = new Date(s.startedAt)
      const day = d.getDay() === 0 ? 7 : d.getDay() // Monday-start week
      const monday = new Date(d)
      monday.setDate(d.getDate() - day + 1)
      return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`
    }),
  )
  const divisor = Math.max(1, activeWeeks.size)

  let recentAverage = 0
  let previousMax = 0

  switch (challenge.challenge_type) {
    case 'volume': {
      // Average weekly reps over the last 4 weeks with activity
      let totalReps = 0
      for (const s of recentSessions) {
        for (const r of s.setResults) {
          totalReps += Math.max(0, r.actual ?? 0)
        }
      }
      recentAverage = recentSessions.length > 0 ? Math.round(totalReps / divisor) : 0
      break
    }
    case 'consistency': {
      // Average weekly sessions over the last 4 weeks with activity
      recentAverage = recentSessions.length > 0 ? Math.round(recentSessions.length / divisor) : 0
      break
    }
    case 'precision': {
      // Average weekly perfect sessions over the last 4 weeks with activity
      let perfectCount = 0
      for (const s of recentSessions) {
        if (s.setResults.length > 0 && allSetsPassed(s.setResults)) perfectCount++
      }
      recentAverage = perfectCount > 0 ? Math.round(perfectCount / divisor) : 0
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
  allSessions?: LocalWorkoutSession[],
): Promise<ScoredChallenge[]> {
  // Get recent sessions for activity scoring (last 2 weeks)
  const twoWeeksAgoMs = Date.now() - 14 * 86400000
  const all = allSessions ?? (await getAllCompletedSessions())
  const recentByProgram = new Map<Program, number>()
  for (const s of all) {
    if (new Date(s.startedAt).getTime() < twoWeeksAgoMs) continue
    const prog = s.program as Program
    recentByProgram.set(prog, (recentByProgram.get(prog) ?? 0) + 1)
  }

  const scored: ScoredChallenge[] = []

  for (let i = 0; i < challenges.length; i++) {
    const ch = challenges[i]
    const p = progress[i]
    const context = await getChallengeContext(ch, all)
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
 * Greedy type diversity: pass 1 takes the best-scored challenge of each
 * type (so the top list isn't 3× "volume" across programs); pass 2 fills
 * any remaining slots by score.
 */
export async function selectRelevantChallenges(
  challenges: WeeklyChallenge[],
  progress: ChallengeProgress[],
  limit = 3,
  allSessions?: LocalWorkoutSession[],
): Promise<ScoredChallenge[]> {
  const scored = await scoreChallenges(challenges, progress, allSessions)

  const picked: ScoredChallenge[] = []
  const seenTypes = new Set<ChallengeType>()
  for (const s of scored) {
    if (picked.length >= limit) break
    if (seenTypes.has(s.challenge.challenge_type)) continue
    seenTypes.add(s.challenge.challenge_type)
    picked.push(s)
  }
  for (const s of scored) {
    if (picked.length >= limit) break
    if (!picked.includes(s)) picked.push(s)
  }

  // Recompute `recommended` — the top-scored challenge may not be picked
  // first in the diversified list.
  for (const s of scored) s.recommended = false
  if (picked.length > 0) picked[0].recommended = true

  return picked
}
