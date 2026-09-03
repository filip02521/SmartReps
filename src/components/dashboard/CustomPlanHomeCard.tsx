import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { getOrCreateCustomProgress, getCustomPlan, setCustomPlanPaused, listExercises } from '@/lib/custom-plan-service'
import { getCustomPlanDisplayDay } from '@/lib/custom-plan-home-summary'
import { CustomWorkoutPreviewSheet } from '@/components/workout/WorkoutPreviewSheet'
import type { CustomPlan, ExerciseDefinition, PlanDay } from '@/lib/exercise-model'
import type { CustomPlanHomeCardModel } from '@/lib/custom-plan-home-summary'
import { cn } from '@/lib/utils'
import { Dumbbell, Pause, Play, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
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

      {preview && (
        <CustomWorkoutPreviewSheet
          open
          onClose={() => setPreview(null)}
          planId={model.planId}
          planName={preview.plan.name.trim() || model.planName}
          dayNumber={preview.dayNumber}
          originalDay={preview.day}
          exercises={preview.exercises}
          onStart={handleStart}
        />
      )}
    </article>
  )
}
