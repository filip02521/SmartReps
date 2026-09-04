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
