/**
 * Research-based prompt templates for AI plan generation and workout analysis.
 *
 * Grounded in:
 * - Schoenfeld BJ, et al. (2017) — volume thresholds for hypertrophy (MEV/MAV/MRV)
 * - Schoenfeld BJ, et al. (2016) — training frequency 2x/week per muscle group
 * - Helms ER, et al. — RPE/RIR-based load prescription
 * - Israetel M, Hoffmann A — volume landmarks & periodization
 * - Rhea MR (2003) — dose-response relationship for strength (3 sets per exercise)
 * - Robbins DW, et al. — exercise selection for hypertrophy
 */

import type { ExerciseDefinition, MuscleGroup } from '@/lib/exercise-model'
import type { LocalWorkoutSession } from '@/lib/db'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import type { ActivityInsights } from '@/lib/weekly-recap'
import { pl } from '@/i18n/pl'
import type { ChatMessage } from './ai-client'

// ─── Research context injected into every prompt ───────────────────────────

export const RESEARCH_CONTEXT = () => pl.aiPromptResearchContext

// ─── Plan generation prompt ────────────────────────────────────────────────

export type PlanGenerationInput = {
  description: string
  daysPerWeek: number
  experienceLevel: 'beginner' | 'intermediate' | 'advanced'
  equipment: 'bodyweight' | 'dumbbells' | 'barbell' | 'full_gym' | 'kettlebell'
  goal: 'hypertrophy' | 'strength' | 'endurance' | 'general_fitness' | 'fat_loss'
  sessionDurationMin?: number
}

export function buildPlanGenerationPrompt(
  input: PlanGenerationInput,
  library: ExerciseDefinition[],
): { system: ChatMessage; user: ChatMessage } {
  const libraryList = library
    .filter((e) => !e.archived)
    .map((e) => pl.aiPromptLibraryEntry(e.id, e.name, e.primaryMetric, e.muscleGroup ?? 'other'))
    .join('\n')

  const equipmentMap: Record<PlanGenerationInput['equipment'], string> = {
    bodyweight: pl.aiPromptEquipmentBodyweight,
    dumbbells: pl.aiPromptEquipmentDumbbells,
    barbell: pl.aiPromptEquipmentBarbell,
    full_gym: pl.aiPromptEquipmentFullGym,
    kettlebell: pl.aiPromptEquipmentKettlebell,
  }

  const goalMap: Record<PlanGenerationInput['goal'], string> = {
    hypertrophy: pl.aiPromptGoalHypertrophy,
    strength: pl.aiPromptGoalStrength,
    endurance: pl.aiPromptGoalEndurance,
    general_fitness: pl.aiPromptGoalGeneral,
    fat_loss: pl.aiPromptGoalFatLoss,
  }

  const experienceMap: Record<PlanGenerationInput['experienceLevel'], string> = {
    beginner: pl.aiPromptExperienceBeginner,
    intermediate: pl.aiPromptExperienceIntermediate,
    advanced: pl.aiPromptExperienceAdvanced,
  }

  const duration = input.sessionDurationMin
    ? `- ${input.sessionDurationMin} min per session`
    : ''

  const userPrompt = pl.aiPromptPlanBuild(
    input.description,
    input.daysPerWeek,
    experienceMap[input.experienceLevel],
    equipmentMap[input.equipment],
    goalMap[input.goal],
    duration,
    libraryList || pl.aiPromptLibraryEmpty,
  )

  return {
    system: { role: 'system', content: RESEARCH_CONTEXT() },
    user: { role: 'user', content: userPrompt },
  }
}

// ─── Workout analysis prompt ───────────────────────────────────────────────

export type WorkoutHistorySummary = {
  totalSessions: number
  totalSets: number
  totalReps: number
  dateRange: { first: string; last: string } | null
  sessionsPerWeek: number
  muscleGroupVolume: { muscleGroup: MuscleGroup; weeklySets: number }[]
  recentSessions: {
    date: string
    planName: string
    dayNumber: number
    exercises: { name: string; sets: number; reps?: number; weightKg?: number }[]
  }[]
  activePlanName?: string
}

export function buildWorkoutAnalysisPrompt(
  history: WorkoutHistorySummary,
): { system: ChatMessage; user: ChatMessage } {
  const volumeTable = history.muscleGroupVolume
    .map((v) => pl.aiPromptVolumeEntry(v.muscleGroup, v.weeklySets))
    .join('\n')

  const recentTable = history.recentSessions
    .slice(0, 10)
    .map((s) => {
      const exs = s.exercises.map((e) => `${e.name} (${e.sets}x${e.reps ?? ''}${e.weightKg ? ` @${e.weightKg}kg` : ''})`).join(', ')
      return `  ${s.date} — ${s.planName} D${s.dayNumber}: ${exs}`
    })
    .join('\n')

  const dateRange = history.dateRange
    ? `${history.dateRange.first} → ${history.dateRange.last}`
    : pl.aiPromptDateRangeNone
  const activePlan = history.activePlanName
    ? `- ${history.activePlanName}`
    : pl.aiPromptNoActivePlan

  const userPrompt = pl.aiPromptAnalysisBuild(
    history.totalSessions,
    history.totalSets,
    history.totalReps,
    dateRange,
    history.sessionsPerWeek.toFixed(1),
    activePlan,
    volumeTable || pl.aiPromptVolumeEmpty,
    recentTable || pl.aiPromptRecentEmpty,
  )

  return {
    system: { role: 'system', content: RESEARCH_CONTEXT() },
    user: { role: 'user', content: userPrompt },
  }
}

// ─── Types for AI response ─────────────────────────────────────────────────

export type AiPlanResponse = {
  plan: {
    name: string
    description: string
    days: {
      dayNumber: number
      restAfterDay: 1 | 2
      exercises: {
        exerciseName: string
        primaryMetric: 'reps' | 'reps_weight' | 'duration_sec'
        muscleGroup?: MuscleGroup
        sets: { reps?: { kind: string; value?: number; min?: number; max?: number }; durationSec?: { kind: string; value?: number; min?: number; max?: number }; weightKg?: { kind: string; value?: number; min?: number; max?: number } }[]
        restBetweenSetsSec: number
        restAfterExerciseSec?: number
        note?: string
      }[]
    }[]
    progression?: {
      enabled: boolean
      repsDelta?: number
      weightKgDelta?: number
      durationSecDelta?: number
      afterCycleComplete?: boolean
    }
    rationale?: string
  }
}

export type AiAnalysisResponse = {
  analysis: {
    summary: string
    strengths: string[]
    weaknesses: string[]
    suggestions: {
      title: string
      description: string
      priority: 'high' | 'medium' | 'low'
    }[]
    volumeAssessment: {
      muscleGroup: string
      weeklySets: number
      status: 'optimal' | 'below_mev' | 'above_mrv' | 'low' | 'high'
      recommendation: string
    }[]
  }
}

// ─── Post-workout insight prompt ───────────────────────────────────────────

export type PostWorkoutPromptInput = {
  current: LocalWorkoutSession
  previous?: LocalWorkoutSession
  history: LocalWorkoutSession[]
  exercises: ExerciseDefinition[]
}

export function buildPostWorkoutPrompt(
  session: LocalWorkoutSession,
  previous: LocalWorkoutSession | undefined,
  history: LocalWorkoutSession[],
  exercises: ExerciseDefinition[],
): { system: ChatMessage; user: ChatMessage } {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]))
  const isCustom = isCustomWorkoutSession(session)

  // Build current session summary
  let currentSummary: string
  if (isCustom && session.exerciseLogs) {
    const logs = session.exerciseLogs.map((log) => {
      const def = exerciseMap.get(log.exerciseId)
      const name = def?.name ?? log.exerciseId
      const sets = log.sets.map((s) => {
        const reps = s.actual.reps ?? 0
        const weight = s.actual.weightKg ?? 0
        const dur = s.actual.durationSec
        if (dur != null) return `${s.setNumber}: ${dur}s`
        if (weight > 0) return `${s.setNumber}: ${reps}x${weight}kg`
        return `${s.setNumber}: ${reps}`
      }).join(', ')
      return `  ${name}: ${sets}`
    }).join('\n')
    currentSummary = `Day ${session.dayNumber}, ${session.totalReps ?? 0} total reps:\n${logs}`
  } else {
    const sets = session.setResults.map((r) => {
      const target = r.target.kind === 'max' ? `${r.target.minReps}+` : `${r.target.reps}`
      return `Set ${r.setNumber}: ${r.actual} reps (target: ${target})`
    }).join(', ')
    currentSummary = `Day ${session.dayNumber}, ${session.totalReps ?? 0} total reps. ${sets}`
  }

  // Build previous session summary if available
  let previousSummary = pl.aiPromptNoActivePlan
  if (previous) {
    if (isCustomWorkoutSession(previous) && previous.exerciseLogs) {
      const prevLogs = previous.exerciseLogs.map((log) => {
        const def = exerciseMap.get(log.exerciseId)
        const name = def?.name ?? log.exerciseId
        const totalReps = log.sets.reduce((s, set) => s + (set.actual.reps ?? 0), 0)
        return `  ${name}: ${totalReps} reps`
      }).join('\n')
      previousSummary = `Day ${previous.dayNumber}, ${previous.totalReps ?? 0} total reps:\n${prevLogs}`
    } else {
      previousSummary = `Day ${previous.dayNumber}, ${previous.totalReps ?? 0} total reps`
    }
  }

  // Recent trend (last 5 sessions same program)
  const recentTrend = history
    .filter((s) => s.program === session.program && s.status === 'completed')
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 5)
    .map((s) => `${s.startedAt.split('T')[0]}: ${s.totalReps ?? 0} reps (day ${s.dayNumber})`)
    .join(', ')

  // Detect PRs (personal records) in current session vs history
  const prSets: string[] = []
  if (!isCustom && session.setResults) {
    for (const set of session.setResults) {
      const prevBest = Math.max(
        ...history
          .filter((s) => s.program === session.program && s.dayNumber === session.dayNumber && s.status === 'completed' && s.id !== session.id)
          .flatMap((s) => s.setResults?.filter((r) => r.setNumber === set.setNumber).map((r) => r.actual) ?? []),
        0,
      )
      if (set.actual > prevBest && prevBest > 0) {
        prSets.push(`Set ${set.setNumber}: ${set.actual} reps (previous best: ${prevBest})`)
      }
    }
  }
  const prInfo = prSets.length ? `\nPERSONAL RECORDS this session:\n${prSets.join('\n')}` : ''

  const userPrompt = `Analyze this completed workout session and give ONE actionable insight (max 2 sentences).

CURRENT SESSION:
${currentSummary}
${prInfo}

PREVIOUS SESSION (same day):
${previousSummary}

RECENT TREND:
${recentTrend || 'First session'}

Guidelines for the insight:
- If the user hit a PR, celebrate it specifically with the number
- If progress is stalling (same reps across 2-3 sessions), suggest a concrete change: +1 rep, slightly longer rest, or a deload week
- Reference RIR (reps in reserve) when relevant — if all sets felt easy (RIR 3+), suggest progression; if sets were grinded (RIR 0-1), suggest recovery
- Be specific with numbers from the session, not generic advice

Respond in JSON: {"insight": "your 1-2 sentence insight here"}
Write in ${pl.aiPromptLanguageHint}.`

  return {
    system: { role: 'system', content: RESEARCH_CONTEXT() },
    user: { role: 'user', content: userPrompt },
  }
}

// ─── Weekly report prompt ──────────────────────────────────────────────────

export function buildWeeklyReportPrompt(
  weekSessions: LocalWorkoutSession[],
  _allSessions: LocalWorkoutSession[],
  exercises: ExerciseDefinition[],
  activity: ActivityInsights,
  totalReps: number,
): { system: ChatMessage; user: ChatMessage } {
  const exerciseMap = new Map(exercises.map((e) => [e.id, e]))

  const weekSummary = weekSessions.map((s) => {
    const date = s.startedAt.split('T')[0]
    if (isCustomWorkoutSession(s) && s.exerciseLogs) {
      const exerciseNames = s.exerciseLogs
        .map((log) => exerciseMap.get(log.exerciseId)?.name ?? log.exerciseId)
        .join(', ')
      return `${date}: ${s.totalReps ?? 0} reps (${exerciseNames})`
    }
    return `${date}: ${s.totalReps ?? 0} reps (day ${s.dayNumber})`
  }).join('\n')

  // Compute weekly sets per muscle group for volume assessment
  const muscleGroupSets = new Map<string, number>()
  for (const s of weekSessions) {
    if (isCustomWorkoutSession(s) && s.exerciseLogs) {
      for (const log of s.exerciseLogs) {
        const def = exerciseMap.get(log.exerciseId)
        const mg = def?.muscleGroup ?? 'unknown'
        muscleGroupSets.set(mg, (muscleGroupSets.get(mg) ?? 0) + log.sets.length)
      }
    } else {
      // Builtin programs: pushups = chest/triceps, pullups = back/biceps
      const mg = s.program === 'pushups' ? 'chest' : s.program === 'pullups' ? 'back' : 'other'
      const sets = s.setResults?.length ?? 0
      muscleGroupSets.set(mg, (muscleGroupSets.get(mg) ?? 0) + sets)
    }
  }
  const volumeByMuscle = [...muscleGroupSets.entries()]
    .map(([mg, sets]) => `  ${mg}: ${sets} sets`)
    .join('\n')

  const userPrompt = `Create a weekly workout report for the user.

THIS WEEK'S SESSIONS (${weekSessions.length}):
${weekSummary || 'No sessions this week.'}

TOTAL REPS THIS WEEK: ${totalReps}
STREAK: ${activity.streakWeeks} weeks
REPS WEEK CHANGE %: ${activity.repsWeekChangePct ?? 'N/A'}

WEEKLY SETS BY MUSCLE GROUP:
${volumeByMuscle || 'No data'}

Volume landmarks for reference (Israetel & Hoffmann):
- MEV (Minimum Effective Volume): 10 sets/muscle group/week
- MAV (Maximum Adaptive Volume): 15-25 sets/muscle group/week
- MRV (Maximum Recoverable Volume): 20-30+ sets/muscle group/week

Guidelines:
- In "improvements", flag any muscle group below MEV (10 sets) as undertrained
- In "improvements", flag any muscle group above MRV (30 sets) as potential overtraining
- In "recommendation", suggest a concrete next-week adjustment based on volume vs landmarks
- If streak is 0, encourage consistency; if streak is 4+ weeks, consider a deload

Respond in JSON:
{
  "summary": "1 sentence overview",
  "strengths": ["1-2 positive observations"],
  "improvements": ["1-2 areas to improve"],
  "recommendation": "1 actionable recommendation for next week"
}

Write in ${pl.aiPromptLanguageHint}. Be specific and encouraging.`

  return {
    system: { role: 'system', content: RESEARCH_CONTEXT() },
    user: { role: 'user', content: userPrompt },
  }
}
