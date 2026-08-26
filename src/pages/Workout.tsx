import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getCycleById } from '@/data/plans'
import { pl } from '@/i18n/pl'
import { validateSet, getTargetReps, isWorkoutAvailable } from '@/lib/progress-engine'
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
import { ErrorBanner, SkeletonCard } from '@/components/ux/Feedback'
import { getProgramProgress, saveActiveWorkout, clearActiveWorkout } from '@/lib/program-service'
import {
  finalizeFailedDay,
  finalizeSuccessfulDay,
  abandonWorkoutSession,
  getPreviousSetActual,
} from '@/lib/session-service'
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
  const { settings, setSettings } = useAppStore()
  const initRef = useRef(false)
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
  const [showPlanSheet, setShowPlanSheet] = useState(false)
  const [negativeCountdown, setNegativeCountdown] = useState<number | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [showStaleConfirm, setShowStaleConfirm] = useState(false)
  const [staleResume, setStaleResume] = useState<{ day: number; set: number; total: number } | null>(null)
  const staleConfirmedRef = useRef(false)
  const [pulseFlash, setPulseFlash] = useState(false)

  const store = useWorkoutStore()
  const cycle = progress ? getCycleById(progress.cycleId) : undefined
  const day = cycle?.days.find((d) => d.dayNumber === progress?.currentDay)
  const currentTarget = day?.sets[store.currentSetIndex]
  const unit = program === 'pushups' ? pl.pushups : pl.pullups

  const loadPreviousActual = useCallback(
    async (setIndex: number, cycleAttempt: number, dayNumber: number) => {
      const prev = await getPreviousSetActual(program, dayNumber, cycleAttempt, setIndex + 1)
      setLastActual(prev)
    },
    [program],
  )

  const initWorkout = useCallback(async () => {
    if (initRef.current) return
    initRef.current = true
    setInitError(null)

    try {
      const prog = await getProgramProgress(program)
      if (!prog) {
        navigate('/')
        return
      }

      if (prog.status === 'test_pending') {
        setTestPendingBlocked(true)
        setProgress(prog)
        setInitialized(true)
        return
      }

      const available = isWorkoutAvailable(
        prog.nextWorkoutAfter ? new Date(prog.nextWorkoutAfter) : null,
      )
      if (!available && !forceStart) {
        setRestBlocked(true)
        setProgress(prog)
        setInitialized(true)
        return
      }

      setProgress(prog)
      const active = await db.activeWorkout.get(program)

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
        setInitError('Nie znaleziono planu treningowego dla tego programu.')
        setInitialized(true)
        return
      }

      let session: LocalWorkoutSession

      if (active) {
        store.resumeSession({
          sessionId: active.sessionId,
          program,
          cycleId: prog.cycleId,
          dayNumber: prog.currentDay,
          cycleAttempt: prog.cycleAttempt,
          currentSetIndex: active.currentSetIndex,
          setResults: active.setResults,
          restTimer: active.restTimerJson ? JSON.parse(active.restTimerJson) : null,
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
        if (!existing) await db.workoutSessions.put(session)
      } else {
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
        store.startSession({
          sessionId,
          program,
          cycleId: prog.cycleId,
          dayNumber: prog.currentDay,
          cycleAttempt: prog.cycleAttempt,
        })
        await db.workoutSessions.put(session)
      }

      setSessionMeta(session)
      const setIdx = active?.currentSetIndex ?? 0
      setActual(getTargetReps(d.sets[setIdx]))
      await loadPreviousActual(setIdx, prog.cycleAttempt, prog.currentDay)
      setInitialized(true)

      if (!settings.hasSeenWorkoutHint) {
        setShowHint(true)
        setSettings({ hasSeenWorkoutHint: true })
      }
    } catch {
      setInitError('Nie udało się rozpocząć treningu.')
      setInitialized(true)
    }
  }, [program, navigate, store, settings.hasSeenWorkoutHint, setSettings, forceStart, loadPreviousActual])

  useEffect(() => {
    void initWorkout()
    store.setImmersive(true)

    const onPopState = () => {
      const s = useWorkoutStore.getState()
      if (s.sessionId && s.setResults.length < setsCountRef.current) {
        const leave = window.confirm(pl.leaveWorkoutConfirm)
        if (!leave) window.history.pushState(null, '', window.location.href)
      }
    }
    window.history.pushState(null, '', window.location.href)
    window.addEventListener('popstate', onPopState)

    return () => {
      store.setImmersive(false)
      releaseWakeLock()
      stopRestTimerWorker()
      window.removeEventListener('popstate', onPopState)
      initRef.current = false
    }
  }, [store])

  useEffect(() => {
    if (!store.restTimer || store.restTimer.mode === 'idle') {
      stopRestTimerWorker()
      return
    }
    requestWakeLock()
    startRestTimerWorker(store.restTimer, {
      getState: () => useWorkoutStore.getState().restTimer,
      onTick: (remainingSec) => {
        const current = useWorkoutStore.getState().restTimer
        if (!current) return
        useWorkoutStore.getState().setRestTimer({ ...current, remainingSec })
      },
      onComplete: () => {
        if (settings.timerSound) playChime()
        if (settings.timerVibration) vibrate(100)
        useWorkoutStore.getState().setRestTimer(skipRest())
        releaseWakeLock()
        checklistRef.current
          ?.querySelector('[data-active-set="true"]')
          ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      },
    })
    return () => stopRestTimerWorker()
  }, [
    store.restTimer?.startedAt,
    store.restTimer?.totalSec,
    store.restTimer?.mode,
    settings.timerSound,
    settings.timerVibration,
  ])

  useEffect(() => {
    if (negativeCountdown === null || negativeCountdown <= 0) return
    const t = window.setTimeout(() => setNegativeCountdown((s) => (s !== null && s > 0 ? s - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [negativeCountdown])

  const persistState = async () => {
    const s = useWorkoutStore.getState()
    await saveActiveWorkout(program, {
      sessionId: s.sessionId!,
      currentSetIndex: s.currentSetIndex,
      setResults: s.setResults,
      restTimerJson: s.restTimer ? JSON.stringify(s.restTimer) : null,
    })
  }

  const handleDone = async () => {
    if (!currentTarget || !day || !progress || !sessionMeta || finishing) return

    if (cycle?.variant === 'negative' && currentTarget.kind === 'exact') {
      setNegativeCountdown(4)
    }

    const passed = validateSet(currentTarget, actual)
    const result: SetResultDraft = {
      setNumber: store.currentSetIndex + 1,
      target: currentTarget,
      actual,
      passed,
    }

    if (!passed) {
      onSetFailed()
      setFailedIndex(store.currentSetIndex)
      if (!store.failedRetryUsed) {
        store.setFailedRetryUsed(true)
        return
      }
      setFinishing(true)
      await finalizeFailedDay(sessionMeta.id, program, [...store.setResults, result])
      store.reset()
      navigate(`/workout/${program}/summary?failed=1&session=${sessionMeta.id}`)
      return
    }

    onSetComplete()
    setPulseFlash(true)
    window.setTimeout(() => setPulseFlash(false), 400)
    const nextSetIndex = store.currentSetIndex + 1
    const allResults = [...store.setResults, result]
    store.completeSet(result)
    setFailedIndex(undefined)
    await persistState()

    if (nextSetIndex >= day.sets.length) {
      setFinishing(true)
      await finalizeSuccessfulDay(sessionMeta, allResults)
      store.reset()
      navigate(`/workout/${program}/summary?session=${sessionMeta.id}`)
      return
    }

    store.setRestTimer(createRestTimer(day.restBetweenSetsSec))
    setActual(getTargetReps(day.sets[nextSetIndex]))
    await loadPreviousActual(nextSetIndex, progress.cycleAttempt, progress.currentDay)
    await persistState()
  }

  if (!initialized) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <SkeletonCard className="h-64" />
      </div>
    )
  }

  if (initError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <ErrorBanner message={initError} onRetry={() => { initRef.current = false; void initWorkout() }} />
        <Button variant="ghost" className="mt-4" fullWidth onClick={() => navigate('/')}>{pl.backHome}</Button>
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
        <Button variant="ghost" className="mt-2" fullWidth onClick={() => navigate('/')}>
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
          initRef.current = false
          void initWorkout()
        }}
        onCancel={async () => {
          await clearActiveWorkout(program)
          store.reset()
          navigate('/')
        }}
      />
    )
  }

  if (restBlocked && progress) {
    const daysLeft = progress.nextWorkoutAfter
      ? Math.max(0, Math.ceil((new Date(progress.nextWorkoutAfter).getTime() - Date.now()) / 86400000))
      : 0
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top safe-bottom">
        <h1 className="sr-text-h1">{pl.restBlocked(pl.restIn(daysLeft))}</h1>
        <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">
          Program zaleca minimum {daysLeft} {daysLeft === 1 ? 'dzień' : 'dni'} przerwy po ostatnim treningu.
        </p>
        <Button className="mt-6" fullWidth onClick={() => navigate(`/workout/${program}?force=1`)}>
          {pl.trainAnyway}
        </Button>
        <Button variant="ghost" className="mt-2" fullWidth onClick={() => navigate('/')}>
          {pl.backHome}
        </Button>
      </div>
    )
  }

  if (!day || !currentTarget || !progress) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <ErrorBanner message="Brak danych treningu." onRetry={() => navigate('/')} />
      </div>
    )
  }

  const nextTarget = day.sets[store.currentSetIndex + 1]
  const nextLabel = nextTarget
    ? pl.nextSet(store.currentSetIndex + 2, getTargetReps(nextTarget), unit)
    : ''

  return (
    <ActiveWorkoutScreen
      program={program}
      progress={{ currentDay: progress.currentDay, cycleAttempt: progress.cycleAttempt }}
      day={day}
      cycleVariant={cycle?.variant}
      currentSetIndex={store.currentSetIndex}
      setResults={store.setResults}
      restTimer={store.restTimer}
      actual={actual}
      lastActual={lastActual}
      failedIndex={failedIndex}
      showHint={showHint}
      showMenu={showMenu}
      showCancelConfirm={showCancelConfirm}
      showPlanSheet={showPlanSheet}
      negativeCountdown={negativeCountdown}
      failedRetryVisible={failedIndex === store.currentSetIndex}
      pulseFlash={pulseFlash}
      nextLabel={nextLabel}
      checklistRef={checklistRef}
      onBack={() => { if (window.confirm(pl.leaveWorkoutConfirm)) navigate('/') }}
      onToggleMenu={() => setShowMenu((v) => !v)}
      onShowPlan={() => { setShowPlanSheet(true); setShowMenu(false) }}
      onShowTechnique={() => { navigate('/setup/technique'); setShowMenu(false) }}
      onRequestCancel={() => { setShowCancelConfirm(true); setShowMenu(false) }}
      onDismissHint={() => setShowHint(false)}
      onActualChange={setActual}
      onDone={() => void handleDone()}
      onRetry={() => { setFailedIndex(undefined); store.setFailedRetryUsed(false) }}
      onFinishDayEarly={() => void (async () => {
        if (!sessionMeta || finishing) return
        setFinishing(true)
        await finalizeFailedDay(sessionMeta.id, program, store.setResults)
        store.reset()
        navigate(`/workout/${program}/summary?failed=1&session=${sessionMeta.id}`)
      })()}
      onExpandTimer={() => store.setRestTimer({ ...store.restTimer!, mode: 'expanded' })}
      onAddRest15={() => store.setRestTimer(addRestTime(useWorkoutStore.getState().restTimer!, 15))}
      onAddRest30={() => store.setRestTimer(addRestTime(useWorkoutStore.getState().restTimer!, 30))}
      onSkipRest={() => store.setRestTimer(skipRest())}
      onCollapseTimer={() => store.setRestTimer({ ...useWorkoutStore.getState().restTimer!, mode: 'pill' })}
      onConfirmCancel={() => void (async () => {
        if (!sessionMeta) return
        await abandonWorkoutSession(program, sessionMeta.id)
        store.reset()
        navigate('/')
      })()}
      onDismissCancel={() => setShowCancelConfirm(false)}
      onClosePlan={() => setShowPlanSheet(false)}
    />
  )
}
