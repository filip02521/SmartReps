import type { CustomPlan, CustomProgramProgress, ExerciseDefinition } from '@/lib/exercise-model'
import type { CustomPlanResumeInfo } from '@/lib/custom-plan-resume'
import type { LocalWorkoutSession } from '@/lib/db'
import type { CustomCycleDayStatus } from '@/lib/custom-plan-cycle-rail'
import { resolveCustomCycleDayStatus } from '@/lib/custom-plan-cycle-rail'
import { daysUntilWorkout, isWorkoutAvailable } from '@/lib/progress-engine'
import { pl } from '@/i18n/pl'

export type CustomPlanHomeBadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'default'

export type CustomPlanCycleDay = { dayNumber: number; status: CustomCycleDayStatus }

export type CustomPlanHomeCardModel = {
  planId: string
  planName: string
  badge: { label: string; variant: CustomPlanHomeBadgeVariant }
  dayLine: string
  previewLine: string
  detailLine: string | null
  resume: CustomPlanResumeInfo | null
  ctaLabel: string
  ctaAction: 'train' | 'unpause'
  /** Progress data for the cycle bar + percent. */
  totalDays: number
  completedDays: number
  pct: number
  /** Per-day status for the cycle rail (null when plan too long to render). */
  cycleDays: CustomPlanCycleDay[] | null
  isPaused: boolean
  isCycleComplete: boolean
  isResting: boolean
  restDaysLeft: number
}

function sortedDayNumbers(plan: CustomPlan): number[] {
  return [...plan.days].map((d) => d.dayNumber).sort((a, b) => a - b)
}

export function getCustomPlanDisplayDay(
  plan: CustomPlan,
  progress: CustomProgramProgress | null,
): number {
  const days = sortedDayNumbers(plan)
  if (days.length === 0) return 1
  if (!progress || progress.status === 'cycle_complete') return days[0]!
  return progress.currentDay
}

export function getCustomPlanDayPreview(
  plan: CustomPlan,
  dayNumber: number,
  exercises: ExerciseDefinition[],
): { names: string; exerciseCount: number; setCount: number } {
  const day = plan.days.find((d) => d.dayNumber === dayNumber)
  if (!day || day.exercises.length === 0) {
    return { names: '', exerciseCount: 0, setCount: 0 }
  }
  const byId = new Map(exercises.map((e) => [e.id, e]))
  const names = day.exercises
    .map((pe) => byId.get(pe.exerciseId)?.name ?? pl.planEllipsis)
    .join(' · ')
  const setCount = day.exercises.reduce((sum, pe) => sum + pe.sets.length, 0)
  return { names, exerciseCount: day.exercises.length, setCount }
}

export function buildCustomPlanHomeCardModel(params: {
  plan: CustomPlan
  progress: CustomProgramProgress | null
  resume: CustomPlanResumeInfo | null
  exercises: ExerciseDefinition[]
  sessions: LocalWorkoutSession[]
  /** @deprecated Custom days no longer use fail-restart; ignored. */
  lastFailed?: boolean
}): CustomPlanHomeCardModel {
  const { plan, progress, resume, exercises, sessions } = params
  const totalDays = plan.days.length
  const displayDay = getCustomPlanDisplayDay(plan, progress)
  const preview = getCustomPlanDayPreview(plan, displayDay, exercises)
  const attempt = progress?.cycleAttempt ?? 1

  const dayParts = [pl.homeCustomDayOf(displayDay, totalDays)]
  if (attempt > 1) dayParts.push(pl.attemptShort(attempt))
  const dayLine = dayParts.join(' · ')

  const previewLine =
    preview.names.length > 0
      ? pl.homeCustomTodayPreview(preview.names, preview.exerciseCount, preview.setCount)
      : pl.customWorkoutMissingDay

  let badge: CustomPlanHomeCardModel['badge']
  let detailLine: string | null = null

  const isPaused = progress?.status === 'paused'
  const isCycleComplete = progress?.status === 'cycle_complete'
  const isResting =
    progress?.status === 'rest' &&
    !!progress.nextWorkoutAfter &&
    !isWorkoutAvailable(new Date(progress.nextWorkoutAfter))
  const restDaysLeft = isResting
    ? Math.max(1, daysUntilWorkout(new Date(progress!.nextWorkoutAfter!)))
    : 0

  if (resume) {
    badge = { label: pl.statusInProgress, variant: 'info' }
    detailLine = pl.homeCustomResumeHint(resume.set, resume.totalSets)
    if (resume.stale) {
      detailLine = `${detailLine} · ${pl.staleSessionShort}`
    }
  } else if (isPaused) {
    badge = { label: pl.statusPaused, variant: 'default' }
  } else if (isCycleComplete) {
    badge = { label: pl.homeCustomStatusCycleComplete, variant: 'success' }
    detailLine = pl.homeCustomCycleRestartHint
  } else if (isResting) {
    badge = { label: pl.statusRest, variant: 'warning' }
    detailLine = pl.nextWorkoutIn(restDaysLeft)
  } else {
    badge = { label: pl.statusReady, variant: 'success' }
  }

  const ctaLabel = resume
    ? pl.continueWorkout(resume.day, resume.set, resume.totalSets)
    : isPaused
      ? pl.planResume
      : pl.planTrain

  const ctaAction: CustomPlanHomeCardModel['ctaAction'] =
    !resume && isPaused ? 'unpause' : 'train'

  // Progress: completed days / total. Cycle-complete counts as full.
  const completedDays = isCycleComplete
    ? totalDays
    : Math.max(0, (progress?.currentDay ?? 1) - 1)
  const pct =
    totalDays > 0 ? Math.min(100, Math.round((completedDays / totalDays) * 100)) : 0

  // Cycle rail: render only for plans with <= 14 days (longer plans get just the bar).
  const cycleDays =
    totalDays > 0 && totalDays <= 14
      ? plan.days.map((d) => ({
          dayNumber: d.dayNumber,
          status: resolveCustomCycleDayStatus(d.dayNumber, progress, sessions),
        }))
      : null

  return {
    planId: plan.id,
    planName: plan.name.trim() || pl.planDash,
    badge,
    dayLine,
    previewLine,
    detailLine,
    resume,
    ctaLabel,
    ctaAction,
    totalDays,
    completedDays,
    pct,
    cycleDays,
    isPaused,
    isCycleComplete,
    isResting,
    restDaysLeft,
  }
}
