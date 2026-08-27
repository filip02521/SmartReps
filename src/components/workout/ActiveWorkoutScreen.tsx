import { MoreVertical } from 'lucide-react'
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
  showPlanSheet: boolean
  negativeCountdown: number | null
  failedRetryVisible: boolean
  pulseFlash?: boolean
  nextLabel: string
  checklistRef?: RefObject<HTMLDivElement | null>
  onBack: () => void
  onToggleMenu: () => void
  onShowPlan: () => void
  onShowTechnique: () => void
  onRequestCancel: () => void
  onDismissHint: () => void
  onActualChange: (n: number) => void
  onDone: () => void
  onRetry: () => void
  onFinishDayEarly: () => void
  onExpandTimer: () => void
  onAddRest15: () => void
  onAddRest30: () => void
  onSkipRest: () => void
  onCollapseTimer: () => void
  onConfirmCancel: () => void
  onDismissCancel: () => void
  onClosePlan: () => void
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
    showPlanSheet,
    negativeCountdown,
    failedRetryVisible,
    pulseFlash,
    nextLabel,
    checklistRef,
    onBack,
    onToggleMenu,
    onShowPlan,
    onShowTechnique,
    onRequestCancel,
    onDismissHint,
    onActualChange,
    onDone,
    onRetry,
    onFinishDayEarly,
    onExpandTimer,
    onAddRest15,
    onAddRest30,
    onSkipRest,
    onCollapseTimer,
    onConfirmCancel,
    onDismissCancel,
    onClosePlan,
  } = props

  const currentTarget = day.sets[currentSetIndex]
  const unit = program === 'pushups' ? pl.pushups : pl.pullups
  const isResting = restTimer !== null && restTimer.mode !== 'idle'

  return (
    <div className="mx-auto flex h-full min-h-0 max-w-lg flex-col safe-top safe-bottom">
      <header className="flex shrink-0 items-center justify-between px-4 py-3">
        <button type="button" onClick={onBack} className="text-[var(--sr-text-secondary)]" aria-label="Wstecz">
          ←
        </button>
        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
          {program === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram} · Dzień {progress.currentDay} · Seria {currentSetIndex + 1}/{day.sets.length}
        </p>
        <button type="button" aria-label="Menu" onClick={onToggleMenu} className="text-[var(--sr-text-secondary)]">
          <MoreVertical size={20} />
        </button>
      </header>

      {showMenu && (
        <div className="mx-4 mb-2 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] py-1">
          <button type="button" className="block w-full px-4 py-2 text-left text-sm" onClick={onShowPlan}>
            {pl.previewDayPlan}
          </button>
          <button type="button" className="block w-full px-4 py-2 text-left text-sm" onClick={onShowTechnique}>
            {pl.helpTechnique}
          </button>
          <button type="button" className="block w-full px-4 py-2 text-left text-sm text-[var(--sr-error)]" onClick={onRequestCancel}>
            {pl.cancelWorkout}
          </button>
        </div>
      )}

      {cycleVariant === 'negative' && <div className="px-4"><NegativeBanner /></div>}
      {negativeCountdown !== null && negativeCountdown > 0 && (
        <NegativeCountdown seconds={negativeCountdown} />
      )}

      {showHint && (
        <div className="mx-4 mb-2 rounded-[var(--sr-radius-md)] bg-[var(--sr-brand-primary-muted)] px-3 py-2 text-sm">
          {pl.workoutHint}
          <button type="button" className="ml-2 underline" onClick={onDismissHint}>OK</button>
        </div>
      )}

      <div className="flex-shrink-0 px-4">
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          Seria {currentSetIndex + 1} z {day.sets.length}, cel {getTargetReps(currentTarget)} {unit}
        </p>
        <RepCounter
          target={currentTarget}
          program={program}
          actual={actual}
          onActualChange={onActualChange}
          onDone={onDone}
          lastActual={lastActual}
          pulseFlash={pulseFlash}
        />
        {failedRetryVisible && (
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" fullWidth onClick={onRetry}>{pl.retry}</Button>
            <Button variant="danger" fullWidth onClick={onFinishDayEarly}>{pl.finishDay}</Button>
          </div>
        )}
      </div>

      <div ref={checklistRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <SetChecklist
          sets={day.sets}
          currentIndex={currentSetIndex}
          results={setResults}
          failedIndex={failedIndex}
          dimmed={isResting}
        />
      </div>

      {restTimer && restTimer.mode !== 'idle' && (
        <div className="flex-shrink-0 px-4 pb-4">
          {restTimer.mode === 'pill' && (
            <RestTimerPill
              remainingSec={restTimer.remainingSec}
              onExpand={onExpandTimer}
              onAdd15={onAddRest15}
            />
          )}
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
          onConfirm={onConfirmCancel}
          onCancel={onDismissCancel}
        />
      )}

      {showPlanSheet && (
        <DayPlanSheet sets={day.sets} restSec={day.restBetweenSetsSec} onClose={onClosePlan} />
      )}
    </div>
  )
}
