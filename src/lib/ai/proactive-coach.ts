/**
 * Proactive AI Coach — local + AI-powered insights generated automatically.
 *
 * Four features:
 * 1. Smart rest suggestions — comparison with previous session during rest timer
 * 2. Post-workout auto-insight — 1-sentence insight in session summary
 * 3. Plateau detector — warning after 3 sessions without progress
 * 4. Weekly report — coach summary card on dashboard + push notification
 *
 * Hybrid model: local insights are always available (free, instant).
 * AI insights replace local ones when the user has Pro access — via hosted
 * SmartReps AI (managed) or a configured BYOK key — and `aiProactiveCoach`
 * is enabled in settings.
 */

import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import type { LocalWorkoutSession, LocalAiInsight } from '@/lib/db'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import { computeBuiltinSessionInsights, computeCustomSessionInsights, primarySetValue, sameTrainingDay } from '@/lib/session-summary-insights'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import { customSessionTotalReps } from '@/lib/custom-session-comparison'
import { getProgramLabel } from '@/lib/plan-resolver'
import { deleteAiInsight } from '@/lib/sync'
import { parseJsonResponse, AiApiError, isGeminiEndpoint } from './ai-client'
import { aiChat, type AiContext } from './managed-client'
import { buildPostWorkoutPrompt, buildWeeklyReportPrompt } from './prompts'
import type { ActivityInsights } from '@/lib/weekly-recap'

// ─── AI Insight Retention ──────────────────────────────────────────────────

/** Maximum number of AI insights to retain locally. Older insights are pruned
 *  to prevent unbounded growth. Dismissed insights are pruned first, then
 *  oldest undismissed insights. */
const MAX_AI_INSIGHTS = 200

/** Prune old/dismissed AI insights to prevent unbounded local storage growth.
 *  Called after new insights are saved. */
export async function pruneOldAiInsights(): Promise<void> {
  const all = await db.aiInsights.toArray()
  if (all.length <= MAX_AI_INSIGHTS) return

  // Sort: dismissed first (oldest dismissed pruned before any undismissed),
  // then by createdAt ascending.
  const sorted = all.sort((a, b) => {
    const aDismissed = a.dismissedAt ? 0 : 1
    const bDismissed = b.dismissedAt ? 0 : 1
    if (aDismissed !== bDismissed) return aDismissed - bDismissed
    const aTime = new Date(a.createdAt).getTime()
    const bTime = new Date(b.createdAt).getTime()
    // Treat invalid dates as 0 (oldest) so they get pruned first
    const aSafe = Number.isFinite(aTime) ? aTime : 0
    const bSafe = Number.isFinite(bTime) ? bTime : 0
    return aSafe - bSafe
  })

  const toDelete = sorted.slice(0, all.length - MAX_AI_INSIGHTS)
  for (const insight of toDelete) {
    if (!insight?.id) continue
    // Tombstoned delete so pruned rows don't resurrect from the cloud on
    // other devices or a fresh install.
    await deleteAiInsight(insight)
  }
}

// ─── Smart Rest Suggestions ────────────────────────────────────────────────

/**
 * Build a coach suggestion shown during rest timer, comparing the upcoming
 * set target with what the user achieved in the same set last session.
 *
 * Returns null when there's nothing motivating to say (e.g. previous was
 * below target — don't demotivate).
 */
export function getSmartRestSuggestion(
  previousActual: number | undefined,
  currentTarget: number,
  unit: 'reps' | 'seconds' = 'reps',
  hasHistory = false,
): string | null {
  // Treat undefined or 0 as "no meaningful history for this set" —
  // 0 reps likely means the set was skipped or failed, not a baseline.
  if (previousActual === undefined || previousActual <= 0) {
    // Distinguish "first time ever" from "new day/set combination"
    return hasHistory ? pl.coachRestSuggestionNewCombination : pl.coachRestSuggestionFirstTime
  }
  if (previousActual > currentTarget) {
    return unit === 'seconds'
      ? pl.coachRestSuggestionImprovedTime(previousActual)
      : pl.coachRestSuggestionImproved(previousActual)
  }
  if (previousActual === currentTarget) {
    return pl.coachRestSuggestionUnchanged
  }
  // previousActual < currentTarget — encourage instead of hiding
  const diff = currentTarget - previousActual
  return unit === 'seconds'
    ? pl.coachRestSuggestionChallengeTime(currentTarget, diff)
    : pl.coachRestSuggestionChallenge(currentTarget, diff)
}

// ─── Post-Workout Auto-Insight ─────────────────────────────────────────────

/** Sorted exercise-id signature for a custom session — two sessions of the
 *  same plan day are only comparable when they trained the same exercises.
 *  A plan edit (swapped/added exercises) starts a fresh comparison window. */
function exerciseSignature(session: LocalWorkoutSession): string {
  return (session.exerciseLogs ?? [])
    .map((l) => l.exerciseId)
    .sort()
    .join(',')
}

/** Consecutive sessions (incl. current) on the same training day where each
 *  beat its predecessor's progression metric. */
function improvementStreak(
  session: LocalWorkoutSession,
  historicalSessions: LocalWorkoutSession[],
): number {
  const group = historicalSessions
    .filter((s) => s.id !== session.id && s.status === 'completed' && sameTrainingDay(s, session))
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())
  const chain = [...group, session]
  let streak = 1
  for (let i = chain.length - 1; i > 0; i--) {
    const curr = chain[i]
    const prev = chain[i - 1]
    if (!curr || !prev) break
    if (sessionProgressionMetric(curr) > sessionProgressionMetric(prev)) streak++
    else break
  }
  return streak
}

/** Passed/total set counts for the failed-session message. */
function passedSetCounts(session: LocalWorkoutSession): { done: number; total: number } {
  if (isCustomWorkoutSession(session) && session.exerciseLogs) {
    const sets = session.exerciseLogs.flatMap((l) => l.sets)
    return { done: sets.filter((s) => s.passed).length, total: sets.length }
  }
  const rows = session.setResults ?? []
  return { done: rows.filter((r) => r.passed).length, total: rows.length }
}

function buildLocalPostWorkoutInsight(
  session: LocalWorkoutSession,
  previous: LocalWorkoutSession | undefined,
  historicalSessions: LocalWorkoutSession[],
  exercises: ExerciseDefinition[],
): { title: string; body: string; tone: LocalAiInsight['tone'] } {
  const isCustom = isCustomWorkoutSession(session)
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]))

  const insights = isCustom
    ? computeCustomSessionInsights({ current: session, previous, exerciseMap, historicalSessions })
    : computeBuiltinSessionInsights({ current: session, previous, historicalSessions })

  const setInsights = [...insights.setInsights.values()]
  const improvedSets = setInsights.filter((i) => i.kind === 'improved')
  const downSets = setInsights.filter((i) => i.kind === 'down')
  const failedSets = setInsights.filter((i) => i.kind === 'failed')
  // Comparable sets = ones with a previous counterpart (not 'none'/'failed')
  const comparableSets = setInsights.filter((i) => i.kind !== 'none' && i.kind !== 'failed')

  // Determine dominant insight tone — priority: failed session > PR > progress > down > unchanged
  // If the session as a whole failed, lead with that even if some sets improved
  if (session.passed === false) {
    const { done, total } = passedSetCounts(session)
    return {
      title: pl.coachPostWorkoutTitle,
      body: total > 0 ? pl.coachPostWorkoutLocalFailedSets(done, total) : pl.coachPostWorkoutLocalFailed,
      tone: 'warning',
    }
  }
  if (insights.prCount > 0) {
    // Vary message based on how many PRs
    if (insights.prCount >= 3) {
      return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalPrMulti(insights.prCount), tone: 'success' }
    }
    return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalPr, tone: 'success' }
  }

  // Three-way dominance among improved/down/failed — custom sessions always
  // complete with passed=true, so below-target sets surface as 'failed' kinds
  // and must not silently fall through to "unchanged".
  const maxCount = Math.max(improvedSets.length, downSets.length, failedSets.length)
  const dominantCount = [improvedSets.length, downSets.length, failedSets.length].filter(
    (c) => c === maxCount,
  ).length

  if (maxCount === 0) {
    // No comparable signal — either first time on this training day (all 'none')
    // or a repeat performance (all 'unchanged').
    const hasUnchanged = setInsights.some((i) => i.kind === 'unchanged')
    return {
      title: pl.coachPostWorkoutTitle,
      body: hasUnchanged ? pl.coachPostWorkoutLocalUnchanged : pl.coachPostWorkoutLocalFirst,
      tone: 'insight',
    }
  }
  if (dominantCount > 1) {
    // Tie between categories — honest "mixed" message
    return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalMixed, tone: 'insight' }
  }
  if (improvedSets.length === maxCount) {
    // 3+ consecutive improving sessions on this training day — highlight the streak
    const streak = improvementStreak(session, historicalSessions)
    if (streak >= 3) {
      return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalStreak(streak), tone: 'success' }
    }
    const bestDelta = Math.max(...improvedSets.map((i) => i.deltaVsPrevious ?? 0))
    if (improvedSets.length === comparableSets.length && comparableSets.length > 1) {
      return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalProgressAll(bestDelta, comparableSets.length), tone: 'insight' }
    }
    return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalProgress(bestDelta), tone: 'insight' }
  }
  if (downSets.length === maxCount) {
    const worstDelta = Math.min(...downSets.map((i) => i.deltaVsPrevious ?? 0))
    return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalDown(Math.abs(worstDelta)), tone: 'warning' }
  }
  // failed dominates — sets below target
  return {
    title: pl.coachPostWorkoutTitle,
    body: pl.coachPostWorkoutLocalMissed(failedSets.length, setInsights.length),
    tone: 'warning',
  }
}

async function buildAiPostWorkoutInsight(
  session: LocalWorkoutSession,
  previous: LocalWorkoutSession | undefined,
  historicalSessions: LocalWorkoutSession[],
  exercises: ExerciseDefinition[],
  aiConfig: AiContext,
  externalSignal?: AbortSignal,
): Promise<string> {
  const { system, user } = buildPostWorkoutPrompt(session, previous, historicalSessions, exercises)
  // Managed (hosted) mode: server picks the model — give it a larger budget;
  // reasoning models need room for hidden thinking tokens.
  const isGemini = !aiConfig.managed && isGeminiEndpoint(aiConfig.baseURL)

  // 15s timeout — post-workout insight should be fast, fall back to local if AI is slow
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  // If external signal aborts (e.g. component unmount), also abort our request
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const result = await aiChat(aiConfig, {
      feature: 'post_workout',
      messages: [system, user],
      jsonMode: true,
      temperature: 0.6,
      maxTokens: aiConfig.managed ? 4000 : isGemini ? 1000 : 300,
      signal: controller.signal,
    })

    const parsed = parseJsonResponse<{ insight: string }>(result.content)
    if (!parsed?.insight) {
      throw new AiApiError(pl.coachPostWorkoutError, undefined, 'parse')
    }
    return parsed.insight
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Generate a post-workout insight — local by default, AI when configured.
 * Falls back to local insight on AI error so the summary is never empty.
 */
export async function generatePostWorkoutInsight(params: {
  session: LocalWorkoutSession
  previous?: LocalWorkoutSession
  historicalSessions: LocalWorkoutSession[]
  exercises: ExerciseDefinition[]
  aiConfig?: AiContext
  signal?: AbortSignal
}): Promise<LocalAiInsight> {
  const { session, previous, historicalSessions, exercises, aiConfig, signal } = params
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  // Try AI path when configured (BYOK key or hosted managed mode)
  if (aiConfig) {
    try {
      const aiBody = await buildAiPostWorkoutInsight(session, previous, historicalSessions, exercises, aiConfig, signal)
      return {
        id,
        type: 'post_workout',
        sessionId: session.id,
        program: session.program,
        customPlanId: session.customPlanId,
        title: pl.coachPostWorkoutTitle,
        body: aiBody,
        tone: 'insight',
        source: 'ai',
        createdAt,
      }
    } catch {
      // Fall back to local insight — never block the summary
    }
  }

  // Local path — always available
  const local = buildLocalPostWorkoutInsight(session, previous, historicalSessions, exercises)
  return {
    id,
    type: 'post_workout',
    sessionId: session.id,
    program: session.program,
    customPlanId: session.customPlanId,
    title: local.title,
    body: local.body,
    tone: local.tone,
    source: 'local',
    createdAt,
  }
}

// ─── Plateau Detector ──────────────────────────────────────────────────────

/**
 * Compute a progression metric for a session.
 * For builtin programs: totalReps (higher = better).
 * For custom workouts: total volume (reps × weight + duration-based exercises count as reps).
 */
function sessionProgressionMetric(session: LocalWorkoutSession): number {
  if (isCustomWorkoutSession(session) && session.exerciseLogs) {
    let volume = 0
    for (const log of session.exerciseLogs) {
      for (const set of log.sets) {
        const reps = set.actual.reps ?? 0
        const weight = set.actual.weightKg ?? 0
        const duration = set.actual.durationSec ?? 0
        // Volume = reps × weight for weighted exercises
        // For bodyweight (reps only, no weight): count reps
        // For duration-only exercises (plank, etc.): count duration seconds as volume
        if (reps > 0) {
          volume += reps * Math.max(weight, 1)
        } else if (duration > 0) {
          volume += duration
        }
      }
    }
    return volume
  }
  // totalReps may be missing on older/partial sessions — fall back to summing
  // logged set results so those sessions still carry a metric.
  return session.totalReps ?? session.setResults.reduce((sum, r) => sum + r.actual, 0)
}

export type PlateauDetection = {
  insight: LocalAiInsight
  /** Display label for the program/plan (used by the home tip). */
  label: string
  /** True when the metric strictly declined across the window (regression),
   *  false for flat stagnation — drives different copy. */
  regression: boolean
}

/**
 * Detect plateau: 3 consecutive completed sessions of the same training day
 * without progression metric improvement.
 *
 * Grouping is per training day *within the same cycle/plan* — day numbers
 * repeat across cycles and different cycles have different targets, so
 * mixing them would produce false plateaus.
 *
 * For builtin programs the metric is totalReps; for custom workouts it's
 * volume (reps × weight, duration-only sets count as seconds).
 *
 * Returns null when no plateau is detected or insufficient data.
 */
export async function detectPlateau(
  program: string,
  sessions: LocalWorkoutSession[],
  opts?: { customPlanId?: string; programLabel?: string },
): Promise<PlateauDetection | null> {
  const customPlanId = opts?.customPlanId
  const scoped = sessions
    .filter((s) => {
      if (s.status !== 'completed') return false
      // Sessions with unparseable start dates cannot be ordered reliably
      if (!Number.isFinite(new Date(s.startedAt).getTime())) return false
      if (customPlanId) return s.customPlanId === customPlanId
      return s.program === program && !isCustomWorkoutSession(s)
    })
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  if (scoped.length < 3) return null

  const byDay = new Map<string, LocalWorkoutSession[]>()
  for (const s of scoped) {
    // Sessions with no usable metric (all-zero / unlogged sets) are failures or
    // skips, not plateau data — including them would fabricate regressions.
    if (sessionProgressionMetric(s) <= 0) continue
    // Custom: also key by exercise signature so a plan edit (different
    // exercises on the same day) starts a fresh comparison window instead of
    // comparing incomparable volumes.
    const key = customPlanId
      ? `${customPlanId}|${s.dayNumber}|${exerciseSignature(s)}`
      : `${s.cycleId}|${s.dayNumber}`
    const arr = byDay.get(key) ?? []
    arr.push(s)
    byDay.set(key, arr)
  }

  // Pick the plateaued day whose last session is most recent — day number
  // does not correlate with recency (day 1 can be trained after day 5).
  let plateauGroup: LocalWorkoutSession[] = []
  let plateauLastAt = 0
  let regression = false
  for (const daySessions of byDay.values()) {
    if (daySessions.length < 3) continue
    const last3 = daySessions.slice(-3)
    const s0 = last3[0]
    const s1 = last3[1]
    const s2 = last3[2]
    if (!s0 || !s1 || !s2) continue
    const m0 = sessionProgressionMetric(s0)
    const m1 = sessionProgressionMetric(s1)
    const m2 = sessionProgressionMetric(s2)
    if (m1 <= m0 && m2 <= m1) {
      const lastAt = new Date(s2.startedAt).getTime()
      if (lastAt > plateauLastAt) {
        plateauLastAt = lastAt
        plateauGroup = daySessions
        // Regression needs a meaningful drop, not a 1-rep wobble — ≥5% or ≥1
        // unit below the window's first session.
        const drop = m0 - m2
        regression = drop >= Math.max(1, m0 * 0.05)
      }
    }
  }

  if (plateauGroup.length === 0) return null

  // Suppress duplicates: at most one warning per scope per 7 days. A recent
  // warning blocks (created within the window); dismissing an older warning
  // resets the cooldown from the dismissal so it doesn't resurface next load.
  // The old logic only blocked undismissed <7d — dismissal regenerated the
  // warning on the next dashboard load, and old undismissed rows piled up.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const existing = await db.aiInsights
    .where('type')
    .equals('plateau_warning')
    .filter((i) => {
      const sameScope = customPlanId
        ? i.customPlanId === customPlanId
        : i.program === program && !i.customPlanId
      if (!sameScope) return false
      if (i.createdAt >= sevenDaysAgo) return true
      return i.dismissedAt != null && i.dismissedAt >= sevenDaysAgo
    })
    .first()
  if (existing) return null

  const programLabel =
    opts?.programLabel ??
    (program === 'pushups' || program === 'pullups' || program === 'squats'
      ? getProgramLabel(program)
      : program)

  const last3 = plateauGroup.slice(-3)
  const lastMetric = sessionProgressionMetric(last3[2]!)
  // Sessions since the best result — across the group's full history,
  // not just the last-3 window.
  const metrics = plateauGroup.map(sessionProgressionMetric)
  const bestMetric = Math.max(...metrics)
  const bestIdx = metrics.lastIndexOf(bestMetric)
  const sessionsSinceBest = plateauGroup.length - 1 - bestIdx

  return {
    insight: {
      id: crypto.randomUUID(),
      type: 'plateau_warning',
      program,
      customPlanId,
      title: pl.coachPlateauTitle,
      body: regression
        ? pl.coachPlateauBodyRegression(programLabel, last3.length, lastMetric, bestMetric)
        : pl.coachPlateauBody(programLabel, last3.length, lastMetric, bestMetric, sessionsSinceBest),
      tone: 'warning',
      source: 'local',
      createdAt: new Date().toISOString(),
    },
    label: programLabel,
    regression,
  }
}

// ─── Weekly Report ─────────────────────────────────────────────────────────

import { buildActivityInsights } from '@/lib/weekly-recap'
import { getWeekKey, startOfLocalWeek, loadFrozenWeekKeys } from '@/lib/stats-engine'

/** Compute total volume for a session: reps × weight for custom, reps for builtin. */
function sessionVolume(session: LocalWorkoutSession): number {
  if (isCustomWorkoutSession(session) && session.exerciseLogs) {
    let volume = 0
    for (const log of session.exerciseLogs) {
      for (const set of log.sets) {
        const reps = set.actual.reps ?? 0
        const weight = set.actual.weightKg ?? 0
        const duration = set.actual.durationSec ?? 0
        if (reps > 0) volume += reps * Math.max(weight, 1)
        else if (duration > 0) volume += duration
      }
    }
    return volume
  }
  return session.totalReps ?? 0
}

/** Count distinct training days (by calendar date) in a set of sessions. */
function countTrainingDays(sessions: LocalWorkoutSession[]): number {
  const days = new Set<string>()
  for (const s of sessions) {
    // Skip sessions with unparseable dates — '' would count as its own "day"
    if (!Number.isFinite(new Date(s.startedAt).getTime())) continue
    const key = s.startedAt.split('T')[0]
    if (key) days.add(key)
  }
  return days.size
}

/** Average session duration in minutes (from startedAt → completedAt). */
function avgDurationMin(sessions: LocalWorkoutSession[]): number {
  const durations: number[] = []
  for (const s of sessions) {
    if (!s.completedAt) continue
    const ms = new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime()
    if (ms > 0) durations.push(ms / 60000)
  }
  if (!durations.length) return 0
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
}

/** Detect PRs achieved within the given week's sessions.
 *  Comparisons are scoped to the same training day of the same cycle/plan —
 *  days differ in targets, so cross-day comparison is meaningless. */
function countWeekPRs(
  weekSessions: LocalWorkoutSession[],
  allCompleted: LocalWorkoutSession[],
  exercises: ExerciseDefinition[],
): number {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]))
  let prCount = 0
  for (const session of weekSessions) {
    const sessionTime = new Date(session.startedAt).getTime()

    if (isCustomWorkoutSession(session) && session.exerciseLogs) {
      const priorSessions = allCompleted.filter(
        (s) =>
          s.id !== session.id &&
          new Date(s.startedAt).getTime() < sessionTime &&
          isCustomWorkoutSession(s) &&
          s.customPlanId === session.customPlanId &&
          s.dayNumber === session.dayNumber,
      )
      for (const log of session.exerciseLogs) {
        const metric = exerciseMap.get(log.exerciseId)?.primaryMetric ?? 'reps'
        const currentBest = Math.max(
          0,
          ...log.sets.filter((s) => s.passed).map((s) => primarySetValue(s, metric)),
        )
        if (currentBest <= 0) continue
        let prevBest = 0
        let hasPrior = false
        for (const prev of priorSessions) {
          const prevLog = prev.exerciseLogs?.find((l) => l.exerciseId === log.exerciseId)
          if (!prevLog) continue
          for (const s of prevLog.sets) {
            if (!s.passed) continue
            hasPrior = true
            prevBest = Math.max(prevBest, primarySetValue(s, metric))
          }
        }
        // No prior data for this exercise = first time, not a PR
        if (hasPrior && currentBest > prevBest) prCount++
      }
    } else {
      const priorSessions = allCompleted.filter(
        (s) =>
          s.id !== session.id &&
          new Date(s.startedAt).getTime() < sessionTime &&
          !isCustomWorkoutSession(s) &&
          s.program === session.program &&
          s.cycleId === session.cycleId &&
          s.dayNumber === session.dayNumber,
      )
      const currentTotal = session.totalReps ?? 0
      let prevBest = 0
      for (const prev of priorSessions) {
        prevBest = Math.max(prevBest, prev.totalReps ?? 0)
      }
      if (priorSessions.length > 0 && currentTotal > 0 && currentTotal > prevBest) prCount++
    }
  }
  return prCount
}

/** Per-program breakdown for the week. */
function perProgramBreakdown(weekSessions: LocalWorkoutSession[]): { program: string; sessions: number; reps: number }[] {
  const map = new Map<string, { sessions: number; reps: number }>()
  for (const s of weekSessions) {
    const key = s.program === 'custom' ? (s.customPlanId ?? 'custom') : s.program
    const entry = map.get(key) ?? { sessions: 0, reps: 0 }
    entry.sessions++
    entry.reps += isCustomWorkoutSession(s) ? customSessionTotalReps(s) : (s.totalReps ?? 0)
    map.set(key, entry)
  }
  return [...map.entries()].map(([program, v]) => ({ program, ...v }))
}

export async function generateWeeklyReport(params: {
  sessions: LocalWorkoutSession[]
  exercises: ExerciseDefinition[]
  aiConfig?: AiContext
  signal?: AbortSignal
  /** Override the week to report on (for catch-up reports from previous week).
   *  Must be a date within the target week. Defaults to now (current week). */
  weekDate?: Date
}): Promise<LocalAiInsight> {
  const { sessions, exercises, aiConfig, signal } = params
  const now = params.weekDate ?? new Date()
  const weekKey = getWeekKey(now)
  // Use ISO-week boundaries (Monday→Sunday) for consistency with getWeekKey
  const weekStart = startOfLocalWeek(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7) // exclusive upper bound

  // Only completed sessions count toward weekly metrics
  const completedSessions = sessions.filter((s) => s.status === 'completed')
  const weekSessions = completedSessions.filter(
    (s) => new Date(s.startedAt) >= weekStart && new Date(s.startedAt) < weekEnd,
  )

  const activity = buildActivityInsights(completedSessions, now, await loadFrozenWeekKeys())
  // Use customSessionTotalReps for custom sessions (exerciseLogs), totalReps for builtin
  const totalReps = weekSessions.reduce((sum, s) => {
    if (isCustomWorkoutSession(s)) return sum + customSessionTotalReps(s)
    return sum + (s.totalReps ?? 0)
  }, 0)
  const totalVolume = weekSessions.reduce((sum, s) => sum + sessionVolume(s), 0)
  const trainingDays = countTrainingDays(weekSessions)
  const avgDuration = avgDurationMin(weekSessions)
  const prCount = countWeekPRs(weekSessions, completedSessions, exercises)
  const programs = perProgramBreakdown(weekSessions)
  const programLabels = await resolveProgramLabels(programs)

  // Per-day rep buckets (Mon-first) — powers the weekly activity mini-chart.
  const dailyReps = new Array<number>(7).fill(0)
  for (const s of weekSessions) {
    const dayIdx = (new Date(s.startedAt).getDay() + 6) % 7 // Mon=0 … Sun=6
    dailyReps[dayIdx] += isCustomWorkoutSession(s) ? customSessionTotalReps(s) : (s.totalReps ?? 0)
  }

  // Structured metrics for card display
  const metrics = {
    sessions: weekSessions.length,
    totalReps,
    totalVolume,
    trainingDays,
    avgDurationMin: avgDuration,
    prCount,
    streakWeeks: activity.streakWeeks,
    repsWeekChangePct: activity.repsWeekChangePct,
    dailyReps,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    programs,
  }
  const metricsJson = JSON.stringify(metrics)

  // Try AI path when configured (BYOK key or hosted managed mode)
  if (aiConfig) {
    try {
      const { system, user } = buildWeeklyReportPrompt(weekSessions, sessions, exercises, activity, totalReps, {
        totalVolume,
        trainingDays,
        avgDurationMin: avgDuration,
        prCount,
        programs,
      })
      const isGemini = !aiConfig.managed && isGeminiEndpoint(aiConfig.baseURL)
      // 20s timeout — weekly report can be slightly longer but still bounded
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20_000)
      // If external signal aborts (e.g. component unmount), also abort our request
      if (signal) {
        if (signal.aborted) controller.abort()
        else signal.addEventListener('abort', () => controller.abort(), { once: true })
      }
      try {
        const result = await aiChat(aiConfig, {
          feature: 'weekly_report',
          messages: [system, user],
          jsonMode: true,
          temperature: 0.5,
          maxTokens: aiConfig.managed ? 8000 : isGemini ? 1500 : 600,
          signal: controller.signal,
        })
        const parsed = parseJsonResponse<{ summary: string; strengths: string[]; improvements: string[]; recommendation: string }>(result.content)
        if (parsed?.summary) {
          const body = [
            parsed.summary,
            parsed.strengths?.length ? `\n\n✓ ${parsed.strengths.join('; ')}` : '',
            parsed.improvements?.length ? `\n\n→ ${parsed.improvements.join('; ')}` : '',
            parsed.recommendation ? `\n\n💡 ${parsed.recommendation}` : '',
          ].join('')
          return {
            id: crypto.randomUUID(),
            type: 'weekly_report',
            weekKey,
            title: pl.coachWeeklyReportTitle,
            body,
            tone: weekSessions.length === 0 ? 'warning' : 'insight',
            source: 'ai',
            createdAt: new Date().toISOString(),
            metricsJson,
          }
        }
      } finally {
        clearTimeout(timeout)
      }
    } catch {
      // Fall back to local
    }
  }

  // Local path
  const body = buildLocalWeeklyReportBody(weekSessions, activity, totalReps, prCount, programLabels)
  return {
    id: crypto.randomUUID(),
    type: 'weekly_report',
    weekKey,
    title: pl.coachWeeklyReportTitle,
    body,
    tone: weekSessions.length === 0 ? 'warning' : 'insight',
    source: 'local',
    createdAt: new Date().toISOString(),
    metricsJson,
  }
}

/** Resolve display labels for per-program breakdown — builtin programs via
 *  i18n labels, custom plans by name from the local DB. */
async function resolveProgramLabels(
  programs: { program: string; sessions: number; reps: number }[],
): Promise<{ label: string; sessions: number; reps: number }[]> {
  return Promise.all(
    programs.map(async (p) => {
      let label: string
      if (p.program === 'pushups' || p.program === 'pullups' || p.program === 'squats') {
        label = getProgramLabel(p.program)
      } else {
        const plan = await db.customPlans.get(p.program)
        label = plan?.name?.trim() || pl.planDash
      }
      return { label, sessions: p.sessions, reps: p.reps }
    }),
  )
}

function buildLocalWeeklyReportBody(
  weekSessions: LocalWorkoutSession[],
  activity: ActivityInsights,
  totalReps: number,
  prCount: number,
  programs: { label: string; sessions: number; reps: number }[],
): string {
  if (weekSessions.length === 0) {
    return pl.coachWeeklyReportEmpty
  }
  const parts: string[] = []

  // Sessions + reps summary line (accessible, skim-friendly)
  parts.push(pl.coachWeeklyReportSessions(weekSessions.length, totalReps))

  // Personal records — the most motivating signal, shown before trend
  if (prCount > 0) {
    parts.push(pl.coachWeeklyReportPrs(prCount))
  }

  // Streak acknowledgment — key motivator, only when there's an active streak
  if (activity.streakWeeks > 0) {
    parts.push(pl.coachWeeklyReportStreak(activity.streakWeeks))
  }

  // Program breakdown — only meaningful when the week mixed programs
  if (programs.length > 1) {
    parts.push(
      pl.coachWeeklyReportPrograms(
        programs
          .map((p) => pl.coachWeeklyReportProgramEntry(p.label, p.sessions, p.reps))
          .join(' · '),
      ),
    )
  }

  // Volume trend — only the direction, numbers are in the metrics grid.
  // When there's no previous week to compare against, say so explicitly.
  if (activity.repsWeekChangePct != null) {
    const pct = Math.round(activity.repsWeekChangePct)
    if (pct > 0) {
      parts.push(pl.coachWeeklyReportUp(pct))
    } else if (pct < 0) {
      parts.push(pl.coachWeeklyReportDown(Math.abs(pct)))
    }
  } else {
    parts.push(pl.coachWeeklyReportFirstWeek)
  }

  // Add research-based recommendation
  if (weekSessions.length >= 4 && activity.streakWeeks >= 4) {
    // 4+ sessions/week for 4+ weeks — potential overtraining, suggest deload
    parts.push(pl.coachWeeklyReportDeloadSuggest)
  } else if (weekSessions.length <= 1) {
    // Low frequency — below MEV for most muscle groups
    parts.push(pl.coachWeeklyReportLowFreq)
  } else if (activity.repsWeekChangePct != null && activity.repsWeekChangePct < -10) {
    // Significant drop — possible fatigue
    parts.push(pl.coachWeeklyReportFatigue)
  } else if (weekSessions.length >= 3 && (activity.repsWeekChangePct ?? 0) >= 0) {
    // Good volume + progress
    parts.push(pl.coachWeeklyReportGreat)
  }

  return parts.join(' ')
}
