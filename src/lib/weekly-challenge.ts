import { supabase } from '@/lib/supabase/client'
import { safeJsonParse } from '@/lib/utils'
import { db } from '@/lib/db'
import { allSetsPassed } from '@/lib/progress-engine'
import type { Program } from '@/data/plans/types'
import type { LocalWorkoutSession } from '@/lib/db'

// ── Types ──

export type ChallengeType =
  | 'volume' | 'marathon' | 'max_set' | 'grinder' | 'surplus' | 'dominator'
  | 'strong_finish' | 'session_starter' | 'big_day'
  | 'consistency' | 'daily' | 'early_bird' | 'night_owl' | 'weekend' | 'double'
  | 'weekday_quest' | 'morning_moves' | 'lunch_break' | 'evening_shift'
  | 'around_the_clock' | 'sunday_sweat'
  | 'precision' | 'perfect_pair' | 'hat_trick' | 'flawless_sets'
  | 'sharpshooter' | 'bounce_back' | 'metronome'
  | 'personal_best' | 'improvement' | 'volume_record' | 'session_record'
  | 'day_record' | 'beat_average'

export type ChallengeCategory = 'power' | 'habit' | 'skill' | 'records'

/** Type → category. The server draws one type per category each week. */
export const CHALLENGE_CATEGORY: Record<ChallengeType, ChallengeCategory> = {
  volume: 'power',
  marathon: 'power',
  max_set: 'power',
  grinder: 'power',
  surplus: 'power',
  dominator: 'power',
  strong_finish: 'power',
  session_starter: 'power',
  big_day: 'power',
  consistency: 'habit',
  daily: 'habit',
  early_bird: 'habit',
  night_owl: 'habit',
  weekend: 'habit',
  double: 'habit',
  weekday_quest: 'habit',
  morning_moves: 'habit',
  lunch_break: 'habit',
  evening_shift: 'habit',
  around_the_clock: 'habit',
  sunday_sweat: 'habit',
  precision: 'skill',
  perfect_pair: 'skill',
  hat_trick: 'skill',
  flawless_sets: 'skill',
  sharpshooter: 'skill',
  bounce_back: 'skill',
  metronome: 'skill',
  personal_best: 'records',
  improvement: 'records',
  volume_record: 'records',
  session_record: 'records',
  day_record: 'records',
  beat_average: 'records',
}

/** Display order for category grouping (matches the server ordering). */
export const CHALLENGE_CATEGORY_ORDER: ChallengeCategory[] = ['power', 'habit', 'skill', 'records']

export function typeCategory(type: ChallengeType): ChallengeCategory {
  // hasOwn — an inherited name ('constructor', 'toString'…) would otherwise
  // resolve to a function instead of a category.
  return Object.hasOwn(CHALLENGE_CATEGORY, type) ? CHALLENGE_CATEGORY[type] : 'power'
}

/** Guard for rows produced by a newer backend than this client understands —
 *  unknown types are skipped instead of crashing icon/label lookups.
 *  Object.hasOwn (not `in`) so inherited names like 'constructor' can't pass. */
export function isKnownChallengeType(type: string): type is ChallengeType {
  return Object.hasOwn(CHALLENGE_CATEGORY, type)
}

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

export function sessionsInRange(
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

/** Local calendar day key — distinct-day challenges count by the user's
 *  local day, not UTC (an evening session must land on the day the user
 *  experienced). Exported under an unambiguous name for the workout recap
 *  (home-summary.ts exports its own localDayKey with a different signature). */
function localDayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export { localDayKey as challengeLocalDayKey }

/** ISO week key (Monday-start) — used to bucket sessions per calendar week. */
function isoWeekKey(iso: string): string {
  const d = new Date(iso)
  const day = d.getDay() === 0 ? 7 : d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - day + 1)
  return `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`
}

/** Sessions that actually trained — recorded sets required, consistent with
 *  the consistency-type rule (a peeked/abandoned shell carries no signal). */
function trained(s: LocalWorkoutSession[]): LocalWorkoutSession[] {
  return s.filter((x) => x.setResults.length > 0)
}

/** Rep target of a single set — fixed/exact give an exact goal, 'max'
 *  sets carry a minimum expectation. */
export function setTargetReps(target: { kind: string; reps?: number; minReps?: number }): number {
  if (target.kind === 'max') return target.minReps ?? 0
  return target.reps ?? 0
}

function sessionRepTotal(s: LocalWorkoutSession): number {
  let total = 0
  for (const r of s.setResults) total += Math.max(0, r.actual ?? 0)
  return total
}

/** setResults ordered by setNumber — finalize dedupes+sorts, but imported
 *  backups could carry unsorted arrays. Edge-set metrics (first/last set,
 *  fail→pass order) must not trust insertion order. */
export function orderedSets(s: LocalWorkoutSession): LocalWorkoutSession['setResults'] {
  return [...s.setResults].sort((a, b) => a.setNumber - b.setNumber)
}

/** Absolute week index from the challenge's Monday — identical math to the
 *  server's floor(epoch/604800), so derived parameters match globally. */
export function challengeWeekIndex(startsAt: string): number {
  return Math.floor(new Date(startsAt).getTime() / 604800000)
}

/** weekday_quest: the drawn ISO weekday (1=Mon … 7=Sun). Steps by 3 through
 *  the 7 days (coprime → every day appears before repeating). */
export function challengeRequiredWeekday(startsAt: string): number {
  return 1 + ((challengeWeekIndex(startsAt) * 3) % 7 + 7) % 7
}

/** Local ISO weekday (1=Mon … 7=Sun) of a session. */
function sessionWeekday(iso: string): number {
  const d = new Date(iso).getDay()
  return d === 0 ? 7 : d
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

    case 'marathon': {
      // Best single-session rep total this week
      for (const s of sessions) {
        let sessionTotal = 0
        for (const r of s.setResults) sessionTotal += Math.max(0, r.actual ?? 0)
        if (sessionTotal > current) current = sessionTotal
      }
      break
    }

    case 'max_set': {
      // Best single set this week
      for (const s of sessions) {
        for (const r of s.setResults) {
          const actual = Math.max(0, r.actual ?? 0)
          if (actual > current) current = actual
        }
      }
      break
    }

    case 'grinder': {
      // Total completed sets this week
      for (const s of sessions) current += s.setResults.length
      break
    }

    case 'surplus': {
      // Bonus reps above each set's target — rewards overshooting the plan
      for (const s of sessions) {
        for (const r of s.setResults) {
          current += Math.max(0, (r.actual ?? 0) - setTargetReps(r.target))
        }
      }
      break
    }

    case 'dominator': {
      // Any single set at >=150% of its target
      current = sessions.some((s) =>
        s.setResults.some((r) => {
          const tgt = setTargetReps(r.target)
          return tgt > 0 && (r.actual ?? 0) >= Math.ceil(tgt * 1.5)
        }),
      )
        ? 1
        : 0
      break
    }

    case 'strong_finish': {
      current = sessions.some((s) => {
        const sets = orderedSets(s)
        return !!sets[sets.length - 1]?.passed
      })
        ? 1
        : 0
      break
    }

    case 'session_starter': {
      current = sessions.some((s) => orderedSets(s)[0]?.passed === true) ? 1 : 0
      break
    }

    case 'big_day': {
      // Best single-day rep total (sessions on the same day stack)
      const perDay = new Map<string, number>()
      for (const s of sessions) {
        const key = localDayKey(s.startedAt)
        perDay.set(key, (perDay.get(key) ?? 0) + sessionRepTotal(s))
      }
      for (const total of perDay.values()) {
        if (total > current) current = total
      }
      break
    }

    case 'consistency': {
      // Count completed sessions this week — a session with no recorded
      // sets carries no training signal and must not count.
      current = trained(sessions).length
      break
    }

    case 'daily': {
      // Sessions on N distinct local days
      current = new Set(trained(sessions).map((s) => localDayKey(s.startedAt))).size
      break
    }

    case 'early_bird': {
      current = trained(sessions).some((s) => new Date(s.startedAt).getHours() < 9) ? 1 : 0
      break
    }

    case 'night_owl': {
      current = trained(sessions).some((s) => new Date(s.startedAt).getHours() >= 20) ? 1 : 0
      break
    }

    case 'weekend': {
      current = trained(sessions).some((s) => {
        const day = new Date(s.startedAt).getDay()
        return day === 0 || day === 6
      })
        ? 1
        : 0
      break
    }

    case 'double': {
      const perDay = new Map<string, number>()
      for (const s of trained(sessions)) {
        const key = localDayKey(s.startedAt)
        perDay.set(key, (perDay.get(key) ?? 0) + 1)
      }
      current = [...perDay.values()].some((n) => n >= 2) ? 1 : 0
      break
    }

    case 'weekday_quest': {
      const required = challengeRequiredWeekday(challenge.starts_at)
      current = trained(sessions).some((s) => sessionWeekday(s.startedAt) === required) ? 1 : 0
      break
    }

    case 'morning_moves': {
      current = trained(sessions).some((s) => new Date(s.startedAt).getHours() < 12) ? 1 : 0
      break
    }

    case 'lunch_break': {
      current = trained(sessions).some((s) => {
        const h = new Date(s.startedAt).getHours()
        return h >= 11 && h < 14
      })
        ? 1
        : 0
      break
    }

    case 'evening_shift': {
      current = trained(sessions).some((s) => {
        const h = new Date(s.startedAt).getHours()
        return h >= 18 && h < 22
      })
        ? 1
        : 0
      break
    }

    case 'around_the_clock': {
      // Both halves required — progress shows how many are done (target 2)
      const early = trained(sessions).some((s) => new Date(s.startedAt).getHours() < 9)
      const late = trained(sessions).some((s) => new Date(s.startedAt).getHours() >= 20)
      current = (early ? 1 : 0) + (late ? 1 : 0)
      break
    }

    case 'sunday_sweat': {
      current = trained(sessions).some((s) => new Date(s.startedAt).getDay() === 0) ? 1 : 0
      break
    }

    case 'precision': {
      // 1 if any session has all sets passed, 0 otherwise
      current = sessions.some((s) => s.setResults.length > 0 && allSetsPassed(s.setResults))
        ? 1
        : 0
      break
    }

    case 'perfect_pair': {
      current = sessions.filter((s) => s.setResults.length > 0 && allSetsPassed(s.setResults)).length
      break
    }

    case 'hat_trick': {
      current = sessions.filter((s) => s.setResults.length > 0 && allSetsPassed(s.setResults)).length
      break
    }

    case 'flawless_sets': {
      // Count of individual sets at/above their target — partial credit,
      // unlike precision which needs the whole session clean.
      for (const s of sessions) {
        for (const r of s.setResults) {
          const tgt = setTargetReps(r.target)
          if (tgt > 0 && (r.actual ?? 0) >= tgt) current++
        }
      }
      break
    }

    case 'sharpshooter': {
      // A set landing exactly on target — only fixed/exact targets qualify
      // ('max' sets have a floor, not a bullseye).
      current = sessions.some((s) =>
        s.setResults.some(
          (r) => r.target.kind !== 'max' && setTargetReps(r.target) > 0 && (r.actual ?? 0) === setTargetReps(r.target),
        ),
      )
        ? 1
        : 0
      break
    }

    case 'bounce_back': {
      // Resilience — a failed set followed by a passed one in the same session
      current = sessions.some((s) => {
        let sawFail = false
        for (const r of orderedSets(s)) {
          if (!r.passed) sawFail = true
          else if (sawFail) return true
        }
        return false
      })
        ? 1
        : 0
      break
    }

    case 'metronome': {
      // Steady output — a session of >=3 sets whose rep spread is <= 2
      current = sessions.some((s) => {
        const actuals = s.setResults.map((r) => r.actual ?? 0)
        if (actuals.length < 3) return false
        return Math.max(...actuals) - Math.min(...actuals) <= 2
      })
        ? 1
        : 0
      break
    }

    case 'improvement': {
      // This week's total reps minus last week's — the delta is what the
      // leaderboard compares (a raw total would be incomparable across
      // users at different levels).
      let weekTotal = 0
      for (const s of sessions) {
        for (const r of s.setResults) weekTotal += Math.max(0, r.actual ?? 0)
      }
      const weekStartMs = new Date(challenge.starts_at).getTime()
      const prevStartMs = weekStartMs - 7 * 86400000
      let prevTotal = 0
      for (const s of all) {
        if (s.program !== program) continue
        const t = new Date(s.startedAt).getTime()
        if (t < prevStartMs || t >= weekStartMs) continue
        for (const r of s.setResults) prevTotal += Math.max(0, r.actual ?? 0)
      }
      // No baseline week → nothing to beat; first week establishes it.
      current = prevTotal > 0 ? Math.max(0, weekTotal - prevTotal) : 0
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

    case 'volume_record': {
      // This week's total minus the best-ever weekly total
      let weekTotal = 0
      for (const s of sessions) weekTotal += sessionRepTotal(s)
      const weekStartMs = new Date(challenge.starts_at).getTime()
      const prevWeeks = new Map<string, number>()
      for (const s of all) {
        if (s.program !== program) continue
        if (new Date(s.startedAt).getTime() >= weekStartMs) continue
        const key = isoWeekKey(s.startedAt)
        prevWeeks.set(key, (prevWeeks.get(key) ?? 0) + sessionRepTotal(s))
      }
      const prevBest = Math.max(0, ...prevWeeks.values())
      current = prevBest > 0 ? Math.max(0, weekTotal - prevBest) : 0
      break
    }

    case 'session_record': {
      // Best session this week minus best-ever session total
      let maxThisWeek = 0
      for (const s of sessions) {
        const t = sessionRepTotal(s)
        if (t > maxThisWeek) maxThisWeek = t
      }
      const weekStartMs = new Date(challenge.starts_at).getTime()
      let prevBest = 0
      for (const s of all) {
        if (s.program !== program) continue
        if (new Date(s.startedAt).getTime() >= weekStartMs) continue
        const t = sessionRepTotal(s)
        if (t > prevBest) prevBest = t
      }
      current = prevBest > 0 ? Math.max(0, maxThisWeek - prevBest) : 0
      break
    }

    case 'day_record': {
      // Best day this week minus best-ever day total
      const thisWeekDays = new Map<string, number>()
      for (const s of sessions) {
        const key = localDayKey(s.startedAt)
        thisWeekDays.set(key, (thisWeekDays.get(key) ?? 0) + sessionRepTotal(s))
      }
      const maxThisWeek = Math.max(0, ...thisWeekDays.values())
      const weekStartMs = new Date(challenge.starts_at).getTime()
      const prevDays = new Map<string, number>()
      for (const s of all) {
        if (s.program !== program) continue
        if (new Date(s.startedAt).getTime() >= weekStartMs) continue
        const key = localDayKey(s.startedAt)
        prevDays.set(key, (prevDays.get(key) ?? 0) + sessionRepTotal(s))
      }
      const prevBest = Math.max(0, ...prevDays.values())
      current = prevBest > 0 ? Math.max(0, maxThisWeek - prevBest) : 0
      break
    }

    case 'beat_average': {
      // This week's total minus the user's average week (last 4 active weeks)
      let weekTotal = 0
      for (const s of sessions) weekTotal += sessionRepTotal(s)
      const weekStartMs = new Date(challenge.starts_at).getTime()
      const fourWeeksAgoMs = weekStartMs - 4 * 7 * 86400000
      const prevWeeks = new Map<string, number>()
      for (const s of all) {
        if (s.program !== program) continue
        const t = new Date(s.startedAt).getTime()
        if (t < fourWeeksAgoMs || t >= weekStartMs) continue
        const key = isoWeekKey(s.startedAt)
        prevWeeks.set(key, (prevWeeks.get(key) ?? 0) + sessionRepTotal(s))
      }
      if (prevWeeks.size > 0) {
        const total = [...prevWeeks.values()].reduce((a, b) => a + b, 0)
        const avg = total / prevWeeks.size
        // Beat = strictly above average. A sub-0.5 positive delta (e.g. avg
        // 50.67 vs week 51) must not round down to 0 — that would mark the
        // challenge unachieved despite beating the average.
        current = avg > 0 && weekTotal > avg ? Math.max(1, Math.round(weekTotal - avg)) : 0
      }
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
    case 'marathon': {
      // Average session rep total — the typical single-workout volume
      let sessionSum = 0
      let counted = 0
      for (const s of recentSessions) {
        if (s.setResults.length === 0) continue
        let t = 0
        for (const r of s.setResults) t += Math.max(0, r.actual ?? 0)
        sessionSum += t
        counted++
      }
      recentAverage = counted > 0 ? Math.round(sessionSum / counted) : 0
      break
    }
    case 'max_set': {
      // Best single set seen recently — shows the bar the target sits above
      for (const s of recentSessions) {
        for (const r of s.setResults) {
          const actual = Math.max(0, r.actual ?? 0)
          if (actual > recentAverage) recentAverage = actual
        }
      }
      break
    }
    case 'grinder': {
      let totalSets = 0
      for (const s of recentSessions) totalSets += s.setResults.length
      recentAverage = totalSets > 0 ? Math.round(totalSets / divisor) : 0
      break
    }
    case 'consistency': {
      // Average weekly sessions over the last 4 weeks with activity — only
      // trained sessions count, matching the challenge metric itself.
      const trainedCount = trained(recentSessions).length
      recentAverage = trainedCount > 0 ? Math.round(trainedCount / divisor) : 0
      break
    }
    case 'daily': {
      const days = new Set(trained(recentSessions).map((s) => localDayKey(s.startedAt)))
      recentAverage = days.size > 0 ? Math.round(days.size / divisor) : 0
      break
    }
    case 'early_bird':
    case 'night_owl':
    case 'weekend':
    case 'double':
    case 'weekday_quest':
    case 'morning_moves':
    case 'lunch_break':
    case 'evening_shift':
    case 'around_the_clock':
    case 'sunday_sweat': {
      // How often the user already does this per active week — drives the
      // difficulty chip.
      const type = challenge.challenge_type
      const requiredDay = type === 'weekday_quest'
        ? challengeRequiredWeekday(challenge.starts_at)
        : -1
      let matches = 0
      const doubles = new Map<string, number>()
      const clockHalves = new Map<string, Set<'early' | 'late'>>()
      for (const s of trained(recentSessions)) {
        const h = new Date(s.startedAt).getHours()
        const d = new Date(s.startedAt).getDay()
        if (type === 'early_bird') {
          if (h < 9) matches++
        } else if (type === 'night_owl') {
          if (h >= 20) matches++
        } else if (type === 'weekend') {
          if (d === 0 || d === 6) matches++
        } else if (type === 'sunday_sweat') {
          if (d === 0) matches++
        } else if (type === 'morning_moves') {
          if (h < 12) matches++
        } else if (type === 'lunch_break') {
          if (h >= 11 && h < 14) matches++
        } else if (type === 'evening_shift') {
          if (h >= 18 && h < 22) matches++
        } else if (type === 'weekday_quest') {
          if (sessionWeekday(s.startedAt) === requiredDay) matches++
        } else if (type === 'around_the_clock') {
          const wk = isoWeekKey(s.startedAt)
          const set = clockHalves.get(wk) ?? new Set<'early' | 'late'>()
          if (h < 9) set.add('early')
          if (h >= 20) set.add('late')
          clockHalves.set(wk, set)
        } else {
          const key = localDayKey(s.startedAt)
          doubles.set(key, (doubles.get(key) ?? 0) + 1)
        }
      }
      if (type === 'double') {
        matches = [...doubles.values()].filter((n) => n >= 2).length
      } else if (type === 'around_the_clock') {
        matches = [...clockHalves.values()].filter((set) => set.size === 2).length
      }
      recentAverage = matches > 0 ? Math.round(matches / divisor) : 0
      break
    }
    case 'surplus': {
      let total = 0
      for (const s of recentSessions) {
        for (const r of s.setResults) {
          total += Math.max(0, (r.actual ?? 0) - setTargetReps(r.target))
        }
      }
      recentAverage = total > 0 ? Math.round(total / divisor) : 0
      break
    }
    case 'dominator':
    case 'strong_finish':
    case 'session_starter':
    case 'sharpshooter':
    case 'bounce_back':
    case 'metronome': {
      // Binary skill/power feats — count of matching sessions per active week
      const type = challenge.challenge_type
      const matches = recentSessions.filter((s) => {
        if (s.setResults.length === 0) return false
        switch (type) {
          case 'dominator':
            return s.setResults.some((r) => {
              const tgt = setTargetReps(r.target)
              return tgt > 0 && (r.actual ?? 0) >= Math.ceil(tgt * 1.5)
            })
          case 'strong_finish': {
            const sets = orderedSets(s)
            return sets[sets.length - 1]?.passed === true
          }
          case 'session_starter':
            return orderedSets(s)[0]?.passed === true
          case 'sharpshooter':
            return s.setResults.some(
              (r) => r.target.kind !== 'max' && setTargetReps(r.target) > 0 && (r.actual ?? 0) === setTargetReps(r.target),
            )
          case 'bounce_back': {
            let sawFail = false
            for (const r of orderedSets(s)) {
              if (!r.passed) sawFail = true
              else if (sawFail) return true
            }
            return false
          }
          case 'metronome': {
            const actuals = s.setResults.map((r) => r.actual ?? 0)
            return actuals.length >= 3 && Math.max(...actuals) - Math.min(...actuals) <= 2
          }
          default:
            return false
        }
      }).length
      recentAverage = matches > 0 ? Math.round(matches / divisor) : 0
      break
    }
    case 'big_day': {
      // Average best-day total over recent weeks
      const perDay = new Map<string, number>()
      for (const s of recentSessions) {
        const key = localDayKey(s.startedAt)
        perDay.set(key, (perDay.get(key) ?? 0) + sessionRepTotal(s))
      }
      const best = Math.max(0, ...perDay.values())
      recentAverage = best > 0 ? best : 0
      break
    }
    case 'flawless_sets': {
      let total = 0
      for (const s of recentSessions) {
        for (const r of s.setResults) {
          const tgt = setTargetReps(r.target)
          if (tgt > 0 && (r.actual ?? 0) >= tgt) total++
        }
      }
      recentAverage = total > 0 ? Math.round(total / divisor) : 0
      break
    }
    case 'hat_trick':
    case 'perfect_pair':
    case 'precision': {
      // Average weekly perfect sessions over the last 4 weeks with activity
      let perfectCount = 0
      for (const s of recentSessions) {
        if (s.setResults.length > 0 && allSetsPassed(s.setResults)) perfectCount++
      }
      recentAverage = perfectCount > 0 ? Math.round(perfectCount / divisor) : 0
      break
    }
    case 'improvement': {
      // Last week's total reps — the bar to beat this week
      const prevStartMs = weekStartMs - 7 * 86400000
      let prevTotal = 0
      for (const s of allSessions) {
        const t = new Date(s.startedAt).getTime()
        if (t < prevStartMs || t >= weekStartMs) continue
        for (const r of s.setResults) prevTotal += Math.max(0, r.actual ?? 0)
      }
      previousMax = prevTotal
      recentAverage = prevTotal
      break
    }
    case 'volume_record':
    case 'session_record':
    case 'day_record':
    case 'beat_average': {
      // The bar to beat — shown as "your average" context in the sheet.
      const type = challenge.challenge_type
      let bar = 0
      if (type === 'session_record') {
        for (const s of allSessions) {
          if (new Date(s.startedAt).getTime() >= weekStartMs) continue
          const t = sessionRepTotal(s)
          if (t > bar) bar = t
        }
      } else {
        const buckets = new Map<string, number>()
        for (const s of allSessions) {
          const t = new Date(s.startedAt).getTime()
          if (t >= weekStartMs) continue
          if (type === 'beat_average' && t < weekStartMs - 4 * 7 * 86400000) continue
          const key = type === 'day_record' ? localDayKey(s.startedAt) : isoWeekKey(s.startedAt)
          buckets.set(key, (buckets.get(key) ?? 0) + sessionRepTotal(s))
        }
        if (buckets.size > 0) {
          const vals = [...buckets.values()]
          bar = type === 'beat_average'
            ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
            : Math.max(...vals)
        }
      }
      // Bar to beat lives in previousMax — recentAverage stays 0 so the
      // sheet shows "your record" instead of mislabeling it an average, and
      // the difficulty chip stays 'unknown' (record-breaking can't be rated
      // from a target/average ratio).
      previousMax = bar
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
/** Pure pick over a pre-scored list — same type-diversity + recommended
 *  rules as selectRelevantChallenges, but lets callers keep the full scored
 *  list (e.g. contexts for every challenge, not just the picked ones). */
export function pickTopChallenges(scored: ScoredChallenge[], limit = 3): ScoredChallenge[] {
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

export async function selectRelevantChallenges(
  challenges: WeeklyChallenge[],
  progress: ChallengeProgress[],
  limit = 3,
  allSessions?: LocalWorkoutSession[],
): Promise<ScoredChallenge[]> {
  return pickTopChallenges(await scoreChallenges(challenges, progress, allSessions), limit)
}
