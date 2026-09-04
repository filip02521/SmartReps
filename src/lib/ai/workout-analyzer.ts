/**
 * AI Workout Analyzer — gathers workout history, sends to AI for analysis.
 */

import { db } from '@/lib/db'
import type { ExerciseDefinition, MuscleGroup } from '@/lib/exercise-model'
import { chatCompletion, parseJsonResponse, AiApiError } from './ai-client'
import { buildWorkoutAnalysisPrompt, type AiAnalysisResponse, type WorkoutHistorySummary } from './prompts'

const DEFAULT_MODEL = 'gpt-4o-mini'

const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Klatka piersiowa',
  back: 'Plecy',
  shoulders: 'Barki',
  arms: 'Ramię',
  legs: 'Nogi',
  core: 'Core',
  full_body: 'Całe ciało',
  cardio: 'Cardio',
  other: 'Inne',
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
    reasoningEffort: isGemini ? 'none' : undefined,
    baseURL: context.baseURL,
    signal: context.signal,
  })

  const parsed = parseJsonResponse<AiAnalysisResponse>(result.content)
  if (!parsed?.analysis) {
    throw new AiApiError('AI nie zwróciło prawidłowej analizy.', undefined, 'parse')
  }

  return {
    ...parsed.analysis,
    muscleGroupLabels: MUSCLE_GROUP_LABELS,
  }
}

async function gatherWorkoutHistory(
  exercises: ExerciseDefinition[],
): Promise<WorkoutHistorySummary> {
  const sessions = await db.workoutSessions
    .where('status')
    .equals('completed')
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

  // Recent sessions (last 10)
  const recentSessions: WorkoutHistorySummary['recentSessions'] = []

  // Built-in program muscle group mapping
  const BUILTIN_MUSCLE_GROUP: Record<string, MuscleGroup> = {
    pushups: 'chest',
    pullups: 'back',
  }

  for (const session of [...sorted].reverse().slice(0, 20)) {
    const sessionExercises: WorkoutHistorySummary['recentSessions'][number]['exercises'] = []

    if (session.exerciseLogs && session.exerciseLogs.length > 0) {
      for (const log of session.exerciseLogs) {
        const def = exerciseById.get(log.exerciseId)
        const name = def?.name ?? 'Nieznane ćwiczenie'
        const sets = log.sets.length
        const totalRepsEx = log.sets.reduce((acc, s) => acc + (s.actual.reps ?? 0), 0)
        const avgWeight =
          log.sets.reduce((acc, s) => acc + (s.actual.weightKg ?? 0), 0) / Math.max(1, sets)

        sessionExercises.push({
          name,
          sets,
          reps: totalRepsEx > 0 ? totalRepsEx : undefined,
          weightKg: avgWeight > 0 ? Math.round(avgWeight * 10) / 10 : undefined,
        })

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
      sessionExercises.push({
        name: program === 'pushups' ? 'Pompki' : program === 'pullups' ? 'Podciąganie' : 'Trening',
        sets: builtinSets,
        reps: session.totalReps,
      })
    }

    if (recentSessions.length < 10) {
      recentSessions.push({
        date: session.startedAt.split('T')[0]!,
        planName: session.program === 'custom' ? 'Plan własny' : session.program === 'pushups' ? 'Pompki' : 'Podciąganie',
        dayNumber: session.dayNumber,
        exercises: sessionExercises,
      })
    }
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
