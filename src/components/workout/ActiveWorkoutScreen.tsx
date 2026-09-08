import { ArrowLeft, MoreVertical } from 'lucide-react'
import type { RefObject } from 'react'
import type { Program } from '@/data/plans/types'
import type { SetTarget } from '@/data/plans/types'
import type { SetResultDraft } from '@/lib/progress-engine'
import type { RestTimerState } from '@/lib/rest-timer'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { getTargetReps } from '@/lib/progress-engine'
import {
  RepCounter,
  SetChecklist,
  RestTimerPill,
  RestTimerExpanded,
  NegativeBanner,
  NegativeCountdown,
  ConfirmSheet,
  DayPlanSheet,
  WorkoutFailRetryRow,
} from '@/components/workout/WorkoutComponents'
import { WarmupPanel } from '@/components/workout/WarmupPanel'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { SessionElapsedLabel } from '@/components/workout/SessionElapsedLabel'
import { Z_REST_PILL } from '@/lib/ui-chrome'
import { useAppStore } from '@/stores/app-store'
import { ErrorBanner } from '@/components/ux/Feedback'

export type ActiveWorkoutScreenProps = {
  program: Program
  progress: { currentDay: number; cycleAttempt: number }
  day: { sets: SetTarget[]; restBetweenSetsSec: number }
  cycleVariant?: string
  currentSetIndex: number
  setResults: SetResultDraft[]
  restTimer: RestTimerState | null
  coachSuggestion?: string | null
  actual: number
  lastActual?: number
  /** Map of setNumber → actual from previous session, for SetChecklist delta. */
  previousResults?: Map<number, number>
  failedIndex?: number
  showHint: boolean
  showMenu: boolean
  showCancelConfirm: boolean
  showLeaveConfirm: boolean
  showPlanSheet: boolean
  negativeCountdown: number | null
  failedRetryVisible: boolean
  pulseFlash?: boolean
  nextLabel: string
  checklistRef?: RefObject<HTMLDivElement | null>
  showTechniqueLink?: boolean
  sessionHasProgress?: boolean
  /** ISO start of the in-memory / persisted workout session. */
  sessionStartedAt?: string | null
  onBack: () => void
  onToggleMenu: () => void
  onShowPlan: () => void
  onShowTechnique: () => void
  onRequestCancel: () => void
  onDismissHint: () => void
  onActualChange: (n: number) => void
  onDone: () => void
  onEditPreviousSet?: () => void
  canEditPreviousSet?: boolean
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
  saveError?: string | null
  onDismissSaveError?: () => void
}

export function ActiveWorkoutScreen(props: ActiveWorkoutScreenProps) {
  const {
    program,
    progress,
    day,
    cycleVariant,
    currentSetIndex,
    setResults,
    restTimer,
    coachSuggestion,
    actual,
    lastActual,
    previousResults,
    failedIndex,
    showHint,
    showMenu,
    showCancelConfirm,
    showLeaveConfirm,
    showPlanSheet,
    negativeCountdown,
    failedRetryVisible,
    pulseFlash,
    nextLabel,
    checklistRef,
    showTechniqueLink = false,
    sessionHasProgress = false,
    sessionStartedAt,
    onBack,
    onToggleMenu,
    onShowPlan,
    onShowTechnique,
    onRequestCancel,
    onDismissHint,
    onActualChange,
    onDone,
    onEditPreviousSet,
    canEditPreviousSet = false,
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
    saveError,
    onDismissSaveError,
  } = props

  const currentTarget = day.sets[currentSetIndex]
  const unit =
    cycleVariant === 'negative'
      ? pl.negatives
      : program === 'pushups'
        ? pl.pushups
        : pl.pullups
  const programLabel = program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram
  const isResting = restTimer !== null && restTimer.mode !== 'idle'
  const preparingNegative = negativeCountdown !== null && negativeCountdown > 0
  const counterLocked = isResting || preparingNegative
  const targetReps = getTargetReps(currentTarget)
  const weightUnit = useAppStore((s) => s.settings.weightUnit)

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col safe-top safe-bottom">
      <header className="shrink-0 border-b border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)]">
        <div className="flex items-center justify-between gap-1 px-2 py-2.5">
          <button
            type="button"
            onClick={onBack}
            className={cn(
              'flex min-h-11 min-w-11 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
              FOCUS_RING,
            )}
            aria-label={pl.back}
          >
            <ArrowLeft size={22} />
          </button>
          <div className="min-w-0 flex-1 px-1 text-center">
            <p className="truncate sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
              {pl.workoutHeader(programLabel, progress.currentDay, currentSetIndex + 1, day.sets.length)}
            </p>
            {sessionStartedAt && (
              <SessionElapsedLabel startedAt={sessionStartedAt} className="mt-0.5" />
            )}
          </div>
          <button
            type="button"
            aria-label={pl.menuWorkout}
            aria-expanded={showMenu}
            onClick={onToggleMenu}
            className={cn(
              'flex min-h-11 min-w-11 items-center justify-center rounded-[var(--sr-radius-md)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] hover:text-[var(--sr-text-primary)] active:scale-95',
              FOCUS_RING,
            )}
          >
            <MoreVertical size={20} />
          </button>
        </div>
        {/* Progress bar — visual indicator of set completion */}
        <div
          className="h-1 w-full bg-[var(--sr-bg-surface)]"
          role="progressbar"
          aria-valuenow={Math.min(setResults.length, day.sets.length)}
          aria-valuemin={0}
          aria-valuemax={day.sets.length}
          aria-label={pl.workoutProgressAria(setResults.length, day.sets.length)}
        >
          <div
            className="h-full bg-[var(--sr-brand-primary)] transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${Math.min(100, (setResults.length / day.sets.length) * 100)}%` }}
          />
        </div>
      </header>

      {showMenu && (
        <Sheet open onClose={onCloseMenu} title={pl.menuWorkout}>
          <div className="flex flex-col gap-1 pb-2">
            <Button variant="ghost" fullWidth className="justify-start px-3" onClick={onShowPlan}>
              {pl.previewDayPlan}
            </Button>
            {showTechniqueLink && (
              <Button variant="ghost" fullWidth className="justify-start px-3" onClick={onShowTechnique}>
                {pl.helpTechniquePushups}
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

      {saveError && (
        <div className="mx-4 mt-3 mb-1">
          <ErrorBanner message={saveError} onRetry={onDismissSaveError} />
        </div>
      )}

      {cycleVariant === 'negative' && <NegativeBanner />}
      {preparingNegative && (
        <NegativeCountdown seconds={negativeCountdown!} />
      )}

      {showHint && (
        <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-brand-primary)]/30 bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_60%,var(--sr-bg-elevated))] px-3 py-2.5 text-sm">
          <span className="flex-1 text-[var(--sr-text-secondary)]">{pl.workoutHint}</span>
          <button type="button" className="min-h-9 shrink-0 rounded-[var(--sr-radius-sm)] px-2 text-sm font-semibold text-[var(--sr-brand-primary)] underline underline-offset-2 transition-colors hover:text-[var(--sr-brand-primary-hover)] active:scale-95" onClick={onDismissHint}>{pl.ok}</button>
        </div>
      )}

      {failedRetryVisible && (
        <div className="mx-4 mt-3 mb-1 flex items-start gap-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-error)]/30 bg-[var(--sr-error-muted)] px-3 py-2.5 text-sm text-[var(--sr-error)]">
          {currentTarget.kind === 'exact'
            ? pl.workoutFailExactBanner(actual, targetReps)
            : pl.workoutFailBanner(actual, targetReps)}
        </div>
      )}

      <div className="flex-shrink-0 px-4 pt-3">
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {pl.setColumn} {currentSetIndex + 1} z {day.sets.length}, {pl.targetColumn.toLowerCase()} {targetReps} {unit}
        </p>
        {currentSetIndex === 0 && !isResting && !preparingNegative && (
          <WarmupPanel
            metric="reps"
            targetReps={targetReps}
            weightUnit={weightUnit}
          />
        )}
        <RepCounter
          target={currentTarget}
          program={program}
          actual={actual}
          onActualChange={onActualChange}
          onDone={onDone}
          lastActual={lastActual ?? previousResults?.get(currentSetIndex + 1)}
          pulseFlash={pulseFlash}
          disabled={counterLocked}
          disabledHint={isResting ? pl.restInProgress : preparingNegative ? pl.negativeCountdown(negativeCountdown!) : undefined}
          onDisabledTap={isResting ? onExpandTimer : undefined}
        />
        {canEditPreviousSet && onEditPreviousSet && (
          <Button variant="ghost" className="mt-2" fullWidth onClick={onEditPreviousSet}>
            {pl.editPreviousSet}
          </Button>
        )}
        {failedRetryVisible && (
          <WorkoutFailRetryRow
            onRetry={onRetry}
            onFinishEarly={onFinishDayEarly}
            finishLabel={pl.finishDay}
          />
        )}
      </div>

      <div ref={checklistRef} className="min-h-0 flex-1 overflow-y-auto px-4 pt-5 pb-28">
        <p className="mb-3 sr-text-overline font-semibold uppercase tracking-wide text-[var(--sr-text-muted)]">
          {pl.workoutSetsSectionTitle} · {setResults.length}/{day.sets.length}
        </p>
        <SetChecklist
          sets={day.sets}
          currentIndex={currentSetIndex}
          results={setResults}
          failedIndex={failedIndex}
          dimmed={false}
          onEditLastSet={canEditPreviousSet ? onEditPreviousSet : undefined}
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
          coachSuggestion={coachSuggestion}
          onAdd15={onAddRest15}
          onAdd30={onAddRest30}
          onSetRest={onSetRest}
          onSkip={onSkipRest}
          onCollapse={onCollapseTimer}
          setLabel={pl.restSetLabel(currentSetIndex + 1, day.sets.length)}
        />
      )}

      {showCancelConfirm && (
        <ConfirmSheet
          title={pl.cancelWorkout}
          message={sessionHasProgress ? pl.cancelWorkoutConfirm : pl.cancelWorkoutConfirmEmpty}
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
        <DayPlanSheet sets={day.sets} restSec={day.restBetweenSetsSec} onClose={onClosePlan} />
      )}
    </div>
  )
}
