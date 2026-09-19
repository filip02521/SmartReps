import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Minus, MoreVertical, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { WorkoutStepperButton } from '@/components/workout/WorkoutComponents'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { muscleGroupLabel } from '@/lib/exercise-substitution'
import { formatExerciseSetSummary } from '@/lib/custom-exercise-stats'
import { displayToKg, kgToDisplay } from '@/lib/weight-units'
import type { ExerciseDefinition, ExerciseLog, SetActual } from '@/lib/exercise-model'

/** One exercise in a free (ad-hoc) workout: logged sets as tappable chips +
 * a counter row prefilled from the previous set for one-tap logging. */
export function FreeExerciseCard({
  log,
  def,
  index,
  total,
  weightUnit,
  initialActual,
  isActive,
  onAddSet,
  onEditSet,
  onMove,
  onRemove,
}: {
  log: ExerciseLog
  def: ExerciseDefinition | undefined
  index: number
  total: number
  weightUnit: 'kg' | 'lb'
  /** Last logged actual for this exercise across history — seeds the inputs
   * when the exercise has no sets yet (prefill-before-first-set). */
  initialActual?: SetActual
  /** Visually marks the card the user is currently logging into. */
  isActive?: boolean
  onAddSet: (actual: SetActual) => void
  onEditSet: (setIndex: number) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const metric = def?.primaryMetric ?? 'reps'
  const durationUnit = def?.durationDisplayUnit ?? 'sec'
  const isRepsWeight = metric === 'reps_weight'
  const isDuration = metric === 'duration_sec'

  const lastSet = log.sets[log.sets.length - 1]
  const [primary, setPrimary] = useState('')
  const [weight, setWeight] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  // Prefill inputs from the last logged set (Strong-style repeat logging);
  // before the first set, seed from the exercise's most recent historical
  // actual so a returning user repeats their typical performance.
  useEffect(() => {
    const source = lastSet?.actual ?? (log.sets.length === 0 ? initialActual : undefined)
    if (!source) return
    setPrimary(
      isDuration
        ? durationUnit === 'min'
          ? String(Math.round(((source.durationSec ?? 0) / 60) * 10) / 10)
          : String(source.durationSec ?? '')
        : String(source.reps ?? ''),
    )
    setWeight(
      isRepsWeight && source.weightKg != null
        ? String(kgToDisplay(source.weightKg, weightUnit))
        : '',
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prefill on new set or new card only
  }, [log.sets.length, initialActual])

  // Step sizes follow the metric: reps ±1, duration ±5s (±0.5min), weight ±2.5kg/±5lb.
  const primaryStep = isDuration ? (durationUnit === 'min' ? 0.5 : 5) : 1
  const weightStep = weightUnit === 'lb' ? 5 : 2.5

  function bump(which: 'primary' | 'weight', dir: -1 | 1) {
    const [raw, setter, step] =
      which === 'primary' ? [primary, setPrimary, primaryStep] : [weight, setWeight, weightStep]
    const n = Number((raw || '0').replace(',', '.'))
    const next = Math.max(0, Math.round((Number.isFinite(n) ? n : 0) * 100 + dir * step * 100) / 100)
    setter(String(next))
  }

  function commit() {
    const n = Number(primary.replace(',', '.'))
    if (!Number.isFinite(n) || n <= 0) return
    const actual: SetActual = isDuration
      ? { durationSec: Math.round(durationUnit === 'min' ? n * 60 : n) }
      : { reps: Math.round(n) }
    if (isRepsWeight && weight.trim() !== '') {
      const w = Number(weight.replace(',', '.'))
      if (Number.isFinite(w) && w >= 0) actual.weightKg = displayToKg(w, weightUnit)
    }
    onAddSet(actual)
    if (!lastSet) setPrimary('')
  }

  const inputChrome = cn(
    'w-full min-w-0 border-0 bg-transparent px-1 py-0 text-center text-2xl font-bold tabular-nums text-[var(--sr-text-primary)] placeholder:font-normal placeholder:text-[var(--sr-text-muted)]',
    FOCUS_RING,
  )

  return (
    <section
      className={cn(
        'rounded-[var(--sr-radius-lg)] border bg-[var(--sr-bg-surface)] p-4 transition-colors',
        isActive ? 'border-[var(--sr-brand-primary)]' : 'border-[var(--sr-border-subtle)]',
      )}
      aria-label={def?.name ?? pl.exerciseFallbackName}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="sr-text-h3 truncate text-[var(--sr-text-primary)]">
            {def?.name ?? pl.exerciseFallbackName}
          </h3>
          {def?.muscleGroup && (
            <p className="sr-text-caption text-[var(--sr-text-muted)]">
              {muscleGroupLabel(def.muscleGroup)}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={pl.freeExerciseOptionsAria}
          className={cn(
            'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--sr-text-muted)]',
            FOCUS_RING,
          )}
        >
          <MoreVertical size={18} aria-hidden />
        </button>
      </div>

      {log.sets.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={pl.freeSetsListAria}>
          {log.sets.map((set, i) => (
            <li key={set.setNumber}>
              <button
                type="button"
                onClick={() => onEditSet(i)}
                aria-label={pl.freeSetChipAria(set.setNumber, formatExerciseSetSummary(metric, set, weightUnit, durationUnit))}
                className={cn(
                  'inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-full border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-3 py-1 text-sm tabular-nums text-[var(--sr-text-primary)]',
                  FOCUS_RING,
                )}
              >
                <span className="text-[var(--sr-text-muted)]">{set.setNumber}</span>
                <span className="font-medium">
                  {formatExerciseSetSummary(metric, set, weightUnit, durationUnit)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Next-set logger — the most-tapped control in the workout, so it gets
          the biggest target: steppers for thumb adjustments, typing optional. */}
      <p className="mt-4 sr-text-overline text-[var(--sr-text-muted)]">
        {pl.freeNextSetLabel(log.sets.length + 1)}
      </p>
      <div className="mt-1.5 flex items-center gap-2">
        <WorkoutStepperButton
          ariaLabel={pl.freeLessValue}
          elevated
          onClick={() => bump('primary', -1)}
        >
          <Minus size={20} aria-hidden />
        </WorkoutStepperButton>
        <label className="flex-1">
          <span className="sr-only">
            {isDuration ? pl.freeDurationLabel(durationUnit) : pl.freeRepsLabel}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit()
            }}
            placeholder={isDuration ? (durationUnit === 'min' ? '1' : '60') : '10'}
            aria-label={isDuration ? pl.freeDurationLabel(durationUnit) : pl.freeRepsLabel}
            className={inputChrome}
          />
        </label>
        <WorkoutStepperButton
          ariaLabel={pl.freeMoreValue}
          elevated
          onClick={() => bump('primary', 1)}
        >
          <Plus size={20} aria-hidden />
        </WorkoutStepperButton>
      </div>
      <p className="mt-0.5 text-center sr-text-caption text-[var(--sr-text-muted)]">
        {isDuration ? pl.freeDurationLabel(durationUnit) : pl.freeRepsLabel}
      </p>

      {isRepsWeight && (
        <>
          <div className="mt-2 flex items-center gap-2">
            <WorkoutStepperButton
              ariaLabel={pl.freeLessWeight}
              elevated
              onClick={() => bump('weight', -1)}
            >
              <Minus size={20} aria-hidden />
            </WorkoutStepperButton>
            <label className="flex-1">
              <span className="sr-only">{pl.freeWeightLabel(weightUnit)}</span>
              <input
                type="text"
                inputMode="decimal"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit()
                }}
                placeholder="60"
                aria-label={pl.freeWeightLabel(weightUnit)}
                className={inputChrome}
              />
            </label>
            <WorkoutStepperButton
              ariaLabel={pl.freeMoreWeight}
              elevated
              onClick={() => bump('weight', 1)}
            >
              <Plus size={20} aria-hidden />
            </WorkoutStepperButton>
          </div>
          <p className="mt-0.5 text-center sr-text-caption text-[var(--sr-text-muted)]">
            {pl.freeWeightLabel(weightUnit)}
          </p>
        </>
      )}

      <Button
        type="button"
        variant="primary"
        size="touch"
        fullWidth
        className="mt-3"
        onClick={commit}
        disabled={primary.trim() === ''}
      >
        <Plus size={18} aria-hidden />
        {pl.customWorkoutAddSet}
      </Button>

      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title={def?.name ?? pl.exerciseFallbackName}
      >
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={index === 0}
            onClick={() => {
              setMenuOpen(false)
              onMove(-1)
            }}
          >
            <ArrowUp size={16} aria-hidden />
            {pl.freeMoveExerciseUp}
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            disabled={index === total - 1}
            onClick={() => {
              setMenuOpen(false)
              onMove(1)
            }}
          >
            <ArrowDown size={16} aria-hidden />
            {pl.freeMoveExerciseDown}
          </Button>
          <Button
            type="button"
            variant="danger"
            fullWidth
            onClick={() => {
              setMenuOpen(false)
              onRemove()
            }}
          >
            <Trash2 size={16} aria-hidden />
            {pl.freeRemoveExercise}
          </Button>
        </div>
      </Sheet>
    </section>
  )
}
