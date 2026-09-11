import { ArrowLeft, BarChart2, ListOrdered, Minus, MoreVertical, Plus, Repeat, TrendingUp } from 'lucide-react'
import { useEffect, useState, type RefObject, ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { ErrorBanner } from '@/components/ux/Feedback'
import {
  ConfirmSheet,
  RestTimerExpanded,
  RestTimerPill,
  WorkoutFailRetryRow,
} from '@/components/workout/WorkoutComponents'
import { CustomPreviousResultHint } from '@/components/workout/CustomPreviousResultHint'
import { RpeRirPicker } from '@/components/workout/RpeRirPicker'
import { SetNoteInput } from '@/components/workout/SetNoteInput'
import { WarmupPanel } from '@/components/workout/WarmupPanel'
import { RestSecChips } from '@/components/plans/RestSecChips'
import { SessionElapsedLabel } from '@/components/workout/SessionElapsedLabel'
import { ExerciseDemo } from '@/components/exercise-demos/ExerciseDemo'
import { pl } from '@/i18n/pl'
import type {
  ExerciseDefinition,
  ExerciseGroupKind,
  ExerciseLog,
  PlanDay,
  PlannedExercise,
  PrimaryMetric,
  SetLog,
  SetPrescription,
} from '@/lib/exercise-model'
import { isVolumeProgress } from '@/lib/exercise-model'
import {
  canJumpToExercise,
  countPassedSets,
  getChecklistSlots,
  getExerciseTargetSetCount,
  isExerciseDoneForDisplay,
} from '@/lib/custom-workout-progress'
import { getGroupForExercise } from '@/lib/custom-workout-nav'
import {
  formatPrescriptionSetLabel,
  formatPrescriptionTarget,
  formatSetActualDisplay,
  getPrimaryMetricTarget,
  isExactPrescription,
  isMaxPrescription,
  secToDisplay,
  type DurationUnit,
} from '@/lib/custom-prescription-format'
import type { PreviousCustomSetResult } from '@/lib/custom-session-service'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'
import type { RestTimerState } from '@/lib/rest-timer'
import { Z_REST_PILL, FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'
import { kgToDisplay, displayToKg, weightUnitLabel } from '@/lib/weight-units'
import { NumericDraftInput } from '@/components/ui/NumericDraftInput'

const WORKOUT_STEPPER_BTN =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-primary)] transition-colors hover:bg-[var(--sr-bg-elevated)] active:scale-95 disabled:opacity-40 disabled:active:scale-100'

function WorkoutStepperButton({
  ariaLabel,
  disabled,
  onClick,
  children,
  elevated = false,
}: {
  ariaLabel: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  elevated?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(
        WORKOUT_STEPPER_BTN,
        elevated ? 'bg-[var(--sr-bg-elevated)]' : 'bg-[var(--sr-bg-surface)]',
        FOCUS_RING,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

/**
 * Collapsible "Log details" row that wraps RPE/RIR picker + set note input.
 * Collapsed: compact summary chips (e.g. "RPE 8 · +notatka") or a label.
 * Expanded: renders the RpeRirPicker and SetNoteInput as-is.
 */
function SetLogDetails({
  rpeRirValue,
  rpeRirMode,
  setNote,
  onRpeRirChange,
  onRpeRirModeChange,
  onSetNoteChange,
}: {
  rpeRirValue: number | null
  rpeRirMode: 'rpe' | 'rir'
  setNote?: string
  onRpeRirChange: (v: number | null) => void
  onRpeRirModeChange: (m: 'rpe' | 'rir') => void
  onSetNoteChange: (v: string | undefined) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasRpeRir = rpeRirValue != null
  const hasNote = Boolean(setNote?.trim())
  const hasAny = hasRpeRir || hasNote

  return (
    <div className="mt-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-center gap-2 px-3 py-2 text-left',
          FOCUS_RING,
        )}
        aria-expanded={expanded}
        aria-label={pl.setLogDetailsTitle}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {hasAny ? (
            <>
              {hasRpeRir && (
                <span className="inline-flex items-center rounded-full bg-[var(--sr-brand-primary-muted)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--sr-brand-primary)]">
                  {rpeRirMode === 'rpe'
                    ? pl.setLogDetailsRpeChip(rpeRirValue!)
                    : pl.setLogDetailsRirChip(rpeRirValue!)}
                </span>
              )}
              {hasNote && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-[var(--sr-text-muted)]">
                  <span aria-hidden>+</span>
                  {pl.setLogDetailsNoteChip}
                </span>
              )}
            </>
          ) : (
            <span className="flex items-center gap-1.5 sr-text-body-sm font-medium text-[var(--sr-text-secondary)]">
              <Plus size={13} className="text-[var(--sr-text-muted)]" aria-hidden />
              {pl.setLogDetailsTitle}
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            'shrink-0 text-[var(--sr-text-muted)] transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && (
        <div className="border-t border-[var(--sr-border-subtle)] px-2.5 py-2">
          <RpeRirPicker
            value={rpeRirValue}
            mode={rpeRirMode}
            onChange={onRpeRirChange}
            onModeChange={onRpeRirModeChange}
            startExpanded
          />
          <SetNoteInput value={setNote} onChange={onSetNoteChange} />
        </div>
      )}
    </div>
  )
}

/**
 * Collapsible panel for set count + rest adjustment (session-only).
 * Collapsed: compact summary ("Rest: 90s · 5 serii").
 * Expanded: rest chips + set count stepper.
 */
function SetRestAdjustPanel({
  isResting,
  showRestAdjust,
  showSetAdjust,
  restBetweenSetsSec,
  setsCount,
  canAddSet,
  canRemoveSet,
  onAddSet,
  onRemoveSet,
  onRestChange,
}: {
  isResting: boolean
  showRestAdjust: boolean
  showSetAdjust: boolean
  restBetweenSetsSec: number
  setsCount: number
  canAddSet: boolean
  canRemoveSet: boolean
  onAddSet?: () => void
  onRemoveSet?: () => void
  onRestChange?: (sec: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const summary = pl.setRestAdjustSummary(restBetweenSetsSec, setsCount)

  return (
    <div className="mb-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex w-full items-start gap-2 px-3 py-2 text-left',
          FOCUS_RING,
        )}
        aria-expanded={expanded}
        aria-label={summary}
      >
        <span className="min-w-0 flex-1 break-words sr-text-body-sm font-medium text-[var(--sr-text-secondary)]">
          {summary}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={cn(
            'shrink-0 text-[var(--sr-text-muted)] transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>
      {expanded && (
        <div className="border-t border-[var(--sr-border-subtle)] px-3 py-2.5">
          {showRestAdjust && onRestChange ? (
            <>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <p className="min-w-0 text-xs font-medium text-[var(--sr-text-secondary)]">
                  {pl.customWorkoutRestAdjustLabel}
                </p>
                {!isResting && showSetAdjust && (
                  <p className="shrink-0 text-xs font-medium text-[var(--sr-text-secondary)]">
                    {pl.customWorkoutSetsSection}
                  </p>
                )}
              </div>
              <RestSecChips
                id="workout-rest-between-sets"
                label={pl.customWorkoutRestAdjustLabel}
                value={restBetweenSetsSec}
                onChange={onRestChange}
                hideLabel
                size="compact"
                nowrap
                trailing={
                  !isResting && showSetAdjust ? (
                    <CustomSetCountStepper
                      count={setsCount}
                      canAdd={canAddSet}
                      canRemove={canRemoveSet}
                      onAdd={onAddSet}
                      onRemove={onRemoveSet}
                    />
                  ) : undefined
                }
              />
            </>
          ) : (
            !isResting &&
            showSetAdjust && (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-[var(--sr-text-secondary)]">
                    {pl.customWorkoutSetsSection}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--sr-text-muted)]">
                    {pl.customWorkoutRestChip(restBetweenSetsSec)}
                  </p>
                </div>
                <CustomSetCountStepper
                  count={setsCount}
                  canAdd={canAddSet}
                  canRemove={canRemoveSet}
                  onAdd={onAddSet}
                  onRemove={onRemoveSet}
                />
              </div>
            )
          )}
          <p className="mt-2 sr-text-caption text-[var(--sr-text-muted)]">
            {pl.customWorkoutSetsAdjustHint}
          </p>
        </div>
      )}
    </div>
  )
}

function WorkoutControlSurface({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'w-full max-w-sm rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

function WorkoutMetricColumn({
  label,
  value,
  unit,
  valueClassName,
  mode = 'integer',
  onDecrease,
  onIncrease,
  onCommit,
  decreaseLabel,
  increaseLabel,
  decreaseDisabled,
  increaseDisabled,
  disabled,
}: {
  label: string
  value: number
  unit?: string
  valueClassName?: string
  mode?: 'integer' | 'decimal'
  onDecrease: () => void
  onIncrease: () => void
  onCommit: (value: number) => void
  decreaseLabel: string
  increaseLabel: string
  decreaseDisabled?: boolean
  increaseDisabled?: boolean
  disabled?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
        {label}
      </p>
      <div className="flex w-full items-baseline justify-center gap-1">
        <NumericDraftInput
          ariaLabel={label}
          value={value}
          mode={mode}
          min={0}
          disabled={disabled}
          onCommit={onCommit}
          className={cn(
            'max-w-[7.5rem] border-0 bg-transparent px-1 py-0 text-center sr-text-h2 font-semibold leading-none shadow-none',
            valueClassName,
          )}
        />
        {unit && (
          <span className="sr-text-body-sm font-medium text-[var(--sr-text-muted)]">{unit}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <WorkoutStepperButton
          ariaLabel={decreaseLabel}
          disabled={decreaseDisabled}
          elevated
          onClick={onDecrease}
        >
          <Minus size={20} />
        </WorkoutStepperButton>
        <WorkoutStepperButton
          ariaLabel={increaseLabel}
          disabled={increaseDisabled}
          elevated
          onClick={onIncrease}
        >
          <Plus size={20} />
        </WorkoutStepperButton>
      </div>
    </div>
  )
}

function SetStatusIcon({ state }: { state: 'pending' | 'active' | 'done' | 'partial' | 'failed' }) {
  if (state === 'done') return <Check size={16} className="animate-check-in text-[var(--sr-success)]" />
  if (state === 'partial') return <TrendingUp size={14} className="text-[var(--sr-warning)]" />
  if (state === 'failed') return <X size={16} className="text-[var(--sr-error)]" />
  if (state === 'active') return <ChevronRight size={16} className="text-[var(--sr-brand-primary)]" />
  return <span className="inline-block h-4 w-4" />
}

function CustomSetRow({
  setNumber,
  prescription,
  metric,
  state,
  result,
  previousResult,
  editable,
  isExtra,
  onClick,
  weightUnit = 'kg',
  durationUnit = 'sec',
}: {
  setNumber: number
  prescription: SetPrescription
  metric: PrimaryMetric
  state: 'pending' | 'active' | 'done' | 'partial' | 'failed'
  result?: SetLog
  /** Previous session's result for this set — for delta indicator. */
  previousResult?: { reps?: number; durationSec?: number; weightKg?: number }
  editable?: boolean
  isExtra?: boolean
  onClick?: () => void
  weightUnit?: 'kg' | 'lb'
  durationUnit?: DurationUnit
}) {
  const canPress = Boolean(onClick) && (state !== 'done' || editable)
  const targetLabel = formatPrescriptionTarget(prescription, metric, weightUnit, durationUnit)
  const actualLabel =
    result != null ? formatSetActualDisplay(result.actual, metric, weightUnit, durationUnit) : null

  // Delta vs previous session — only for completed sets with same metric
  const showDelta =
    (state === 'done' || state === 'partial') &&
    result != null &&
    previousResult != null
  const rawDelta = showDelta ? computeCustomDelta(result.actual, previousResult, metric) : 0
  // Dla min-based exercises konwertuj deltę sekund na minuty
  const delta =
    rawDelta != null && metric === 'duration_sec' && durationUnit === 'min'
      ? secToDisplay(rawDelta, 'min')
      : rawDelta

  const completedLabel =
    state === 'done' && actualLabel != null
      ? editable
        ? `${actualLabel} / ${targetLabel} · ${pl.editShort}`
        : `${actualLabel} / ${targetLabel}`
      : state === 'partial' && actualLabel != null
        ? `${actualLabel} / ${targetLabel}`
        : state === 'failed' && actualLabel != null
          ? `${actualLabel} / ${targetLabel}`
          : targetLabel

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canPress}
      data-active-set={state === 'active' ? 'true' : undefined}
      aria-label={
        editable
          ? `${pl.setColumn} ${setNumber} — ${pl.editPreviousSet}`
          : isExtra
            ? `${pl.setColumn} ${setNumber} (${pl.customWorkoutSetExtraBadge})`
            : undefined
      }
      className={cn(
        'flex w-full items-center justify-between rounded-[var(--sr-radius-md)] border px-3 py-2.5 text-left transition-all active:scale-[0.99]',
        state === 'active' &&
          'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)] ring-2 ring-inset ring-[var(--sr-brand-primary)]/30',
        state === 'done' && 'border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)]',
        state === 'partial' && 'border-[var(--sr-warning)]/40 bg-[var(--sr-warning-muted)]',
        state === 'failed' && 'border-[var(--sr-error)]/30 bg-[var(--sr-error-muted)]',
        state === 'pending' && 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] hover:border-[var(--sr-border-strong)]',
        editable && 'ring-1 ring-[var(--sr-brand-primary)]/40',
      )}
    >
      <span
        className={cn(
          'flex min-w-0 items-center gap-2 font-medium',
          state === 'done' && 'text-[var(--sr-success)]',
          state === 'partial' && 'text-[var(--sr-warning)]',
          state === 'failed' && 'text-[var(--sr-error)]',
          state === 'pending' && 'text-[var(--sr-text-secondary)]',
          state === 'active' && 'text-[var(--sr-text-primary)]',
        )}
      >
        <SetStatusIcon state={state} />
        <span className="truncate">
          {pl.setColumn} {setNumber}
          {isExtra ? (
            <span className="ml-1.5 sr-text-caption font-normal text-[var(--sr-text-muted)]">
              {pl.customWorkoutSetExtraBadge}
            </span>
          ) : null}
        </span>
      </span>
      <span className="flex items-center gap-2">
        <span
          className={cn(
            'shrink-0 tabular-nums text-base font-semibold',
            state === 'done' && 'text-[var(--sr-text-primary)]',
            state === 'partial' && 'text-[var(--sr-warning)]',
            state === 'failed' && 'text-[var(--sr-error)]',
            state === 'pending' && 'text-[var(--sr-text-primary)]',
            state === 'active' && 'text-[var(--sr-text-primary)]',
          )}
        >
          {completedLabel}
        </span>
        {showDelta && delta !== null && (
          <span
            className={cn(
              'shrink-0 rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums',
              delta > 0 && 'bg-[var(--sr-success-muted)] text-[var(--sr-success)]',
              delta < 0 && 'bg-[var(--sr-error-muted)] text-[var(--sr-error)]',
              delta === 0 && 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
            )}
          >
            {delta > 0
              ? pl.setDeltaUp(delta)
              : delta < 0
                ? pl.setDeltaDown(Math.abs(delta))
                : pl.setDeltaEqual}
          </span>
        )}
      </span>
    </button>
  )
}

/** Compute delta between current and previous set result based on metric type. */
export function computeCustomDelta(
  current: { reps?: number; durationSec?: number; weightKg?: number | null },
  previous: { reps?: number; durationSec?: number; weightKg?: number | null },
  metric: PrimaryMetric,
): number | null {
  if (metric === 'duration_sec') {
    if (current.durationSec == null || previous.durationSec == null) return null
    return current.durationSec - previous.durationSec
  }
  // reps_weight and reps both use reps for delta
  if (current.reps == null || previous.reps == null) return null
  return current.reps - previous.reps
}

function CustomSetChecklist({
  sets,
  metric,
  currentIndex,
  results,
  failedIndex,
  baselineSetCount,
  onEditLastSet,
  weightUnit = 'kg',
  durationUnit = 'sec',
  previousResults,
}: {
  sets: SetPrescription[]
  metric: PrimaryMetric
  currentIndex: number
  results: SetLog[]
  failedIndex?: number
  /** Sets at/after this 0-based index are session extras (index >= baseline). */
  baselineSetCount?: number
  onEditLastSet?: () => void
  weightUnit?: 'kg' | 'lb'
  durationUnit?: DurationUnit
  /** Map of setNumber → previous result, for delta indicators. */
  previousResults?: Map<number, { reps?: number; durationSec?: number; weightKg?: number }>
}) {
  const baseline = baselineSetCount ?? sets.length
  const lastLoggedSetNumber =
    results.length > 0 ? results[results.length - 1]!.setNumber : null
  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      {sets.map((prescription, i) => {
        const setNumber = i + 1
        const result = results.find((r) => r.setNumber === setNumber)
        let state: 'pending' | 'active' | 'done' | 'partial' | 'failed' = 'pending'
        if (result?.passed) state = 'done'
        else if (result && !result.passed) {
          // Check if this is volume progress (below reps target but weight up enough
          // that volume >= target volume) — mark amber instead of red.
          state = isVolumeProgress(prescription, result.actual, metric) ? 'partial' : 'failed'
        }
        else if (failedIndex === i) state = 'failed'
        else if (i === currentIndex) state = 'active'
        const editable =
          Boolean(onEditLastSet) &&
          result != null &&
          setNumber === lastLoggedSetNumber &&
          (state === 'done' || state === 'partial' || state === 'failed')
        return (
          <CustomSetRow
            key={setNumber}
            setNumber={setNumber}
            prescription={prescription}
            metric={metric}
            state={state}
            result={result}
            previousResult={previousResults?.get(setNumber)}
            editable={editable}
            isExtra={i >= baseline}
            onClick={editable ? onEditLastSet : undefined}
            weightUnit={weightUnit}
            durationUnit={durationUnit}
          />
        )
      })}
    </div>
  )
}

/** Compact − N + stepper — same height/chrome as rest chips. */
function CustomSetCountStepper({
  count,
  canAdd,
  canRemove,
  onAdd,
  onRemove,
}: {
  count: number
  canAdd: boolean
  canRemove: boolean
  onAdd?: () => void
  onRemove?: () => void
}) {
  return (
    <div
      className="flex h-9 shrink-0 items-stretch overflow-hidden rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)]"
      role="group"
      aria-label={pl.customWorkoutSetsSection}
    >
      <button
        type="button"
        className={cn(
          'flex w-9 items-center justify-center text-[var(--sr-text-secondary)] transition-colors hover:text-[var(--sr-text-primary)] active:scale-90',
          'disabled:opacity-40 disabled:active:scale-100',
          FOCUS_RING,
        )}
        disabled={!canRemove || !onRemove}
        onClick={onRemove}
        aria-label={pl.customWorkoutRemoveSet}
      >
        <Minus size={15} strokeWidth={2.25} aria-hidden />
      </button>
      <span className="flex min-w-[1.75rem] items-center justify-center border-x border-[var(--sr-border-subtle)] px-1 text-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
        {pl.customWorkoutSetsCount(count)}
      </span>
      <button
        type="button"
        className={cn(
          'flex w-9 items-center justify-center text-[var(--sr-text-secondary)] transition-colors hover:text-[var(--sr-text-primary)] active:scale-90',
          'disabled:opacity-40 disabled:active:scale-100',
          FOCUS_RING,
        )}
        disabled={!canAdd || !onAdd}
        onClick={onAdd}
        aria-label={pl.customWorkoutAddSet}
      >
        <Plus size={15} strokeWidth={2.25} aria-hidden />
      </button>
    </div>
  )
}

function CustomDayExerciseRail({
  planDay,
  exercises,
  exerciseDefs,
  exerciseLogs,
  currentExerciseIndex,
  onExerciseStats,
  onJumpToExercise,
  amrapGroupId,
}: {
  planDay: PlanDay
  exercises: PlannedExercise[]
  exerciseDefs: Map<string, ExerciseDefinition>
  exerciseLogs: ExerciseLog[]
  currentExerciseIndex: number
  onExerciseStats?: (exerciseId: string) => void
  onJumpToExercise?: (exerciseIndex: number) => void
  amrapGroupId?: string | null
}) {
  if (exercises.length <= 1) return null

  return (
    <div className="mx-4 mt-3 mb-3">
      <div
        className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={pl.customWorkoutExerciseOf(currentExerciseIndex + 1, exercises.length)}
      >
        {exercises.map((pe, i) => {
          const def = exerciseDefs.get(pe.exerciseId)
          const name = def?.name ?? pl.planEllipsis
          const log = exerciseLogs[i]
          const passedSets = countPassedSets(log)
          const totalSets = getExerciseTargetSetCount(planDay, i)
          const done = isExerciseDoneForDisplay(planDay, i, exerciseLogs, currentExerciseIndex)
          const active = i === currentExerciseIndex
          const canJump = Boolean(
            onJumpToExercise &&
              canJumpToExercise(planDay, exerciseLogs, currentExerciseIndex, i, {
                amrapGroupId,
              }),
          )
          const canOpenStats = done && !canJump && onExerciseStats && def
          const interactive = canJump || Boolean(canOpenStats)
          const Tag = interactive ? 'button' : 'div'
          const setsLabel = done
            ? pl.planSetsShort(totalSets)
            : pl.customWorkoutExerciseDone(passedSets, totalSets)

          return (
            <Tag
              key={`${pe.exerciseId}-${i}`}
              type={interactive ? 'button' : undefined}
              aria-label={
                canJump
                  ? pl.customWorkoutSwitchTo(name)
                  : canOpenStats
                    ? pl.exerciseDetailOpenFor(name)
                    : undefined
              }
              aria-current={active ? 'step' : undefined}
              onClick={
                canJump
                  ? () => onJumpToExercise?.(i)
                  : canOpenStats
                    ? () => onExerciseStats?.(pe.exerciseId)
                    : undefined
              }
              className={cn(
                'flex min-w-[5.75rem] max-w-[12rem] shrink-0 flex-col gap-1 rounded-[var(--sr-radius-md)] px-2.5 py-2 text-left transition-colors',
                done && 'bg-[var(--sr-success-muted)]',
                active &&
                  'border-2 border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]',
                !done && !active && 'border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
                interactive &&
                  'cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sr-brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sr-bg-base)]',
              )}
            >
              <div className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-x-1.5 gap-y-0.5">
                {done ? (
                  <Check size={14} className="text-[var(--sr-success)]" aria-hidden />
                ) : active ? (
                  <ChevronRight size={14} className="text-[var(--sr-brand-primary)]" aria-hidden />
                ) : (
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--sr-bg-elevated)] text-[10px] font-semibold tabular-nums text-[var(--sr-text-muted)]"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                )}
                <span
                  className={cn(
                    'line-clamp-2 text-sm font-medium leading-tight',
                    done && 'text-[var(--sr-success)]',
                    active && 'text-[var(--sr-text-primary)]',
                    !done && !active && 'text-[var(--sr-text-secondary)]',
                  )}
                >
                  {name}
                </span>
                <span aria-hidden />
                <p
                  className={cn(
                    'truncate text-xs tabular-nums',
                    done
                      ? 'font-semibold text-[var(--sr-success)]'
                      : active
                        ? 'font-semibold text-[var(--sr-brand-primary)]'
                        : 'text-[var(--sr-text-muted)]',
                  )}
                >
                  {done
                    ? pl.customWorkoutExerciseCompleted
                    : active
                      ? pl.customWorkoutExerciseNow
                      : setsLabel}
                </p>
              </div>
            </Tag>
          )
        })}
      </div>
    </div>
  )
}

function CustomDayPlanSheet({
  planDay,
  exercises,
  exerciseDefs,
  exerciseLogs,
  currentExerciseIndex,
  onClose,
  onJumpToExercise,
  amrapGroupId,
}: {
  planDay: PlanDay
  exercises: PlannedExercise[]
  exerciseDefs: Map<string, ExerciseDefinition>
  exerciseLogs: ExerciseLog[]
  currentExerciseIndex: number
  onClose: () => void
  onJumpToExercise?: (exerciseIndex: number) => void
  amrapGroupId?: string | null
}) {
  return (
    <Sheet open onClose={onClose} title={pl.previewDayPlan}>
      {exercises.length > 1 && (
        <p className="mb-3 text-sm text-[var(--sr-text-secondary)]">{pl.previewDayPlanHint}</p>
      )}
      <ul className="flex flex-col gap-3">
        {exercises.map((pe, i) => {
          const def = exerciseDefs.get(pe.exerciseId)
          const name = def?.name ?? pl.planEllipsis
          const metric = def?.primaryMetric ?? 'reps'
          const active = i === currentExerciseIndex
          const log = exerciseLogs[i]
          const doneSets = countPassedSets(log)
          const totalSets = getExerciseTargetSetCount(planDay, i)
          const done = isExerciseDoneForDisplay(planDay, i, exerciseLogs, currentExerciseIndex)
          const canJump = Boolean(
            onJumpToExercise &&
              canJumpToExercise(planDay, exerciseLogs, currentExerciseIndex, i, {
                amrapGroupId,
              }),
          )
          const slots = getChecklistSlots(planDay, i, log?.sets.length ?? 0)
          const RowTag = canJump ? 'button' : 'div'
          return (
            <li key={`${pe.exerciseId}-${i}`}>
              <RowTag
                type={canJump ? 'button' : undefined}
                aria-label={canJump ? pl.customWorkoutSwitchTo(name) : undefined}
                onClick={
                  canJump
                    ? () => {
                        onJumpToExercise?.(i)
                        onClose()
                      }
                    : undefined
                }
                className={cn(
                  'w-full rounded-[var(--sr-radius-md)] border px-3 py-3 text-left transition-colors',
                  active
                    ? 'border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]'
                    : done
                      ? 'border-[var(--sr-success)]/30 bg-[var(--sr-success-muted)]'
                      : 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
                  canJump &&
                    'cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sr-brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sr-bg-base)]',
                )}
              >
              <div className="flex items-baseline justify-between gap-2">
                <p className="min-w-0 flex-1 break-words font-medium text-[var(--sr-text-primary)]">
                  {i + 1}. {name}
                </p>
                <p className="shrink-0 text-xs text-[var(--sr-text-muted)]">
                  {done
                    ? pl.planSetsShort(totalSets)
                    : active
                      ? pl.customWorkoutExerciseDone(doneSets, totalSets)
                      : pl.planSetsShort(totalSets)}
                </p>
              </div>
              <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                {pl.customWorkoutRestChip(pe.restBetweenSetsSec)}
                {pe.restAfterExerciseSec != null && pe.restAfterExerciseSec > 0
                  ? ` · ${pl.customWorkoutRestAfterExercise(pe.restAfterExerciseSec)}`
                  : ''}
              </p>
              {pe.note?.trim() && (
                <p className="mt-2 text-xs text-[var(--sr-text-secondary)]">{pe.note.trim()}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {slots.map((s, si) => {
                  const setLog = log?.sets.find((r) => r.setNumber === si + 1)
                  const doneSet = setLog?.passed === true
                  return (
                    <span
                      key={si}
                      className={cn(
                        'rounded-[var(--sr-radius-full)] px-2.5 py-1 text-xs font-semibold tabular-nums',
                        doneSet
                          ? 'bg-[var(--sr-success-muted)] text-[var(--sr-success)]'
                          : active && si === doneSets
                            ? 'bg-[var(--sr-brand-primary-muted)] text-[var(--sr-text-primary)] ring-1 ring-[var(--sr-brand-primary)]'
                            : 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-primary)]',
                      )}
                    >
                      {doneSet && setLog
                        ? formatSetActualDisplay(setLog.actual, metric, 'kg', def?.durationDisplayUnit ?? 'min')
                        : formatPrescriptionTarget(s, metric, 'kg', def?.durationDisplayUnit ?? 'min')}
                    </span>
                  )
                })}
              </div>
              </RowTag>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

function isMinPrescription(
  prescription: import('@/lib/exercise-model').SetPrescription,
  metric: import('@/lib/exercise-model').PrimaryMetric,
): boolean {
  const target = getPrimaryMetricTarget(prescription, metric)
  return target?.kind === 'min'
}

function CustomMetricCounter({
  prescription,
  metric,
  exerciseName,
  actual,
  onActualChange,
  onDone,
  dayNumber,
  cycleAttempt,
  pulseFlash,
  disabled,
  disabledHint,
  onDisabledTap,
  weightKg,
  onWeightChange,
  timerRunning,
  onToggleTimer,
  previousResult,
  weightUnit,
  durationUnit = 'sec',
}: {
  prescription: SetPrescription
  metric: PrimaryMetric
  exerciseName: string
  actual: number
  onActualChange: (n: number) => void
  onDone: () => void
  dayNumber: number
  cycleAttempt: number
  previousResult?: PreviousCustomSetResult
  pulseFlash?: boolean
  disabled?: boolean
  disabledHint?: string
  onDisabledTap?: () => void
  weightKg: number | ''
  onWeightChange: (v: number | '') => void
  timerRunning: boolean
  onToggleTimer: () => void
  weightUnit: 'kg' | 'lb'
  durationUnit?: 'sec' | 'min'
}) {
  const isDuration = metric === 'duration_sec'
  const isMinUnit = isDuration && durationUnit === 'min'
  const primaryTarget = getPrimaryMetricTarget(prescription, metric)
  const isExact = isExactPrescription(prescription, metric)
  const isMax = isMaxPrescription(prescription, metric)
  const isMin = isMinPrescription(prescription, metric)
  const targetReps = primaryTarget ? metricTargetDisplayValue(primaryTarget) : 0
  const targetWeightKg =
    metric === 'reps_weight' && prescription.weightKg
      ? metricTargetDisplayValue(prescription.weightKg)
      : null
  const targetWeight = targetWeightKg != null ? kgToDisplay(targetWeightKg, weightUnit) : null
  const maxValue = isExact ? targetReps : 9999
  // For min-based exercises, step by 60 seconds (1 minute)
  const step = isMinUnit ? 60 : 1
  // Display value: convert seconds to minutes for min-based exercises
  const displayActual = isMinUnit ? Math.round(actual / 60) : actual
  const displayMaxValue = isMinUnit ? Math.round(maxValue / 60) : maxValue
  const weightValueKg = weightKg === '' ? 0 : Number(weightKg)
  const weightValue = kgToDisplay(weightValueKg, weightUnit)
  const weightStep = weightUnit === 'lb' ? 5 : 2.5
  const showWeightTargetHint =
    targetWeight != null && weightValue > 0 && Math.abs(weightValue - targetWeight) > 0.05
  const isRepsWeight = metric === 'reps_weight'
  const unitLabel = weightUnitLabel(weightUnit)

  return (
    <div className={cn('flex flex-col items-center gap-2.5 py-3', disabled && 'opacity-60')}>
      {/* Single compact target row: prescription label + optional badges */}
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <p className="px-2 text-center sr-text-overline text-[var(--sr-text-muted)]">
          {formatPrescriptionSetLabel(prescription, metric, exerciseName, weightUnit, durationUnit)}
        </p>
        {isExact && (
          <span className="inline-flex items-center rounded-full border border-[var(--sr-warning)]/40 bg-[var(--sr-warning-muted)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--sr-warning)]">
            {pl.exactBadge}
          </span>
        )}
        {isMax && (
          <span className="inline-flex items-center rounded-full border border-[var(--sr-brand-primary)]/30 bg-[var(--sr-brand-primary-muted)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--sr-brand-primary)]">
            {pl.customMaxBadge}
          </span>
        )}
        {isMin && (
          <span className="inline-flex items-center rounded-full border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--sr-text-muted)]">
            {pl.customMinBadge}
          </span>
        )}
        {isRepsWeight && targetWeight != null && (
          <span className="inline-flex items-center rounded-full border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--sr-text-muted)]">
            {targetWeight} {unitLabel}
          </span>
        )}
      </div>
      {previousResult && (
        <CustomPreviousResultHint
          result={previousResult}
          metric={metric}
          currentDayNumber={dayNumber}
          currentCycleAttempt={cycleAttempt}
          durationUnit={durationUnit}
        />
      )}

      {!isRepsWeight && (
        <div className="flex items-baseline gap-2">
          <NumericDraftInput
            ariaLabel={isDuration ? (isMinUnit ? pl.customWorkoutDurationMin : pl.customWorkoutDurationSec) : pl.exerciseMetricReps}
            value={isMinUnit ? displayActual : actual}
            mode="integer"
            min={0}
            max={isMinUnit ? displayMaxValue : maxValue}
            disabled={disabled}
            onCommit={(n) => {
              // Convert display value back to seconds for min-based exercises
              const secValue = isMinUnit ? Math.min(maxValue, Math.max(0, n * 60)) : Math.min(maxValue, Math.max(0, n))
              onActualChange(secValue)
            }}
            className={cn(
              'w-auto min-w-[4.5rem] max-w-[9rem] border-0 bg-transparent px-1 py-0 text-center sr-text-display leading-none shadow-none',
              pulseFlash && 'animate-pulse-success',
              isExact && actual !== targetReps && actual > 0 && 'text-[var(--sr-warning)]',
              isDuration && timerRunning && 'text-[var(--sr-brand-primary)]',
            )}
          />
          {isDuration && (
            <span className="sr-text-body-sm font-medium text-[var(--sr-text-muted)]">
              {isMinUnit ? pl.customDurationUnitMin : pl.customDurationUnit}
            </span>
          )}
        </div>
      )}

      {disabled && disabledHint && (
        <p className="text-center text-sm text-[var(--sr-text-secondary)]">{disabledHint}</p>
      )}

      {isRepsWeight && (
        <WorkoutControlSurface>
          <div className="grid grid-cols-2 divide-x divide-[var(--sr-border-subtle)]">
            <WorkoutMetricColumn
              label={pl.exerciseMetricReps}
              value={actual}
              mode="integer"
              disabled={disabled}
              valueClassName={cn(
                pulseFlash && 'animate-pulse-success',
                isExact && actual !== targetReps && actual > 0 && 'text-[var(--sr-warning)]',
              )}
              decreaseLabel={pl.lessReps}
              increaseLabel={pl.moreReps}
              decreaseDisabled={disabled}
              increaseDisabled={disabled || actual >= maxValue}
              onDecrease={() => onActualChange(Math.max(0, actual - step))}
              onIncrease={() => onActualChange(Math.min(maxValue, actual + step))}
              onCommit={(n) => onActualChange(Math.min(maxValue, Math.max(0, n)))}
            />
            <div className="pl-3">
              <WorkoutMetricColumn
                label={pl.customWorkoutWeightKg}
                value={weightValue}
                mode="decimal"
                unit={unitLabel}
                disabled={disabled}
                decreaseLabel={pl.customWorkoutLessWeight}
                increaseLabel={pl.customWorkoutMoreWeight}
                decreaseDisabled={disabled || weightValue <= 0}
                increaseDisabled={disabled}
                onDecrease={() => onWeightChange(displayToKg(Math.max(0, weightValue - weightStep), weightUnit))}
                onIncrease={() => onWeightChange(displayToKg(weightValue + weightStep, weightUnit))}
                onCommit={(n) => onWeightChange(displayToKg(Math.max(0, n), weightUnit))}
              />
            </div>
          </div>
          {showWeightTargetHint && (
            <p className="mt-3 border-t border-[var(--sr-border-subtle)] pt-3 text-center text-xs text-[var(--sr-text-muted)]">
              {pl.customWorkoutTargetWeight(targetWeight!, unitLabel)}
            </p>
          )}
        </WorkoutControlSurface>
      )}

      {isDuration && (
        <Button
          type="button"
          variant="secondary"
          className="min-h-12 w-full max-w-xs"
          disabled={disabled}
          onClick={onToggleTimer}
        >
          {timerRunning ? pl.customWorkoutStopTimer : pl.customWorkoutStartTimer}
        </Button>
      )}

      {isRepsWeight ? (
        <Button
          size="touch"
          className="w-full max-w-sm"
          disabled={disabled && !onDisabledTap}
          onClick={() => {
            if (disabled) {
              onDisabledTap?.()
              return
            }
            onDone()
          }}
        >
          {pl.done}
        </Button>
      ) : (
        <div className="flex w-full max-w-xs items-center gap-3">
          <WorkoutStepperButton
            ariaLabel={isDuration ? (isMinUnit ? pl.customWorkoutLessMin : pl.customWorkoutLessSec) : pl.lessReps}
            disabled={disabled}
            onClick={() => onActualChange(Math.max(0, actual - step))}
          >
            <Minus size={24} />
          </WorkoutStepperButton>
          <Button
            size="touch"
            fullWidth
            disabled={disabled && !onDisabledTap}
            onClick={() => {
              if (disabled) {
                onDisabledTap?.()
                return
              }
              onDone()
            }}
          >
            {pl.done}
          </Button>
          <WorkoutStepperButton
            ariaLabel={isDuration ? (isMinUnit ? pl.customWorkoutMoreMin : pl.customWorkoutMoreSec) : pl.moreReps}
            disabled={disabled || actual >= maxValue}
            onClick={() => onActualChange(Math.min(maxValue, actual + step))}
          >
            <Plus size={24} />
          </WorkoutStepperButton>
        </div>
      )}
    </div>
  )
}

export type ActiveCustomWorkoutScreenProps = {
  planName: string
  dayNumber: number
  cycleAttempt: number
  exerciseIndex: number
  exerciseTotal: number
  setIndex: number
  /** Raw position index (round for circuit/amrap). */
  positionSetIndex?: number
  groupKind?: ExerciseGroupKind
  groupRounds?: number
  amrapEndAt?: number | null
  planned: PlannedExercise
  planDay: PlanDay
  checklistSets?: SetPrescription[]
  dayExercises: PlannedExercise[]
  exerciseDef: ExerciseDefinition
  exerciseDefs: Map<string, ExerciseDefinition>
  exerciseLogs: ExerciseLog[]
  setResults: SetLog[]
  restTimer: RestTimerState | null
  coachSuggestion?: string | null
  /** For duration_sec: value in seconds. For reps: reps count. */
  actual: number
  /** Duration display unit — 'sec' (default) or 'min' for cardio. */
  durationUnit?: 'sec' | 'min'
  previousResult?: PreviousCustomSetResult
  /** Map of setNumber → previous result, for SetChecklist delta indicators. */
  previousResults?: Map<number, { reps?: number; durationSec?: number; weightKg?: number }>
  failedIndex?: number
  showHint: boolean
  showMenu: boolean
  showCancelConfirm: boolean
  showLeaveConfirm: boolean
  showPlanSheet: boolean
  failedRetryVisible: boolean
  pulseFlash?: boolean
  saveError?: string | null
  /** Re-attempt the failed set persist (taps "Zrobione" again). */
  onRetrySave?: () => void
  nextLabel: string
  checklistRef?: RefObject<HTMLDivElement | null>
  sessionHasProgress?: boolean
  /** ISO start of the in-memory / persisted workout session. */
  sessionStartedAt?: string | null
  weightKg: number | ''
  timerRunning: boolean
  canEditPreviousSet?: boolean
  weightUnit: 'kg' | 'lb'
  rpeRirValue?: number | null
  rpeRirMode?: 'rpe' | 'rir'
  setNote?: string | undefined
  onRpeRirChange?: (v: number | null) => void
  onRpeRirModeChange?: (m: 'rpe' | 'rir') => void
  onSetNoteChange?: (v: string | undefined) => void
  /** Called when user adds a warm-up set from the generator. */
  onAddWarmupSet?: (set: { reps: number; weightKg: number }) => void
  onBack: () => void
  onToggleMenu: () => void
  onShowPlan: () => void
  onRequestCancel: () => void
  onDismissHint: () => void
  onActualChange: (n: number) => void
  onWeightChange: (v: number | '') => void
  onToggleTimer: () => void
  onDone: () => void
  onEditPreviousSet?: () => void
  onRetry: () => void
  onFinishDayEarly: () => void
  onExpandTimer: () => void
  onAddRest15: () => void
  onAddRest30: () => void
  onSetRest?: (sec: number) => void
  onSkipRest: () => void
  onCollapseTimer: () => void
  onConfirmCancel: () => void
  onDismissCancel: () => void
  onConfirmLeave: () => void
  onDismissLeave: () => void
  onClosePlan: () => void
  onCloseMenu: () => void
  onExerciseStats?: () => void
  onExerciseStatsById?: (exerciseId: string) => void
  onJumpToExercise?: (exerciseIndex: number) => void
  /** Linear (non-group) exercises only — adds a pending set for this session. */
  canAddSet?: boolean
  canRemoveSet?: boolean
  /** Show − N + even when one side is disabled (discoverability). */
  showSetAdjust?: boolean
  baselineSetCount?: number
  onAddSet?: () => void
  onRemoveSet?: () => void
  /** Change restBetweenSetsSec for this exercise (session-only until summary). */
  showRestAdjust?: boolean
  onRestChange?: (sec: number) => void
  /** Swap current exercise for another from library (session-only until summary). */
  canSwapExercise?: boolean
  onSwapExercise?: () => void
  /** Add a new exercise to the end of the session day (session-only until summary). */
  onAddExercise?: () => void
}

export function ActiveCustomWorkoutScreen(props: ActiveCustomWorkoutScreenProps) {
  const {
    planName,
    dayNumber,
    cycleAttempt,
    exerciseIndex,
    exerciseTotal,
    setIndex,
    positionSetIndex,
    groupKind,
    groupRounds,
    amrapEndAt,
    planned,
    planDay,
    checklistSets,
    dayExercises,
    exerciseDef,
    exerciseDefs,
    exerciseLogs,
    setResults,
    restTimer,
    coachSuggestion,
    actual,
    previousResult,
    previousResults,
    failedIndex,
    showHint,
    showMenu,
    showCancelConfirm,
    showLeaveConfirm,
    showPlanSheet,
    failedRetryVisible,
    pulseFlash,
    saveError,
    onRetrySave,
    nextLabel,
    checklistRef,
    sessionHasProgress = false,
    sessionStartedAt,
    weightKg,
    timerRunning,
    canEditPreviousSet = false,
    weightUnit = 'kg',
    durationUnit,
    onBack,
    onToggleMenu,
    onShowPlan,
    onRequestCancel,
    onDismissHint,
    onActualChange,
    onWeightChange,
    onToggleTimer,
    onDone,
    onEditPreviousSet,
    onRetry,
    onFinishDayEarly,
    onExpandTimer,
    onAddRest15,
    onAddRest30,
    onSetRest,
    onSkipRest,
    onCollapseTimer,
    onConfirmCancel,
    onDismissCancel,
    onConfirmLeave,
    onDismissLeave,
    onClosePlan,
    onCloseMenu,
    onExerciseStats,
    onExerciseStatsById,
    onJumpToExercise,
    canAddSet = false,
    canRemoveSet = false,
    showSetAdjust = false,
    baselineSetCount,
    onAddSet,
    onRemoveSet,
    showRestAdjust = false,
    onRestChange,
    canSwapExercise = false,
    onSwapExercise,
    onAddExercise,
    rpeRirValue = null,
    rpeRirMode = 'rpe',
    setNote,
    onRpeRirChange,
    onRpeRirModeChange,
    onSetNoteChange,
    onAddWarmupSet,
  } = props

  const prescription = planned.sets[setIndex]
  const isResting = restTimer !== null && restTimer.mode !== 'idle'
  const counterLocked = isResting
  const positionRound = (positionSetIndex ?? setIndex) + 1
  const [amrapRemaining, setAmrapRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (groupKind !== 'amrap' || !amrapEndAt) {
      setAmrapRemaining(null)
      return
    }
    const tick = () => {
      const left = Math.max(0, Math.ceil((amrapEndAt - Date.now()) / 1000))
      setAmrapRemaining(left)
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [groupKind, amrapEndAt])

  const setLine =
    groupKind === 'circuit'
      ? pl.customWorkoutRoundLine(positionRound, groupRounds)
      : groupKind === 'amrap'
        ? amrapRemaining != null
          ? pl.customWorkoutAmrapRemaining(amrapRemaining)
          : pl.customWorkoutRoundLine(positionRound)
        : pl.customWorkoutHeaderSetLine(dayNumber, setIndex + 1, planned.sets.length)

  const groupBadge =
    groupKind === 'superset'
      ? pl.customWorkoutGroupSuperset
      : groupKind === 'circuit'
        ? pl.customWorkoutGroupCircuit
        : groupKind === 'amrap'
          ? pl.customWorkoutGroupAmrap
          : groupKind === 'dropset'
            ? pl.dropsetLabel
            : null

  const jumpAmrapGroupId =
    groupKind === 'amrap' && amrapEndAt
      ? (getGroupForExercise(planDay, exerciseIndex)?.id ?? null)
      : null

  const headerSub =
    cycleAttempt > 1
      ? pl.customWorkoutHeaderSubAttempt(planName, cycleAttempt, exerciseIndex + 1, exerciseTotal)
      : pl.customWorkoutHeaderSub(planName, exerciseIndex + 1, exerciseTotal)

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col safe-top safe-bottom">
      <header className="shrink-0 border-b border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]">
        <div className="flex items-center justify-between px-2 py-2.5">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              'flex min-h-12 min-w-12 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
              FOCUS_RING,
            )}
            aria-label={pl.back}
          >
            <ArrowLeft size={22} />
          </button>
          <div className="min-w-0 flex-1 px-1 text-center">
            {onExerciseStats ? (
              <button
                type="button"
                onClick={onExerciseStats}
                className="mx-auto flex max-w-full min-h-12 items-start justify-center gap-1.5 rounded-[var(--sr-radius-sm)] px-2 transition-colors hover:bg-[var(--sr-bg-surface)] active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]"
                aria-label={pl.exerciseDetailOpenFor(exerciseDef.name)}
              >
                <span className="break-words sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
                  {exerciseDef.name}
                </span>
                <BarChart2 size={15} className="shrink-0 text-[var(--sr-brand-primary)]" aria-hidden />
              </button>
            ) : (
              <p className="break-words sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
                {exerciseDef.name}
              </p>
            )}
            <p className="break-words sr-text-body-sm font-medium text-[var(--sr-text-primary)]">{setLine}</p>
            {(groupBadge || headerSub || sessionStartedAt) && (
              <div className="mt-0.5 flex min-w-0 items-start justify-center gap-x-1.5">
                {(groupBadge || headerSub) && (
                  <p className="min-w-0 break-words sr-text-caption text-[var(--sr-text-muted)]">
                    {[groupBadge, headerSub].filter(Boolean).join(' · ')}
                  </p>
                )}
                {sessionStartedAt && <SessionElapsedLabel startedAt={sessionStartedAt} />}
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={pl.menuWorkout}
            aria-expanded={showMenu}
            onClick={onToggleMenu}
            className={cn(
              'flex min-h-12 min-w-12 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
              FOCUS_RING,
            )}
          >
            <MoreVertical size={20} />
          </button>
        </div>
        {/* Progress bar — visual indicator of set completion for current exercise */}
        <div
          className="h-1 w-full bg-[var(--sr-bg-surface)]"
          role="progressbar"
          aria-valuenow={Math.min(setResults.length, planned.sets.length)}
          aria-valuemin={0}
          aria-valuemax={planned.sets.length}
          aria-label={pl.customWorkoutProgressAria(setResults.length, planned.sets.length)}
        >
          <div
            className="h-full bg-[var(--sr-brand-primary)] transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${Math.min(100, (setResults.length / Math.max(1, planned.sets.length)) * 100)}%` }}
          />
        </div>
      </header>

      {/* Collapsible exercise demo — thumbnail by default, expand on tap */}
      <div className="px-4 pt-2">
        <ExerciseDemo exercise={exerciseDef} collapsible hideNameWhenCollapsed showControls={false} />
      </div>

      {saveError && onRetrySave && (
        <div className="mx-4 mt-3 mb-1">
          <ErrorBanner message={saveError} onRetry={onRetrySave} />
        </div>
      )}

      {showMenu && (
        <Sheet open onClose={onCloseMenu} title={pl.menuWorkout}>
          <div className="flex flex-col gap-1 pb-2">
            {onExerciseStats && (
              <Button
                variant="ghost"
                fullWidth
                className="justify-start gap-2 px-3"
                onClick={() => {
                  onCloseMenu()
                  onExerciseStats()
                }}
              >
                <BarChart2 size={18} aria-hidden />
                {pl.exerciseDetailOpen}
              </Button>
            )}
            <Button variant="ghost" fullWidth className="justify-start gap-2 px-3" onClick={onShowPlan}>
              <ListOrdered size={18} aria-hidden />
              {dayExercises.length > 1 ? pl.customWorkoutSwitchExerciseMenu : pl.previewDayPlan}
            </Button>
            {canSwapExercise && onSwapExercise && (
              <Button
                variant="ghost"
                fullWidth
                className="justify-start gap-2 px-3"
                onClick={() => {
                  onCloseMenu()
                  onSwapExercise()
                }}
              >
                <Repeat size={18} aria-hidden />
                {pl.customWorkoutSwapExercise}
              </Button>
            )}
            {onAddExercise && (
              <Button
                variant="ghost"
                fullWidth
                className="justify-start gap-2 px-3"
                onClick={() => {
                  onCloseMenu()
                  onAddExercise()
                }}
              >
                <Plus size={18} aria-hidden />
                {pl.customWorkoutAddExercise}
              </Button>
            )}
            {sessionHasProgress && (
              <Button
                variant="ghost"
                fullWidth
                className="justify-start px-3"
                onClick={() => {
                  onCloseMenu()
                  onBack()
                }}
              >
                {pl.leaveWorkoutMenu}
              </Button>
            )}
            <Button
              variant="ghost"
              fullWidth
              className="justify-start px-3 text-[var(--sr-error)] hover:text-[var(--sr-error)]"
              onClick={onRequestCancel}
            >
              {pl.cancelWorkout}
            </Button>
          </div>
        </Sheet>
      )}

      <CustomDayExerciseRail
        planDay={planDay}
        exercises={dayExercises}
        exerciseDefs={exerciseDefs}
        exerciseLogs={exerciseLogs}
        currentExerciseIndex={exerciseIndex}
        onExerciseStats={onExerciseStatsById}
        onJumpToExercise={onJumpToExercise}
        amrapGroupId={jumpAmrapGroupId}
      />

      {planned.note?.trim() && (
        <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2.5 text-sm">
          <span className="flex-1 text-[var(--sr-text-secondary)]">
            <span className="font-medium text-[var(--sr-text-primary)]">
              {pl.customWorkoutExerciseNote}:{' '}
            </span>
            {planned.note.trim()}
          </span>
        </div>
      )}

      {showHint && (
        <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary)]/30 bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_60%,var(--sr-bg-elevated))] px-3 py-2.5 text-sm">
          <span className="flex-1 text-[var(--sr-text-secondary)]">{pl.customWorkoutHint}</span>
          <button type="button" className="min-h-9 shrink-0 rounded-[var(--sr-radius-sm)] px-2 text-sm font-semibold text-[var(--sr-brand-primary)] underline underline-offset-2 transition-colors hover:text-[var(--sr-brand-primary-hover)] active:scale-95" onClick={onDismissHint}>
            {pl.ok}
          </button>
        </div>
      )}

      {failedRetryVisible && (
        <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-error)]/30 bg-[var(--sr-error-muted)] px-3 py-2.5 text-sm text-[var(--sr-error)]">
          {pl.customFailBannerHint}
        </div>
      )}

      <div className="flex-shrink-0 px-4 pt-3">
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {pl.customWorkoutHeaderAria(
            planName,
            dayNumber,
            exerciseIndex + 1,
            exerciseTotal,
            setIndex + 1,
            planned.sets.length,
          )}
        </p>
        {setIndex === 0 && exerciseDef.primaryMetric !== 'duration_sec' && (
          <WarmupPanel
            metric={exerciseDef.primaryMetric}
            targetReps={prescription.reps ? metricTargetDisplayValue(prescription.reps) : 0}
            targetWeight={prescription.weightKg?.kind === 'fixed' ? prescription.weightKg.value : undefined}
            weightUnit={weightUnit}
            onAddWarmupSet={onAddWarmupSet}
          />
        )}
        {prescription && (
          <CustomMetricCounter
            prescription={prescription}
            metric={exerciseDef.primaryMetric}
            exerciseName={exerciseDef.name}
            actual={actual}
            onActualChange={onActualChange}
            onDone={onDone}
            dayNumber={dayNumber}
            cycleAttempt={cycleAttempt}
            previousResult={previousResult}
            pulseFlash={pulseFlash}
            disabled={counterLocked}
            disabledHint={isResting ? pl.restInProgress : undefined}
            onDisabledTap={isResting ? onExpandTimer : undefined}
            weightKg={weightKg}
            onWeightChange={onWeightChange}
            timerRunning={timerRunning}
            onToggleTimer={onToggleTimer}
            weightUnit={weightUnit}
            durationUnit={durationUnit ?? exerciseDef.durationDisplayUnit ?? 'min'}
          />
        )}
        {onRpeRirChange && onSetNoteChange && !counterLocked && (
          <SetLogDetails
            rpeRirValue={rpeRirValue}
            rpeRirMode={rpeRirMode}
            setNote={setNote}
            onRpeRirChange={onRpeRirChange}
            onRpeRirModeChange={onRpeRirModeChange ?? (() => {})}
            onSetNoteChange={onSetNoteChange}
          />
        )}
        {canEditPreviousSet && onEditPreviousSet && (
          <Button variant="ghost" className="mt-2" fullWidth onClick={onEditPreviousSet}>
            {pl.editPreviousSet}
          </Button>
        )}
        {failedRetryVisible && (
          <WorkoutFailRetryRow
            onRetry={onRetry}
            onFinishEarly={onFinishDayEarly}
            finishLabel={pl.customFailEndLabel}
            finishVariant="secondary"
          />
        )}
      </div>

      <div ref={checklistRef} className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-28">
        {showRestAdjust || showSetAdjust ? (
          <SetRestAdjustPanel
            isResting={isResting}
            showRestAdjust={showRestAdjust}
            showSetAdjust={showSetAdjust}
            restBetweenSetsSec={planned.restBetweenSetsSec}
            setsCount={(checklistSets ?? planned.sets).length}
            canAddSet={canAddSet}
            canRemoveSet={canRemoveSet}
            onAddSet={onAddSet}
            onRemoveSet={onRemoveSet}
            onRestChange={onRestChange}
          />
        ) : (
          <div className="mb-3 flex items-center gap-2">
            <p className="sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
              {pl.customWorkoutSetsSection}
            </p>
            <span className="inline-flex items-center rounded-full bg-[var(--sr-bg-surface)] px-2 py-0.5 text-xs font-semibold tabular-nums text-[var(--sr-text-muted)]">
              {setResults.length}/{(checklistSets ?? planned.sets).length}
            </span>
            <span className="ml-auto text-xs text-[var(--sr-text-muted)]">
              {pl.customWorkoutRestChip(planned.restBetweenSetsSec)}
            </span>
          </div>
        )}
        <CustomSetChecklist
          sets={checklistSets ?? planned.sets}
          metric={exerciseDef.primaryMetric}
          currentIndex={positionSetIndex ?? setIndex}
          results={setResults}
          failedIndex={failedIndex}
          baselineSetCount={baselineSetCount}
          onEditLastSet={canEditPreviousSet ? onEditPreviousSet : undefined}
          weightUnit={weightUnit}
          durationUnit={durationUnit ?? exerciseDef.durationDisplayUnit ?? 'min'}
          previousResults={previousResults}
        />
      </div>

      {restTimer && restTimer.mode === 'pill' && (
        <div
          className="fixed inset-x-0 bottom-0 border-t border-[var(--sr-border-subtle)] bg-[var(--sr-bg-base)]/95 px-4 py-3 backdrop-blur safe-bottom"
          style={{ zIndex: Z_REST_PILL }}
        >
          <div className="mx-auto max-w-lg">
            <RestTimerPill
              remainingSec={restTimer.remainingSec}
              onExpand={onExpandTimer}
              onAdd15={onAddRest15}
            />
          </div>
        </div>
      )}

      {restTimer?.mode === 'expanded' && (
        <RestTimerExpanded
          remainingSec={restTimer.remainingSec}
          totalSec={restTimer.totalSec}
          nextLabel={nextLabel}
          nextExercise={exerciseDef}
          coachSuggestion={coachSuggestion}
          onAdd15={onAddRest15}
          onAdd30={onAddRest30}
          onSetRest={onSetRest}
          onSkip={onSkipRest}
          onCollapse={onCollapseTimer}
          setLabel={pl.restSetLabel((positionSetIndex ?? setIndex) + 1, planned.sets.length)}
        />
      )}

      {showCancelConfirm && (
        <ConfirmSheet
          title={pl.cancelWorkout}
          message={
            sessionHasProgress ? pl.cancelWorkoutConfirm : pl.cancelWorkoutConfirmEmpty
          }
          confirmLabel={pl.cancelWorkoutConfirmAction}
          variant="danger"
          onConfirm={onConfirmCancel}
          onCancel={onDismissCancel}
        />
      )}

      {showLeaveConfirm && (
        <ConfirmSheet
          title={pl.leaveWorkoutTitle}
          message={pl.leaveWorkoutConfirm}
          confirmLabel={pl.leaveWorkoutConfirmAction}
          cancelLabel={pl.cancel}
          onConfirm={onConfirmLeave}
          onCancel={onDismissLeave}
        />
      )}

      {showPlanSheet && (
        <CustomDayPlanSheet
          planDay={planDay}
          exercises={dayExercises}
          exerciseDefs={exerciseDefs}
          exerciseLogs={exerciseLogs}
          currentExerciseIndex={exerciseIndex}
          onClose={onClosePlan}
          onJumpToExercise={onJumpToExercise}
          amrapGroupId={jumpAmrapGroupId}
        />
      )}
    </div>
  )
}
