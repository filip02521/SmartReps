import { ArrowLeft, MoreVertical } from 'lucide-react'
import type { RefObject } from 'react'
import type { Program } from '@/data/plans/types'
import type { SetTarget } from '@/data/plans/types'
import type { SetResultDraft } from '@/lib/progress-engine'
import type { RestTimerState } from '@/lib/rest-timer'
import { pl } from '@/i18n/pl'
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
} from '@/components/workout/WorkoutComponents'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Z_REST_PILL } from '@/lib/ui-chrome'

export type ActiveWorkoutScreenProps = {
  program: Program
  progress: { currentDay: number; cycleAttempt: number }
  day: { sets: SetTarget[]; restBetweenSetsSec: number }
  cycleVariant?: string
  currentSetIndex: number
  setResults: SetResultDraft[]
  restTimer: RestTimerState | null
  actual: number
  lastActual?: number
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
  onSkipRest: () => void
  onCollapseTimer: () => void
  onConfirmCancel: () => void
  onDismissCancel: () => void
  onConfirmLeave: () => void
  onDismissLeave: () => void
  onClosePlan: () => void
  onCloseMenu: () => void
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
    actual,
    lastActual,
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
    onSkipRest,
    onCollapseTimer,
    onConfirmCancel,
    onDismissCancel,
    onConfirmLeave,
    onDismissLeave,
    onClosePlan,
    onCloseMenu,
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
        <p className="text-center sr-text-body-sm font-medium text-[var(--sr-text-primary)]">
          {pl.workoutHeader(programLabel, progress.currentDay, currentSetIndex + 1, day.sets.length)}
        </p>
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
            <Button variant="ghost" fullWidth className="justify-start px-3" onClick={onShowPlan}>
              {pl.previewDayPlan}
            </Button>
            {showTechniqueLink && (
              <Button variant="ghost" fullWidth className="justify-start px-3" onClick={onShowTechnique}>
                {pl.helpTechniquePushups}
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

      {cycleVariant === 'negative' && <div className="px-4"><NegativeBanner /></div>}
      {preparingNegative && (
        <NegativeCountdown seconds={negativeCountdown!} />
      )}

      {showHint && (
        <div className="mx-4 mb-2 rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary-muted)] px-3 py-2 text-sm">
          {pl.workoutHint}
          <button type="button" className="ml-2 min-h-11 underline" onClick={onDismissHint}>{pl.ok}</button>
        </div>
      )}

      {failedRetryVisible && (
        <div className="mx-4 mb-2 rounded-[var(--sr-radius-md)] bg-[var(--sr-error-muted)] px-3 py-2 text-sm text-[var(--sr-error)]">
          {currentTarget.kind === 'exact'
            ? pl.workoutFailExactBanner(actual, targetReps)
            : pl.workoutFailBanner(actual, targetReps)}
        </div>
      )}

      <div className="flex-shrink-0 px-4">
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {pl.setColumn} {currentSetIndex + 1} z {day.sets.length}, {pl.targetColumn.toLowerCase()} {targetReps} {unit}
        </p>
        <RepCounter
          target={currentTarget}
          program={program}
          actual={actual}
          onActualChange={onActualChange}
          onDone={onDone}
          lastActual={lastActual}
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
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" fullWidth onClick={onRetry}>{pl.retry}</Button>
            <Button variant="danger" fullWidth onClick={onFinishDayEarly}>{pl.finishDay}</Button>
          </div>
        )}
      </div>

      <div ref={checklistRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-28">
        <SetChecklist
          sets={day.sets}
          currentIndex={currentSetIndex}
          results={setResults}
          failedIndex={failedIndex}
          dimmed={false}
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
          message={pl.cancelWorkoutConfirm}
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
        <DayPlanSheet sets={day.sets} restSec={day.restBetweenSetsSec} onClose={onClosePlan} />
      )}
    </div>
  )
}
