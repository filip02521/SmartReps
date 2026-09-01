import { cn } from '@/lib/utils'
import { pl } from '@/i18n/pl'
import type { PrimaryMetric, SetPrescription } from '@/lib/exercise-model'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'

function formatPrescriptionChip(set: SetPrescription, metric: PrimaryMetric): string {
  if (metric === 'duration_sec' && set.durationSec) {
    const v = metricTargetDisplayValue(set.durationSec)
    return `${v}s`
  }
  const reps = set.reps ? metricTargetDisplayValue(set.reps) : 0
  if (metric === 'reps_weight') {
    const kg =
      set.weightKg && set.weightKg.kind !== 'max'
        ? set.weightKg.value
        : set.weightKg?.kind === 'max'
          ? set.weightKg.minValue
          : null
    return kg != null && Number.isFinite(kg) ? `${reps}×${kg}kg` : `${reps}`
  }
  return String(reps)
}

/** Scannable set chips for custom plan prescriptions. */
export function CustomSetChips({
  sets,
  metric,
  className,
  size = 'md',
}: {
  sets: SetPrescription[]
  metric: PrimaryMetric
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)} aria-label={pl.setColumn}>
      {sets.map((set, i) => (
        <li
          key={i}
          className={cn(
            'flex min-w-[2.25rem] flex-col items-center justify-center rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]',
            size === 'sm' ? 'px-1.5 py-1' : 'px-2.5 py-2',
          )}
        >
          <span className="sr-text-overline text-[var(--sr-text-muted)]">{i + 1}</span>
          <span
            className={cn(
              'font-semibold tabular-nums leading-tight text-[var(--sr-text-primary)]',
              size === 'sm' ? 'text-xs' : 'text-sm',
            )}
          >
            {formatPrescriptionChip(set, metric)}
          </span>
        </li>
      ))}
    </ul>
  )
}
