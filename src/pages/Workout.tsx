import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getCycleById } from '@/data/plans'
import { pl } from '@/i18n/pl'
import { validateSet, getTargetReps, isWorkoutAvailable, daysUntilWorkout } from '@/lib/progress-engine'
import {
  createRestTimer,
  addRestTime,
  skipRest,
  requestWakeLock,
  releaseWakeLock,
  startRestTimerWorker,
  stopRestTimerWorker,
} from '@/lib/rest-timer'
import { useWorkoutStore } from '@/stores/workout-store'
import { useAppStore } from '@/stores/app-store'
import { onSetComplete, onSetFailed, ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { ActiveWorkoutScreen } from '@/components/workout/ActiveWorkoutScreen'
import { Button } from '@/components/ui/Button'
import { ErrorBanner, PageLoader } from '@/components/ux/Feedback'
import {
  finalizeFailedDay,
  finalizeSuccessfulDay,
  abandonWorkoutSession,
  abandonAllInProgress,
  getPreviousSetActual,
  saveWorkoutSession,
} from '@/lib/session-service'
import { getProgramProgress, saveActiveWorkout, markProgramActiveIfReady } from '@/lib/program-service'
import { db } from '@/lib/db'
import { isStaleActiveWorkout } from '@/lib/sync'
import { generateId, playChime, vibrate } from '@/lib/utils'
import type { Program } from '@/data/plans/types'
import type { SetResultDraft } from '@/lib/progress-engine'
import type { LocalWorkoutSession } from '@/lib/db'

export default function WorkoutPage() {
  const { program: programParam } = useParams<{ program: Program }>()
  const program = programParam as Program
  const [searchParams] = useSearchParams()
  const forceStart = searchParams.get('force') === '1'
  const navigate = useNavigate()
  const timerSound = useAppStore((s) => s.settings.timerSound)
  const timerVibration = useAppStore((s) => s.settings.timerVibration)
  const finishingRef = useRef(false)
  const initGenerationRef = useRef(0)
  const checklistRef = useRef<HTMLDivElement>(null)
  const setsCountRef = useRef(5)

  const [progress, setProgress] = useState<Awaited<ReturnType<typeof getProgramProgress>>>(undefined)
  const [sessionMeta, setSessionMeta] = useState<LocalWorkoutSession | null>(null)
  const [actual, setActual] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [failedIndex, setFailedIndex] = useState<number | undefined>()
  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [lastActual, setLastActual] = useState<number | undefined>()
  const [restBlocked, setRestBlocked] = useState(false)
  const [testPendingBlocked, setTestPendingBlocked] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [showPlanSheet, setShowPlanSheet] = useState(false)
  const [negativeCountdown, setNegativeCountdown] = useState<number | null>(null)
  const negativePrepForSetRef = useRef<number | null>(null)
  const [showStaleConfirm, setShowStaleConfirm] = useState(false)
  const [staleResume, setStaleResume] = useState<{ day: number; set: number; total: number } | null>(null)
  const staleConfirmedRef = useRef(false)
  const [pulseFlash, setPulseFlash] = useState(false)

  const currentSetIndex = useWorkoutStore((s) => s.currentSetIndex)
  const setResults = useWorkoutStore((s) => s.setResults)
  const restTimer = useWorkoutStore((s) => s.restTimer)
  const cycle = progress ? getCycleById(progress.cycleId) : undefined
  const day = cycle?.days.find((d) => d.dayNumber === progress?.currentDay)
  const currentTarget = day?.sets[currentSetIndex]
  const unit =
    cycle?.variant === 'negative'
      ? pl.negatives
      : program === 'pushups'
        ? pl.pushups
        : pl.pullups

  const loadPreviousActual = useCallback(
    async (setIndex: number, cycleAttempt: number, dayNumber: number) => {
      const prev = await getPreviousSetActual(program, dayNumber, cycleAttempt, setIndex + 1)
      setLastActual(prev)
    },
    [program],
  )

  const initWorkout = useCallback(async (generation: number) => {
    setInitError(null)
    setRestBlocked(false)
    setTestPendingBlocked(false)
    const workout = useWorkoutStore.getState()

    try {
      const prog = await getProgramProgress(program)
      if (generation !== initGenerationRef.current) return
      if (!prog) {
        navigate('/', { replace: true })
        return
      }

      if (prog.status === 'test_pending') {
        setTestPendingBlocked(true)
        setProgress(prog)
        setInitialized(true)
        return
      }

      if (prog.status === 'paused') {
        setInitError(pl.statusPaused)
        setInitialized(true)
        return
      }

      const available = isWorkoutAvailable(
        prog.nextWorkoutAfter ? new Date(prog.nextWorkoutAfter) : null,
      )
      const existingActive = await db.activeWorkout.get(program)
      // Allow resuming an in-progress session during rest; block only new starts
      if (!available && !forceStart && !existingActive) {
        setRestBlocked(true)
        setProgress(prog)
        setInitialized(true)
        return
      }

      await markProgramActiveIfReady(program)

      setProgress(prog)
      let active = existingActive

      if (active && isStaleActiveWorkout(active.updatedAt) && !staleConfirmedRef.current) {
        const cycleForStale = getCycleById(prog.cycleId)
        const dayForStale = cycleForStale?.days.find((x) => x.dayNumber === prog.currentDay)
        setStaleResume({
          day: prog.currentDay,
          set: active.currentSetIndex + 1,
          total: dayForStale?.sets.length ?? 5,
        })
        setProgress(prog)
        setShowStaleConfirm(true)
        setInitialized(true)
        return
      }

      const c = getCycleById(prog.cycleId)
      const d = c?.days.find((x) => x.dayNumber === prog.currentDay)
      setsCountRef.current = d?.sets.length ?? 5
      if (!c || !d) {
        setInitError(pl.errorNoPlan)
        setInitialized(true)
        return
      }

      let session: LocalWorkoutSession

      if (!active) {
        const existingInProgress = await db.workoutSessions
          .where('program')
          .equals(program)
          .filter((s) => s.status === 'in_progress')
          .first()
        if (existingInProgress) {
          active = {
            program,
            sessionId: existingInProgress.id,
            currentSetIndex: existingInProgress.setResults.length,
            setResults: existingInProgress.setResults,
            restTimerJson: null,
            updatedAt: new Date().toISOString(),
          }
        }
      }

      if (generation !== initGenerationRef.current) return

      if (active) {
        let restTimer = null
        if (active.restTimerJson) {
          try {
            restTimer = JSON.parse(active.restTimerJson)
          } catch {
            restTimer = null
          }
        }
        workout.resumeSession({
          sessionId: active.sessionId,
          program,
          cycleId: prog.cycleId,
          dayNumber: prog.currentDay,
          cycleAttempt: prog.cycleAttempt,
          currentSetIndex: active.currentSetIndex,
          setResults: active.setResults,
          restTimer,
        })
        const existing = await db.workoutSessions.get(active.sessionId)
        session = existing ?? {
          id: active.sessionId,
          program,
          cycleId: prog.cycleId,
          dayNumber: prog.currentDay,
          cycleAttempt: prog.cycleAttempt,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          setResults: active.setResults,
        }
        if (!existing) await saveWorkoutSession(session)
      } else {
        // Ensure no orphan in_progress ghosts before creating a fresh session
        await abandonAllInProgress(program)

        const sessionId = generateId()
        session = {
          id: sessionId,
          program,
          cycleId: prog.cycleId,
          dayNumber: prog.currentDay,
          cycleAttempt: prog.cycleAttempt,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
          setResults: [],
        }
        workout.startSession({
          sessionId,
          program,
          cycleId: prog.cycleId,
          dayNumber: prog.currentDay,
          cycleAttempt: prog.cycleAttempt,
        })
        await saveWorkoutSession(session)
        await saveActiveWorkout(program, {
          sessionId,
          currentSetIndex: 0,
          setResults: [],
          restTimerJson: null,
        })
      }

      if (generation !== initGenerationRef.current) return

      setSessionMeta(session)
      const setIdx = active?.currentSetIndex ?? 0
      setActual(getTargetReps(d.sets[setIdx]))
      await loadPreviousActual(setIdx, prog.cycleAttempt, prog.currentDay)
      setInitialized(true)

      const { settings: appSettings, setSettings: patchSettings } = useAppStore.getState()
      if (!appSettings.hasSeenWorkoutHint) {
        setShowHint(true)
        patchSettings({ hasSeenWorkoutHint: true })
      }
    } catch {
      if (generation !== initGenerationRef.current) return
      setInitError(pl.errorStartWorkout)
      setInitialized(true)
    }
  }, [program, navigate, forceStart, loadPreviousActual])

  useEffect(() => {
    const generation = ++initGenerationRef.current
    finishingRef.current = false
    setInitialized(false)
    void initWorkout(generation)
    useWorkoutStore.getState().setImmersive(true)

    return () => {
      initGenerationRef.current += 1
      useWorkoutStore.getState().setImmersive(false)
      releaseWakeLock()
      stopRestTimerWorker()
    }
  }, [program, forceStart, initWorkout])

  useEffect(() => {
    if (!restTimer || restTimer.mode === 'idle') {
      stopRestTimerWorker()
      return
    }
    requestWakeLock()
    startRestTimerWorker(restTimer, {
      getState: () => useWorkoutStore.getState().restTimer,
      onTick: (remainingSec) => {
        const current = useWorkoutStore.getState().restTimer
        if (!current) return
        useWorkoutStore.getState().setRestTimer({ ...current, remainingSec })
      },
      onComplete: () => {
        if (timerSound) playChime()
        if (timerVibration) vibrate(100)
        useWorkoutStore.getState().setRestTimer(skipRest())
        releaseWakeLock()
        checklistRef.current
          ?.querySelector('[data-active-set="true"]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      },
    })
    return () => stopRestTimerWorker()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart worker only when timer identity changes
  }, [
    restTimer?.startedAt,
    restTimer?.totalSec,
    restTimer?.mode,
    timerSound,
    timerVibration,
  ])

  useEffect(() => {
    if (negativeCountdown === null || negativeCountdown <= 0) return
    const t = window.setTimeout(() => setNegativeCountdown((s) => (s !== null && s > 0 ? s - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [negativeCountdown])

  // Pre-set negative prep when landing on an exact set (not after Done / mid-persist)
  useEffect(() => {
    if (!initialized || !day || !cycle || finishingRef.current) return
    const resting = restTimer !== null && restTimer.mode !== 'idle'
    if (resting) {
      setNegativeCountdown(null)
      return
    }
    const target = day.sets[currentSetIndex]
    if (cycle.variant !== 'negative' || !target || target.kind !== 'exact') {
      setNegativeCountdown(null)
      negativePrepForSetRef.current = null
      return
    }
    if (negativePrepForSetRef.current === currentSetIndex) return
    negativePrepForSetRef.current = currentSetIndex
    setNegativeCountdown(4)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- react to set index + rest mode only
  }, [initialized, day, cycle, currentSetIndex, restTimer?.mode])

  const persistState = async () => {
    const s = useWorkoutStore.getState()
    if (!s.sessionId) return
    await saveActiveWorkout(program, {
      sessionId: s.sessionId,
      currentSetIndex: s.currentSetIndex,
      setResults: s.setResults,
      restTimerJson: s.restTimer ? JSON.stringify(s.restTimer) : null,
    })
  }

  const handleDone = async () => {
    const workout = useWorkoutStore.getState()
    if (!currentTarget || !day || !progress || !sessionMeta || finishingRef.current) return
    if (workout.restTimer && workout.restTimer.mode !== 'idle') {
      workout.setRestTimer({ ...workout.restTimer, mode: 'expanded' })
      return
    }
    if (negativeCountdown !== null && negativeCountdown > 0) return
    finishingRef.current = true
    setNegativeCountdown(null)

    try {
      const passed = validateSet(currentTarget, actual)
      const result: SetResultDraft = {
        setNumber: workout.currentSetIndex + 1,
        target: currentTarget,
        actual,
        passed,
      }

      if (!passed) {
        onSetFailed()
        setFailedIndex(workout.currentSetIndex)
        if (!workout.failedRetryUsed) {
          workout.setFailedRetryUsed(true)
          finishingRef.current = false
          return
        }
        await finalizeFailedDay(sessionMeta.id, program, [...workout.setResults, result])
        workout.reset()
        navigate(`/workout/${program}/summary?failed=1&session=${sessionMeta.id}`, { replace: true })
        return
      }

      onSetComplete()
      setPulseFlash(true)
      window.setTimeout(() => setPulseFlash(false), 400)
      const nextSetIndex = workout.currentSetIndex + 1
      const allResults = [...workout.setResults, result]
      workout.completeSet(result)
      setFailedIndex(undefined)

      if (nextSetIndex >= day.sets.length) {
        await persistState()
        await finalizeSuccessfulDay(sessionMeta, allResults)
        workout.reset()
        navigate(`/workout/${program}/summary?session=${sessionMeta.id}`, { replace: true })
        return
      }

      // Start rest before any await so negative-prep effect cannot fire on the next set
      workout.setRestTimer(createRestTimer(day.restBetweenSetsSec))
      setActual(getTargetReps(day.sets[nextSetIndex]))
      await persistState()
      await loadPreviousActual(nextSetIndex, progress.cycleAttempt, progress.currentDay)
      await persistState()
      finishingRef.current = false
    } catch {
      finishingRef.current = false
      setInitError(pl.errorSaveSet)
    }
  }

  if (!initialized) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader message={pl.loading} />
      </div>
    )
  }

  if (initError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <ErrorBanner message={initError} onRetry={() => {
          const generation = ++initGenerationRef.current
          setInitialized(false)
          void initWorkout(generation)
        }} />
        <Button variant="ghost" className="mt-4" fullWidth onClick={() => navigate('/', { replace: true })}>{pl.backHome}</Button>
      </div>
    )
  }

  if (testPendingBlocked && progress) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
        <h1 className="sr-text-h1">{pl.testPendingBlocked}</h1>
        <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.cycleCompleteHint}</p>
        <Button className="mt-6" fullWidth onClick={() => navigate(`/setup/test/${program}?retest=1`)}>
          {pl.test}
        </Button>
        <Button variant="ghost" className="mt-2" fullWidth onClick={() => navigate('/', { replace: true })}>
          {pl.backHome}
        </Button>
      </div>
    )
  }

  if (showStaleConfirm && staleResume) {
    return (
      <ConfirmSheet
        title={pl.staleSessionTitle}
        message={pl.staleSessionConfirm}
        confirmLabel={pl.continueWorkout(staleResume.day, staleResume.set, staleResume.total)}
        cancelLabel={pl.startFresh}
        onConfirm={() => {
          staleConfirmedRef.current = true
          setShowStaleConfirm(false)
          const generation = ++initGenerationRef.current
          setInitialized(false)
          void initWorkout(generation)
        }}
        onCancel={async () => {
          await abandonAllInProgress(program)
          useWorkoutStore.getState().reset()
          navigate('/', { replace: true })
        }}
      />
    )
  }

  if (restBlocked && progress) {
    const daysLeft = daysUntilWorkout(
      progress.nextWorkoutAfter ? new Date(progress.nextWorkoutAfter) : null,
    )
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
        <h1 className="sr-text-h1">{pl.restBlocked(pl.restIn(daysLeft))}</h1>
        <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
          {pl.restGateHint(daysLeft)}
        </p>
        <Button className="mt-6" fullWidth onClick={() => navigate(`/workout/${program}?force=1`, { replace: true })}>
          {pl.trainAnyway}
        </Button>
        <Button variant="ghost" className="mt-2" fullWidth onClick={() => navigate('/', { replace: true })}>
          {pl.backHome}
        </Button>
      </div>
    )
  }

  if (!day || !currentTarget || !progress) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <ErrorBanner message={pl.errorNoWorkoutData} onRetry={() => navigate('/', { replace: true })} />
      </div>
    )
  }

  const nextTarget = day.sets[currentSetIndex + 1]
  const nextLabel = nextTarget
    ? pl.nextSet(currentSetIndex + 2, getTargetReps(nextTarget), unit)
    : ''

  return (
    <ActiveWorkoutScreen
      program={program}
      progress={{ currentDay: progress.currentDay, cycleAttempt: progress.cycleAttempt }}
      day={day}
      cycleVariant={cycle?.variant}
      currentSetIndex={currentSetIndex}
      setResults={setResults}
      restTimer={restTimer}
      actual={actual}
      lastActual={lastActual}
      failedIndex={failedIndex}
      showHint={showHint}
      showMenu={showMenu}
      showCancelConfirm={showCancelConfirm}
      showLeaveConfirm={showLeaveConfirm}
      showPlanSheet={showPlanSheet}
      negativeCountdown={negativeCountdown}
      failedRetryVisible={failedIndex === currentSetIndex}
      pulseFlash={pulseFlash}
      nextLabel={nextLabel}
      checklistRef={checklistRef}
      showTechniqueLink={program === 'pushups'}
      onBack={() => setShowLeaveConfirm(true)}
      onToggleMenu={() => setShowMenu((v) => !v)}
      onShowPlan={() => { setShowPlanSheet(true); setShowMenu(false) }}
      onShowTechnique={() => {
        void persistState().finally(() => {
          navigate('/setup/technique?from=workout')
          setShowMenu(false)
        })
      }}
      onRequestCancel={() => { setShowCancelConfirm(true); setShowMenu(false) }}
      onDismissHint={() => setShowHint(false)}
      onActualChange={setActual}
      onDone={() => void handleDone()}
      onRetry={() => { setFailedIndex(undefined) }}
      onFinishDayEarly={() => void (async () => {
        if (!sessionMeta || !currentTarget || finishingRef.current) return
        finishingRef.current = true
        try {
          const workout = useWorkoutStore.getState()
          const failedResult: SetResultDraft = {
            setNumber: workout.currentSetIndex + 1,
            target: currentTarget,
            actual,
            passed: false,
          }
          await finalizeFailedDay(sessionMeta.id, program, [...workout.setResults, failedResult])
          workout.reset()
          navigate(`/workout/${program}/summary?failed=1&session=${sessionMeta.id}`, { replace: true })
        } catch {
          finishingRef.current = false
          setInitError(pl.errorFinishDay)
        }
      })()}
      onExpandTimer={() => {
        const t = useWorkoutStore.getState().restTimer
        if (t) useWorkoutStore.getState().setRestTimer({ ...t, mode: 'expanded' })
      }}
      onAddRest15={() => {
        const t = useWorkoutStore.getState().restTimer
        if (t) useWorkoutStore.getState().setRestTimer(addRestTime(t, 15))
      }}
      onAddRest30={() => {
        const t = useWorkoutStore.getState().restTimer
        if (t) useWorkoutStore.getState().setRestTimer(addRestTime(t, 30))
      }}
      onSkipRest={() => useWorkoutStore.getState().setRestTimer(skipRest())}
      onCollapseTimer={() => {
        const t = useWorkoutStore.getState().restTimer
        if (t) useWorkoutStore.getState().setRestTimer({ ...t, mode: 'pill' })
      }}
      onConfirmCancel={() => void (async () => {
        if (!sessionMeta) return
        await abandonWorkoutSession(program, sessionMeta.id)
        useWorkoutStore.getState().reset()
        navigate('/', { replace: true })
      })()}
      onDismissCancel={() => setShowCancelConfirm(false)}
      onConfirmLeave={() => {
        setShowLeaveConfirm(false)
        void persistState().finally(() => navigate('/', { replace: true }))
      }}
      onDismissLeave={() => setShowLeaveConfirm(false)}
      onClosePlan={() => setShowPlanSheet(false)}
      onCloseMenu={() => setShowMenu(false)}
    />
  )
}
