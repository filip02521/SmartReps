import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { getOrCreateCustomProgress, getCustomPlan, setCustomPlanPaused, listExercises } from '@/lib/custom-plan-service'
import { getCustomPlanDisplayDay } from '@/lib/custom-plan-home-summary'
import { CustomWorkoutPreviewSheet } from '@/components/workout/WorkoutPreviewSheet'
import { CustomPlanCycleRail } from '@/components/progress/CustomPlanCycleRail'
import type { CustomPlan, ExerciseDefinition, PlanDay } from '@/lib/exercise-model'
import type { CustomPlanHomeCardModel } from '@/lib/custom-plan-home-summary'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { pl } from '@/i18n/pl'
import { Dumbbell, Pause, Play, CheckCircle2, Clock, AlertCircle, Map as MapIcon } from 'lucide-react'
import type { ReactNode } from 'react'

const statusIcon: Record<string, { icon: ReactNode; accent: string; muted: string }> = {
  info: {
    icon: <Play size={16} strokeWidth={2.5} />,
    accent: 'var(--sr-info)',
    muted: 'var(--sr-info-muted)',
  },
  warning: {
    icon: <Clock size={16} strokeWidth={2.5} />,
    accent: 'var(--sr-warning)',
    muted: 'var(--sr-warning-muted)',
  },
  success: {
    icon: <CheckCircle2 size={16} strokeWidth={2.5} />,
    accent: 'var(--sr-success)',
    muted: 'var(--sr-success-muted)',
  },
  error: {
    icon: <AlertCircle size={16} strokeWidth={2.5} />,
    accent: 'var(--sr-error)',
    muted: 'var(--sr-error-muted)',
  },
  default: {
    icon: <Pause size={16} strokeWidth={2.5} />,
    accent: 'var(--sr-text-muted)',
    muted: 'color-mix(in srgb, var(--sr-text-muted) 12%, transparent)',
  },
}

export function CustomPlanHomeCard({
  model,
  onUpdated,
}: {
  model: CustomPlanHomeCardModel
  onUpdated?: () => void
}) {
  const navigate = useNavigate()
  const chrome = statusIcon[model.badge.variant] ?? statusIcon.default!
  const [preview, setPreview] = useState<{
    plan: CustomPlan
    day: PlanDay
    dayNumber: number
    exercises: Map<string, ExerciseDefinition>
  } | null>(null)
  const [planMap, setPlanMap] = useState<{
    plan: CustomPlan
    progress: import('@/lib/exercise-model').CustomProgramProgress | null
    exercises: Map<string, ExerciseDefinition>
    sessions: import('@/lib/db').LocalWorkoutSession[]
  } | null>(null)
  const [planMapDay, setPlanMapDay] = useState<number | null>(null)

  async function openPreview() {
    const plan = await getCustomPlan(model.planId)
    if (!plan) return
    const progress = await getOrCreateCustomProgress(model.planId)
    const dayNumber = getCustomPlanDisplayDay(plan, progress ?? null)
    const day = plan.days.find((d) => d.dayNumber === dayNumber) ?? plan.days[0]
    if (!day) return
    const exList = await listExercises()
    const exMap = new Map(exList.map((e) => [e.id, e]))
    setPreview({ plan, day, dayNumber, exercises: exMap })
  }

  function handleStart() {
    setPreview(null)
    navigate(`/workout/custom/${model.planId}`)
  }

  async function openPlanMap() {
    const plan = await getCustomPlan(model.planId)
    if (!plan) return
    // Read-only — don't create progress just by viewing the map.
    const { db } = await import('@/lib/db')
    const progress = await db.customProgramProgress
      .where('customPlanId')
      .equals(model.planId)
      .first()
    const planSessions = await db.workoutSessions
      .where('customPlanId')
      .equals(model.planId)
      .toArray()
    const exList = await listExercises()
    const exMap = new Map(exList.map((e) => [e.id, e]))
    setPlanMap({ plan, progress: progress ?? null, exercises: exMap, sessions: planSessions })
  }

  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)]',
        'bg-[var(--sr-bg-elevated)] p-4 transition-colors hover:border-[var(--sr-border-strong)]',
      )}
      style={{
        backgroundImage: `linear-gradient(135deg, ${chrome.muted} 0%, var(--sr-bg-elevated) 50%)`,
      }}
    >
      {/* Accent bar — left edge */}
      <div
        className="absolute inset-y-0 left-0 w-1"
        style={{ background: chrome.accent }}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]"
            style={{ background: chrome.muted, color: chrome.accent }}
            aria-hidden
          >
            <Dumbbell size={18} strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-[var(--sr-text-primary)]">
              {model.planName}
            </h3>
            <p className="mt-0.5 text-sm text-[var(--sr-text-secondary)]">{model.dayLine}</p>
          </div>
        </div>
        <Badge variant={model.badge.variant} className="shrink-0">
          <span className="flex items-center gap-1">
            {chrome.icon}
            {model.badge.label}
          </span>
        </Badge>
      </div>

      <p
        className="mt-3 truncate text-sm text-[var(--sr-text-primary)]"
        title={model.previewLine}
      >
        {model.previewLine}
      </p>

      {model.detailLine ? (
        <p className="mt-1 text-sm text-[var(--sr-text-muted)]">{model.detailLine}</p>
      ) : null}

      <Button
        type="button"
        size="touch"
        fullWidth
        className="mt-5"
        onClick={() => {
          if (model.ctaAction === 'unpause') {
            void setCustomPlanPaused(model.planId, false).then(() => onUpdated?.())
            return
          }
          // Resume → go directly (workout already in progress).
          if (model.resume) {
            navigate(`/workout/custom/${model.planId}`)
            return
          }
          // Fresh start → preview first.
          void openPreview()
        }}
      >
        {model.ctaLabel}
      </Button>

      <button
        type="button"
        className={cn(
          'mt-2 flex min-h-11 w-full items-center justify-center gap-2',
          'sr-text-body-sm text-[var(--sr-text-muted)] transition-colors',
          'hover:text-[var(--sr-text-primary)]',
          FOCUS_RING,
          'rounded-[var(--sr-radius-md)]',
        )}
        onClick={() => void openPlanMap()}
      >
        <MapIcon size={16} aria-hidden />
        {pl.menuPlanMap}
      </button>

      {preview && (
        <CustomWorkoutPreviewSheet
          open
          onClose={() => setPreview(null)}
          planId={model.planId}
          planName={preview.plan.name.trim() || model.planName}
          dayNumber={preview.dayNumber}
          originalDay={preview.day}
          exercises={preview.exercises}
          plan={preview.plan}
          onStart={handleStart}
        />
      )}

      {planMap && (
        <Sheet
          open
          onClose={() => {
            setPlanMap(null)
            setPlanMapDay(null)
          }}
          title={planMap.plan.name.trim() || model.planName}
        >
          <div className="pb-2">
            <p className="mb-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
              {pl.progressCustomPlanDayProgress(
                getCustomPlanDisplayDay(planMap.plan, planMap.progress),
                planMap.plan.days.length,
              )}
            </p>
            <CustomPlanCycleRail
              plan={planMap.plan}
              progress={planMap.progress}
              sessions={planMap.sessions}
              selectedDay={planMapDay ?? getCustomPlanDisplayDay(planMap.plan, planMap.progress)}
              onDayClick={setPlanMapDay}
            />

            {(() => {
              const detailDay = planMapDay ?? getCustomPlanDisplayDay(planMap.plan, planMap.progress)
              const day = planMap.plan.days.find((d) => d.dayNumber === detailDay)
              if (!day) return null
              return (
                <div className="mt-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3">
                  <p className="sr-text-overline text-[var(--sr-text-muted)]">
                    {pl.dayLabel(detailDay)}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {day.exercises.map((ex, idx) => {
                      const def = planMap.exercises.get(ex.exerciseId)
                      const name = def?.name ?? pl.progressCustomExerciseFallback
                      return (
                        <li
                          key={`${ex.exerciseId}-${idx}`}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <span className="min-w-0 truncate sr-text-body-sm text-[var(--sr-text-primary)]">
                            {name}
                          </span>
                          <span className="shrink-0 sr-text-caption text-[var(--sr-text-muted)]">
                            {pl.progressCustomDaySets(ex.sets.length)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })()}
          </div>
        </Sheet>
      )}
    </article>
  )
}
