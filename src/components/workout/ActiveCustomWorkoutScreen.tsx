import { ArrowLeft, BarChart2, Minus, MoreVertical, Plus } from 'lucide-react'
import type { RefObject, ReactNode } from 'react'
import { Check, ChevronRight, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import {
  ConfirmSheet,
  RestTimerExpanded,
  RestTimerPill,
} from '@/components/workout/WorkoutComponents'
import { PreviousResultBadge } from '@/components/workout/PreviousResultBadge'
import { pl } from '@/i18n/pl'
import type {
  ExerciseDefinition,
  ExerciseLog,
  PlannedExercise,
  PrimaryMetric,
  SetLog,
  SetPrescription,
} from '@/lib/exercise-model'
import {
  formatPrescriptionSetLabel,
  formatPrescriptionTarget,
  formatSetActualDisplay,
  getPrimaryMetricTarget,
  isExactPrescription,
  isMaxPrescription,
} from '@/lib/custom-prescription-format'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'
import type { RestTimerState } from '@/lib/rest-timer'
import { Z_REST_PILL, FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

const WORKOUT_STEPPER_BTN =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-primary)] disabled:opacity-40'

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
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
  decreaseDisabled,
  increaseDisabled,
}: {
  label: string
  value: number
  unit?: string
  valueClassName?: string
  onDecrease: () => void
  onIncrease: () => void
  decreaseLabel: string
  increaseLabel: string
  decreaseDisabled?: boolean
  increaseDisabled?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--sr-text-muted)]">
        {label}
      </p>
      <p
        className={cn(
          'sr-text-h2 tabular-nums font-semibold leading-none text-[var(--sr-text-primary)]',
          valueClassName,
        )}
      >
        {value}
        {unit && (
          <span className="ml-0.5 sr-text-body-sm font-medium text-[var(--sr-text-muted)]">
            {unit}
          </span>
        )}
      </p>
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

function SetStatusIcon({ state }: { state: 'pending' | 'active' | 'done' | 'failed' }) {
  if (state === 'done') return <Check size={16} className="animate-check-in text-[var(--sr-success)]" />
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
  editable,
  onClick,
}: {
  setNumber: number
  prescription: SetPrescription
  metric: PrimaryMetric
  state: 'pending' | 'active' | 'done' | 'failed'
  result?: SetLog
  editable?: boolean
  onClick?: () => void
}) {
  const canPress = Boolean(onClick) && (state !== 'done' || editable)
  const targetLabel = formatPrescriptionTarget(prescription, metric)
  const actualLabel =
    result != null ? formatSetActualDisplay(result.actual, metric) : null

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!canPress}
      data-active-set={state === 'active' ? 'true' : undefined}
      aria-label={
        editable ? `${pl.setColumn} ${setNumber} — ${pl.editPreviousSet}` : undefined
      }
      className={cn(
        'flex w-full items-center justify-between rounded-[var(--sr-radius-md)] px-4 py-3.5 text-left transition-colors',
        state === 'active' &&
          'border-2 border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]',
        state === 'done' && 'bg-[var(--sr-success-muted)]',
        state === 'failed' && 'bg-[var(--sr-error-muted)]',
        state === 'pending' && 'bg-[var(--sr-bg-surface)]',
        editable && 'ring-1 ring-[var(--sr-brand-primary)]/40',
      )}
    >
      <span
        className={cn(
          'flex items-center gap-2 font-medium',
          state === 'done' && 'text-[var(--sr-success)]',
          state === 'failed' && 'text-[var(--sr-error)]',
          state === 'pending' && 'text-[var(--sr-text-secondary)]',
          state === 'active' && 'text-[var(--sr-text-primary)]',
        )}
      >
        <SetStatusIcon state={state} />
        {pl.setColumn} {setNumber}
      </span>
      <span
        className={cn(
          'tabular-nums text-base font-semibold',
          state === 'done' && 'text-[var(--sr-text-primary)]',
          state === 'failed' && 'text-[var(--sr-error)]',
          state === 'pending' && 'text-[var(--sr-text-primary)]',
          state === 'active' && 'text-[var(--sr-text-primary)]',
        )}
      >
        {state === 'done' && actualLabel != null
          ? editable
            ? `${actualLabel} / ${targetLabel} · ${pl.editShort}`
            : `${actualLabel} / ${targetLabel}`
          : targetLabel}
      </span>
    </button>
  )
}

function CustomSetChecklist({
  sets,
  metric,
  currentIndex,
  results,
  failedIndex,
  onEditLastSet,
}: {
  sets: SetPrescription[]
  metric: PrimaryMetric
  currentIndex: number
  results: SetLog[]
  failedIndex?: number
  onEditLastSet?: () => void
}) {
  return (
    <div className="flex flex-col gap-2 overflow-y-auto">
      {sets.map((prescription, i) => {
        const setNumber = i + 1
        const result = results.find((r) => r.setNumber === setNumber)
        let state: 'pending' | 'active' | 'done' | 'failed' = 'pending'
        if (result?.passed) state = 'done'
        else if (result && !result.passed) state = 'failed'
        else if (failedIndex === i) state = 'failed'
        else if (i === currentIndex) state = 'active'
        const editable =
          state === 'done' && setNumber === currentIndex && Boolean(onEditLastSet)
        return (
          <CustomSetRow
            key={setNumber}
            setNumber={setNumber}
            prescription={prescription}
            metric={metric}
            state={state}
            result={result}
            editable={editable}
            onClick={editable ? onEditLastSet : undefined}
          />
        )
      })}
    </div>
  )
}

function CustomDayExerciseRail({
  exercises,
  exerciseDefs,
  exerciseLogs,
  currentExerciseIndex,
  onExerciseStats,
}: {
  exercises: PlannedExercise[]
  exerciseDefs: Map<string, ExerciseDefinition>
  exerciseLogs: ExerciseLog[]
  currentExerciseIndex: number
  onExerciseStats?: (exerciseId: string) => void
}) {
  if (exercises.length <= 1) return null

  return (
    <div className="mx-4 mb-3">
      <div
        className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label={pl.customWorkoutExerciseOf(currentExerciseIndex + 1, exercises.length)}
      >
        {exercises.map((pe, i) => {
          const def = exerciseDefs.get(pe.exerciseId)
          const name = def?.name ?? pl.planEllipsis
          const log = exerciseLogs[i]
          const passedSets = log?.sets.filter((s) => s.passed).length ?? 0
          const totalSets = pe.sets.length
          const done = i < currentExerciseIndex
          const active = i === currentExerciseIndex
          const canOpenStats = done && onExerciseStats && def
          const Tag = canOpenStats ? 'button' : 'div'
          const setsLabel = done
            ? pl.planSetsShort(totalSets)
            : pl.customWorkoutExerciseDone(active ? passedSets : 0, totalSets)

          return (
            <Tag
              key={`${pe.exerciseId}-${i}`}
              type={canOpenStats ? 'button' : undefined}
              aria-label={canOpenStats ? pl.exerciseDetailOpenFor(name) : undefined}
              aria-current={active ? 'step' : undefined}
              onClick={canOpenStats ? () => onExerciseStats(pe.exerciseId) : undefined}
              className={cn(
                'flex min-w-[5.75rem] max-w-[9rem] shrink-0 flex-col gap-1 rounded-[var(--sr-radius-md)] px-2.5 py-2 text-left transition-colors',
                done && 'bg-[var(--sr-success-muted)]',
                active &&
                  'border-2 border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]',
                !done && !active && 'border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)]',
                canOpenStats &&
                  'cursor-pointer hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sr-brand-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sr-bg-base)]',
              )}
            >
              <div className="grid grid-cols-[1rem_minmax(0,1fr)] items-center gap-x-1.5 gap-y-0.5">
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
                    'truncate text-sm font-medium leading-tight',
                    done && 'text-[var(--sr-success)]',
                    active && 'text-[var(--sr-text-primary)]',
                    !done && !active && 'text-[var(--sr-text-secondary)]',
                  )}
                >
                  {name}
                </span>
                <span aria-hidden />
                <p className="truncate text-xs tabular-nums text-[var(--sr-text-muted)]">{setsLabel}</p>
              </div>
            </Tag>
          )
        })}
      </div>
    </div>
  )
}

function CustomDayPlanSheet({
  exercises,
  exerciseDefs,
  exerciseLogs,
  currentExerciseIndex,
  onClose,
}: {
  exercises: PlannedExercise[]
  exerciseDefs: Map<string, ExerciseDefinition>
  exerciseLogs: ExerciseLog[]
  currentExerciseIndex: number
  onClose: () => void
}) {
  return (
    <Sheet open onClose={onClose} title={pl.previewDayPlan}>
      <ul className="flex flex-col gap-3">
        {exercises.map((pe, i) => {
          const def = exerciseDefs.get(pe.exerciseId)
          const name = def?.name ?? pl.planEllipsis
          const metric = def?.primaryMetric ?? 'reps'
          const active = i === currentExerciseIndex
          const log = exerciseLogs[i]
          const doneSets = log?.sets.filter((s) => s.passed).length ?? 0
          const done = i < currentExerciseIndex
          return (
            <li
              key={`${pe.exerciseId}-${i}`}
              className={cn(
                'rounded-[var(--sr-radius-md)] px-3 py-3',
                active
                  ? 'border-2 border-[var(--sr-brand-primary)] bg-[var(--sr-brand-primary-muted)]'
                  : done
                    ? 'bg-[var(--sr-success-muted)]'
                    : 'bg-[var(--sr-bg-surface)]',
              )}
            >
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium text-[var(--sr-text-primary)]">
                  {i + 1}. {name}
                </p>
                <p className="shrink-0 text-xs text-[var(--sr-text-muted)]">
                  {done
                    ? pl.planSetsShort(pe.sets.length)
                    : active
                      ? pl.customWorkoutExerciseDone(doneSets, pe.sets.length)
                      : pl.planSetsShort(pe.sets.length)}
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
                {pe.sets.map((s, si) => {
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
                        ? formatSetActualDisplay(setLog.actual, metric)
                        : formatPrescriptionTarget(s, metric)}
                    </span>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

function CustomMetricCounter({
  prescription,
  metric,
  exerciseName,
  actual,
  onActualChange,
  onDone,
  lastActual,
  pulseFlash,
  disabled,
  disabledHint,
  onDisabledTap,
  weightKg,
  onWeightChange,
  timerRunning,
  onToggleTimer,
}: {
  prescription: SetPrescription
  metric: PrimaryMetric
  exerciseName: string
  actual: number
  onActualChange: (n: number) => void
  onDone: () => void
  lastActual?: number
  pulseFlash?: boolean
  disabled?: boolean
  disabledHint?: string
  onDisabledTap?: () => void
  weightKg: number | ''
  onWeightChange: (v: number | '') => void
  timerRunning: boolean
  onToggleTimer: () => void
}) {
  const isDuration = metric === 'duration_sec'
  const primaryTarget = getPrimaryMetricTarget(prescription, metric)
  const isExact = isExactPrescription(prescription, metric)
  const isMax = isMaxPrescription(prescription, metric)
  const targetReps = primaryTarget ? metricTargetDisplayValue(primaryTarget) : 0
  const targetWeight =
    metric === 'reps_weight' && prescription.weightKg
      ? metricTargetDisplayValue(prescription.weightKg)
      : null
  const maxValue = isExact ? targetReps : 9999
  const step = 1
  const weightValue = weightKg === '' ? 0 : Number(weightKg)
  const weightStep = 2.5
  const showWeightTargetHint =
    targetWeight != null && weightValue > 0 && weightValue !== targetWeight
  const isRepsWeight = metric === 'reps_weight'

  return (
    <div className={cn('flex flex-col items-center gap-4 py-4', disabled && 'opacity-60')}>
      <p className="px-2 text-center sr-text-overline text-[var(--sr-text-muted)]">
        {formatPrescriptionSetLabel(prescription, metric, exerciseName)}
      </p>
      {isExact && (
        <p className="text-center text-sm text-[var(--sr-text-secondary)]">
          {pl.exactLiveHint(targetReps)}
        </p>
      )}
      {isMax && (
        <p className="text-center text-sm text-[var(--sr-text-secondary)]">
          {pl.customMaxLiveHint(targetReps)}
        </p>
      )}

      {!isRepsWeight && (
        <div className="flex items-baseline gap-2">
          <p
            className={cn(
              'sr-text-display tabular-nums leading-none text-[var(--sr-text-primary)]',
              pulseFlash && 'animate-pulse-success',
              isExact && actual !== targetReps && actual > 0 && 'text-[var(--sr-warning)]',
              isDuration && timerRunning && 'text-[var(--sr-brand-primary)]',
            )}
          >
            {actual}
          </p>
          {isDuration && (
            <span className="sr-text-body-sm font-medium text-[var(--sr-text-muted)]">
              {pl.customDurationUnit}
            </span>
          )}
        </div>
      )}

      {lastActual !== undefined && !isRepsWeight && (
        <PreviousResultBadge actual={lastActual} target={targetReps} />
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
            />
            <div className="pl-3">
              <WorkoutMetricColumn
                label={pl.customWorkoutWeightKg}
                value={weightValue}
                unit={pl.customWorkoutWeightShort}
                decreaseLabel={pl.customWorkoutLessWeight}
                increaseLabel={pl.customWorkoutMoreWeight}
                decreaseDisabled={disabled || weightValue <= 0}
                increaseDisabled={disabled}
                onDecrease={() => onWeightChange(Math.max(0, weightValue - weightStep))}
                onIncrease={() => onWeightChange(weightValue + weightStep)}
              />
            </div>
          </div>
          {showWeightTargetHint && (
            <p className="mt-3 border-t border-[var(--sr-border-subtle)] pt-3 text-center text-xs text-[var(--sr-text-muted)]">
              {pl.customWorkoutTargetWeight(targetWeight!)}
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
            ariaLabel={isDuration ? pl.customWorkoutLessSec : pl.lessReps}
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
            ariaLabel={isDuration ? pl.customWorkoutMoreSec : pl.moreReps}
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
  planned: PlannedExercise
  dayExercises: PlannedExercise[]
  exerciseDef: ExerciseDefinition
  exerciseDefs: Map<string, ExerciseDefinition>
  exerciseLogs: ExerciseLog[]
  setResults: SetLog[]
  restTimer: RestTimerState | null
  actual: number
  lastActual?: number
  failedIndex?: number
  showHint: boolean
  showMenu: boolean
  showCancelConfirm: boolean
  showLeaveConfirm: boolean
  showPlanSheet: boolean
  failedRetryVisible: boolean
  pulseFlash?: boolean
  nextLabel: string
  checklistRef?: RefObject<HTMLDivElement | null>
  sessionHasProgress?: boolean
  weightKg: number | ''
  timerRunning: boolean
  canEditPreviousSet?: boolean
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
}

export function ActiveCustomWorkoutScreen(props: ActiveCustomWorkoutScreenProps) {
  const {
    planName,
    dayNumber,
    cycleAttempt,
    exerciseIndex,
    exerciseTotal,
    setIndex,
    planned,
    dayExercises,
    exerciseDef,
    exerciseDefs,
    exerciseLogs,
    setResults,
    restTimer,
    actual,
    lastActual,
    failedIndex,
    showHint,
    showMenu,
    showCancelConfirm,
    showLeaveConfirm,
    showPlanSheet,
    failedRetryVisible,
    pulseFlash,
    nextLabel,
    checklistRef,
    sessionHasProgress = false,
    weightKg,
    timerRunning,
    canEditPreviousSet = false,
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
  } = props

  const prescription = planned.sets[setIndex]
  const isResting = restTimer !== null && restTimer.mode !== 'idle'
  const counterLocked = isResting
  const primaryTarget = prescription
    ? getPrimaryMetricTarget(prescription, exerciseDef.primaryMetric)
    : undefined
  const targetDisplay = primaryTarget ? metricTargetDisplayValue(primaryTarget) : 0
  const isExactTarget = prescription
    ? isExactPrescription(prescription, exerciseDef.primaryMetric)
    : false

  const headerSub =
    cycleAttempt > 1
      ? pl.customWorkoutHeaderSubAttempt(planName, cycleAttempt, exerciseIndex + 1, exerciseTotal)
      : pl.customWorkoutHeaderSub(planName, exerciseIndex + 1, exerciseTotal)

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col safe-top safe-bottom">
      <header className="flex shrink-0 items-center justify-between px-2 py-2">
        <button
          type="button"
          onClick={onBack}
          className="flex min-h-11 min-w-11 items-center justify-center text-[var(--sr-text-secondary)]"
          aria-label={pl.back}
        >
          <ArrowLeft size={22} />
        </button>
        <div className="min-w-0 flex-1 px-1 text-center">
          {onExerciseStats ? (
            <button
              type="button"
              onClick={onExerciseStats}
              className="mx-auto flex max-w-full min-h-11 items-center justify-center gap-1.5 rounded-[var(--sr-radius-sm)] px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]"
              aria-label={pl.exerciseDetailOpenFor(exerciseDef.name)}
            >
              <span className="truncate sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
                {exerciseDef.name}
              </span>
              <BarChart2 size={15} className="shrink-0 text-[var(--sr-brand-primary)]" aria-hidden />
            </button>
          ) : (
            <p className="truncate sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
              {exerciseDef.name}
            </p>
          )}
          <p className="truncate text-xs text-[var(--sr-text-muted)]">
            {pl.customWorkoutHeaderSetLine(dayNumber, setIndex + 1, planned.sets.length)}
          </p>
          <p className="truncate text-xs text-[var(--sr-text-muted)]">{headerSub}</p>
        </div>
        <button
          type="button"
          aria-label={pl.menuWorkout}
          aria-expanded={showMenu}
          onClick={onToggleMenu}
          className="flex min-h-11 min-w-11 items-center justify-center text-[var(--sr-text-secondary)]"
        >
          <MoreVertical size={20} />
        </button>
      </header>

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
            <Button variant="ghost" fullWidth className="justify-start px-3" onClick={onShowPlan}>
              {pl.previewDayPlan}
            </Button>
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
        exercises={dayExercises}
        exerciseDefs={exerciseDefs}
        exerciseLogs={exerciseLogs}
        currentExerciseIndex={exerciseIndex}
        onExerciseStats={onExerciseStatsById}
      />

      {planned.note?.trim() && (
        <div className="mx-4 mb-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3 py-2 text-sm text-[var(--sr-text-secondary)]">
          <span className="font-medium text-[var(--sr-text-primary)]">
            {pl.customWorkoutExerciseNote}:{' '}
          </span>
          {planned.note.trim()}
        </div>
      )}

      {showHint && (
        <div className="mx-4 mb-2 rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary-muted)] px-3 py-2 text-sm">
          {pl.customWorkoutHint}
          <button type="button" className="ml-2 min-h-11 underline" onClick={onDismissHint}>
            {pl.ok}
          </button>
        </div>
      )}

      {failedRetryVisible && (
        <div className="mx-4 mb-2 rounded-[var(--sr-radius-md)] bg-[var(--sr-error-muted)] px-3 py-2 text-sm text-[var(--sr-error)]">
          {isExactTarget
            ? pl.workoutFailExactBanner(actual, targetDisplay)
            : pl.workoutFailBanner(actual, targetDisplay)}
        </div>
      )}

      <div className="flex-shrink-0 px-4">
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
        {prescription && (
          <CustomMetricCounter
            prescription={prescription}
            metric={exerciseDef.primaryMetric}
            exerciseName={exerciseDef.name}
            actual={actual}
            onActualChange={onActualChange}
            onDone={onDone}
            lastActual={lastActual}
            pulseFlash={pulseFlash}
            disabled={counterLocked}
            disabledHint={isResting ? pl.restInProgress : undefined}
            onDisabledTap={isResting ? onExpandTimer : undefined}
            weightKg={weightKg}
            onWeightChange={onWeightChange}
            timerRunning={timerRunning}
            onToggleTimer={onToggleTimer}
          />
        )}
        {canEditPreviousSet && onEditPreviousSet && (
          <Button variant="ghost" className="mt-2" fullWidth onClick={onEditPreviousSet}>
            {pl.editPreviousSet}
          </Button>
        )}
        {failedRetryVisible && (
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" fullWidth onClick={onRetry}>
              {pl.retry}
            </Button>
            <Button variant="danger" fullWidth onClick={onFinishDayEarly}>
              {pl.customFailEnd}
            </Button>
          </div>
        )}
      </div>

      <div ref={checklistRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-28">
        <div className="mb-3 flex items-end justify-between gap-2">
          <p className="sr-text-overline text-[var(--sr-text-muted)]">
            {pl.customWorkoutSetsSection}
          </p>
          <p className="text-xs text-[var(--sr-text-muted)]">
            {pl.customWorkoutRestChip(planned.restBetweenSetsSec)}
          </p>
        </div>
        <CustomSetChecklist
          sets={planned.sets}
          metric={exerciseDef.primaryMetric}
          currentIndex={setIndex}
          results={setResults}
          failedIndex={failedIndex}
          onEditLastSet={canEditPreviousSet ? onEditPreviousSet : undefined}
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
          onAdd15={onAddRest15}
          onAdd30={onAddRest30}
          onSkip={onSkipRest}
          onCollapse={onCollapseTimer}
        />
      )}

      {showCancelConfirm && (
        <ConfirmSheet
          title={pl.cancelWorkout}
          message={
            sessionHasProgress ? pl.cancelWorkoutConfirm : pl.cancelWorkoutConfirmEmpty
          }
          confirmLabel={pl.cancelWorkout}
          variant="danger"
          onConfirm={onConfirmCancel}
          onCancel={onDismissCancel}
        />
      )}

      {showLeaveConfirm && (
        <ConfirmSheet
          title={pl.leaveWorkoutTitle}
          message={pl.leaveWorkoutConfirm}
          confirmLabel={pl.yes}
          cancelLabel={pl.no}
          onConfirm={onConfirmLeave}
          onCancel={onDismissLeave}
        />
      )}

      {showPlanSheet && (
        <CustomDayPlanSheet
          exercises={dayExercises}
          exerciseDefs={exerciseDefs}
          exerciseLogs={exerciseLogs}
          currentExerciseIndex={exerciseIndex}
          onClose={onClosePlan}
        />
      )}
    </div>
  )
}
