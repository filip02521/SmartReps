import { useState, useMemo } from 'react'
import { ChevronDown, Flame, Plus } from 'lucide-react'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { kgToDisplay, displayToKg, weightUnitLabel } from '@/lib/weight-units'
import { NumericDraftInput } from '@/components/ui/NumericDraftInput'
import type { PrimaryMetric } from '@/lib/exercise-model'

type WarmupSet = {
  reps: number
  weightKg: number
  label: string
}

/**
 * Collapsible warmup panel with auto-generator.
 * For reps_weight: generates a full warm-up ladder (bar, 50%, 65%, 80%, 90%).
 * For reps: suggests 50%, 75% of target reps.
 * For duration: suggests 30s at 50% intensity.
 */
export function WarmupPanel({
  metric,
  targetReps,
  targetWeight,
  weightUnit = 'kg',
  onAddWarmupSet,
}: {
  metric: PrimaryMetric
  targetReps: number
  targetWeight?: number
  weightUnit?: 'kg' | 'lb'
  /** Called when user taps "add" on a warm-up set. */
  onAddWarmupSet?: (set: { reps: number; weightKg: number }) => void
}) {
  const [open, setOpen] = useState(false)
  const [customWeight, setCustomWeight] = useState<number>(
    targetWeight ? kgToDisplay(targetWeight, weightUnit) : 0,
  )

  const suggestions = useMemo(
    () => buildWarmupSuggestions(metric, targetReps, targetWeight, weightUnit),
    [metric, targetReps, targetWeight, weightUnit],
  )

  const generatorSets = useMemo<WarmupSet[]>(() => {
    if (metric !== 'reps_weight') return []
    const workingWeight = customWeight === 0 ? targetWeight : displayToKg(customWeight, weightUnit)
    if (!workingWeight || workingWeight <= 0) return []

    const barWeight = 20 // standard Olympic bar
    const unit = weightUnitLabel(weightUnit)
    const disp = (kg: number) => kgToDisplay(Math.round(kg), weightUnit)

    // Build ladder entries: { reps, fraction } — filtered by minimum useful weight
    const ladder: { reps: number; fraction: number }[] = [
      { reps: 10, fraction: 0 }, // empty bar
      { reps: 5, fraction: 0.5 },
      { reps: 4, fraction: 0.65 },
      { reps: 3, fraction: 0.8 },
      { reps: 2, fraction: 0.9 },
    ]

    const sets: WarmupSet[] = []
    const seenWeights = new Set<number>()

    for (const rung of ladder) {
      const kg = rung.fraction === 0 ? barWeight : Math.round(workingWeight * rung.fraction)
      // Skip if weight is too close to the working weight (no warm-up value)
      if (rung.fraction > 0 && kg >= workingWeight) continue
      // Skip if weight is below bar weight (unless it's the empty bar rung)
      if (rung.fraction > 0 && kg <= barWeight) continue
      // Skip duplicates (same weight as previous rung)
      if (seenWeights.has(kg)) continue
      seenWeights.add(kg)
      sets.push({
        reps: rung.reps,
        weightKg: kg,
        label: pl.warmupSetRepsWeight(rung.reps, disp(kg), unit),
      })
    }

    return sets
  }, [metric, customWeight, targetWeight, weightUnit])

  if (suggestions.length === 0 && metric !== 'reps_weight') return null

  const showGenerator = metric === 'reps_weight'

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
          {showGenerator ? pl.warmupGeneratorTitle : pl.warmupTitle}
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-[var(--sr-text-muted)] transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {open && (
        <div className="border-t border-[var(--sr-border-subtle)] px-3 py-2">
          {/* Quick suggestions (non-weighted) */}
          {!showGenerator && (
            <>
              <p className="mb-2 text-xs text-[var(--sr-text-muted)]">{pl.warmupHint}</p>
              <ul className="space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 sr-text-body-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sr-brand-primary)]/10 text-xs font-semibold text-[var(--sr-brand-primary)]">
                      {i + 1}
                    </span>
                    <span className="min-w-0 break-words text-[var(--sr-text-primary)]">{s}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Interactive generator for weighted exercises */}
          {showGenerator && (
            <>
              <p className="mb-2 text-xs text-[var(--sr-text-muted)]">{pl.warmupGeneratorHint}</p>
              <div className="mb-2 flex items-center gap-2">
                <label className="sr-text-body-sm font-medium text-[var(--sr-text-secondary)]" htmlFor="warmup-working-weight">
                  {pl.warmupGeneratorWorkingWeight}
                </label>
                <div className="flex items-center gap-1">
                  <NumericDraftInput
                    id="warmup-working-weight"
                    value={customWeight}
                    mode="decimal"
                    min={0}
                    onCommit={(v: number) => setCustomWeight(v)}
                    className="w-20"
                    ariaLabel={pl.warmupGeneratorWorkingWeight}
                  />
                  <span className="text-xs text-[var(--sr-text-muted)]">{weightUnitLabel(weightUnit)}</span>
                </div>
              </div>

              {generatorSets.length > 0 && (
                <>
                  <ul className="mb-2 space-y-1">
                    {generatorSets.map((s, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 sr-text-body-sm">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sr-brand-primary)]/10 text-xs font-semibold text-[var(--sr-brand-primary)]">
                            {i + 1}
                          </span>
                          <span className="min-w-0 break-words text-[var(--sr-text-primary)]">{s.label}</span>
                        </div>
                        {onAddWarmupSet && (
                          <button
                            type="button"
                            onClick={() => onAddWarmupSet({ reps: s.reps, weightKg: s.weightKg })}
                            className={cn(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-brand-primary)] hover:text-white',
                              FOCUS_RING,
                            )}
                            aria-label={`${pl.warmupGeneratorAddSet}: ${s.label}`}
                          >
                            <Plus size={14} />
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
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
