import { useState } from 'react'
import { ChevronDown, Flame } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { kgToDisplay, weightUnitLabel } from '@/lib/weight-units'
import type { PrimaryMetric } from '@/lib/exercise-model'

/**
 * Collapsible warmup suggestion panel.
 * Shows recommended warmup sets based on the working weight/target.
 * For reps_weight: suggests 50%, 70%, 80% of working weight for 5-8 reps.
 * For reps: suggests 50%, 75% of target reps.
 * For duration: suggests 30s at 50% intensity.
 */
export function WarmupPanel({
  metric,
  targetReps,
  targetWeight,
  weightUnit = 'kg',
}: {
  metric: PrimaryMetric
  targetReps: number
  targetWeight?: number
  weightUnit?: 'kg' | 'lb'
}) {
  const [open, setOpen] = useState(false)

  const suggestions = buildWarmupSuggestions(metric, targetReps, targetWeight, weightUnit)
  if (suggestions.length === 0) return null

  return (
    <div className="mb-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]">
      <button
        type="button"
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2.5 text-left',
          FOCUS_RING,
        )}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Flame size={16} className="shrink-0 text-[var(--sr-warning)]" aria-hidden />
        <span className="flex-1 sr-text-body-sm font-medium text-[var(--sr-text-secondary)]">
          {pl.warmupTitle}
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-[var(--sr-text-muted)] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-[var(--sr-border-subtle)] px-3 py-2">
          <p className="mb-2 text-xs text-[var(--sr-text-muted)]">{pl.warmupHint}</p>
          <ul className="space-y-1">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-center gap-2 sr-text-body-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sr-brand-primary)]/10 text-xs font-semibold text-[var(--sr-brand-primary)]">
                  {i + 1}
                </span>
                <span className="text-[var(--sr-text-primary)]">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function buildWarmupSuggestions(
  metric: PrimaryMetric,
  targetReps: number,
  targetWeight?: number,
  weightUnit: 'kg' | 'lb' = 'kg',
): string[] {
  if (metric === 'reps_weight' && targetWeight && targetWeight > 0) {
    const unit = weightUnitLabel(weightUnit)
    const disp = (frac: number) => kgToDisplay(Math.round(targetWeight * frac), weightUnit)
    return [
      pl.warmupSetRepsWeight(5, disp(0.5), unit),
      pl.warmupSetRepsWeight(5, disp(0.7), unit),
      pl.warmupSetRepsWeight(3, disp(0.8), unit),
    ]
  }
  if (metric === 'reps' && targetReps > 0) {
    return [
      pl.warmupSetReps(Math.max(5, Math.round(targetReps * 0.5))),
      pl.warmupSetReps(Math.max(3, Math.round(targetReps * 0.75))),
    ]
  }
  if (metric === 'duration_sec') {
    return [pl.warmupSetDuration(30)]
  }
  return []
}
