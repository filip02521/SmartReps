import { db, type LocalWorkoutSession } from '@/lib/db'
import { computeStreakWeeks } from '@/lib/stats-engine'
import { computeBestStreakWeeks } from '@/lib/weekly-recap'
import { customSessionHasBelowTarget } from '@/lib/custom-session-comparison'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import { getCycleById } from '@/data/plans'
import type { AuthorImpactStats, AchievementSnapshot, AchievementId } from './types'

const MS_DAY = 86400000

function isCompletedForAchievements(s: LocalWorkoutSession): boolean {
  if (s.status !== 'completed') return false
  if (isCustomWorkoutSession(s)) return true
  return s.passed === true
}

function isNightSession(s: LocalWorkoutSession): boolean {
  const h = new Date(s.startedAt).getHours()
  return h >= 21 || h < 5
}

function detectComeback(sortedAsc: LocalWorkoutSession[], now: Date): boolean {
  if (sortedAsc.length < 5) return false
  for (let i = 1; i < sortedAsc.length; i++) {
    const prev = new Date(sortedAsc[i - 1]!.completedAt ?? sortedAsc[i - 1]!.startedAt).getTime()
    const cur = new Date(sortedAsc[i]!.completedAt ?? sortedAsc[i]!.startedAt).getTime()
    const gapDays = (cur - prev) / MS_DAY
    if (gapDays < 28) continue
    const windowEnd = cur + 21 * MS_DAY
    const rebound = sortedAsc.filter((s) => {
      const t = new Date(s.completedAt ?? s.startedAt).getTime()
      return t >= cur && t <= windowEnd
    })
    if (rebound.length < 4) continue
    const streakAfter = computeStreakWeeks(rebound, new Date(Math.min(windowEnd, now.getTime())))
    // Also check current streak if rebound reaches "now"
    const streakNow = computeStreakWeeks(
      sortedAsc.filter((s) => new Date(s.startedAt).getTime() >= cur),
      now,
    )
    if (streakAfter >= 2 || streakNow >= 2) return true
  }
  return false
}

/** Count sessions where a same-day / same-set PR occurred vs prior history (builtin). */
function computeBuiltinPrRepeatMax(sessions: LocalWorkoutSession[]): number {
  const byProgramDay = new Map<string, number>()
  const sorted = [...sessions]
    .filter((s) => !isCustomWorkoutSession(s) && s.passed === true)
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime())

  const prSessionKeys = new Set<string>()
  for (const s of sorted) {
    const passedRows = s.setResults.filter((r) => r.passed)
    if (!passedRows.length) continue
    const best = Math.max(...passedRows.map((r) => r.actual))
    let isPr = false
    for (const row of passedRows) {
      const key = `${s.program}:${s.dayNumber}:${row.setNumber}`
      const prev = byProgramDay.get(key) ?? 0
      if (row.actual > prev && prev > 0) isPr = true
      if (row.actual > prev) byProgramDay.set(key, row.actual)
    }
    // Also session-best set PR vs prior same program
    const histKey = `${s.program}:best`
    const prevBest = byProgramDay.get(histKey) ?? 0
    if (best > prevBest && prevBest > 0) isPr = true
    if (best > prevBest) byProgramDay.set(histKey, best)
    if (isPr) prSessionKeys.add(s.id)
  }
  // Count max PR sessions for same program day setNumber key chain — simplify: total PR sessions
  // Plan: same context PR in ≥3 sessions — use max count per (program, dayNumber) PR events
  const prByContext = new Map<string, number>()
  for (const s of sorted) {
    if (!prSessionKeys.has(s.id)) continue
    const ctx = `${s.program}:${s.dayNumber}`
    prByContext.set(ctx, (prByContext.get(ctx) ?? 0) + 1)
  }
  let max = 0
  for (const n of prByContext.values()) max = Math.max(max, n)
  return max
}

export function emptyImpact(): AuthorImpactStats {
  return {
    likeTotal: 0,
    importTotal: 0,
    trainedTotal: 0,
    publishedCount: 0,
    bestPlanImports: 0,
    bestPlanTrained: 0,
  }
}

export async function buildAchievementSnapshot(opts?: {
  now?: Date
  impact?: AuthorImpactStats
}): Promise<AchievementSnapshot> {
  const now = opts?.now ?? new Date()
  const impact = opts?.impact ?? emptyImpact()

  const [allSessions, maxTests, progressRows, customPlans] = await Promise.all([
    db.workoutSessions.toArray(),
    db.maxTests.toArray(),
    db.programProgress.toArray(),
    db.customPlans.toArray(),
  ])

  const completed = allSessions.filter(isCompletedForAchievements)
  const completedAsc = [...completed].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  )

  const nowMs = now.getTime()
  const completedInLast14d = completed.filter(
    (s) => nowMs - new Date(s.startedAt).getTime() <= 14 * MS_DAY,
  ).length

  const customCompleted = completed.filter(isCustomWorkoutSession)
  const customHitTarget = customCompleted.filter((s) => !customSessionHasBelowTarget(s))

  let maxPushups = 0
  let maxPullups = 0
  for (const t of maxTests) {
    if (t.program === 'pushups') maxPushups = Math.max(maxPushups, t.reps)
    if (t.program === 'pullups') maxPullups = Math.max(maxPullups, t.reps)
  }

  const hasCycleClosedStrong =
    progressRows.some((p) => p.status === 'test_pending') ||
    completed.some((s) => {
      if (isCustomWorkoutSession(s) || !s.passed) return false
      const cycle = getCycleById(s.cycleId)
      if (!cycle?.days.length) return false
      const lastDay = Math.max(...cycle.days.map((d) => d.dayNumber))
      return s.dayNumber === lastDay
    })

  let workshopCustom = false
  for (const plan of customPlans) {
    const multi = plan.days.some((d) => d.exercises.length >= 2)
    if (!multi) continue
    const n = customCompleted.filter((s) => s.customPlanId === plan.id).length
    if (n >= 5) {
      workshopCustom = true
      break
    }
  }

  const unlockAtHints: Partial<Record<AchievementId, string>> = {}
  if (completedAsc[0]) {
    unlockAtHints.first_session = completedAsc[0].completedAt ?? completedAsc[0].startedAt
  }
  const firstCustom = completedAsc.find(isCustomWorkoutSession)
  if (firstCustom) {
    unlockAtHints.first_custom_session = firstCustom.completedAt ?? firstCustom.startedAt
  }

  return {
    now,
    completedCount: completed.length,
    completedInLast14d,
    customCompletedCount: customCompleted.length,
    customHitTargetCount: customHitTarget.length,
    nightSessionCount: completed.filter(isNightSession).length,
    streakWeeks: computeStreakWeeks(completed, now),
    bestStreakWeeks: computeBestStreakWeeks(completed),
    maxPushups,
    maxPullups,
    hasCycleClosedStrong,
    workshopCustom,
    prRepeatMax: computeBuiltinPrRepeatMax(completed),
    comebackStronger: detectComeback(completedAsc, now),
    impact,
    unlockAtHints,
  }
}
