import { ChevronRight, Pencil } from 'lucide-react'
import { ExerciseSparkline } from '@/components/plans/ExerciseSparkline'
import { ExerciseStatsIconButton } from '@/components/plans/ExerciseDetailSheet'
import type { ExerciseDefinition, PrimaryMetric } from '@/lib/exercise-model'
import type { ExerciseListSummary } from '@/lib/custom-exercise-stats'
import { pl } from '@/i18n/pl'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

function metricLabel(m: PrimaryMetric): string {
  if (m === 'reps') return pl.exerciseMetricReps
  if (m === 'duration_sec') return pl.exerciseMetricDuration
  return pl.exerciseMetricRepsWeight
}

function trendDot(trend: ExerciseListSummary['trend']) {
  if (trend === 'up') return 'bg-[var(--sr-success)]'
  if (trend === 'down') return 'bg-[var(--sr-error)]'
  if (trend === 'flat') return 'bg-[var(--sr-text-muted)]'
  return null
}

export function ExerciseLibraryRow({
  exercise,
  summary,
  mode,
  onOpenDetail,
  onPick,
  onEdit,
}: {
  exercise: ExerciseDefinition
  summary: ExerciseListSummary | undefined
  mode: 'manage' | 'pick'
  onOpenDetail: () => void
  onPick?: () => void
  onEdit?: () => void
}) {
  const hasHistory = (summary?.sessionCount ?? 0) > 0
  const dotClass = trendDot(summary?.trend ?? null)

  const subtitle = hasHistory
    ? pl.exerciseListRowMeta(summary!.sessionCount, summary!.prLabel ?? '—')
    : metricLabel(exercise.primaryMetric)

  return (
    <article
      className={cn(
        'flex items-center gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)]',
        'bg-[var(--sr-bg-surface)] p-2.5 transition-colors',
        'hover:border-[var(--sr-border-strong)]',
      )}
    >
      <button
        type="button"
        className={cn(
          'flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-[var(--sr-radius-sm)] text-left transition-colors hover:bg-[var(--sr-bg-elevated)] active:scale-[0.99]',
          FOCUS_RING,
        )}
        onClick={() => {
          if (mode === 'pick' && onPick) onPick()
          else onOpenDetail()
        }}
      >
        <ExerciseSparkline values={summary?.sparkline ?? []} active={hasHistory} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate font-medium text-[var(--sr-text-primary)]">{exercise.name}</p>
            {dotClass && (
              <span
                className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)}
                aria-hidden
              />
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--sr-text-muted)]">{subtitle}</p>
        </div>
        <ChevronRight size={18} className="shrink-0 text-[var(--sr-text-muted)]" aria-hidden />
      </button>

      {mode === 'pick' && <ExerciseStatsIconButton onClick={onOpenDetail} />}

      {mode === 'manage' && (
        <ExerciseStatsIconButton onClick={onOpenDetail} />
      )}

      {mode === 'manage' && onEdit && (
        <button
          type="button"
          aria-label={pl.editExercise}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)]',
            'text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-elevated)] hover:text-[var(--sr-text-primary)] active:scale-95',
            FOCUS_RING,
          )}
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
        >
          <Pencil size={18} aria-hidden />
        </button>
      )}
    </article>
  )
}
