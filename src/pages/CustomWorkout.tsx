import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBanner, PageLoader } from '@/components/ux/Feedback'
import { ActiveCustomWorkoutScreen } from '@/components/workout/ActiveCustomWorkoutScreen'
import { ExerciseDetailSheet } from '@/components/plans/ExerciseDetailSheet'
import { ExerciseLibraryPanel } from '@/components/plans/ExerciseLibraryPanel'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { pl } from '@/i18n/pl'
import { db } from '@/lib/db'
import type { CustomPlan, ExerciseDefinition, SetActual, SetLog } from '@/lib/exercise-model'
import { validateSetLog } from '@/lib/exercise-model'
import { suggestSubstitutes } from '@/lib/exercise-substitution'
import { FOCUS_RING } from '@/lib/ui-chrome'
import {
  formatPrescriptionSetLabel,
} from '@/lib/custom-prescription-format'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'
import {
  abandonCustomWorkout,
  createCustomSession,
  customSessionHasProgress,
  finalizeCustomDay,
  getLastExerciseLogs,
  getPreviousCustomSetResult,
  getPreviousCustomSetActual,
  hasAnyCompletedCustomSessions,
  persistCustomActive,
  reconcileActiveCustomWorkout,
  type PreviousCustomSetResult,
} from '@/lib/custom-session-service'
import {
  canAddSetToExercise,
  canRemoveSetFromExercise,
  addSetToPlanExercise,
  removeSetFromPlanExercise,
  applyDayOverrideToPlan,
  captureBaselineSetCounts,
  captureBaselineRests,
  baselineSetCountForExercise,
  sessionDayIsDirty,
  sessionHasExerciseSwaps,
  setRestBetweenSetsOnExercise,
  swapExerciseInSessionDay,
  addExerciseToSessionDay,
} from '@/lib/custom-plan-session-patch'
import { getOrCreateCustomProgress, saveCustomPlan } from '@/lib/custom-plan-service'
import {
  filterValidDayExercises,
  findFirstMissingExercise,
  replaceExerciseInDay,
  type CustomLoadErrorKind,
} from '@/lib/custom-plan-edit-lock'
import {
  getNextWorkoutPosition,
  getPrescriptionForPosition,
  getPrescriptionSetIndex,
  getGroupForExercise,
  shouldStartAmrap,
} from '@/lib/custom-workout-nav'
import { getSmartRestSuggestion } from '@/lib/ai/proactive-coach'
import {
  canJumpToExercise,
  findNextIncompletePosition,
  getChecklistSlots,
  isExerciseIncomplete,
  reconcileCustomWorkoutResume,
  resumeSetIndexForExercise,
  staleResumeTotalSets,
  canUndoCustomSet,
} from '@/lib/custom-workout-progress'
import { reconcileRestTimerJson } from '@/lib/rest-timer-sync'
import {
  initWorkoutAudio,
  onAmrapBlockEndFeedback,
  onRestComplete,
  onSetCompleteFeedback,
  onSetFailedFeedback,
  playDurationGoalTick,
  wrapRestTimerCallbacks,
} from '@/lib/workout-feedback'
import { daysUntilWorkout } from '@/lib/progress-engine'
import {
  createRestTimer,
  skipRest,
  startRestTimerWorker,
  stopRestTimerWorker,
  type RestTimerState,
} from '@/lib/rest-timer'
import { useKeepScreenAwake } from '@/hooks/useKeepScreenAwake'
import { isStaleActiveWorkout } from '@/lib/sync'
import { useAppStore } from '@/stores/app-store'
import { useCustomWorkoutStore } from '@/stores/custom-workout-store'
import { takePendingDayOverride, takePendingDayNumber } from '@/lib/pending-day-override'

function parseRestTimerJson(json: string | null): RestTimerState | null {
  const reconciled = reconcileRestTimerJson(json)
  if (!reconciled) return null
  try {
    const parsed = JSON.parse(reconciled) as RestTimerState
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
  const weightUnit = useAppStore((s) => s.settings.weightUnit)

  const store = useCustomWorkoutStore()
  const [plan, setPlan] = useState<CustomPlan | null>(null)
  const planRef = useRef<CustomPlan | null>(null)
  /** Saved plan without session-only day overrides — used for progression / restAfterDay. */
  const basePlanRef = useRef<CustomPlan | null>(null)
  const [exercises, setExercises] = useState<Map<string, ExerciseDefinition>>(new Map())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadErrorKind, setLoadErrorKind] = useState<CustomLoadErrorKind | null>(null)
  const [loadErrorDayNumber, setLoadErrorDayNumber] = useState<number | null>(null)
  const [missingExerciseId, setMissingExerciseId] = useState<string | null>(null)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [swapOpen, setSwapOpen] = useState(false)
  const [swapConfirm, setSwapConfirm] = useState<ExerciseDefinition | null>(null)
  const [addExerciseOpen, setAddExerciseOpen] = useState(false)
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
  const [previousResult, setPreviousResult] = useState<PreviousCustomSetResult | undefined>()
  const [previousResults, setPreviousResults] = useState<Map<number, { reps?: number; durationSec?: number; weightKg?: number }>>(new Map())
  const [coachSuggestion, setCoachSuggestion] = useState<string | null>(null)
  const [pulseFlash, setPulseFlash] = useState(false)
  const [failedIndex, setFailedIndex] = useState<number | undefined>()
  const [saveError, setSaveError] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const sessionRef = useRef<Awaited<ReturnType<typeof createCustomSession>> | null>(null)
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null)
  const finishingRef = useRef(false)
  const sessionPlanDirtyRef = useRef(false)
  const [baselineSets, setBaselineSets] = useState<Record<string, number>>({})
  const [baselineRests, setBaselineRests] = useState<Record<string, number>>({})
  const initGenerationRef = useRef(0)
  const sessionEpochRef = useRef(0)
  const staleConfirmedRef = useRef(false)
  const checklistRef = useRef<HTMLDivElement>(null)
  const amrapEndFiredRef = useRef(false)
  /** Blocks the prescription-reset effect for one iteration after editing a previous set,
   *  so the restored actual values aren't immediately overwritten by target defaults. */
  const skipNextResetRef = useRef(false)

  const day = useMemo(() => {
    if (!plan) return null
    return plan.days.find((d) => d.dayNumber === store.dayNumber) ?? plan.days[0] ?? null
  }, [plan, store.dayNumber])

  useEffect(() => {
    planRef.current = plan
  }, [plan])

  const setPlanLive = useCallback((next: CustomPlan | null) => {
    planRef.current = next
    setPlan(next)
  }, [])

  const planned = day?.exercises[store.currentExerciseIndex]
  const exDef = planned ? exercises.get(planned.exerciseId) : undefined
  const allExerciseDefs = useMemo(() => Array.from(exercises.values()), [exercises])
  const swapSuggestions = useMemo(() => {
    if (!exDef) return []
    return suggestSubstitutes(allExerciseDefs, exDef.id, 5)
  }, [exDef, allExerciseDefs])
  const displaySetIndex =
    day && planned
      ? getPrescriptionSetIndex(day, store.currentExerciseIndex, store.currentSetIndex)
      : 0
  const prescription =
    day && planned
      ? getPrescriptionForPosition(day, store.currentExerciseIndex, store.currentSetIndex)
      : undefined
  const restTimer = store.restTimer
  const currentLog = store.exerciseLogs[store.currentExerciseIndex]
  const setResults = currentLog?.sets ?? []

  useKeepScreenAwake(
    keepScreenOn &&
      !loading &&
      !loadError &&
      !restBlocked &&
      !showStaleConfirm &&
      Boolean(plan && day && planned && exDef && prescription),
  )

  const checklistSets = useMemo(() => {
    if (!day) return []
    return getChecklistSlots(day, store.currentExerciseIndex, setResults.length)
  }, [day, store.currentExerciseIndex, setResults.length])

  const loadPreviousActual = useCallback(
    async (
      customPlanId: string,
      currentDayNumber: number,
      currentCycleAttempt: number,
      exerciseId: string,
      setNumber: number,
      excludeSessionId?: string,
    ) => {
      const prev = await getPreviousCustomSetResult({
        customPlanId,
        exerciseId,
        setNumber,
        currentDayNumber,
        currentCycleAttempt,
        excludeSessionId,
      })
      setPreviousResult(prev)
    },
    [],
  )

  /** Load previous session's set results for all sets of the current exercise (for delta indicators). */
  const loadAllPreviousResults = useCallback(
    async (
      customPlanId: string,
      currentDayNumber: number,
      currentCycleAttempt: number,
      exerciseId: string,
      totalSets: number,
      excludeSessionId?: string,
    ) => {
      const map = new Map<number, { reps?: number; durationSec?: number; weightKg?: number }>()
      for (let i = 1; i <= totalSets; i++) {
        const prev = await getPreviousCustomSetResult({
          customPlanId,
          exerciseId,
          setNumber: i,
          currentDayNumber,
          currentCycleAttempt,
          excludeSessionId,
        })
        if (prev) map.set(i, { reps: prev.reps, durationSec: prev.durationSec, weightKg: prev.weightKg })
      }
      setPreviousResults(map)
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
      amrapEndAt: latest.amrapEndAt,
      amrapGroupId: latest.amrapGroupId,
      displayStartedAt: sessionStartedAt,
    })
    if (epoch !== sessionEpochRef.current) return
  }, [sessionStartedAt])

  const startNewSession = useCallback(
    async (
      p: CustomPlan,
      dayPlan: CustomPlan['days'][0],
      dayNumber: number,
      cycleAttempt: number,
      generation: number,
      dayOverride?: CustomPlan['days'][0] | null,
    ) => {
      const effectiveDay = dayOverride ?? dayPlan
      if (effectiveDay.exercises.length === 0) {
        setLoadError(pl.customWorkoutMissingDay)
        setLoadErrorKind('empty_day')
        setLoadErrorDayNumber(dayNumber)
        setLoading(false)
        return
      }
      const session = await createCustomSession({
        plan: p,
        dayNumber,
        cycleAttempt,
      })
      if (generation !== initGenerationRef.current) return

      sessionRef.current = session
      setSessionStartedAt(session.startedAt)
      sessionPlanDirtyRef.current = !!dayOverride
      basePlanRef.current = p
      setBaselineSets(captureBaselineSetCounts(effectiveDay))
      setBaselineRests(captureBaselineRests(effectiveDay))
      const initialLogs = effectiveDay.exercises.map((e) => ({
        exerciseId: e.exerciseId,
        order: e.order,
        sets: [] as SetLog[],
      }))
      useCustomWorkoutStore.getState().startSession({
        sessionId: session.id,
        customPlanId: planId!,
        dayNumber,
        cycleAttempt,
        exerciseCount: effectiveDay.exercises.length,
      })
      useCustomWorkoutStore.setState({ exerciseLogs: initialLogs })
      // Apply pending override to the live plan so the workout screen shows edited sets/rest.
      if (dayOverride) {
        const patchedPlan: CustomPlan = {
          ...p,
          days: p.days.map((d) => (d.dayNumber === dayNumber ? dayOverride : d)),
        }
        setPlanLive(patchedPlan)
      } else {
        setPlanLive(p)
      }
      setLoadError(null)
      setLoadErrorKind(null)
      if (!hasSeenWorkoutHint) {
        setShowHint(true)
        setSettings({ hasSeenWorkoutHint: true })
      }
      setLoading(false)

      // Persist the override as dayOverrideJson so it survives resume.
      if (dayOverride) {
        await persistCustomActive(session, {
          currentExerciseIndex: 0,
          currentSetIndex: 0,
          exerciseLogs: initialLogs,
          restTimerJson: null,
          dayOverrideJson: JSON.stringify(dayOverride),
        }).catch(() => {
          setSaveError(pl.errorSaveSet)
        })
      }
    },
    [planId, hasSeenWorkoutHint, setSettings, setPlanLive],
  )

  const initWorkout = useCallback(
    async (generation: number) => {
      if (!planId) return
      // Consume any pending preview override early — before early returns —
      // so a stale override isn't applied on a later navigation to this plan.
      const pendingOverride = takePendingDayOverride(planId)
      const pendingDayNumberOverride = takePendingDayNumber(planId)
      setLoadError(null)
      setLoadErrorKind(null)
      setLoadErrorDayNumber(null)
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
        setPlanLive(p)
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
          setPlanLive(p)
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
              totalSets: staleResumeTotalSets(
                p.days.find((d) => d.dayNumber === session.dayNumber) ?? p.days[0]!,
                active.currentExerciseIndex,
              ),
            })
            setPlanLive(p)
            setShowStaleConfirm(true)
            setLoading(false)
            return
          }

          const resumeDayBase =
            p.days.find((d) => d.dayNumber === session.dayNumber) ?? p.days[0]
          if (!resumeDayBase) {
            navigate('/plans?tab=mine', { replace: true })
            return
          }
          let planForResume = p
          // Baseline from saved plan (before session override).
          basePlanRef.current = p
          setBaselineSets(captureBaselineSetCounts(resumeDayBase))
          setBaselineRests(captureBaselineRests(resumeDayBase))
          if (active.dayOverrideJson) {
            const patched = applyDayOverrideToPlan(p, active.dayOverrideJson)
            if (patched) {
              planForResume = patched
              sessionPlanDirtyRef.current = true
            }
          }
          const resumeDay =
            planForResume.days.find((d) => d.dayNumber === session.dayNumber) ??
            planForResume.days[0]
          if (!resumeDay) {
            navigate('/plans?tab=mine', { replace: true })
            return
          }
          const missingOnResume = findFirstMissingExercise(resumeDay.exercises, exMap)
          if (missingOnResume) {
            setLoadError(pl.customWorkoutMissingExercise)
            setLoadErrorKind('missing_exercise')
            setLoadErrorDayNumber(session.dayNumber)
            setMissingExerciseId(missingOnResume.exerciseId)
            setPlanLive(p)
            setLoading(false)
            return
          }
          const reconciled = reconcileCustomWorkoutResume(
            resumeDay,
            active.exerciseLogs,
            active.currentExerciseIndex,
            active.currentSetIndex,
          )

          sessionRef.current = session
          // Shift the display clock forward by the time spent away from the workout
          // so the live elapsed timer doesn't count the pause.
          const lastActiveMs = new Date(active.updatedAt).getTime()
          const pauseMs = Number.isFinite(lastActiveMs) ? Math.max(0, Date.now() - lastActiveMs) : 0
          const prevDisplay = active.displayStartedAt
            ? new Date(active.displayStartedAt).getTime()
            : new Date(session.startedAt).getTime()
          const nextDisplay = Number.isFinite(prevDisplay)
            ? new Date(prevDisplay + pauseMs).toISOString()
            : session.startedAt
          setSessionStartedAt(nextDisplay)
          useCustomWorkoutStore.getState().resumeSession({
            sessionId: session.id,
            customPlanId: planId,
            dayNumber: session.dayNumber,
            cycleAttempt: session.cycleAttempt,
            currentExerciseIndex: reconciled.currentExerciseIndex,
            currentSetIndex: reconciled.currentSetIndex,
            exerciseLogs: reconciled.exerciseLogs,
            restTimer: parseRestTimerJson(active.restTimerJson),
            amrapEndAt: active.amrapEndAt ?? null,
            amrapGroupId: active.amrapGroupId ?? null,
          })
          setPlanLive(planForResume)
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

      const progressDayNumber = progress.status === 'cycle_complete' ? 1 : progress.currentDay
      const dayNumber = pendingDayNumberOverride ?? progressDayNumber
      const dayPlan = p.days.find((d) => d.dayNumber === dayNumber) ?? p.days[0]
      if (!dayPlan || dayPlan.exercises.length === 0) {
        setLoadError(pl.customWorkoutMissingDay)
        setLoadErrorKind('empty_day')
        setLoadErrorDayNumber(dayNumber)
        setPlanLive(p)
        setLoading(false)
        return
      }
      const missing = findFirstMissingExercise(dayPlan.exercises, exMap)
      if (missing) {
        setLoadError(pl.customWorkoutMissingExercise)
        setLoadErrorKind('missing_exercise')
        setLoadErrorDayNumber(dayNumber)
        setMissingExerciseId(missing.exerciseId)
        setPlanLive(p)
        setLoading(false)
        return
      }

      const cycleAttempt =
        progress.status === 'cycle_complete' ? progress.cycleAttempt + 1 : progress.cycleAttempt
      await startNewSession(p, dayPlan, dayNumber, cycleAttempt, generation, pendingOverride)
    },
    [planId, forceStart, navigate, hasSeenWorkoutHint, setSettings, startNewSession, setPlanLive],
  )

  const handleSkipMissingExercise = useCallback(async () => {
    if (!planId || !plan || loadErrorDayNumber == null) return
    const exs = await db.exercises.toArray()
    const exMap = new Map(exs.map((e) => [e.id, e]))
    const dayPlan = plan.days.find((d) => d.dayNumber === loadErrorDayNumber)
    if (!dayPlan) return
    const valid = filterValidDayExercises(dayPlan.exercises, exMap)
    if (valid.length < 1) return
    const patchedPlan: CustomPlan = {
      ...plan,
      days: plan.days.map((d) =>
        d.dayNumber === loadErrorDayNumber ? { ...d, exercises: valid } : d,
      ),
    }
    const progress = await getOrCreateCustomProgress(planId)
    const cycleAttempt =
      progress.status === 'cycle_complete' ? progress.cycleAttempt + 1 : progress.cycleAttempt
    setExercises(exMap)
    setLoadError(null)
    setLoadErrorKind(null)
    setMissingExerciseId(null)
    setLoading(true)
    const generation = ++initGenerationRef.current
    await startNewSession(
      patchedPlan,
      { ...dayPlan, exercises: valid },
      loadErrorDayNumber,
      cycleAttempt,
      generation,
    )
  }, [planId, plan, loadErrorDayNumber, startNewSession])

  const handleReplaceMissingExercise = useCallback(
    async (replacement: ExerciseDefinition) => {
      if (!planId || !plan || loadErrorDayNumber == null || !missingExerciseId) return
      try {
        const patched = replaceExerciseInDay(
          plan,
          loadErrorDayNumber,
          missingExerciseId,
          replacement.id,
        )
        const saved = await saveCustomPlan(patched, { skipValidation: true })
        setPlanLive(saved)
        setExercises((prev) => {
          const next = new Map(prev)
          next.set(replacement.id, replacement)
          return next
        })
        setReplaceOpen(false)
        setLoadError(null)
        setLoadErrorKind(null)
        setMissingExerciseId(null)
        setLoading(true)
        const generation = ++initGenerationRef.current
        await initWorkout(generation)
      } catch {
        setLoadError(pl.errorCrash)
      }
    },
    [planId, plan, loadErrorDayNumber, missingExerciseId, initWorkout, setPlanLive],
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
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [planId, forceStart, initWorkout])

  useEffect(() => {
    if (!prescription || !exDef || !plan || !planned) return
    if (skipNextResetRef.current) {
      skipNextResetRef.current = false
      return
    }
    setTimerRunning(false)
    setFailedIndex(undefined)
    // Clear previous-result state to avoid stale data from prior exercise
    setPreviousResult(undefined)
    setPreviousResults(new Map())
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
      store.currentSetIndex + 1,
      sessionRef.current?.id,
    )
    void loadAllPreviousResults(
      plan.id,
      store.dayNumber,
      store.cycleAttempt,
      planned.exerciseId,
      planned.sets.length,
      sessionRef.current?.id,
    )
  }, [
    prescription,
    exDef,
    plan,
    planned,
    store.currentSetIndex,
    store.dayNumber,
    store.cycleAttempt,
    loadPreviousActual,
    loadAllPreviousResults,
  ])

  useEffect(() => {
    if (!restTimer || restTimer.mode === 'idle') {
      stopRestTimerWorker()
      return
    }
    startRestTimerWorker(restTimer, wrapRestTimerCallbacks({
      getState: () => useCustomWorkoutStore.getState().restTimer,
      onTick: (remainingSec) => {
        const current = useCustomWorkoutStore.getState().restTimer
        if (!current) return
        useCustomWorkoutStore.getState().setRestTimer({ ...current, remainingSec })
      },
      onComplete: () => {
        onRestComplete({ sound: timerSound, vibration: timerVibration })
        useCustomWorkoutStore.getState().setRestTimer(skipRest())
        setCoachSuggestion(null)
        void persistState()
        checklistRef.current
          ?.querySelector('[data-active-set="true"]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      },
    }, { sound: timerSound, vibration: timerVibration }))
    return () => stopRestTimerWorker()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart on rest identity only
  }, [restTimer?.startedAt, restTimer?.totalSec, timerSound, timerVibration, persistState])

  useEffect(() => {
    if (!timerRunning) return
    timerRef.current = window.setInterval(() => {
      setActualSec((s) => {
        const next = s + 1
        if (
          prescription?.durationSec &&
          next === metricTargetDisplayValue(prescription.durationSec)
        ) {
          playDurationGoalTick({ sound: timerSound, vibration: timerVibration })
        }
        return next
      })
    }, 1000)
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [timerRunning, prescription, timerSound, timerVibration])

  useEffect(() => {
    if (!store.amrapEndAt) {
      amrapEndFiredRef.current = false
      return
    }
    const endAt = store.amrapEndAt
    const check = () => {
      if (Date.now() >= endAt && !amrapEndFiredRef.current) {
        amrapEndFiredRef.current = true
        onAmrapBlockEndFeedback({ sound: timerSound, vibration: timerVibration })
      }
    }
    check()
    const id = window.setInterval(check, 400)
    return () => window.clearInterval(id)
  }, [store.amrapEndAt, timerSound, timerVibration])

  useEffect(() => {
    if (!loading && plan && day && planned && exDef) {
      void initWorkoutAudio()
    }
  }, [loading, plan, day, planned, exDef])

  useEffect(() => {
    if (!day || loading) return
    const w = useCustomWorkoutStore.getState()
    const start = shouldStartAmrap(day, w.currentExerciseIndex, w.currentSetIndex, w.amrapEndAt)
    if (start) {
      useCustomWorkoutStore.getState().setAmrap(start.groupId, start.endAt)
      void persistState()
    }
  }, [day, loading, store.currentExerciseIndex, store.currentSetIndex, store.amrapEndAt, persistState])

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
    const nextPrescription = getPrescriptionForPosition(day, nextExerciseIndex, nextSetIndex)
    if (!nextDef || !nextPrescription) return ''
    if (nextExerciseIndex !== store.currentExerciseIndex) {
      return pl.customWorkoutNextExercise(nextDef.name)
    }
    const baseLabel = pl.customNextSet(
      nextSetIndex + 1,
      formatPrescriptionSetLabel(nextPrescription, nextDef.primaryMetric, nextDef.name),
    )
    // Append "Ostatnio: X" if we have previous data for this set
    const prev = previousResults.get(nextSetIndex + 1)
    if (prev) {
      let prevValue: string | undefined
      if (nextDef.primaryMetric === 'duration_sec' && prev.durationSec != null) {
        prevValue = `${prev.durationSec}s`
      } else if (prev.reps != null) {
        prevValue = prev.weightKg
          ? `${prev.reps}×${prev.weightKg}kg`
          : `${prev.reps}`
      }
      if (prevValue) {
        return `${baseLabel} · ${pl.lastTimeOnly(prevValue)}`
      }
    }
    return baseLabel
  }

  const isResting = restTimer !== null && restTimer.mode !== 'idle'
  const nextLabel = useMemo(() => {
    if (!isResting || !day) return ''
    const nextPos = getNextWorkoutPosition(
      day,
      store.currentExerciseIndex,
      store.currentSetIndex,
      store.amrapEndAt,
    ).next
    if (!nextPos) return ''
    return buildNextLabel(nextPos.exerciseIndex, nextPos.setIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    day,
    store.currentExerciseIndex,
    store.currentSetIndex,
    store.amrapEndAt,
    exercises,
    isResting,
  ])

  /** Log set (hit or below target) and continue — custom never aborts the day on underperformance. */
  async function acceptSetAndContinue(result: SetLog) {
    const livePlan = planRef.current ?? plan
    if (!livePlan || !sessionRef.current) return
    const liveDay =
      livePlan.days.find((d) => d.dayNumber === store.dayNumber) ?? livePlan.days[0]
    const livePlanned = liveDay?.exercises[store.currentExerciseIndex]
    if (!liveDay || !livePlanned) return

    setFailedIndex(undefined)
    if (result.passed) {
      setPulseFlash(true)
      window.setTimeout(() => setPulseFlash(false), 450)
    }

    const nav = getNextWorkoutPosition(
      liveDay,
      store.currentExerciseIndex,
      store.currentSetIndex,
      store.amrapEndAt,
    )
    const beforeComplete = useCustomWorkoutStore.getState()
    store.completeSet(livePlanned.exerciseId, livePlanned.order, result, nav.next ?? undefined)

    if (nav.restSec > 0) {
      store.setRestTimer(createRestTimer(nav.restSec, 'expanded'))
      // Smart rest suggestion — compare next set target with previous session actual
      if (nav.next && sessionRef.current) {
        const nextEx = liveDay.exercises[nav.next.exerciseIndex]
        if (nextEx) {
          const nextSet = nextEx.sets[nav.next.setIndex]
          const repsTarget = nextSet?.reps
          const durTarget = nextSet?.durationSec
          // Prefer reps target; fall back to duration target (timed exercises like plank)
          const isTimed = !repsTarget && !!durTarget
          const target = repsTarget
            ? (repsTarget.kind === 'max' ? repsTarget.minValue : repsTarget.value)
            : durTarget
              ? (durTarget.kind === 'max' ? durTarget.minValue : durTarget.value)
              : 0
          if (target > 0) {
            try {
              const prevActual = await getPreviousCustomSetActual({
                customPlanId: livePlan.id,
                exerciseId: nextEx.exerciseId,
                setNumber: nav.next.setIndex + 1,
                currentDayNumber: store.dayNumber,
                currentCycleAttempt: sessionRef.current.cycleAttempt,
                excludeSessionId: sessionRef.current.id,
              })
              // If no history for this specific set+day, check if user has ANY
              // completed sessions for this plan — to distinguish "first time ever"
              // from "new day/set combination"
              const hasHistory = prevActual === undefined
                ? await hasAnyCompletedCustomSessions(livePlan.id, sessionRef.current.id)
                : true
              setCoachSuggestion(getSmartRestSuggestion(prevActual, target, isTimed ? 'seconds' : 'reps', hasHistory))
            } catch {
              setCoachSuggestion(null)
            }
          }
        }
      }
    }

    let latest = useCustomWorkoutStore.getState()
    const inAmrap = Boolean(latest.amrapGroupId)
    const landedIncomplete = isExerciseIncomplete(
      liveDay,
      latest.exerciseLogs,
      latest.currentExerciseIndex,
      { amrapActiveGroupId: latest.amrapGroupId },
    )

    // After out-of-order jumps, linear dayComplete / next can land on a finished
    // exercise or end the day while earlier work remains — redirect first.
    if (!inAmrap && (nav.dayComplete || !nav.next || !landedIncomplete)) {
      const incomplete = findNextIncompletePosition(liveDay, latest.exerciseLogs)
      if (incomplete) {
        if (
          incomplete.exerciseIndex !== latest.currentExerciseIndex ||
          incomplete.setIndex !== latest.currentSetIndex
        ) {
          store.setPointers(incomplete.exerciseIndex, incomplete.setIndex)
          latest = useCustomWorkoutStore.getState()
        }
      } else if (nav.dayComplete || !nav.next) {
        try {
          await persistCustomActive(sessionRef.current, {
            currentExerciseIndex: latest.currentExerciseIndex,
            currentSetIndex: latest.currentSetIndex,
            exerciseLogs: latest.exerciseLogs,
            restTimerJson: latest.restTimer ? JSON.stringify(latest.restTimer) : null,
            amrapEndAt: latest.amrapEndAt,
            amrapGroupId: latest.amrapGroupId,
          })
        } catch {
          useCustomWorkoutStore.setState({
            exerciseLogs: beforeComplete.exerciseLogs,
            currentExerciseIndex: beforeComplete.currentExerciseIndex,
            currentSetIndex: beforeComplete.currentSetIndex,
            restTimer: beforeComplete.restTimer,
            amrapEndAt: beforeComplete.amrapEndAt,
            amrapGroupId: beforeComplete.amrapGroupId,
            failedRetryUsed: beforeComplete.failedRetryUsed,
          })
          setSaveError(pl.errorSaveSet)
          return
        }
        await finalizeCustomDay({
          session: sessionRef.current,
          plan: basePlanRef.current ?? livePlan,
          exerciseLogs: latest.exerciseLogs,
          sessionDayPatchJson: sessionDayPatchJsonNow(),
        })
        const doneSessionId = sessionRef.current.id
        sessionRef.current = null
        setSessionStartedAt(null)
        store.reset()
        navigate(`/workout/custom/${livePlan.id}/summary?session=${doneSessionId}`, {
          replace: true,
        })
        return
      }
    } else if (inAmrap && (nav.dayComplete || !nav.next)) {
      const incomplete = findNextIncompletePosition(liveDay, latest.exerciseLogs)
      if (!incomplete) {
        try {
          await persistCustomActive(sessionRef.current, {
            currentExerciseIndex: latest.currentExerciseIndex,
            currentSetIndex: latest.currentSetIndex,
            exerciseLogs: latest.exerciseLogs,
            restTimerJson: latest.restTimer ? JSON.stringify(latest.restTimer) : null,
            amrapEndAt: latest.amrapEndAt,
            amrapGroupId: latest.amrapGroupId,
          })
        } catch {
          useCustomWorkoutStore.setState({
            exerciseLogs: beforeComplete.exerciseLogs,
            currentExerciseIndex: beforeComplete.currentExerciseIndex,
            currentSetIndex: beforeComplete.currentSetIndex,
            restTimer: beforeComplete.restTimer,
            amrapEndAt: beforeComplete.amrapEndAt,
            amrapGroupId: beforeComplete.amrapGroupId,
            failedRetryUsed: beforeComplete.failedRetryUsed,
          })
          setSaveError(pl.errorSaveSet)
          return
        }
        await finalizeCustomDay({
          session: sessionRef.current,
          plan: basePlanRef.current ?? livePlan,
          exerciseLogs: latest.exerciseLogs,
          sessionDayPatchJson: sessionDayPatchJsonNow(),
        })
        const doneSessionId = sessionRef.current.id
        sessionRef.current = null
        setSessionStartedAt(null)
        store.reset()
        navigate(`/workout/custom/${livePlan.id}/summary?session=${doneSessionId}`, {
          replace: true,
        })
        return
      }
      store.setPointers(incomplete.exerciseIndex, incomplete.setIndex)
      latest = useCustomWorkoutStore.getState()
    }

    try {
      await persistCustomActive(sessionRef.current, {
        currentExerciseIndex: latest.currentExerciseIndex,
        currentSetIndex: latest.currentSetIndex,
        exerciseLogs: latest.exerciseLogs,
        restTimerJson: latest.restTimer ? JSON.stringify(latest.restTimer) : null,
        amrapEndAt: latest.amrapEndAt,
        amrapGroupId: latest.amrapGroupId,
      })
    } catch {
      useCustomWorkoutStore.setState({
        exerciseLogs: beforeComplete.exerciseLogs,
        currentExerciseIndex: beforeComplete.currentExerciseIndex,
        currentSetIndex: beforeComplete.currentSetIndex,
        restTimer: beforeComplete.restTimer,
        amrapEndAt: beforeComplete.amrapEndAt,
        amrapGroupId: beforeComplete.amrapGroupId,
        failedRetryUsed: beforeComplete.failedRetryUsed,
      })
      setSaveError(pl.errorSaveSet)
      return
    }

    scrollChecklistToActive()
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
        // Custom workouts: accept below-target set and continue immediately —
        // no retry prompt, just start the rest timer and move on.
        onSetFailedFeedback({ sound: timerSound, vibration: timerVibration })
        await acceptSetAndContinue(result)
        return
      }

      onSetCompleteFeedback({ sound: timerSound, vibration: timerVibration })
      await acceptSetAndContinue(result)
    } catch {
      setSaveError(pl.errorSaveSet)
    } finally {
      finishingRef.current = false
    }
  }

  function buildCurrentBelowTargetResult(): SetLog | null {
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

  function persistDayOverride(
    overrideDay: import('@/lib/exercise-model').PlanDay,
    restTimerJsonOverride?: string | null,
  ) {
    if (finishingRef.current || !sessionRef.current) return
    const baselineDay =
      basePlanRef.current?.days.find((d) => d.dayNumber === overrideDay.dayNumber) ?? null
    const hasSwaps = baselineDay
      ? sessionHasExerciseSwaps(overrideDay, baselineDay)
      : false
    const dirty =
      sessionDayIsDirty(overrideDay, baselineSets, baselineRests) || hasSwaps
    const after = useCustomWorkoutStore.getState()
    const restTimerJson =
      restTimerJsonOverride !== undefined
        ? restTimerJsonOverride
        : after.restTimer
          ? JSON.stringify(after.restTimer)
          : null
    void persistCustomActive(sessionRef.current, {
      currentExerciseIndex: after.currentExerciseIndex,
      currentSetIndex: after.currentSetIndex,
      exerciseLogs: after.exerciseLogs,
      restTimerJson,
      amrapEndAt: after.amrapEndAt,
      amrapGroupId: after.amrapGroupId,
      dayOverrideJson: dirty ? JSON.stringify(overrideDay) : null,
    }).catch(() => {
      setSaveError(pl.errorSaveSet)
    })
    sessionPlanDirtyRef.current = dirty
  }

  function sessionDayPatchJsonNow(): string | undefined {
    if (!sessionPlanDirtyRef.current) return undefined
    const livePlan = planRef.current
    if (!livePlan) return undefined
    const dayNumber = useCustomWorkoutStore.getState().dayNumber
    const liveDay =
      livePlan.days.find((d) => d.dayNumber === dayNumber) ?? livePlan.days[0]
    return liveDay ? JSON.stringify(liveDay) : undefined
  }

  function handleRestChange(sec: number) {
    if (finishingRef.current) return
    const livePlan = planRef.current ?? plan
    const liveDay =
      livePlan?.days.find((d) => d.dayNumber === store.dayNumber) ?? livePlan?.days[0]
    if (!livePlan || !liveDay) return
    const exerciseIndex = store.currentExerciseIndex
    const next = setRestBetweenSetsOnExercise(livePlan, liveDay.dayNumber, exerciseIndex, sec)
    if (!next) return
    setPlanLive(next)
    const overrideDay = next.days.find((d) => d.dayNumber === liveDay.dayNumber)
    if (!overrideDay) return

    let restTimerJsonOverride: string | null | undefined
    const rt = useCustomWorkoutStore.getState().restTimer
    if (rt && rt.mode !== 'idle' && rt.startedAt) {
      const elapsed = Math.max(0, Math.floor((Date.now() - rt.startedAt) / 1000))
      const nextTimer = {
        ...rt,
        totalSec: Math.max(0, Math.floor(sec)),
        remainingSec: Math.max(0, Math.floor(sec) - elapsed),
      }
      store.setRestTimer(nextTimer)
      restTimerJsonOverride = JSON.stringify(nextTimer)
    }
    persistDayOverride(overrideDay, restTimerJsonOverride)
  }

  function handleAddSet() {
    if (finishingRef.current) return
    const livePlan = planRef.current ?? plan
    const liveDay =
      livePlan?.days.find((d) => d.dayNumber === store.dayNumber) ?? livePlan?.days[0]
    if (!livePlan || !liveDay) return
    if (restTimer && restTimer.mode !== 'idle') return
    const exerciseIndex = store.currentExerciseIndex
    const next = addSetToPlanExercise(livePlan, liveDay.dayNumber, exerciseIndex)
    if (!next) return
    setPlanLive(next)
    const overrideDay = next.days.find((d) => d.dayNumber === liveDay.dayNumber)
    if (!overrideDay) return
    const latest = useCustomWorkoutStore.getState()
    const logged = latest.exerciseLogs[exerciseIndex]?.sets.length ?? 0
    const newLen = overrideDay.exercises[exerciseIndex]?.sets.length ?? 0
    // If prior slots are already logged, focus the new empty set.
    if (newLen > 0 && logged >= newLen - 1) {
      store.setPointers(exerciseIndex, newLen - 1)
    }
    persistDayOverride(overrideDay)
    window.setTimeout(() => scrollChecklistToActive(), 50)
  }

  function handleRemoveSet() {
    if (finishingRef.current) return
    const livePlan = planRef.current ?? plan
    const liveDay =
      livePlan?.days.find((d) => d.dayNumber === store.dayNumber) ?? livePlan?.days[0]
    if (!livePlan || !liveDay) return
    if (restTimer && restTimer.mode !== 'idle') return
    const exerciseIndex = store.currentExerciseIndex
    const plannedEx = liveDay.exercises[exerciseIndex]
    if (!plannedEx) return
    const baseline = baselineSetCountForExercise(
      baselineSets,
      plannedEx.exerciseId,
      plannedEx.sets.length,
    )
    let logged = useCustomWorkoutStore.getState().exerciseLogs[exerciseIndex]?.sets.length ?? 0
    if (!canRemoveSetFromExercise(liveDay, exerciseIndex, baseline, logged)) return

    // Logged trailing extra → undo result, then drop the slot.
    if (logged === plannedEx.sets.length && plannedEx.sets.length > baseline) {
      const removed = store.undoLastSet()
      if (!removed) return
      setFailedIndex(undefined)
      if (exDef?.primaryMetric === 'duration_sec') {
        setActualSec(removed.actual.durationSec ?? 0)
      } else {
        setActualReps(removed.actual.reps ?? 0)
        if (removed.actual.weightKg != null) setWeightKg(removed.actual.weightKg)
      }
      logged = useCustomWorkoutStore.getState().exerciseLogs[exerciseIndex]?.sets.length ?? 0
    }

    const next = removeSetFromPlanExercise(
      livePlan,
      liveDay.dayNumber,
      exerciseIndex,
      baseline,
      logged,
    )
    if (!next) return
    setPlanLive(next)
    setFailedIndex(undefined)
    const overrideDay = next.days.find((d) => d.dayNumber === liveDay.dayNumber)
    if (!overrideDay) return
    const newLen = overrideDay.exercises[exerciseIndex]?.sets.length ?? 0
    const latest = useCustomWorkoutStore.getState()
    if (latest.currentExerciseIndex === exerciseIndex && latest.currentSetIndex >= newLen) {
      store.setPointers(exerciseIndex, Math.max(0, newLen - 1))
    }
    persistDayOverride(overrideDay)
  }

  function handleSwapExercise(newDef: ExerciseDefinition) {
    if (finishingRef.current) return
    const livePlan = planRef.current ?? plan
    const liveDay =
      livePlan?.days.find((d) => d.dayNumber === store.dayNumber) ?? livePlan?.days[0]
    if (!livePlan || !liveDay) return
    const exerciseIndex = store.currentExerciseIndex
    const plannedEx = liveDay.exercises[exerciseIndex]
    if (!plannedEx) return
    if (plannedEx.exerciseId === newDef.id) {
      setSwapOpen(false)
      setSwapConfirm(null)
      return
    }

    // If current exercise has logged sets, confirm before zeroing.
    const currentLog = useCustomWorkoutStore.getState().exerciseLogs[exerciseIndex]
    if (currentLog && currentLog.sets.length > 0) {
      setSwapConfirm(newDef)
      return
    }

    void applySwap(exerciseIndex, newDef)
  }

  async function applySwap(exerciseIndex: number, newDef: ExerciseDefinition) {
    const livePlan = planRef.current ?? plan
    const liveDay =
      livePlan?.days.find((d) => d.dayNumber === store.dayNumber) ?? livePlan?.days[0]
    if (!livePlan || !liveDay) return
    const plannedEx = liveDay.exercises[exerciseIndex]
    if (!plannedEx) return

    // Prefill sets/reps/weight from the last session for this exercise in this plan.
    let historySets: SetLog[] | null = null
    try {
      const sets = await getLastExerciseLogs({
        customPlanId: livePlan.id,
        exerciseId: newDef.id,
        excludeSessionId: sessionRef.current?.id,
      })
      historySets = sets ?? null
    } catch {
      // ignore — fall back to defaults
    }

    const next = swapExerciseInSessionDay(
      livePlan,
      liveDay.dayNumber,
      exerciseIndex,
      newDef.id,
      newDef,
      historySets,
    )
    if (!next) return
    setPlanLive(next)

    // Reset exercise log for the swapped position.
    const latest = useCustomWorkoutStore.getState()
    const newLogs = latest.exerciseLogs.map((log, i) =>
      i === exerciseIndex
        ? { exerciseId: newDef.id, order: plannedEx.order, sets: [] as SetLog[] }
        : log,
    )
    useCustomWorkoutStore.setState({
      exerciseLogs: newLogs,
      currentSetIndex: 0,
      failedRetryUsed: false,
    })

    setFailedIndex(undefined)
    setSwapOpen(false)
    setSwapConfirm(null)

    const overrideDay = next.days.find((d) => d.dayNumber === liveDay.dayNumber)
    if (overrideDay) persistDayOverride(overrideDay)
  }

  async function handleAddExercise(newDef: ExerciseDefinition) {
    const livePlan = planRef.current ?? plan
    const liveDay =
      livePlan?.days.find((d) => d.dayNumber === store.dayNumber) ?? livePlan?.days[0]
    if (!livePlan || !liveDay) return

    // Prefill sets/reps/weight from the last session for this exercise in this plan.
    let historySets: SetLog[] | null = null
    try {
      const sets = await getLastExerciseLogs({
        customPlanId: livePlan.id,
        exerciseId: newDef.id,
        excludeSessionId: sessionRef.current?.id,
      })
      historySets = sets ?? null
    } catch {
      // ignore — fall back to defaults
    }

    const next = addExerciseToSessionDay(
      livePlan,
      liveDay.dayNumber,
      newDef.id,
      newDef,
      historySets,
    )
    if (!next) return
    setPlanLive(next)

    // Append an empty log entry for the new exercise.
    const latest = useCustomWorkoutStore.getState()
    const nextOrder = liveDay.exercises.length > 0
      ? Math.max(...liveDay.exercises.map((e) => e.order)) + 1
      : 0
    const newLogs = [
      ...latest.exerciseLogs,
      { exerciseId: newDef.id, order: nextOrder, sets: [] as SetLog[] },
    ]
    useCustomWorkoutStore.setState({
      exerciseLogs: newLogs,
    })

    setAddExerciseOpen(false)

    const overrideDay = next.days.find((d) => d.dayNumber === liveDay.dayNumber)
    if (overrideDay) persistDayOverride(overrideDay)
  }

  async function confirmLeave() {
    setLeaveOpen(false)
    await persistState()
    store.reset()
    sessionRef.current = null
    setSessionStartedAt(null)
    navigate('/plans?tab=mine')
  }

  function discardEphemeralSession() {
    sessionEpochRef.current += 1
    store.reset()
    sessionRef.current = null
    setSessionStartedAt(null)
  }

  async function confirmCancel() {
    setCancelOpen(false)
    setShowMenu(false)
    sessionEpochRef.current += 1
    const latest = useCustomWorkoutStore.getState()
    if (sessionRef.current && planId) {
      if (customSessionHasProgress(latest.exerciseLogs)) {
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
    skipNextResetRef.current = true
    if (exDef?.primaryMetric === 'duration_sec') {
      setActualSec(removed.actual.durationSec ?? 0)
    } else {
      setActualReps(removed.actual.reps ?? 0)
      if (removed.actual.weightKg != null) setWeightKg(removed.actual.weightKg)
    }
    void persistState()
  }

  function handleJumpToExercise(targetIndex: number) {
    if (!day) return
    const latest = useCustomWorkoutStore.getState()
    if (
      !canJumpToExercise(day, latest.exerciseLogs, latest.currentExerciseIndex, targetIndex, {
        amrapGroupId: latest.amrapGroupId,
      })
    ) {
      return
    }
    const resumeSet = resumeSetIndexForExercise(day, latest.exerciseLogs, targetIndex)
    const fromGroup = getGroupForExercise(day, latest.currentExerciseIndex)
    const toGroup = getGroupForExercise(day, targetIndex)
    stopRestTimerWorker()
    store.setRestTimer(null)
    if (
      latest.amrapEndAt &&
      fromGroup?.kind === 'amrap' &&
      fromGroup.id !== toGroup?.id
    ) {
      store.setAmrap(null, null)
    }
    store.setPointers(targetIndex, resumeSet)
    setShowMenu(false)
    setShowPlanSheet(false)
    setFailedIndex(undefined)
    void persistState()
  }

  function mutateRestTimer(next: RestTimerState) {
    store.setRestTimer(next)
    if (next.mode === 'idle') setCoachSuggestion(null)
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

  function setRest(sec: number) {
    const current = useCustomWorkoutStore.getState().restTimer
    if (!current || current.mode === 'idle') return
    mutateRestTimer({
      ...current,
      totalSec: sec,
      remainingSec: sec,
      startedAt: Date.now(),
    })
  }

  if (loadError) {
    const canSkip =
      loadErrorKind === 'missing_exercise' &&
      plan &&
      loadErrorDayNumber != null &&
      filterValidDayExercises(
        plan.days.find((d) => d.dayNumber === loadErrorDayNumber)?.exercises ?? [],
        exercises,
      ).length >= 1
    const canReplace = loadErrorKind === 'missing_exercise' && missingExerciseId != null
    const errorTitle =
      loadErrorKind === 'missing_exercise'
        ? pl.customWorkoutMissingExercise
        : loadErrorKind === 'empty_day'
          ? pl.customWorkoutMissingDay
          : pl.customWorkoutProblemTitle
    return (
      <>
        <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
          <PageHeader title={errorTitle} subtitle={loadError} />
          <div className="mt-6 flex w-full flex-col gap-2">
            {planId && loadErrorDayNumber != null && (
              <Button
                type="button"
                size="touch"
                fullWidth
                onClick={() =>
                  navigate(
                    `/plans?tab=mine&edit=${planId}&day=${loadErrorDayNumber}`,
                  )
                }
              >
                {pl.customWorkoutEditPlan}
              </Button>
            )}
            {canReplace && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  onClick={() => setReplaceOpen(true)}
                >
                  {pl.customWorkoutReplaceExercise}
                </Button>
                <p className="text-xs text-[var(--sr-text-muted)]">
                  {pl.customWorkoutReplaceExerciseHint}
                </p>
              </>
            )}
            {canSkip && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  fullWidth
                  onClick={() => void handleSkipMissingExercise()}
                >
                  {pl.customWorkoutSkipExercise}
                </Button>
                <p className="text-xs text-[var(--sr-text-muted)]">{pl.customWorkoutSkipExerciseHint}</p>
              </>
            )}
            <Button type="button" variant="ghost" fullWidth onClick={() => navigate('/plans?tab=mine')}>
              {pl.myPlansTitle}
            </Button>
          </div>
        </div>
        <Sheet
          open={replaceOpen}
          onClose={() => setReplaceOpen(false)}
          title={pl.customWorkoutReplaceExercise}
          className="max-h-[85vh] overflow-y-auto"
        >
          <ExerciseLibraryPanel
            mode="pick"
            onPick={(ex) => void handleReplaceMissingExercise(ex)}
          />
        </Sheet>
      </>
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
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader message={pl.loading} />
      </div>
    )
  }

  const isDuration = exDef.primaryMetric === 'duration_sec'
  const actual = isDuration ? actualSec : actualReps
  const sessionHasProgress = customSessionHasProgress(store.exerciseLogs)
  const canEditPreviousSet = canUndoCustomSet(
    day,
    store.exerciseLogs,
    store.currentExerciseIndex,
    store.currentSetIndex,
    restTimer,
    failedIndex,
    store.amrapEndAt,
  )
  const failedRetryVisible = failedIndex === store.currentSetIndex
  const activeGroup = getGroupForExercise(day, store.currentExerciseIndex)
  const canAddSet =
    canAddSetToExercise(day, store.currentExerciseIndex) &&
    !(restTimer && restTimer.mode !== 'idle') &&
    !failedRetryVisible
  const currentBaseline = baselineSetCountForExercise(
    baselineSets,
    planned.exerciseId,
    planned.sets.length,
  )
  const canRemoveSet =
    !activeGroup &&
    canRemoveSetFromExercise(
      day,
      store.currentExerciseIndex,
      currentBaseline,
      setResults.length,
    ) &&
    !(restTimer && restTimer.mode !== 'idle') &&
    !failedRetryVisible
  const showSetAdjust =
    !activeGroup &&
    !(restTimer && restTimer.mode !== 'idle') &&
    !failedRetryVisible
  const showRestAdjust = !activeGroup && !failedRetryVisible
  const canSwapExercise =
    !activeGroup &&
    !(restTimer && restTimer.mode !== 'idle') &&
    !failedRetryVisible

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
        positionSetIndex={store.currentSetIndex}
        groupKind={activeGroup?.kind}
        groupRounds={activeGroup?.rounds}
        amrapEndAt={store.amrapEndAt}
        planned={planned}
        planDay={day}
        checklistSets={checklistSets}
        dayExercises={day.exercises}
        exerciseDef={exDef}
        exerciseDefs={exercises}
        exerciseLogs={store.exerciseLogs}
        setResults={setResults}
        restTimer={restTimer}
        coachSuggestion={coachSuggestion}
        actual={actual}
        previousResult={previousResult}
        previousResults={previousResults}
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
        sessionStartedAt={sessionStartedAt}
        weightKg={weightKg}
        timerRunning={timerRunning}
        canEditPreviousSet={canEditPreviousSet}
        weightUnit={weightUnit}
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
          if (finishingRef.current) return
          const below = buildCurrentBelowTargetResult()
          if (!below) return
          finishingRef.current = true
          void (async () => {
            try {
              onSetFailedFeedback({ sound: timerSound, vibration: timerVibration })
              await acceptSetAndContinue(below)
            } catch {
              setSaveError(pl.errorSaveSet)
            } finally {
              finishingRef.current = false
            }
          })()
        }}
        onExpandTimer={() => {
          if (restTimer) mutateRestTimer({ ...restTimer, mode: 'expanded' })
        }}
        onAddRest15={() => addRest(15)}
        onAddRest30={() => addRest(30)}
        onSetRest={(sec) => setRest(sec)}
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
        onJumpToExercise={handleJumpToExercise}
        canAddSet={canAddSet}
        canRemoveSet={canRemoveSet}
        showSetAdjust={showSetAdjust}
        baselineSetCount={currentBaseline}
        onAddSet={handleAddSet}
        onRemoveSet={handleRemoveSet}
        showRestAdjust={showRestAdjust}
        onRestChange={handleRestChange}
        canSwapExercise={canSwapExercise}
        onSwapExercise={() => setSwapOpen(true)}
        onAddExercise={() => setAddExerciseOpen(true)}
      />
      <ExerciseDetailSheet
        open={detailExercise != null}
        exercise={detailExercise}
        elevated
        showProgressLink={false}
        onClose={() => setDetailExercise(null)}
      />
      <Sheet
        open={swapOpen}
        onClose={() => setSwapOpen(false)}
        title={pl.customWorkoutSwapExercise}
        className="max-h-[85vh] overflow-y-auto"
      >
        <p className="mb-3 text-xs text-[var(--sr-text-muted)]">
          {pl.customWorkoutSwapExerciseHint}
        </p>
        {exDef && swapSuggestions.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
              {pl.exerciseSwapSuggestions}
            </p>
            <p className="mb-2 text-xs text-[var(--sr-text-muted)]">
              {pl.exerciseSwapSuggestionsHint}
            </p>
            <div className="flex flex-wrap gap-2">
              {swapSuggestions.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  className={`min-h-9 rounded-full border border-[var(--sr-brand-primary)]/30 bg-[var(--sr-brand-primary)]/10 px-3 text-sm font-medium text-[var(--sr-brand-primary)] ${FOCUS_RING}`}
                  onClick={() => void handleSwapExercise(ex)}
                >
                  {ex.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <ExerciseLibraryPanel
          mode="pick"
          onPick={(ex) => void handleSwapExercise(ex)}
        />
      </Sheet>
      {swapConfirm && (
        <ConfirmSheet
          title={pl.customWorkoutSwapConfirmTitle}
          message={pl.customWorkoutSwapConfirmBody(exDef?.name ?? '')}
          confirmLabel={pl.customWorkoutSwapConfirmAction}
          onConfirm={() => {
            const idx = store.currentExerciseIndex
            const target = swapConfirm
            setSwapConfirm(null)
            void applySwap(idx, target)
          }}
          onCancel={() => setSwapConfirm(null)}
        />
      )}
      <Sheet
        open={addExerciseOpen}
        onClose={() => setAddExerciseOpen(false)}
        title={pl.customWorkoutAddExercise}
        className="max-h-[85vh] overflow-y-auto"
      >
        <p className="mb-3 text-xs text-[var(--sr-text-muted)]">
          {pl.customWorkoutAddExerciseHint}
        </p>
        <ExerciseLibraryPanel
          mode="pick"
          onPick={(ex) => void handleAddExercise(ex)}
        />
      </Sheet>
    </>
  )
}
