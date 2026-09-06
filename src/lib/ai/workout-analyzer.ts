/**
 * AI Workout Analyzer — gathers workout history, sends to AI for analysis.
 */

import { db } from '@/lib/db'
import type { ExerciseDefinition, MuscleGroup } from '@/lib/exercise-model'
import { pl } from '@/i18n/pl'
import { chatCompletion, parseJsonResponse, AiApiError, resolveReasoningEffort } from './ai-client'
import { buildWorkoutAnalysisPrompt, type AiAnalysisResponse, type WorkoutHistorySummary } from './prompts'

const DEFAULT_MODEL = 'gpt-4o-mini'

const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: pl.muscleGroupFull_chest,
  back: pl.muscleGroupFull_back,
  shoulders: pl.muscleGroupFull_shoulders,
  arms: pl.muscleGroupFull_arms,
  legs: pl.muscleGroupFull_legs,
  core: pl.muscleGroupFull_core,
  full_body: pl.muscleGroupFull_full_body,
  cardio: pl.muscleGroupFull_cardio,
  other: pl.muscleGroupFull_other,
}

export type AnalysisResult = AiAnalysisResponse['analysis'] & {
  muscleGroupLabels: Record<string, string>
}

export async function analyzeWorkouts(
  context: {
    apiKey: string
    model?: string
    exercises: ExerciseDefinition[]
    baseURL?: string
    reasoningEffort?: 'auto' | 'low' | 'medium' | 'high'
    signal?: AbortSignal
  },
): Promise<AnalysisResult> {
  const summary = await gatherWorkoutHistory(context.exercises)
  const { system, user } = buildWorkoutAnalysisPrompt(summary)

  const isGemini = context.baseURL?.includes('gemini') || context.baseURL?.includes('googleapis')

  const result = await chatCompletion({
    apiKey: context.apiKey,
    model: context.model || DEFAULT_MODEL,
    messages: [system, user],
    jsonMode: true,
    temperature: 0.5,
    maxTokens: isGemini ? 12000 : 6000,
    reasoningEffort: resolveReasoningEffort(context.model || DEFAULT_MODEL, context.reasoningEffort),
    baseURL: context.baseURL,
    signal: context.signal,
  })

  const parsed = parseJsonResponse<AiAnalysisResponse>(result.content)
  if (!parsed?.analysis) {
    throw new AiApiError(pl.aiErrorParseAnalysis, undefined, 'parse')
  }

  // Ensure all arrays exist — AI may omit empty arrays
  const analysis = parsed.analysis
  const safeAnalysis = {
    ...analysis,
    summary: analysis.summary ?? '',
    strengths: analysis.strengths ?? [],
    weaknesses: analysis.weaknesses ?? [],
    suggestions: analysis.suggestions ?? [],
    volumeAssessment: analysis.volumeAssessment ?? [],
  }

  return {
    ...safeAnalysis,
    muscleGroupLabels: MUSCLE_GROUP_LABELS,
  }
}

async function gatherWorkoutHistory(
  exercises: ExerciseDefinition[],
): Promise<WorkoutHistorySummary> {
  const sessions = await db.workoutSessions
    .filter((s) => s.status === 'completed')
    .toArray()

  if (sessions.length === 0) {
    return {
      totalSessions: 0,
      totalSets: 0,
      totalReps: 0,
      dateRange: null,
      sessionsPerWeek: 0,
      muscleGroupVolume: [],
      recentSessions: [],
    }
  }

  const sorted = sessions.sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
  )

  const first = sorted[0]!.startedAt
  const last = sorted[sorted.length - 1]!.startedAt
  const weeksSpan = Math.max(
    1,
    (new Date(last).getTime() - new Date(first).getTime()) / (1000 * 60 * 60 * 24 * 7),
  )

  let totalSets = 0
  let totalReps = 0

  // Track volume per muscle group per week
  const muscleGroupSets = new Map<MuscleGroup, number>()
  const exerciseById = new Map(exercises.map((e) => [e.id, e]))

  // Recent sessions (last 10) — built from the most recent sessions
  const recentSessions: WorkoutHistorySummary['recentSessions'] = []

  // Built-in program muscle group mapping
  const BUILTIN_MUSCLE_GROUP: Record<string, MuscleGroup> = {
    pushups: 'chest',
    pullups: 'back',
  }

  // Accumulate totals over ALL completed sessions (not just last 20).
  // Previously this loop was sliced to 20, undercounting totalSets/totalReps
  // and muscleGroupSets for users with >20 sessions.
  for (const session of sorted) {
    if (session.exerciseLogs && session.exerciseLogs.length > 0) {
      for (const log of session.exerciseLogs) {
        const def = exerciseById.get(log.exerciseId)
        const sets = log.sets?.length ?? 0
        const totalRepsEx = (log.sets ?? []).reduce((acc, s) => acc + (s.actual.reps ?? 0), 0)

        totalSets += sets
        totalReps += totalRepsEx

        if (def?.muscleGroup) {
          muscleGroupSets.set(
            def.muscleGroup,
            (muscleGroupSets.get(def.muscleGroup) ?? 0) + sets,
          )
        }
      }
    } else if (session.totalReps != null) {
      // Built-in program session (pushups/pullups)
      const builtinSets = session.setResults?.length || 1
      totalReps += session.totalReps
      totalSets += builtinSets
      const program = session.program === 'custom' ? 'custom' : session.program
      const muscleGroup = BUILTIN_MUSCLE_GROUP[program]
      if (muscleGroup) {
        muscleGroupSets.set(
          muscleGroup,
          (muscleGroupSets.get(muscleGroup) ?? 0) + builtinSets,
        )
      }
    }
  }

  // Build recentSessions from the last 10 sessions (most recent first)
  for (const session of [...sorted].reverse().slice(0, 10)) {
    const sessionExercises: WorkoutHistorySummary['recentSessions'][number]['exercises'] = []

    if (session.exerciseLogs && session.exerciseLogs.length > 0) {
      for (const log of session.exerciseLogs) {
        const def = exerciseById.get(log.exerciseId)
        const name = def?.name ?? pl.builtinExerciseUnknown
        const sets = log.sets?.length ?? 0
        const totalRepsEx = (log.sets ?? []).reduce((acc, s) => acc + (s.actual.reps ?? 0), 0)
        const avgWeight =
          (log.sets ?? []).reduce((acc, s) => acc + (s.actual.weightKg ?? 0), 0) / Math.max(1, sets)

        sessionExercises.push({
          name,
          sets,
          reps: totalRepsEx > 0 ? totalRepsEx : undefined,
          weightKg: avgWeight > 0 ? Math.round(avgWeight * 10) / 10 : undefined,
        })
      }
    } else if (session.totalReps != null) {
      const builtinSets = session.setResults?.length || 1
      const program = session.program === 'custom' ? 'custom' : session.program
      sessionExercises.push({
        name: program === 'pushups' ? pl.builtinExercisePushups : program === 'pullups' ? pl.builtinExercisePullups : pl.builtinWorkoutFallback,
        sets: builtinSets,
        reps: session.totalReps,
      })
    }

    recentSessions.push({
      date: session.startedAt.split('T')[0]!,
      planName: session.program === 'custom' ? pl.calendarSessionCustom : session.program === 'pushups' ? pl.builtinExercisePushups : pl.builtinExercisePullups,
      dayNumber: session.dayNumber,
      exercises: sessionExercises,
    })
  }

  // Reverse to chronological order
  recentSessions.reverse()

  const muscleGroupVolume = Array.from(muscleGroupSets.entries())
    .map(([muscleGroup, totalSets]) => ({
      muscleGroup,
      weeklySets: Math.round((totalSets / weeksSpan) * 10) / 10,
    }))
    .sort((a, b) => b.weeklySets - a.weeklySets)

  return {
    totalSessions: sessions.length,
    totalSets,
    totalReps,
    dateRange: { first: first.split('T')[0]!, last: last.split('T')[0]! },
    sessionsPerWeek: Math.round((sessions.length / weeksSpan) * 10) / 10,
    muscleGroupVolume,
    recentSessions,
  }
}
