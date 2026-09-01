import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { BrandLoader } from '@/components/ui/BrandLoader'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBanner } from '@/components/ux/Feedback'
import { ActiveCustomWorkoutScreen } from '@/components/workout/ActiveCustomWorkoutScreen'
import { ExerciseDetailSheet } from '@/components/plans/ExerciseDetailSheet'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import type { CustomPlan, ExerciseDefinition, SetActual, SetLog } from '@/lib/exercise-model'
import { validateSetLog } from '@/lib/exercise-model'
import {
  formatPrescriptionSetLabel,
  formatPrescriptionTarget,
} from '@/lib/custom-prescription-format'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'
import {
  abandonCustomWorkout,
  appendFailedSetLog,
  createCustomSession,
  customSessionHasProgress,
  finalizeCustomDay,
  getPreviousCustomSetActual,
  persistCustomActive,
  reconcileActiveCustomWorkout,
} from '@/lib/custom-session-service'
import { getOrCreateCustomProgress } from '@/lib/custom-plan-service'
import {
  initWorkoutAudio,
  onRestComplete,
  onSetCompleteFeedback,
  onSetFailedFeedback,
  playDurationGoalTick,
} from '@/lib/workout-feedback'
import { daysUntilWorkout } from '@/lib/progress-engine'
import {
  createRestTimer,
  skipRest,
  startRestTimerWorker,
  stopRestTimerWorker,
  requestWakeLock,
  releaseWakeLock,
  type RestTimerState,
} from '@/lib/rest-timer'
import { isStaleActiveWorkout } from '@/lib/sync'
import { useAppStore } from '@/stores/app-store'
import { useCustomWorkoutStore } from '@/stores/custom-workout-store'

function parseRestTimerJson(json: string | null): RestTimerState | null {
  if (!json) return null
  try {
    const parsed = JSON.parse(json) as RestTimerState
    if (parsed.mode !== 'idle') return { ...parsed, mode: 'expanded' }
    return parsed
  } catch {
    return null
  }
}

export default function CustomWorkoutPage() {
  const { planId } = useParams<{ planId: string }>()
  const [searchParams] = useSearchParams()
  const forceStart = searchParams.get('force') === '1'
  const navigate = useNavigate()
  const timerSound = useAppStore((s) => s.settings.timerSound)
  const timerVibration = useAppStore((s) => s.settings.timerVibration)
  const keepScreenOn = useAppStore((s) => s.settings.keepScreenOn)
  const hasSeenWorkoutHint = useAppStore((s) => s.settings.hasSeenWorkoutHint)
  const setSettings = useAppStore((s) => s.setSettings)

  const store = useCustomWorkoutStore()
  const [plan, setPlan] = useState<CustomPlan | null>(null)
  const [exercises, setExercises] = useState<Map<string, ExerciseDefinition>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [restBlocked, setRestBlocked] = useState(false)
  const [restDaysLeft, setRestDaysLeft] = useState(0)
  const [showStaleConfirm, setShowStaleConfirm] = useState(false)
  const [staleResume, setStaleResume] = useState<{
    day: number
    exerciseIndex: number
    set: number
    totalSets: number
  } | null>(null)
  const [actualReps, setActualReps] = useState(0)
  const [actualSec, setActualSec] = useState(0)
  const [weightKg, setWeightKg] = useState<number | ''>('')
  const [timerRunning, setTimerRunning] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [showPlanSheet, setShowPlanSheet] = useState(false)
  const [detailExercise, setDetailExercise] = useState<ExerciseDefinition | null>(null)
  const [lastActual, setLastActual] = useState<number | undefined>()
  const [pulseFlash, setPulseFlash] = useState(false)
  const [failedIndex, setFailedIndex] = useState<number | undefined>()
  const [saveError, setSaveError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const sessionRef = useRef<Awaited<ReturnType<typeof createCustomSession>> | null>(null)
  const finishingRef = useRef(false)
  const initGenerationRef = useRef(0)
  const sessionEpochRef = useRef(0)
  const staleConfirmedRef = useRef(false)
  const checklistRef = useRef<HTMLDivElement>(null)

  const day = useMemo(() => {
    if (!plan) return null
    return plan.days.find((d) => d.dayNumber === store.dayNumber) ?? plan.days[0] ?? null
  }, [plan, store.dayNumber])

  const planned = day?.exercises[store.currentExerciseIndex]
  const exDef = planned ? exercises.get(planned.exerciseId) : undefined
  const displaySetIndex = planned
    ? Math.min(store.currentSetIndex, Math.max(0, planned.sets.length - 1))
    : 0
  const prescription = planned?.sets[displaySetIndex]
  const restTimer = store.restTimer
  const currentLog = store.exerciseLogs[store.currentExerciseIndex]
  const setResults = currentLog?.sets ?? []

  const loadPreviousActual = useCallback(
    async (
      customPlanId: string,
      dayNumber: number,
      cycleAttempt: number,
      exerciseId: string,
      setNumber: number,
    ) => {
      const prev = await getPreviousCustomSetActual({
        customPlanId,
        dayNumber,
        cycleAttempt,
        exerciseId,
        setNumber,
      })
      setLastActual(prev)
    },
    [],
  )

  const persistState = useCallback(async () => {
    const epoch = sessionEpochRef.current
    const latest = useCustomWorkoutStore.getState()
    if (!sessionRef.current || !customSessionHasProgress(latest.exerciseLogs)) return
    await persistCustomActive(sessionRef.current, {
      currentExerciseIndex: latest.currentExerciseIndex,
      currentSetIndex: latest.currentSetIndex,
      exerciseLogs: latest.exerciseLogs,
      restTimerJson: latest.restTimer ? JSON.stringify(latest.restTimer) : null,
    })
    if (epoch !== sessionEpochRef.current) return
  }, [])

  const initWorkout = useCallback(
    async (generation: number) => {
      if (!planId) return
      setLoadError(null)
      setRestBlocked(false)

      const p = await db.customPlans.get(planId)
      if (generation !== initGenerationRef.current) return
      if (!p || p.status !== 'active') {
        navigate('/plans?tab=mine', { replace: true })
        return
      }

      const exs = await db.exercises.toArray()
      const exMap = new Map(exs.map((e) => [e.id, e]))
      if (generation !== initGenerationRef.current) return
      setExercises(exMap)

      const progress = await getOrCreateCustomProgress(planId)
      if (generation !== initGenerationRef.current) return

      const activeEarly = await reconcileActiveCustomWorkout(planId)
      if (generation !== initGenerationRef.current) return
      const activeSession = activeEarly
        ? await db.workoutSessions.get(activeEarly.sessionId)
        : null
      const hasResume = activeSession?.status === 'in_progress'

      if (progress.status === 'paused' && !forceStart && !hasResume) {
        setLoadError(pl.errorProgramPaused)
        setPlan(p)
        setLoading(false)
        return
      }

      if (progress.status === 'rest' && progress.nextWorkoutAfter && !forceStart && !hasResume) {
        const until = new Date(progress.nextWorkoutAfter).getTime()
        if (until > Date.now()) {
          setRestDaysLeft(
            daysUntilWorkout(new Date(progress.nextWorkoutAfter)),
          )
          setRestBlocked(true)
          setPlan(p)
          setLoading(false)
          return
        }
      }

      const active = activeEarly
      if (generation !== initGenerationRef.current) return

      if (active && !forceStart) {
        const session = activeSession
        if (session && session.status === 'in_progress') {
          if (
            isStaleActiveWorkout(active.updatedAt) &&
            !staleConfirmedRef.current
          ) {
            setStaleResume({
              day: session.dayNumber,
              exerciseIndex: active.currentExerciseIndex,
              set: active.currentSetIndex + 1,
              totalSets:
                p.days.find((d) => d.dayNumber === session.dayNumber)?.exercises[
                  active.currentExerciseIndex
                ]?.sets.length ?? 1,
            })
            setPlan(p)
            setShowStaleConfirm(true)
            setLoading(false)
            return
          }

          sessionRef.current = session
          useCustomWorkoutStore.getState().resumeSession({
            sessionId: session.id,
            customPlanId: planId,
            dayNumber: session.dayNumber,
            cycleAttempt: session.cycleAttempt,
            currentExerciseIndex: active.currentExerciseIndex,
            currentSetIndex: active.currentSetIndex,
            exerciseLogs: active.exerciseLogs,
            restTimer: parseRestTimerJson(active.restTimerJson),
          })
          setPlan(p)
          if (!hasSeenWorkoutHint) {
            setShowHint(true)
            setSettings({ hasSeenWorkoutHint: true })
          }
          setLoading(false)
          return
        }
      }

      if (forceStart && active) {
        await abandonCustomWorkout(planId, active.sessionId)
      }

      const dayNumber = progress.status === 'cycle_complete' ? 1 : progress.currentDay
      const dayPlan = p.days.find((d) => d.dayNumber === dayNumber) ?? p.days[0]
      if (!dayPlan || dayPlan.exercises.length === 0) {
        setLoadError(pl.customWorkoutMissingDay)
        setLoading(false)
        return
      }
      const missing = dayPlan.exercises.find((e) => {
        const def = exMap.get(e.exerciseId)
        return !def || def.archived
      })
      if (missing) {
        setLoadError(pl.customWorkoutMissingExercise)
        setLoading(false)
        return
      }

      const cycleAttempt =
        progress.status === 'cycle_complete' ? progress.cycleAttempt + 1 : progress.cycleAttempt
      const session = await createCustomSession({
        plan: p,
        dayNumber,
        cycleAttempt,
      })
      if (generation !== initGenerationRef.current) return

      sessionRef.current = session
      const initialLogs = dayPlan.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        order: e.order,
        sets: [] as SetLog[],
      }))
      useCustomWorkoutStore.getState().startSession({
        sessionId: session.id,
        customPlanId: planId,
        dayNumber,
        cycleAttempt,
        exerciseCount: dayPlan.exercises.length,
      })
      useCustomWorkoutStore.setState({ exerciseLogs: initialLogs })
      setPlan(p)
      if (!hasSeenWorkoutHint) {
        setShowHint(true)
        setSettings({ hasSeenWorkoutHint: true })
      }
      setLoading(false)
    },
    [planId, forceStart, navigate, hasSeenWorkoutHint, setSettings],
  )

  useEffect(() => {
    const generation = ++initGenerationRef.current
    finishingRef.current = false
    setLoading(true)
    void initWorkout(generation)
    useCustomWorkoutStore.getState().setImmersive(true)

    return () => {
      initGenerationRef.current += 1
      useCustomWorkoutStore.getState().setImmersive(false)
      stopRestTimerWorker()
      releaseWakeLock()
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [planId, forceStart, initWorkout])

  useEffect(() => {
    if (!prescription || !exDef || !plan || !planned) return
    setTimerRunning(false)
    setFailedIndex(undefined)
    if (exDef.primaryMetric === 'duration_sec' && prescription.durationSec) {
      setActualSec(metricTargetDisplayValue(prescription.durationSec))
    } else if (prescription.reps) {
      setActualReps(metricTargetDisplayValue(prescription.reps))
    }
    if (exDef.primaryMetric === 'reps_weight' && prescription.weightKg) {
      setWeightKg(metricTargetDisplayValue(prescription.weightKg))
    } else {
      setWeightKg('')
    }
    void loadPreviousActual(
      plan.id,
      store.dayNumber,
      store.cycleAttempt,
      planned.exerciseId,
      displaySetIndex + 1,
    )
  }, [
    prescription,
    exDef,
    plan,
    planned,
    displaySetIndex,
    store.dayNumber,
    store.cycleAttempt,
    loadPreviousActual,
  ])

  useEffect(() => {
    if (!restTimer || restTimer.mode === 'idle') {
      stopRestTimerWorker()
      void releaseWakeLock()
      return
    }
    startRestTimerWorker(restTimer, {
      getState: () => useCustomWorkoutStore.getState().restTimer,
      onTick: (remainingSec) => {
        const current = useCustomWorkoutStore.getState().restTimer
        if (!current) return
        useCustomWorkoutStore.getState().setRestTimer({ ...current, remainingSec })
      },
      onComplete: () => {
        onRestComplete({ sound: timerSound, vibration: timerVibration })
        useCustomWorkoutStore.getState().setRestTimer(skipRest())
        releaseWakeLock()
        checklistRef.current
          ?.querySelector('[data-active-set="true"]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      },
    })
    return () => stopRestTimerWorker()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart on rest identity only
  }, [restTimer?.startedAt, restTimer?.totalSec, timerSound, timerVibration])

  useEffect(() => {
    if (!restTimer || restTimer.mode === 'idle') {
      void releaseWakeLock()
      return
    }
    if (keepScreenOn) void requestWakeLock()
    else void releaseWakeLock()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- wake lock only
  }, [restTimer?.startedAt, restTimer?.mode, keepScreenOn])

  useEffect(() => {
    if (!timerRunning) return
    timerRef.current = window.setInterval(() => {
      setActualSec((s) => {
        const next = s + 1
        if (
          prescription?.durationSec &&
          next === metricTargetDisplayValue(prescription.durationSec)
        ) {
          playDurationGoalTick()
        }
        return next
      })
    }, 1000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [timerRunning, prescription])

  function scrollChecklistToActive() {
    window.requestAnimationFrame(() => {
      const el = checklistRef.current?.querySelector('[data-active-set="true"]')
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }

  function buildNextLabel(nextExerciseIndex: number, nextSetIndex: number): string {
    if (!day) return ''
    const nextPlanned = day.exercises[nextExerciseIndex]
    if (!nextPlanned) return ''
    const nextDef = exercises.get(nextPlanned.exerciseId)
    const nextPrescription = nextPlanned.sets[nextSetIndex]
    if (!nextDef || !nextPrescription) return ''
    const label = formatPrescriptionTarget(nextPrescription, nextDef.primaryMetric)
    if (nextExerciseIndex !== store.currentExerciseIndex) {
      return pl.customNextSet(nextSetIndex + 1, `${nextDef.name} · ${label}`)
    }
    return pl.customNextSet(
      nextSetIndex + 1,
      formatPrescriptionSetLabel(nextPrescription, nextDef.primaryMetric, nextDef.name),
    )
  }

  const isResting = restTimer !== null && restTimer.mode !== 'idle'
  const nextLabel = useMemo(() => {
    if (!isResting || !day || !planned) return ''
    const setsInExercise = planned.sets.length
    if (store.currentSetIndex + 1 < setsInExercise) {
      return buildNextLabel(store.currentExerciseIndex, store.currentSetIndex + 1)
    }
    if (store.currentExerciseIndex + 1 < day.exercises.length) {
      return buildNextLabel(store.currentExerciseIndex + 1, 0)
    }
    return ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, planned, store.currentExerciseIndex, store.currentSetIndex, exercises, isResting])

  async function finalizeFailedDay(result: SetLog) {
    if (!plan || !sessionRef.current || !planned) return
    const latest = useCustomWorkoutStore.getState()
    const logs = appendFailedSetLog(
      latest.exerciseLogs,
      latest.currentExerciseIndex,
      planned.exerciseId,
      planned.order,
      result,
    )
    useCustomWorkoutStore.setState({ exerciseLogs: logs })
    await persistCustomActive(sessionRef.current, {
      currentExerciseIndex: latest.currentExerciseIndex,
      currentSetIndex: latest.currentSetIndex,
      exerciseLogs: logs,
      restTimerJson: null,
    })
    await finalizeCustomDay({
      session: sessionRef.current,
      plan,
      exerciseLogs: logs,
      passed: false,
    })
    store.reset()
    navigate(`/workout/custom/${plan.id}/summary?failed=1&session=${sessionRef.current.id}`, {
      replace: true,
    })
  }

  async function handleDone() {
    if (!plan || !day || !planned || !prescription || !exDef || !sessionRef.current) return
    if (finishingRef.current) return

    const workout = useCustomWorkoutStore.getState()
    if (workout.restTimer && workout.restTimer.mode !== 'idle') {
      if (workout.restTimer.mode !== 'expanded') {
        store.setRestTimer({ ...workout.restTimer, mode: 'expanded' })
      }
      return
    }

    finishingRef.current = true
    void initWorkoutAudio()
    setTimerRunning(false)
    setSaveError(null)

    const actual: SetActual =
      exDef.primaryMetric === 'duration_sec'
        ? { durationSec: actualSec }
        : {
            reps: actualReps,
            weightKg:
              exDef.primaryMetric === 'reps_weight'
                ? weightKg === ''
                  ? null
                  : Number(weightKg)
                : undefined,
          }

    const passed = validateSetLog(prescription, actual, exDef.primaryMetric)
    const result: SetLog = {
      setNumber: store.currentSetIndex + 1,
      actual,
      passed,
      prescription,
    }

    try {
      if (!passed) {
        onSetFailedFeedback()
        setFailedIndex(store.currentSetIndex)
        if (!store.failedRetryUsed) {
          store.setFailedRetryUsed(true)
          finishingRef.current = false
          return
        }
        await finalizeFailedDay(result)
        return
      }

      onSetCompleteFeedback()
      setFailedIndex(undefined)
      setPulseFlash(true)
      window.setTimeout(() => setPulseFlash(false), 450)

      store.completeSet(planned.exerciseId, planned.order, result)
      const after = useCustomWorkoutStore.getState()

      const nextSet = after.currentSetIndex
      const setsInExercise = planned.sets.length
      let nextEx = after.currentExerciseIndex

      if (nextSet >= setsInExercise) {
        nextEx += 1
        if (nextEx < day.exercises.length) {
          store.setPointers(nextEx, 0)
          const restSec = planned.restAfterExerciseSec ?? planned.restBetweenSetsSec
          if (restSec > 0) {
            store.setRestTimer(createRestTimer(restSec, 'expanded'))
          }
        }
      } else if (planned.restBetweenSetsSec > 0) {
        store.setRestTimer(createRestTimer(planned.restBetweenSetsSec, 'expanded'))
      }

      const latest = useCustomWorkoutStore.getState()
      await persistCustomActive(sessionRef.current, {
        currentExerciseIndex: latest.currentExerciseIndex,
        currentSetIndex: latest.currentSetIndex,
        exerciseLogs: latest.exerciseLogs,
        restTimerJson: latest.restTimer ? JSON.stringify(latest.restTimer) : null,
      })

      if (nextEx >= day.exercises.length && nextSet >= setsInExercise) {
        await finalizeCustomDay({
          session: sessionRef.current,
          plan,
          exerciseLogs: latest.exerciseLogs,
          passed: true,
        })
        store.reset()
        navigate(`/workout/custom/${plan.id}/summary?session=${sessionRef.current.id}`, {
          replace: true,
        })
        return
      }

      scrollChecklistToActive()
    } catch {
      setSaveError(pl.errorSaveSet)
    } finally {
      finishingRef.current = false
    }
  }

  function buildCurrentFailResult(): SetLog | null {
    if (!planned || !prescription || !exDef) return null
    const actual: SetActual =
      exDef.primaryMetric === 'duration_sec'
        ? { durationSec: actualSec }
        : {
            reps: actualReps,
            weightKg:
              exDef.primaryMetric === 'reps_weight'
                ? weightKg === ''
                  ? null
                  : Number(weightKg)
                : undefined,
          }
    return {
      setNumber: store.currentSetIndex + 1,
      actual,
      passed: false,
      prescription,
    }
  }

  async function confirmLeave() {
    setLeaveOpen(false)
    await persistState()
    store.reset()
    navigate('/plans?tab=mine')
  }

  function discardEphemeralSession() {
    sessionEpochRef.current += 1
    store.reset()
    sessionRef.current = null
  }

  async function confirmCancel() {
    setCancelOpen(false)
    setShowMenu(false)
    sessionEpochRef.current += 1
    if (sessionRef.current && planId) {
      if (customSessionHasProgress(store.exerciseLogs)) {
        await abandonCustomWorkout(planId, sessionRef.current.id)
      }
    }
    discardEphemeralSession()
    navigate('/plans?tab=mine', { replace: true })
  }

  function handleEditPreviousSet() {
    const removed = store.undoLastSet()
    if (!removed) return
    setFailedIndex(undefined)
    if (exDef?.primaryMetric === 'duration_sec') {
      setActualSec(removed.actual.durationSec ?? 0)
    } else {
      setActualReps(removed.actual.reps ?? 0)
      if (removed.actual.weightKg != null) setWeightKg(removed.actual.weightKg)
    }
    void persistState()
  }

  function mutateRestTimer(next: RestTimerState) {
    store.setRestTimer(next)
    void persistState()
  }

  function addRest(sec: number) {
    const current = useCustomWorkoutStore.getState().restTimer
    if (!current || current.mode === 'idle') return
    mutateRestTimer({
      ...current,
      totalSec: current.totalSec + sec,
      remainingSec: current.remainingSec + sec,
    })
  }

  if (loadError) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-[var(--sr-text-secondary)]">{loadError}</p>
        <Button type="button" onClick={() => navigate('/plans?tab=mine')}>
          {pl.myPlansTitle}
        </Button>
      </div>
    )
  }

  if (showStaleConfirm && staleResume && planId) {
    return (
      <ConfirmSheet
        title={pl.staleSessionTitle}
        message={pl.staleSessionConfirm}
        confirmLabel={pl.continueWorkout(
          staleResume.day,
          staleResume.set,
          staleResume.totalSets,
        )}
        cancelLabel={pl.startFresh}
        onConfirm={() => {
          staleConfirmedRef.current = true
          setShowStaleConfirm(false)
          const generation = ++initGenerationRef.current
          setLoading(true)
          void initWorkout(generation)
        }}
        onCancel={async () => {
          if (planId) {
            const active = await reconcileActiveCustomWorkout(planId)
            if (active) await abandonCustomWorkout(planId, active.sessionId)
          }
          discardEphemeralSession()
          navigate('/plans?tab=mine', { replace: true })
        }}
      />
    )
  }

  if (restBlocked && plan) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
        <PageHeader
          title={pl.restBlocked(pl.restIn(restDaysLeft))}
          subtitle={pl.restGateHint(restDaysLeft)}
        />
        <Button
          className="mt-2"
          size="touch"
          fullWidth
          onClick={() => navigate(`/workout/custom/${plan.id}?force=1`, { replace: true })}
        >
          {pl.trainAnyway}
        </Button>
        <Button
          variant="ghost"
          className="mt-2"
          fullWidth
          onClick={() => navigate('/plans?tab=mine', { replace: true })}
        >
          {pl.myPlansTitle}
        </Button>
      </div>
    )
  }

  if (loading || !plan || !day || !planned || !exDef || !prescription) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <BrandLoader size={44} />
      </div>
    )
  }

  const isDuration = exDef.primaryMetric === 'duration_sec'
  const actual = isDuration ? actualSec : actualReps
  const sessionHasProgress = customSessionHasProgress(store.exerciseLogs)
  const canEditPreviousSet =
    setResults.length > 0 &&
    store.currentSetIndex === setResults.length &&
    failedIndex !== store.currentSetIndex &&
    !(restTimer && restTimer.mode !== 'idle')
  const failedRetryVisible = failedIndex === store.currentSetIndex

  return (
    <>
      {saveError && (
        <div className="mx-auto max-w-lg px-4 pt-4 safe-top">
          <ErrorBanner message={saveError} onRetry={() => setSaveError(null)} />
        </div>
      )}
      <ActiveCustomWorkoutScreen
        planName={plan.name}
        dayNumber={store.dayNumber}
        cycleAttempt={store.cycleAttempt}
        exerciseIndex={store.currentExerciseIndex}
        exerciseTotal={day.exercises.length}
        setIndex={displaySetIndex}
        planned={planned}
        dayExercises={day.exercises}
        exerciseDef={exDef}
        exerciseDefs={exercises}
        exerciseLogs={store.exerciseLogs}
        setResults={setResults}
        restTimer={restTimer}
        actual={actual}
        lastActual={lastActual}
        failedIndex={failedIndex}
        showHint={showHint}
        showMenu={showMenu}
        showCancelConfirm={cancelOpen}
        showLeaveConfirm={leaveOpen}
        showPlanSheet={showPlanSheet}
        failedRetryVisible={failedRetryVisible}
        pulseFlash={pulseFlash}
        nextLabel={nextLabel}
        checklistRef={checklistRef}
        sessionHasProgress={sessionHasProgress}
        weightKg={weightKg}
        timerRunning={timerRunning}
        canEditPreviousSet={canEditPreviousSet}
        onBack={() => {
          if (!sessionHasProgress) {
            discardEphemeralSession()
            navigate('/plans?tab=mine', { replace: true })
            return
          }
          setLeaveOpen(true)
        }}
        onToggleMenu={() => setShowMenu((v) => !v)}
        onShowPlan={() => {
          setShowMenu(false)
          setShowPlanSheet(true)
        }}
        onRequestCancel={() => {
          setShowMenu(false)
          setCancelOpen(true)
        }}
        onDismissHint={() => setShowHint(false)}
        onActualChange={(n) => {
          if (isDuration) setActualSec(n)
          else setActualReps(n)
        }}
        onWeightChange={setWeightKg}
        onToggleTimer={() => {
          void initWorkoutAudio()
          setTimerRunning((v) => {
            if (!v && prescription.durationSec && actualSec === metricTargetDisplayValue(prescription.durationSec)) {
              setActualSec(0)
            }
            return !v
          })
        }}
        onDone={() => void handleDone()}
        onEditPreviousSet={handleEditPreviousSet}
        onRetry={() => setFailedIndex(undefined)}
        onFinishDayEarly={() => {
          const failResult = buildCurrentFailResult()
          if (failResult) void finalizeFailedDay(failResult)
        }}
        onExpandTimer={() => {
          if (restTimer) mutateRestTimer({ ...restTimer, mode: 'expanded' })
        }}
        onAddRest15={() => addRest(15)}
        onAddRest30={() => addRest(30)}
        onSkipRest={() => mutateRestTimer(skipRest())}
        onCollapseTimer={() => {
          if (restTimer) mutateRestTimer({ ...restTimer, mode: 'pill' })
        }}
        onConfirmCancel={() => void confirmCancel()}
        onDismissCancel={() => setCancelOpen(false)}
        onConfirmLeave={() => void confirmLeave()}
        onDismissLeave={() => setLeaveOpen(false)}
        onClosePlan={() => setShowPlanSheet(false)}
        onCloseMenu={() => setShowMenu(false)}
        onExerciseStats={() => setDetailExercise(exDef)}
        onExerciseStatsById={(exerciseId) => {
          const def = exercises.get(exerciseId)
          if (def) setDetailExercise(def)
        }}
      />
      <ExerciseDetailSheet
        open={detailExercise != null}
        exercise={detailExercise}
        elevated
        showProgressLink={false}
        onClose={() => setDetailExercise(null)}
      />
    </>
  )
}
