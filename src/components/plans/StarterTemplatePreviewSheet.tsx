import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { formatPrescriptionTarget, type DurationUnit } from '@/lib/custom-prescription-format'
import { useAppStore } from '@/stores/app-store'
import {
  starterTemplateName,
  starterTemplateDescription,
} from '@/lib/starter-templates'
import { starterTemplateEstimatedWeeks } from '@/data/starter-templates'
import type {
  StarterTemplate,
  StarterTemplateDay,
} from '@/data/starter-templates'
import { EXERCISE_STARTERS, type ExerciseStarterKey, type PrimaryMetric } from '@/lib/exercise-model'

const STARTER_LABELS: Record<ExerciseStarterKey, string> = EXERCISE_STARTERS.reduce(
  (acc, s) => {
    const key = `exerciseStarter${s.key.charAt(0).toUpperCase()}${s.key.slice(1)}` as keyof typeof pl
    acc[s.key] = pl[key] as string
    return acc
  },
  {} as Record<ExerciseStarterKey, string>,
)

function formatSet(
  set: StarterTemplateDay['exercises'][number]['sets'][number],
  metric: PrimaryMetric,
  weightUnit: 'kg' | 'lb',
  durationUnit: DurationUnit,
): string {
  return formatPrescriptionTarget(set, metric, weightUnit, durationUnit)
}

export function StarterTemplatePreviewSheet({
  open,
  template,
  onClose,
  onActivate,
  activating,
}: {
  open: boolean
  template: StarterTemplate
  onClose: () => void
  onActivate: () => void
  activating?: boolean
}) {
  const [selectedDay, setSelectedDay] = useState<number>(1)
  const weightUnit = useAppStore((s) => s.settings.weightUnit)

  useEffect(() => {
    if (open) setSelectedDay(template.days[0]?.dayNumber ?? 1)
  }, [open, template])

  const day = template.days.find((d) => d.dayNumber === selectedDay) ?? template.days[0]
  if (!day) return null

  const name = starterTemplateName(template)
  const desc = starterTemplateDescription(template)
  const weeks = starterTemplateEstimatedWeeks(template)
  const totalSets = day.exercises.reduce((sum, pe) => sum + pe.sets.length, 0)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pl.starterPreviewTitle}
      elevated
      className="max-w-md"
    >
      <div className="flex flex-col gap-4 pb-4">
        {/* Header */}
        <div className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] px-4 py-3">
          <p className="sr-text-overline text-[var(--sr-text-muted)]">
            {pl.starterDaysPerWeek(template.daysPerWeek)} ·{' '}
            {pl.starterEstimatedWeeks(weeks[0], weeks[1])}
          </p>
          <p className="mt-1 sr-text-h3 text-[var(--sr-text-primary)]">{name}</p>
          <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{desc}</p>
        </div>

        {/* Day selector */}
        {template.days.length > 1 && (
          <div role="group" aria-label={pl.starterPreviewDayLabel(selectedDay)}>
            <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
              {pl.starterPreviewDayLabel(selectedDay)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {template.days.map((d) => (
                <button
                  key={d.dayNumber}
                  type="button"
                  onClick={() => setSelectedDay(d.dayNumber)}
                  className={cn(
                    'min-h-9 rounded-[var(--sr-radius-sm)] border px-3 py-1.5 text-sm font-medium tabular-nums transition-colors active:scale-95',
                    FOCUS_RING,
                    d.dayNumber === selectedDay
                      ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)]'
                      : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] text-[var(--sr-text-secondary)]',
                  )}
                  aria-pressed={d.dayNumber === selectedDay}
                >
                  {pl.planDayLabel(d.dayNumber)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Day summary */}
        <div className="flex items-center gap-2 text-xs text-[var(--sr-text-muted)]">
          <Badge variant="default">
            {pl.starterPreviewExercisesCount(day.exercises.length)}
          </Badge>
          <Badge variant="default">
            {pl.starterPreviewSetsCount(totalSets)}
          </Badge>
        </div>

        {/* Exercises — read-only */}
        <div className="flex flex-col gap-3">
          {day.exercises.map((pe, i) => {
            const starter = EXERCISE_STARTERS.find((s) => s.key === pe.starterKey)
            const exName = STARTER_LABELS[pe.starterKey] ?? pl.planEllipsis
            const metric = starter?.primaryMetric ?? 'reps'
            const durationUnit: DurationUnit =
              starter?.muscleGroup === 'cardio' ? 'min' : 'sec'
            return (
              <div
                key={`${pe.starterKey}-${i}`}
                className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-[var(--sr-text-primary)]">{exName}</p>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--sr-text-muted)]">
                    {pe.sets.length} {pl.setsShort}
                  </span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {pe.sets.map((s, si) => (
                    <span
                      key={si}
                      className="flex min-w-[2.25rem] flex-col items-center justify-center rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-2 py-1.5"
                    >
                      <span className="sr-text-overline text-[var(--sr-text-muted)]">
                        {si + 1}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
                        {formatSet(s, metric, weightUnit, durationUnit)}
                      </span>
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[var(--sr-text-muted)]">
                  {pl.starterPreviewRestLabel}: {pl.durationSecValue(pe.restBetweenSetsSec)}
                </p>
              </div>
            )
          })}
        </div>

        {/* Progression info */}
        <div className="rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)] px-3 py-2 text-xs text-[var(--sr-text-secondary)]">
          {template.progression?.enabled && (template.progression.repsDelta ?? 0) > 0
            ? pl.starterPreviewProgression(template.progression.repsDelta ?? 0)
            : pl.starterPreviewNoProgression}
        </div>

        {/* Hint */}
        <p className="text-xs text-[var(--sr-text-muted)]">
          {pl.starterPreviewStartHint}
        </p>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="touch"
            fullWidth
            onClick={onClose}
          >
            {pl.planBack}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="touch"
            fullWidth
            disabled={activating}
            onClick={onActivate}
          >
            {activating ? pl.starterActivating : pl.starterActivate}
          </Button>
        </div>
      </div>
    </Sheet>
  )
}
