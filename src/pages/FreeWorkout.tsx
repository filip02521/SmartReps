import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Dumbbell, Flag, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { TextField } from '@/components/ui/TextField'
import { PageLoader, ErrorBanner } from '@/components/ux/Feedback'
import { ExerciseLibrarySheet } from '@/components/plans/ExerciseLibrarySheet'
import { FreeExerciseCard } from '@/components/workout/FreeExerciseCard'
import { SessionElapsedLabel } from '@/components/workout/SessionElapsedLabel'
import {
  ConfirmSheet,
  RestTimerExpanded,
  RestTimerPill,
} from '@/components/workout/WorkoutComponents'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import type { LocalWorkoutSession } from '@/lib/db'
import type { ExerciseDefinition, ExerciseLog, SetActual, SetLog } from '@/lib/exercise-model'
import {
  abandonFreeWorkoutSession,
  computeLastActualsByExercise,
  finishFreeWorkoutSession,
  freeSessionHasProgress,
  makeFreeSetLog,
  persistFreeWorkoutSession,
  startFreeWorkoutSession,
} from '@/lib/free-workout-service'
import { ensureDefaultExercises, listExercises } from '@/lib/custom-plan-service'
import { computeExerciseListSummaries } from '@/lib/custom-exercise-stats'
import {
  addRestTime,
  createRestTimer,
  startRestTimerWorker,
  stopRestTimerWorker,
  type RestTimerState,
} from '@/lib/rest-timer'
import { displayToKg, kgToDisplay } from '@/lib/weight-units'
import { useAppStore } from '@/stores/app-store'
import { showToast } from '@/stores/toast-store'

/** Ad-hoc workout screen: the user builds the workout live while at the gym.
 * The session row itself is the persistence + resume source — every mutation
 * is written back to IndexedDB (and queued for cloud sync). */
export default function FreeWorkout() {
  const navigate = useNavigate()
  const weightUnit = useAppStore((s) => s.settings.weightUnit)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [session, setSession] = useState<LocalWorkoutSession | null>(null)
  const [logs, setLogs] = useState<ExerciseLog[]>([])
  const [exercises, setExercises] = useState<Map<string, ExerciseDefinition>>(new Map())
  const [lastActuals, setLastActuals] = useState<Map<string, SetActual>>(new Map())
  const [activeExIdx, setActiveExIdx] = useState<number | null>(null)
  const [quickPicks, setQuickPicks] = useState<ExerciseDefinition[]>([])
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<{ ex: number; set: number } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<number | null>(null)
  const [finishSheet, setFinishSheet] = useState<'none' | 'finish' | 'empty'>('none')
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null)
  const [saveError, setSaveError] = useState(false)
  const [busy, setBusy] = useState(false)

  const sessionRef = useRef<LocalWorkoutSession | null>(null)
  const logsRef = useRef<ExerciseLog[]>([])
  const restRef = useRef<RestTimerState | null>(null)
  const initGenRef = useRef(0)
  const listEndRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    restRef.current = restTimer
  }, [restTimer])

  const hasProgress = useMemo(() => freeSessionHasProgress(logs), [logs])
  const totalSets = useMemo(() => logs.reduce((n, l) => n + l.sets.length, 0), [logs])

  // --- init: resume the active free session or start a fresh one (timer begins
  // at session row creation, which happens exactly once) ---
  useEffect(() => {
    const generation = ++initGenRef.current
    void (async () => {
      try {
        await ensureDefaultExercises()
        const s = await startFreeWorkoutSession()
        if (generation !== initGenRef.current) return
        const defs = await listExercises()
        if (generation !== initGenRef.current) return
        sessionRef.current = s
        logsRef.current = s.exerciseLogs ?? []
        setSession(s)
        setLogs(logsRef.current)
        const map = new Map(defs.map((e) => [e.id, e]))
        setExercises(map)
        // Historical last-actuals seed the next-set inputs of a newly added
        // exercise — the user repeats their typical performance by default.
        setLastActuals(await computeLastActualsByExercise())
        setActiveExIdx(logsRef.current.length > 0 ? logsRef.current.length - 1 : null)
        // Quick-pick chips for the empty state: most-used exercises first so a
        // returning gym-goer can tap instead of searching.
        try {
          const summaries = await computeExerciseListSummaries(defs)
          const ranked = defs
            .filter((e) => !e.archived)
            .map((e) => ({ e, n: summaries.get(e.id)?.sessionCount ?? 0 }))
            .sort((a, b) => b.n - a.n)
          setQuickPicks(ranked.slice(0, 4).map((r) => r.e))
        } catch {
          setQuickPicks(defs.filter((e) => !e.archived).slice(0, 4))
        }
        setLoadError(false)
      } catch {
        if (generation === initGenRef.current) setLoadError(true)
      } finally {
        if (generation === initGenRef.current) setLoading(false)
      }
    })()
    return () => {
      stopRestTimerWorker()
    }
  }, [])

  // --- persistence: every mutation writes the session row + sync queue ---
  const applyLogs = useCallback(
    async (next: ExerciseLog[]) => {
      const s = sessionRef.current
      if (!s) return
      const updated: LocalWorkoutSession = { ...s, exerciseLogs: next }
      logsRef.current = next
      sessionRef.current = updated
      setLogs(next)
      setSession(updated)
      try {
        const refused = await persistFreeWorkoutSession(updated)
        if (refused === 'completed') {
          // Finished elsewhere — follow the data to its summary instead of
          // letting the user keep logging into a dead session.
          navigate(`/workout/free/summary?session=${s.id}`)
          return
        }
        if (refused === 'abandoned') {
          navigate('/', { replace: true })
          return
        }
        setSaveError(false)
      } catch {
        setSaveError(true)
      }
    },
    [navigate],
  )

  const addExercise = useCallback(
    async (def: ExerciseDefinition) => {
      // Exercises created inside the picker aren't in the loaded map yet —
      // without this the card would render the fallback name + wrong metric.
      setExercises((prev) => (prev.has(def.id) ? prev : new Map(prev).set(def.id, def)))
      const next = [
        ...logsRef.current,
        // _cid gives the card a React-stable identity across reorders —
        // remounting on index change would drop an uncommitted input draft.
        {
          exerciseId: def.id,
          order: logsRef.current.length,
          sets: [],
          _cid: crypto.randomUUID(),
        } as ExerciseLog,
      ]
      setActiveExIdx(next.length - 1)
      await applyLogs(next)
      requestAnimationFrame(() =>
        listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }),
      )
    },
    [applyLogs],
  )

  const moveExercise = useCallback(
    async (i: number, dir: -1 | 1) => {
      const j = i + dir
      const cur = logsRef.current
      if (j < 0 || j >= cur.length) return
      const next = [...cur]
      ;[next[i], next[j]] = [next[j], next[i]]
      for (let idx = 0; idx < next.length; idx++) next[idx] = { ...next[idx], order: idx }
      // Keep the "active" highlight on the same exercise after the swap.
      setActiveExIdx((cur3) => (cur3 === i ? j : cur3 === j ? i : cur3))
      await applyLogs(next)
    },
    [applyLogs],
  )

  const removeExercise = useCallback(
    async (i: number) => {
      const next = logsRef.current
        .filter((_, idx) => idx !== i)
        .map((l, idx) => ({ ...l, order: idx }))
      setActiveExIdx((cur3) =>
        cur3 == null ? null : cur3 === i ? null : cur3 > i ? cur3 - 1 : cur3,
      )
      await applyLogs(next)
    },
    [applyLogs],
  )

  const restartRestWorker = useCallback((timer: RestTimerState) => {
    setRestTimer(timer)
    startRestTimerWorker(timer, {
      onTick: (remainingSec) =>
        setRestTimer((prev) => (prev ? { ...prev, remainingSec } : prev)),
      onComplete: () => setRestTimer(null),
      getState: () => restRef.current,
    })
  }, [])

  const startRest = useCallback(
    (seconds: number) => restartRestWorker(createRestTimer(Math.max(0, Math.floor(seconds)), 'pill')),
    [restartRestWorker],
  )

  const addRest = useCallback(
    (seconds: number) => {
      const cur = restRef.current
      if (cur) restartRestWorker(addRestTime(cur, seconds))
    },
    [restartRestWorker],
  )

  const skipTimer = useCallback(() => {
    stopRestTimerWorker()
    setRestTimer(null)
  }, [])

  const addSet = useCallback(
    async (exIndex: number, actual: SetActual) => {
      const cur = logsRef.current
      const target = cur[exIndex]
      if (!target) return
      const def = exercises.get(target.exerciseId)
      const setLog: SetLog = makeFreeSetLog(target.sets.length + 1, actual, def?.primaryMetric ?? 'reps')
      const next = cur.map((l, idx) =>
        idx === exIndex ? { ...l, sets: [...l.sets, setLog] } : l,
      )
      setActiveExIdx(exIndex)
      await applyLogs(next)
      // Undo affordance — mistaps happen mid-set. The set object identity
      // survives later mutations ({...l} copies keep element refs), so
      // `includes` finds exactly the log that received this set — even when
      // the same exercise was added twice — and no-ops if it was already
      // edited/replaced or deleted.
      const exName = def?.name ?? pl.exerciseFallbackName
      showToast(pl.freeSetLogged(setLog.setNumber, exName), 'info', {
        action: {
          label: pl.freeUndoSet,
          onClick: () => {
            const cur2 = logsRef.current
            const idx = cur2.findIndex((l) => l.sets.includes(setLog))
            if (idx < 0) return
            void applyLogs(
              cur2.map((l, i) =>
                i === idx
                  ? {
                      ...l,
                      sets: l.sets
                        .filter((s) => s !== setLog)
                        .map((s, si) => ({ ...s, setNumber: si + 1 })),
                    }
                  : l,
              ),
            )
          },
        },
      })
      const rest = def?.restDefaultSec ?? 90
      if (rest > 0) startRest(rest)
    },
    [applyLogs, exercises, startRest],
  )

  const updateSet = useCallback(
    async (exIndex: number, setIndex: number, actual: SetActual) => {
      const cur = logsRef.current
      const target = cur[exIndex]
      const old = target?.sets[setIndex]
      if (!target || !old) return
      const def = exercises.get(target.exerciseId)
      const replacement: SetLog = {
        ...makeFreeSetLog(old.setNumber, actual, def?.primaryMetric ?? 'reps'),
        rpe: old.rpe,
        rir: old.rir,
        note: old.note,
      }
      const next = cur.map((l, idx) =>
        idx === exIndex
          ? { ...l, sets: l.sets.map((s, si) => (si === setIndex ? replacement : s)) }
          : l,
      )
      await applyLogs(next)
    },
    [applyLogs, exercises],
  )

  const deleteSet = useCallback(
    async (exIndex: number, setIndex: number) => {
      const cur = logsRef.current
      const target = cur[exIndex]
      if (!target) return
      const next = cur.map((l, idx) =>
        idx === exIndex
          ? {
              ...l,
              sets: l.sets
                .filter((_, si) => si !== setIndex)
                .map((s, si) => ({ ...s, setNumber: si + 1 })),
            }
          : l,
      )
      await applyLogs(next)
    },
    [applyLogs],
  )

  // --- leave vs finish ---
  const finishWorkout = useCallback(async () => {
    const s = sessionRef.current
    if (!s || busy) return
    setBusy(true)
    try {
      const done = await finishFreeWorkoutSession({ ...s, exerciseLogs: logsRef.current })
      if (done) navigate(`/workout/free/summary?session=${done.id}`)
      else navigate('/', { replace: true }) // abandoned/missing — nothing to summarize
    } finally {
      setBusy(false)
      setFinishSheet('none')
    }
  }, [busy, navigate])

  const discardWorkout = useCallback(async () => {
    const s = sessionRef.current
    if (!s || busy) return
    setBusy(true)
    try {
      await abandonFreeWorkoutSession(s.id)
      navigate('/', { replace: true })
    } finally {
      setBusy(false)
      setFinishSheet('none')
      setLeaveOpen(false)
    }
  }, [busy, navigate])

  // Warn on tab close only when real progress exists (peek-and-leave is silent).
  useEffect(() => {
    if (!hasProgress) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasProgress])

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <PageLoader message={pl.loading} />
      </div>
    )
  }

  if (loadError || !session) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 safe-top">
        <ErrorBanner message={pl.freeWorkoutLoadError} onRetry={() => window.location.reload()} />
      </div>
    )
  }

  const editing = editTarget != null ? logs[editTarget.ex]?.sets[editTarget.set] : undefined
  const editingDef = editTarget != null ? exercises.get(logs[editTarget.ex]?.exerciseId ?? '') : undefined

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 safe-top">
      {/* Header: leave + title + live elapsed clock */}
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 border-b border-[var(--sr-border-subtle)] bg-[var(--sr-bg-base)] px-4 py-3">
        <button
          type="button"
          onClick={() => setLeaveOpen(true)}
          aria-label={pl.back}
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--sr-text-secondary)]',
            FOCUS_RING,
          )}
        >
          <ArrowLeft size={20} aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="sr-text-h2 truncate text-[var(--sr-text-primary)]">{pl.freeWorkoutTitle}</h1>
          <div className="flex items-center gap-1.5">
            <SessionElapsedLabel startedAt={session.startedAt} />
            {(logs.length > 0 || totalSets > 0) && (
              <span className="sr-text-caption text-[var(--sr-text-muted)]">
                · {pl.freeHeaderStats(logs.length, totalSets)}
              </span>
            )}
          </div>
        </div>
      </header>

      {saveError && (
        <div className="mt-3">
          <ErrorBanner message={pl.errorSaveSet} />
        </div>
      )}

      <main className="flex-1 space-y-3 py-4 pb-32">
        {logs.length === 0 ? (
          <div className="rounded-[var(--sr-radius-lg)] border border-dashed border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-6 text-center">
            <Dumbbell size={28} className="mx-auto text-[var(--sr-text-muted)]" aria-hidden />
            <h2 className="mt-2 sr-text-h3 text-[var(--sr-text-primary)]">
              {pl.freeEmptyTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">{pl.freeEmptyHint}</p>
            {quickPicks.length > 0 && (
              <>
                <p className="mt-4 sr-text-caption text-[var(--sr-text-muted)]">
                  {pl.freeRecentExercises}
                </p>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {quickPicks.map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => void addExercise(ex)}
                      className={cn(
                        'inline-flex min-h-[2.5rem] items-center rounded-full border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-4 text-sm font-medium text-[var(--sr-text-primary)]',
                        FOCUS_RING,
                      )}
                    >
                      {ex.name}
                    </button>
                  ))}
                </div>
              </>
            )}
            <Button
              type="button"
              variant="primary"
              size="touch"
              fullWidth
              className="mt-5"
              onClick={() => setLibraryOpen(true)}
            >
              <Plus size={18} aria-hidden />
              {pl.customWorkoutAddExercise}
            </Button>
          </div>
        ) : (
          <>
            {logs.map((log, i) => (
              <FreeExerciseCard
                key={(log as { _cid?: string })._cid ?? `${log.exerciseId}-${i}`}
                log={log}
                def={exercises.get(log.exerciseId)}
                index={i}
                total={logs.length}
                weightUnit={weightUnit}
                initialActual={lastActuals.get(log.exerciseId)}
                isActive={i === activeExIdx}
                onAddSet={(actual) => void addSet(i, actual)}
                onEditSet={(setIndex) => setEditTarget({ ex: i, set: setIndex })}
                onMove={(dir) => void moveExercise(i, dir)}
                onRemove={() => {
                  if (log.sets.length > 0) setRemoveTarget(i)
                  else void removeExercise(i)
                }}
              />
            ))}
            <div ref={listEndRef} />
          </>
        )}
      </main>

      {/* Sticky action bar — both primary gym actions stay thumb-reachable. */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-[var(--sr-border-subtle)] bg-[var(--sr-bg-base)] px-4 py-3 safe-bottom">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            type="button"
            variant="primary"
            size="touch"
            className="flex-1"
            onClick={() => setLibraryOpen(true)}
          >
            <Plus size={18} aria-hidden />
            {pl.customWorkoutAddExercise}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="touch"
            className="flex-1"
            onClick={() => setFinishSheet(hasProgress ? 'finish' : 'empty')}
          >
            <Flag size={18} aria-hidden />
            {pl.freeFinishWorkout}
          </Button>
        </div>
      </div>

      {restTimer && restTimer.mode === 'pill' && (
        <div className="fixed bottom-24 inset-x-0 z-20 flex justify-center px-4">
          <RestTimerPill
            remainingSec={restTimer.remainingSec}
            onExpand={() => restartRestWorker({ ...restTimer, mode: 'expanded' })}
            onAdd15={() => addRest(15)}
          />
        </div>
      )}
      {restTimer?.mode === 'expanded' && (
        <RestTimerExpanded
          remainingSec={restTimer.remainingSec}
          totalSec={restTimer.totalSec}
          nextLabel={pl.freeRestNextLabel}
          onAdd15={() => addRest(15)}
          onAdd30={() => addRest(30)}
          onSkip={skipTimer}
          onCollapse={() => restartRestWorker({ ...restTimer, mode: 'pill' })}
        />
      )}

      <ExerciseLibrarySheet
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onPick={(ex) => void addExercise(ex)}
      />

      {/* Edit set */}
      {editTarget != null && editing && (
        <EditFreeSetSheet
          set={editing}
          metric={editingDef?.primaryMetric ?? 'reps'}
          durationUnit={editingDef?.durationDisplayUnit ?? 'sec'}
          weightUnit={weightUnit}
          onSave={(actual) => {
            void updateSet(editTarget.ex, editTarget.set, actual)
            setEditTarget(null)
          }}
          onDelete={() => {
            void deleteSet(editTarget.ex, editTarget.set)
            setEditTarget(null)
          }}
          onClose={() => setEditTarget(null)}
        />
      )}

      {/* Remove exercise (only confirmed when it has logged sets) */}
      {removeTarget != null && (
        <ConfirmSheet
          title={pl.freeRemoveExerciseTitle}
          message={pl.freeRemoveExerciseConfirm}
          confirmLabel={pl.freeRemoveExercise}
          variant="danger"
          onConfirm={() => {
            void removeExercise(removeTarget)
            setRemoveTarget(null)
          }}
          onCancel={() => setRemoveTarget(null)}
        />
      )}

      {/* Finish / discard */}
      {finishSheet === 'finish' && (
        <ConfirmSheet
          title={pl.freeFinishTitle}
          message={pl.freeFinishConfirm(
            logs.filter((l) => l.sets.length > 0).length,
            totalSets,
          )}
          confirmLabel={pl.freeFinishWorkout}
          confirming={busy}
          onConfirm={() => void finishWorkout()}
          onCancel={() => setFinishSheet('none')}
        />
      )}
      {finishSheet === 'empty' && (
        <ConfirmSheet
          title={pl.freeFinishTitle}
          message={pl.freeFinishEmptyConfirm}
          confirmLabel={pl.cancelWorkoutConfirmAction}
          variant="danger"
          confirming={busy}
          onConfirm={() => void discardWorkout()}
          onCancel={() => setFinishSheet('none')}
        />
      )}

      {/* Leave: session stays resumable unless explicitly discarded */}
      {leaveOpen && (
        <ConfirmSheet
          title={pl.freeLeaveTitle}
          message={hasProgress ? pl.freeLeaveDesc : pl.freeLeaveEmptyDesc}
          confirmLabel={hasProgress ? pl.freeLeaveAction : pl.cancelWorkoutConfirmAction}
          variant={hasProgress ? 'primary' : 'danger'}
          confirming={busy}
          onConfirm={() => {
            if (hasProgress) {
              navigate('/', { replace: true })
            } else {
              void discardWorkout()
            }
          }}
          extraActions={
            hasProgress ? (
              <Button
                type="button"
                variant="danger"
                fullWidth
                disabled={busy}
                onClick={() => void discardWorkout()}
              >
                {pl.freeDiscardAction}
              </Button>
            ) : undefined
          }
          onCancel={() => setLeaveOpen(false)}
        />
      )}
    </div>
  )
}

/** Sheet for editing or deleting a logged free-workout set. */
function EditFreeSetSheet({
  set,
  metric,
  durationUnit,
  weightUnit,
  onSave,
  onDelete,
  onClose,
}: {
  set: SetLog
  metric: 'reps' | 'duration_sec' | 'reps_weight'
  durationUnit: 'sec' | 'min'
  weightUnit: 'kg' | 'lb'
  onSave: (actual: SetActual) => void
  onDelete: () => void
  onClose: () => void
}) {
  const isDuration = metric === 'duration_sec'
  const isRepsWeight = metric === 'reps_weight'
  const [primary, setPrimary] = useState(
    isDuration
      ? durationUnit === 'min'
        ? String(Math.round(((set.actual.durationSec ?? 0) / 60) * 10) / 10)
        : String(set.actual.durationSec ?? '')
      : String(set.actual.reps ?? ''),
  )
  const [weight, setWeight] = useState(
    isRepsWeight && set.actual.weightKg != null
      ? String(kgToDisplay(set.actual.weightKg, weightUnit))
      : '',
  )

  const primaryNum = Number(primary.replace(',', '.'))
  const valid = Number.isFinite(primaryNum) && primaryNum > 0

  function save() {
    if (!valid) return
    const actual: SetActual = isDuration
      ? { durationSec: Math.round(durationUnit === 'min' ? primaryNum * 60 : primaryNum) }
      : { reps: Math.round(primaryNum) }
    if (isRepsWeight && weight.trim() !== '') {
      const w = Number(weight.replace(',', '.'))
      if (Number.isFinite(w) && w >= 0) actual.weightKg = displayToKg(w, weightUnit)
    }
    onSave(actual)
  }

  return (
    <Sheet open onClose={onClose} title={pl.freeEditSetTitle(set.setNumber)}>
      <div className="flex flex-col gap-3">
        <TextField
          id="free-edit-set-primary"
          label={isDuration ? pl.freeDurationLabel(durationUnit) : pl.freeRepsLabel}
          inputMode="decimal"
          value={primary}
          onChange={(e) => setPrimary(e.target.value)}
        />
        {isRepsWeight && (
          <TextField
            id="free-edit-set-weight"
            label={pl.freeWeightLabel(weightUnit)}
            inputMode="decimal"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
        )}
        <Button type="button" variant="primary" fullWidth disabled={!valid} onClick={save}>
          {pl.freeSaveSet}
        </Button>
        <Button type="button" variant="danger" fullWidth onClick={onDelete}>
          {pl.customWorkoutRemoveSet}
        </Button>
      </div>
    </Sheet>
  )
}
