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
 * AI insights replace local ones when the user has configured an API key
 * and enabled `aiProactiveCoach` in settings.
 */

import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import type { LocalWorkoutSession, LocalAiInsight } from '@/lib/db'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import { computeBuiltinSessionInsights, computeCustomSessionInsights } from '@/lib/session-summary-insights'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import { chatCompletion, parseJsonResponse, AiApiError } from './ai-client'
import { buildPostWorkoutPrompt, buildWeeklyReportPrompt } from './prompts'
import type { ActivityInsights } from '@/lib/weekly-recap'

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
  const totalSets = setInsights.length

  // Determine dominant insight tone — priority: failed session > PR > progress > down > unchanged
  // If the session as a whole failed, lead with that even if some sets improved
  if (session.passed === false) {
    return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalFailed, tone: 'warning' }
  }
  if (insights.prCount > 0) {
    // Vary message based on how many PRs
    if (insights.prCount >= 3) {
      return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalPrMulti(insights.prCount), tone: 'success' }
    }
    return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalPr, tone: 'success' }
  }
  if (improvedSets.length > 0) {
    const bestDelta = Math.max(...improvedSets.map((i) => i.deltaVsPrevious ?? 0))
    // Vary: if all sets improved vs just some
    if (improvedSets.length === totalSets && totalSets > 1) {
      return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalProgressAll(bestDelta, totalSets), tone: 'insight' }
    }
    return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalProgress(bestDelta), tone: 'insight' }
  }
  // Check for down
  if (downSets.length > 0) {
    const worstDelta = Math.min(...downSets.map((i) => i.deltaVsPrevious ?? 0))
    return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalDown(Math.abs(worstDelta)), tone: 'warning' }
  }
  // Default: unchanged
  return { title: pl.coachPostWorkoutTitle, body: pl.coachPostWorkoutLocalUnchanged, tone: 'insight' }
}

async function buildAiPostWorkoutInsight(
  session: LocalWorkoutSession,
  previous: LocalWorkoutSession | undefined,
  historicalSessions: LocalWorkoutSession[],
  exercises: ExerciseDefinition[],
  aiConfig: { apiKey: string; model: string; baseURL?: string },
  externalSignal?: AbortSignal,
): Promise<string> {
  const { system, user } = buildPostWorkoutPrompt(session, previous, historicalSessions, exercises)
  const isGemini = aiConfig.baseURL?.includes('gemini') || aiConfig.baseURL?.includes('googleapis')

  // 15s timeout — post-workout insight should be fast, fall back to local if AI is slow
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  // If external signal aborts (e.g. component unmount), also abort our request
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  try {
    const result = await chatCompletion({
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      messages: [system, user],
      jsonMode: true,
      temperature: 0.6,
      maxTokens: isGemini ? 1000 : 300,
      reasoningEffort: isGemini ? 'none' : undefined,
      baseURL: aiConfig.baseURL,
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
  aiConfig?: { apiKey: string; model: string; baseURL?: string }
  signal?: AbortSignal
}): Promise<LocalAiInsight> {
  const { session, previous, historicalSessions, exercises, aiConfig, signal } = params
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  // Try AI path when configured
  if (aiConfig?.apiKey) {
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
  return session.totalReps ?? 0
}

/**
 * Detect plateau: 3 consecutive passed sessions for the same program+day
 * without progression metric improvement.
 *
 * For builtin programs: uses totalReps.
 * For custom workouts: uses volume (reps × weight).
 *
 * Returns null when no plateau is detected or insufficient data.
 */
export async function detectPlateau(
  program: string,
  sessions: LocalWorkoutSession[],
): Promise<LocalAiInsight | null> {
  // Get completed sessions for this program, sorted chronologically
  const completed = sessions
    .filter((s) => s.program === program && s.status === 'completed')
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  if (completed.length < 3) return null

  // Group by dayNumber and check the most recent day with ≥3 sessions
  const byDay = new Map<number, LocalWorkoutSession[]>()
  for (const s of completed) {
    const arr = byDay.get(s.dayNumber) ?? []
    arr.push(s)
    byDay.set(s.dayNumber, arr)
  }

  // Find the most recent dayNumber that has at least 3 sessions with no progress
  let plateauDay: number | null = null
  let plateauSessions: LocalWorkoutSession[] = []
  for (const [day, daySessions] of byDay) {
    if (daySessions.length >= 3) {
      const last3 = daySessions.slice(-3)
      const s0 = last3[0]
      const s1 = last3[1]
      const s2 = last3[2]
      if (!s0 || !s1 || !s2) continue
      // Plateau = no improvement across last 3 sessions (each ≤ previous)
      const m0 = sessionProgressionMetric(s0)
      const m1 = sessionProgressionMetric(s1)
      const m2 = sessionProgressionMetric(s2)
      const noProgress = m1 <= m0 && m2 <= m1
      if (noProgress) {
        // Pick the most recent plateau day
        if (plateauDay === null || day > plateauDay) {
          plateauDay = day
          plateauSessions = last3
        }
      }
    }
  }

  if (plateauDay === null) return null

  // Check if we already have an active plateau warning for this program in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const existing = await db.aiInsights
    .where('type')
    .equals('plateau_warning')
    .filter((i) => i.program === program && !i.dismissedAt && i.createdAt >= sevenDaysAgo)
    .first()
  if (existing) return null

  const programLabel = program === 'pushups' ? pl.pushupsProgram : program === 'pullups' ? pl.pullupsProgram : program
  const lastMetric = sessionProgressionMetric(plateauSessions[2])
  const bestMetric = Math.max(...plateauSessions.map(sessionProgressionMetric))
  const sessionsSinceBest = plateauSessions.length - plateauSessions.findIndex((s) => sessionProgressionMetric(s) === bestMetric) - 1

  return {
    id: crypto.randomUUID(),
    type: 'plateau_warning',
    program,
    title: pl.coachPlateauTitle,
    body: pl.coachPlateauBody(programLabel, plateauSessions.length, lastMetric, bestMetric, sessionsSinceBest),
    tone: 'warning',
    source: 'local',
    createdAt: new Date().toISOString(),
  }
}

// ─── Weekly Report ─────────────────────────────────────────────────────────

import { buildActivityInsights } from '@/lib/weekly-recap'
import { getWeekKey, startOfLocalWeek } from '@/lib/stats-engine'

export async function generateWeeklyReport(params: {
  sessions: LocalWorkoutSession[]
  exercises: ExerciseDefinition[]
  aiConfig?: { apiKey: string; model: string; baseURL?: string }
  signal?: AbortSignal
}): Promise<LocalAiInsight> {
  const { sessions, exercises, aiConfig, signal } = params
  const now = new Date()
  const weekKey = getWeekKey(now)
  // Use ISO-week boundaries (Monday→Sunday) for consistency with getWeekKey
  const weekStart = startOfLocalWeek(now)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7) // exclusive upper bound

  const weekSessions = sessions.filter(
    (s) => s.status === 'completed' && new Date(s.startedAt) >= weekStart && new Date(s.startedAt) < weekEnd,
  )

  const activity = buildActivityInsights(sessions)
  const totalReps = weekSessions.reduce((sum, s) => sum + (s.totalReps ?? 0), 0)

  // Structured metrics for card display
  const metrics = {
    sessions: weekSessions.length,
    totalReps,
    streakWeeks: activity.streakWeeks,
    repsWeekChangePct: activity.repsWeekChangePct,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
  }
  const metricsJson = JSON.stringify(metrics)

  // Try AI path when configured
  if (aiConfig?.apiKey) {
    try {
      const { system, user } = buildWeeklyReportPrompt(weekSessions, sessions, exercises, activity, totalReps)
      const isGemini = aiConfig.baseURL?.includes('gemini') || aiConfig.baseURL?.includes('googleapis')
      // 20s timeout — weekly report can be slightly longer but still bounded
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20_000)
      // If external signal aborts (e.g. component unmount), also abort our request
      if (signal) {
        if (signal.aborted) controller.abort()
        else signal.addEventListener('abort', () => controller.abort(), { once: true })
      }
      try {
        const result = await chatCompletion({
          apiKey: aiConfig.apiKey,
          model: aiConfig.model,
          messages: [system, user],
          jsonMode: true,
          temperature: 0.5,
          maxTokens: isGemini ? 1500 : 600,
          reasoningEffort: isGemini ? 'none' : undefined,
          baseURL: aiConfig.baseURL,
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
  const body = buildLocalWeeklyReportBody(weekSessions, activity, totalReps)
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

function buildLocalWeeklyReportBody(
  weekSessions: LocalWorkoutSession[],
  activity: ActivityInsights,
  totalReps: number,
): string {
  if (weekSessions.length === 0) {
    return pl.coachWeeklyReportEmpty
  }
  const parts: string[] = []
  parts.push(pl.coachWeeklyReportSessions(weekSessions.length, totalReps))
  if (activity.streakWeeks > 0) {
    parts.push(pl.coachWeeklyReportStreak(activity.streakWeeks))
  }
  if (activity.repsWeekChangePct != null) {
    const pct = Math.round(activity.repsWeekChangePct)
    if (pct > 0) {
      parts.push(pl.coachWeeklyReportUp(pct))
    } else if (pct < 0) {
      parts.push(pl.coachWeeklyReportDown(Math.abs(pct)))
    }
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
