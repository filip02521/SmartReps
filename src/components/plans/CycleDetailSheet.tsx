import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { pl } from '@/i18n/pl'
import { getCycleName, getCycleDescription } from '@/lib/plan-resolver'
import { getTargetReps } from '@/lib/progress-engine'
import { selectCycleByTest, isHigherCycle } from '@/lib/cycle-selector'
import { applyLevelChange } from '@/lib/level-change'
import { abandonAllInProgress } from '@/lib/session-service'
import { reconcileActiveWorkout } from '@/lib/program-service'
import { beginProgramSetup } from '@/lib/setup-flow'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'
import { track, AnalyticsEvents } from '@/lib/analytics'
import type { Cycle, Program } from '@/data/plans/types'

type CtaState = 'enable_and_test' | 'do_test' | 'back_to_workout' | 'change_to_this'

function getCtaState(
  programEnabled: boolean,
  hasProgress: boolean,
  isCurrentCycle: boolean,
  progressStatus: string | undefined,
): CtaState {
  if (!programEnabled) return 'enable_and_test'
  if (!hasProgress) return 'do_test'
  if (isCurrentCycle) {
    if (progressStatus === 'test_pending') return 'do_test'
    return 'back_to_workout'
  }
  return 'change_to_this'
}

export function CycleDetailSheet({
  open,
  onClose,
  cycle,
  program,
  programEnabled,
  hasProgress,
  currentCycleId,
  currentStatus,
  lastTestReps,
  onEnableProgram,
}: {
  open: boolean
  onClose: () => void
  cycle: Cycle
  program: Program
  programEnabled: boolean
  hasProgress: boolean
  currentCycleId: string | null
  currentStatus: string | undefined
  lastTestReps: number | null
  onEnableProgram: (program: Program) => void
}) {
  const navigate = useNavigate()
  const { setPendingStart, clearPendingTest } = useAppStore()
  const [submitting, setSubmitting] = useState(false)
  const [showActiveWarning, setShowActiveWarning] = useState(false)
  const [showHigherWarning, setShowHigherWarning] = useState(false)

  const isCurrentCycle = currentCycleId === cycle.id
  const ctaState = getCtaState(
    programEnabled,
    hasProgress,
    isCurrentCycle,
    currentStatus,
  )

  const recommendedCycle =
    lastTestReps != null ? selectCycleByTest(program, lastTestReps) : null
  const isRecommended = recommendedCycle?.id === cycle.id
  const isHigherThanRecommended =
    recommendedCycle != null && isHigherCycle(cycle, recommendedCycle)

  const layoutLabel =
    cycle.layout === 'standard_6day'
      ? pl.programTierLayout6day
      : cycle.layout === 'compact_3day'
        ? pl.programTierLayout3day
        : pl.programTierLayout9day

  /**
   * Główna funkcja aktywacji — porzuca in-progress, aplikuje level change,
   * ustawia pendingStart i nawiguje do ekranu start.
   * Blokada double-tap przez `submitting`. Warning sheety zostają otwarte
   * z loading state aż do zakończenia (sukces → zamyka wszystko, błąd → zamyka warning).
   */
  async function runActivate() {
    setSubmitting(true)
    try {
      await abandonAllInProgress(program)
      track(AnalyticsEvents.levelChange, { program, source: 'browser' })
      const result = await applyLevelChange(program, cycle.id)
      clearPendingTest()
      setPendingStart({
        program,
        cycleId: result.cycle.id,
        cycleName: result.cycle.nameShort,
        reps: lastTestReps ?? 0,
        isLevelChange: true,
      })
      setShowActiveWarning(false)
      setShowHigherWarning(false)
      onClose()
      navigate(`/setup/start/${program}?change=1`)
    } catch {
      showToast(pl.errorActivateLevel, 'error')
      setShowActiveWarning(false)
      setShowHigherWarning(false)
    } finally {
      setSubmitting(false)
    }
  }

  /**
   * Sprawdza aktywny trening, potem wyższy poziom, potem aktywuje.
   * Kolejność: active → higher → runActivate (jedno ostrzeżenie naraz).
   */
  async function tryActivate() {
    if (submitting) return
    setSubmitting(true)
    try {
      const active = await reconcileActiveWorkout(program)
      if (active) {
        setShowActiveWarning(true)
        return
      }
      if (isHigherThanRecommended) {
        setShowHigherWarning(true)
        return
      }
      await runActivate()
    } finally {
      setSubmitting(false)
    }
  }

  function handleEnableAndTest() {
    onEnableProgram(program)
    void beginProgramSetup(navigate, program)
    onClose()
  }

  function handleDoTest() {
    void beginProgramSetup(navigate, program, { retest: true })
    onClose()
  }

  function handleBackToWorkout() {
    navigate(`/workout/${program}`)
    onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title={getCycleName(cycle)}>
      <p className="text-sm text-[var(--sr-text-secondary)]">
        {getCycleDescription(cycle)}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="default">{pl.planSummaryDays(cycle.days.length)}</Badge>
        <Badge variant="default">{layoutLabel}</Badge>
        {cycle.estimatedWeeks && (
          <Badge variant="info">
            {pl.planEstimatedWeeks(
              cycle.estimatedWeeks[0],
              cycle.estimatedWeeks[1],
            )}
          </Badge>
        )}
        {isCurrentCycle && <Badge variant="success">{pl.plansYourCycle}</Badge>}
        {isRecommended && !isCurrentCycle && (
          <Badge variant="info">{pl.programRecommendedForYou}</Badge>
        )}
      </div>

      <div className="mt-5 space-y-4">
        {cycle.days.map((day) => {
          const dayTotal = day.sets.reduce((s, t) => s + getTargetReps(t), 0)
          return (
            <div key={day.dayNumber}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="font-semibold text-[var(--sr-text-primary)]">
                  {pl.dayLabel(day.dayNumber)}
                </p>
                <p className="sr-text-body-sm tabular-nums text-[var(--sr-text-secondary)]">
                  {pl.plansDayReps(day.sets.length, dayTotal)}
                </p>
              </div>
              <SetTargetsRow sets={day.sets} size="md" />
              <p className="mt-2 sr-text-body-sm text-[var(--sr-text-muted)]">
                {pl.restBetweenSets(day.restBetweenSetsSec)}
              </p>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {ctaState === 'enable_and_test' && (
          <Button size="touch" fullWidth onClick={handleEnableAndTest}>
            {pl.programEnableAndTest}
          </Button>
        )}
        {ctaState === 'do_test' && (
          <Button size="touch" fullWidth onClick={handleDoTest}>
            {pl.programDoMaxTest}
          </Button>
        )}
        {ctaState === 'change_to_this' && (
          <Button
            size="touch"
            fullWidth
            disabled={submitting}
            onClick={() => void tryActivate()}
          >
            {pl.programChangeToThisLevel}
          </Button>
        )}
        {ctaState === 'back_to_workout' && (
          <Button size="touch" fullWidth onClick={handleBackToWorkout}>
            {pl.programBackToWorkout}
          </Button>
        )}

        {/* Secondary: retest when user has progress and views a different cycle */}
        {hasProgress && !isCurrentCycle && ctaState === 'change_to_this' && (
          <Button variant="ghost" fullWidth onClick={handleDoTest}>
            {pl.programRetest}
          </Button>
        )}
        {/* Secondary: manual activate (restart) when viewing current cycle in test_pending */}
        {isCurrentCycle && currentStatus === 'test_pending' && (
          <Button
            variant="ghost"
            fullWidth
            disabled={submitting}
            onClick={() => void tryActivate()}
          >
            {pl.programActivateThisLevel}
          </Button>
        )}
      </div>

      {showActiveWarning && (
        <ConfirmSheet
          title={pl.menuChangeLevel}
          message={pl.changeLevelActiveWarning}
          confirmLabel={pl.confirm}
          cancelLabel={pl.cancel}
          variant="danger"
          confirming={submitting}
          onConfirm={() => void runActivate()}
          onCancel={() => setShowActiveWarning(false)}
        />
      )}

      {showHigherWarning && (
        <ConfirmSheet
          title={pl.higherLevelWarningTitle}
          message={pl.higherLevelWarning}
          confirmLabel={pl.understandHigher}
          cancelLabel={pl.backToRecommended}
          variant="danger"
          confirming={submitting}
          onConfirm={() => void runActivate()}
          onCancel={() => setShowHigherWarning(false)}
        />
      )}
    </Sheet>
  )
}
