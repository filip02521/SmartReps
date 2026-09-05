import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getCycleById } from '@/data/plans'
import { pl } from '@/i18n/pl'
import { validateSet, getTargetReps, isWorkoutAvailable, daysUntilWorkout } from '@/lib/progress-engine'
import {
  createRestTimer,
  addRestTime,
  skipRest,
  startRestTimerWorker,
  stopRestTimerWorker,
} from '@/lib/rest-timer'
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake'
import { useWorkoutStore } from '@/stores/workout-store'
import { useAppStore } from '@/stores/app-store'
import { onSetComplete, onSetFailed, ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { ActiveWorkoutScreen } from '@/components/workout/ActiveWorkoutScreen'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBanner, PageLoader } from '@/components/ux/Feedback'
import {
  finalizeFailedDay,
  finalizeSuccessfulDay,
  abandonWorkoutSession,
  abandonAllInProgress,
  cleanupEmptyInProgressSessions,
  ensureWorkoutSessionPersisted,
  getPreviousSetActual,
  getMostRecentSetActual,
  hasAnyCompletedSessions,
} from '@/lib/session-service'
import { getRestNextSetLabel } from '@/lib/workout-rest-label'
import { getSmartRestSuggestion } from '@/lib/ai/proactive-coach'
import { getProgramProgress, reconcileActiveWorkout, clearActiveWorkout } from '@/lib/program-service'
import { db } from '@/lib/db'
import { isStaleActiveWorkout } from '@/lib/sync'
import { generateId } from '@/lib/utils'
import {
  initWorkoutAudio,
  onPrepCountdownFeedback,
  onPrepCountdownGoFeedback,
  onRestComplete,
  wrapRestTimerCallbacks,
} from '@/lib/workout-feedback'
import type { Program } from '@/data/plans/types'
import type { SetResultDraft } from '@/lib/progress-engine'
import { reconcileRestTimerJson } from '@/lib/rest-timer-sync'
import type { LocalWorkoutSession } from '@/lib/db'

export default function WorkoutPage() {
  const { program: programParam } = useParams<{ program: Program }>()
  const program = programParam as Program
  const [searchParams] = useSearchParams()
  const forceStart = searchParams.get('force') === '1'
  const navigate = useNavigate()
  const timerSound = useAppStore((s) => s.settings.timerSound)
  const timerVibration = useAppStore((s) => s.settings.timerVibration)
  const keepScreenOn = useAppStore((s) => s.settings.keepScreenOn)
  const finishingRef = useRef(false)
  /** Bumped on cancel/leave-finish so in-flight persistState cannot resurrect activeWorkout. */
  const sessionEpochRef = useRef(0)
  const initGenerationRef = useRef(0)
  const checklistRef = useRef<HTMLDivElement>(null)
  const setsCountRef = useRef(5)

  const [progress, setProgress] = useState<Awaited<ReturnType<typeof getProgramProgress>>>(undefined)
  const [sessionMeta, setSessionMeta] = useState<LocalWorkoutSession | null>(null)
  /** Display-only startedAt — shifted forward by pause duration on resume so the live clock
   *  doesn't count time spent away from the workout. DB `startedAt` stays original. */
  const [displayStartedAt, setDisplayStartedAt] = useState<string | null>(null)
  const [actual, setActual] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [failedIndex, setFailedIndex] = useState<number | undefined>()
  const [initialized, setInitialized] = useState(false)
  const [initError, setInitError] = useState<string | null>(null)
  const [lastActual, setLastActual] = useState<number | undefined>()
  const [previousResults, setPreviousResults] = useState<Map<number, number>>(new Map())
  const [coachSuggestion, setCoachSuggestion] = useState<string | null>(null)
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

  const dayCompletePending =
    day != null &&
    currentSetIndex >= (day?.sets.length ?? 0) &&
    setResults.length >= (day?.sets.length ?? 0)

  useKeepScreenAwake(
    keepScreenOn &&
      initialized &&
      !initError &&
      !restBlocked &&
      !testPendingBlocked &&
      !showStaleConfirm &&
      Boolean(day && progress && (currentTarget || dayCompletePending)),
  )

  const loadPreviousActual = useCallback(
    async (setIndex: number, cycleAttempt: number, dayNumber: number) => {
      const prev = await getPreviousSetActual(program, dayNumber, cycleAttempt, setIndex + 1)
      setLastActual(prev)
    },
    [program],
  )

  /** Load previous session's set results for all sets of the current day (for delta indicators). */
  const loadAllPreviousResults = useCallback(
    async (dayNumber: number, totalSets: number, excludeSessionId?: string) => {
      const map = new Map<number, number>()
      for (let i = 1; i <= totalSets; i++) {
        const prev = await getMostRecentSetActual(program, dayNumber, i, excludeSessionId)
        if (prev !== undefined) map.set(i, prev)
      }
      setPreviousResults(map)
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
        setInitError(pl.errorProgramPaused)
        setInitialized(true)
        return
      }

      const available = isWorkoutAvailable(
        prog.nextWorkoutAfter ? new Date(prog.nextWorkoutAfter) : null,
      )
      const existingActive = await reconcileActiveWorkout(program)
      // Allow resuming an in-progress session during rest; block only new starts
      if (!available && !forceStart && !existingActive) {
        setRestBlocked(true)
        setProgress(prog)
        setInitialized(true)
        return
      }

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
        if (existingInProgress && existingInProgress.setResults.length > 0) {
          active = {
            program,
            sessionId: existingInProgress.id,
            currentSetIndex: existingInProgress.setResults.length,
            setResults: existingInProgress.setResults,
            restTimerJson: null,
            updatedAt: new Date().toISOString(),
          }
        } else if (existingInProgress) {
          await cleanupEmptyInProgressSessions(program)
        }
      }

      if (generation !== initGenerationRef.current) return

      if (active) {
        const reconciledRest = reconcileRestTimerJson(active.restTimerJson)
        let restTimer = null
        if (reconciledRest) {
          try {
            restTimer = JSON.parse(reconciledRest)
          } catch {
            restTimer = null
          }
        }

        const setsDone =
          active.currentSetIndex >= d.sets.length &&
          active.setResults.length >= d.sets.length
        if (setsDone) {
          const existing = await db.workoutSessions.get(active.sessionId)
          if (existing?.status === 'in_progress') {
            await finalizeSuccessfulDay(existing, active.setResults)
          }
          await clearActiveWorkout(program)
          navigate(`/workout/${program}/summary?session=${active.sessionId}`, { replace: true })
          return
        }

        workout.resumeSession({
          sessionId: active.sessionId,
          program,
          cycleId: prog.cycleId,
          dayNumber: prog.currentDay,
          cycleAttempt: prog.cycleAttempt,
          currentSetIndex: active.currentSetIndex,
          setResults: active.setResults,
          failedRetryUsed: active.failedRetryUsed ?? false,
          // Always show the big clock when resuming mid-rest — pill alone was easy to miss.
          restTimer:
            restTimer && restTimer.mode !== 'idle'
              ? { ...restTimer, mode: 'expanded' as const }
              : restTimer,
        })
        const existing = await db.workoutSessions.get(active.sessionId)
        if (!existing) {
          setInitError(pl.errorStartWorkout)
          setInitialized(true)
          return
        }
        session = existing
        // Shift the display clock forward by the time spent away from the workout
        // so the live elapsed timer doesn't count the pause.
        const lastActiveMs = new Date(active.updatedAt).getTime()
        const pauseMs = Number.isFinite(lastActiveMs) ? Math.max(0, Date.now() - lastActiveMs) : 0
        const prevDisplay = active.displayStartedAt
          ? new Date(active.displayStartedAt).getTime()
          : new Date(existing.startedAt).getTime()
        const nextDisplay = Number.isFinite(prevDisplay)
          ? new Date(prevDisplay + pauseMs).toISOString()
          : existing.startedAt
        setDisplayStartedAt(nextDisplay)
      } else {
        await cleanupEmptyInProgressSessions(program)

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
        setDisplayStartedAt(session.startedAt)
        workout.startSession({
          sessionId,
          program,
          cycleId: prog.cycleId,
          dayNumber: prog.currentDay,
          cycleAttempt: prog.cycleAttempt,
        })
      }

      if (generation !== initGenerationRef.current) return

      setSessionMeta(session)
      const setIdx = active?.currentSetIndex ?? 0
      setActual(getTargetReps(d.sets[setIdx]))
      await loadPreviousActual(setIdx, prog.cycleAttempt, prog.currentDay)
      void loadAllPreviousResults(prog.currentDay, d.sets.length, session.id)
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
  }, [program, navigate, forceStart, loadPreviousActual, loadAllPreviousResults])

  useEffect(() => {
    const generation = ++initGenerationRef.current
    finishingRef.current = false
    setInitialized(false)
    void initWorkout(generation)
    useWorkoutStore.getState().setImmersive(true)

    return () => {
      initGenerationRef.current += 1
      useWorkoutStore.getState().setImmersive(false)
      stopRestTimerWorker()
    }
  }, [program, forceStart, initWorkout])

  useEffect(() => {
    if (initialized && day && currentTarget) {
      void initWorkoutAudio()
    }
  }, [initialized, day, currentTarget])

  const persistState = useCallback(async () => {
    const epoch = sessionEpochRef.current
    const s = useWorkoutStore.getState()
    if (!s.sessionId || !sessionMeta || s.setResults.length === 0) return
    const snapshot = {
      sessionId: s.sessionId,
      currentSetIndex: s.currentSetIndex,
      setResults: s.setResults,
      restTimerJson: s.restTimer ? JSON.stringify(s.restTimer) : null,
      failedRetryUsed: s.failedRetryUsed,
    }
    await ensureWorkoutSessionPersisted(sessionMeta, {
      currentSetIndex: snapshot.currentSetIndex,
      setResults: snapshot.setResults,
      restTimerJson: snapshot.restTimerJson,
      failedRetryUsed: snapshot.failedRetryUsed,
      displayStartedAt: displayStartedAt,
    })
    if (
      epoch !== sessionEpochRef.current ||
      useWorkoutStore.getState().sessionId !== snapshot.sessionId
    ) {
      const still = await db.activeWorkout.get(program)
      if (still?.sessionId === snapshot.sessionId) {
        await clearActiveWorkout(program)
      }
    }
  }, [program, sessionMeta, displayStartedAt])

  useEffect(() => {
    if (!restTimer || restTimer.mode === 'idle') {
      stopRestTimerWorker()
      return
    }
    startRestTimerWorker(restTimer, wrapRestTimerCallbacks({
      getState: () => useWorkoutStore.getState().restTimer,
      onTick: (remainingSec) => {
        const current = useWorkoutStore.getState().restTimer
        if (!current) return
        useWorkoutStore.getState().setRestTimer({ ...current, remainingSec })
      },
      onComplete: () => {
        onRestComplete({ sound: timerSound, vibration: timerVibration })
        useWorkoutStore.getState().setRestTimer(skipRest())
        void persistState()
        checklistRef.current
          ?.querySelector('[data-active-set="true"]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      },
    }, { sound: timerSound, vibration: timerVibration }))
    return () => stopRestTimerWorker()
    // Restart worker only when the rest interval identity changes — not on mode (pill/expanded).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit mode
  }, [
    restTimer?.startedAt,
    restTimer?.totalSec,
    timerSound,
    timerVibration,
    persistState,
  ])

  const prevNegativeRef = useRef<number | null>(null)
  useEffect(() => {
    if (negativeCountdown === null) {
      prevNegativeRef.current = null
      return
    }
    if (prevNegativeRef.current === negativeCountdown) return
    prevNegativeRef.current = negativeCountdown
    if (negativeCountdown === 3 || negativeCountdown === 2 || negativeCountdown === 1) {
      onPrepCountdownFeedback(negativeCountdown, { sound: timerSound, vibration: timerVibration })
    } else if (negativeCountdown === 0) {
      onPrepCountdownGoFeedback({ sound: timerSound, vibration: timerVibration })
    }
  }, [negativeCountdown, timerSound, timerVibration])

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

  const discardEphemeralSession = () => {
    sessionEpochRef.current += 1
    useWorkoutStore.getState().reset()
    setSessionMeta(null)
  }

  const mutateRestTimer = (next: ReturnType<typeof skipRest>) => {
    useWorkoutStore.getState().setRestTimer(next)
    setCoachSuggestion(null)
    void persistState()
  }

  const handleEditPreviousSet = async () => {
    if (finishingRef.current || !day || !progress) return
    const workout = useWorkoutStore.getState()
    if (workout.currentSetIndex <= 0 || workout.setResults.length === 0) return

    // Stop rest worker before mutating state (undo also clears timer mode).
    if (workout.restTimer && workout.restTimer.mode !== 'idle') {
      workout.setRestTimer(skipRest())
    }

    const removed = useWorkoutStore.getState().undoLastSet()
    if (!removed) return

    setFailedIndex(undefined)
    setNegativeCountdown(null)
    negativePrepForSetRef.current = null
    setActual(removed.actual)

    const editIndex = useWorkoutStore.getState().currentSetIndex
    try {
      await persistState()
      await loadPreviousActual(editIndex, progress.cycleAttempt, progress.currentDay)
    } catch {
      setInitError(pl.errorSaveSet)
    }
  }

  const handleDone = async () => {
    const workout = useWorkoutStore.getState()
    if (!currentTarget || !day || !progress || !sessionMeta || finishingRef.current) return
    // During rest: open the big clock (ignore accidental taps while saving the previous set).
    if (workout.restTimer && workout.restTimer.mode !== 'idle') {
      if (workout.restTimer.mode !== 'expanded') {
        workout.setRestTimer({ ...workout.restTimer, mode: 'expanded' })
      }
      return
    }
    if (negativeCountdown !== null && negativeCountdown > 0) return
    finishingRef.current = true
    setNegativeCountdown(null)
    void initWorkoutAudio()

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
          void persistState()
          finishingRef.current = false
          return
        }
        const failedResults = [...workout.setResults, result]
        await ensureWorkoutSessionPersisted(sessionMeta, {
          currentSetIndex: workout.currentSetIndex,
          setResults: failedResults,
          restTimerJson: null,
          failedRetryUsed: workout.failedRetryUsed,
        })
        await finalizeFailedDay(sessionMeta.id, program, failedResults)
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

      const afterSet = useWorkoutStore.getState()
      await ensureWorkoutSessionPersisted(sessionMeta, {
        currentSetIndex: afterSet.currentSetIndex,
        setResults: afterSet.setResults,
        restTimerJson: afterSet.restTimer ? JSON.stringify(afterSet.restTimer) : null,
        failedRetryUsed: afterSet.failedRetryUsed,
      })

      if (nextSetIndex >= day.sets.length) {
        await finalizeSuccessfulDay(sessionMeta, allResults)
        workout.reset()
        navigate(`/workout/${program}/summary?session=${sessionMeta.id}`, { replace: true })
        return
      }

      // Full-screen rest clock immediately after a set (pill alone was easy to miss).
      const restSec = day.restBetweenSetsSec > 0 ? day.restBetweenSetsSec : 60
      workout.setRestTimer(createRestTimer(restSec, 'expanded'))
      setActual(getTargetReps(day.sets[nextSetIndex]))
      await persistState()
      await loadPreviousActual(nextSetIndex, progress.cycleAttempt, progress.currentDay)
      // Smart rest suggestion — compare next set target with most recent session actual
      // (regardless of cycle attempt, to show progress across cycles)
      const prevActual = await getMostRecentSetActual(program, progress.currentDay, nextSetIndex + 1)
      // If no history for this specific set+day, check if user has ANY completed
      // sessions for this program — to distinguish "first time ever" from "new day/set"
      const hasHistory = prevActual === undefined
        ? await hasAnyCompletedSessions(program, sessionMeta?.id)
        : true
      setCoachSuggestion(getSmartRestSuggestion(prevActual, getTargetReps(day.sets[nextSetIndex]), 'reps', hasHistory))
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
        <PageHeader title={pl.testPendingBlocked} subtitle={pl.cycleCompleteHint} />
        <Button className="mt-2" size="touch" fullWidth onClick={() => navigate(`/setup/test/${program}?retest=1`)}>
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
        <PageHeader
          title={pl.restBlocked(pl.restIn(daysLeft))}
          subtitle={pl.restGateHint(daysLeft)}
        />
        <Button className="mt-2" size="touch" fullWidth onClick={() => navigate(`/workout/${program}?force=1`, { replace: true })}>
          {pl.trainAnyway}
        </Button>
        <Button variant="ghost" className="mt-2" fullWidth onClick={() => navigate('/', { replace: true })}>
          {pl.backHome}
        </Button>
      </div>
    )
  }

  if (dayCompletePending) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader message={pl.loading} />
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

  const isResting = restTimer !== null && restTimer.mode !== 'idle'
  const nextLabel = getRestNextSetLabel(
    currentSetIndex,
    day.sets,
    unit,
    isResting,
    previousResults.get(currentSetIndex + 1),
  )

  const hasSessionProgress = setResults.length > 0

  return (
    <ActiveWorkoutScreen
      program={program}
      progress={{ currentDay: progress.currentDay, cycleAttempt: progress.cycleAttempt }}
      day={day}
      cycleVariant={cycle?.variant}
      currentSetIndex={currentSetIndex}
      setResults={setResults}
      restTimer={restTimer}
      coachSuggestion={coachSuggestion}
      actual={actual}
      lastActual={lastActual}
      previousResults={previousResults}
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
      sessionHasProgress={hasSessionProgress}
      sessionStartedAt={displayStartedAt}
      onBack={() => {
        if (!hasSessionProgress) {
          discardEphemeralSession()
          navigate('/', { replace: true })
          return
        }
        setShowLeaveConfirm(true)
      }}
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
      canEditPreviousSet={setResults.length > 0 && currentSetIndex > 0}
      onEditPreviousSet={() => void handleEditPreviousSet()}
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
          const failedResults = [...workout.setResults, failedResult]
          await ensureWorkoutSessionPersisted(sessionMeta, {
            currentSetIndex: workout.currentSetIndex,
            setResults: failedResults,
            restTimerJson: null,
            failedRetryUsed: workout.failedRetryUsed,
          })
          await finalizeFailedDay(sessionMeta.id, program, failedResults)
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
        if (t) mutateRestTimer(addRestTime(t, 15))
      }}
      onAddRest30={() => {
        const t = useWorkoutStore.getState().restTimer
        if (t) mutateRestTimer(addRestTime(t, 30))
      }}
      onSetRest={(sec) => {
        const t = useWorkoutStore.getState().restTimer
        if (t) mutateRestTimer({ ...t, totalSec: sec, remainingSec: sec, startedAt: Date.now() })
      }}
      onSkipRest={() => {
        mutateRestTimer(skipRest())
      }}
      onCollapseTimer={() => {
        const t = useWorkoutStore.getState().restTimer
        if (t && t.mode !== 'idle') {
          useWorkoutStore.getState().setRestTimer({ ...t, mode: 'pill' })
        }
      }}
      onConfirmCancel={() => void (async () => {
        finishingRef.current = true
        sessionEpochRef.current += 1
        setShowCancelConfirm(false)
        try {
          if (hasSessionProgress && sessionMeta) {
            await abandonWorkoutSession(program, sessionMeta.id)
          }
          useWorkoutStore.getState().reset()
          setSessionMeta(null)
          navigate('/', { replace: true })
        } catch {
          finishingRef.current = false
          setInitError(pl.errorSaveSet)
        }
      })()}
      onDismissCancel={() => setShowCancelConfirm(false)}
      onConfirmLeave={() => {
        setShowLeaveConfirm(false)
        if (!hasSessionProgress) {
          discardEphemeralSession()
          navigate('/', { replace: true })
          return
        }
        void persistState().finally(() => navigate('/', { replace: true }))
      }}
      onDismissLeave={() => setShowLeaveConfirm(false)}
      onClosePlan={() => setShowPlanSheet(false)}
      onCloseMenu={() => setShowMenu(false)}
    />
  )
}
