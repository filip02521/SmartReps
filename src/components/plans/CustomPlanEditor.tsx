import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { TextField, CheckboxField } from '@/components/ui/TextField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ExerciseLibraryPanel } from '@/components/plans/ExerciseLibraryPanel'
import { CustomSetChips } from '@/components/plans/CustomSetChips'
import { RestSecChips, SetsCountStepper } from '@/components/plans/RestSecChips'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { FeedbackBanner } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import type {
  CustomPlan,
  ExerciseDefinition,
  PlannedExercise,
  SetPrescription,
} from '@/lib/exercise-model'
import { validateCustomPlan } from '@/lib/exercise-model'
import {
  createEmptyDraftPlan,
  deleteCustomPlan,
  duplicatePlanDay,
  adjustCustomProgressAfterDayDelete,
  getCustomPlan,
  hasActiveCustomWorkout,
  isEmptyOrphanDraft,
  listExercises,
  saveCustomPlan,
  shouldPersistDraft,
} from '@/lib/custom-plan-service'
import { previewProgressionDiff } from '@/lib/custom-progression'
import { showToast } from '@/stores/toast-store'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'
import { metricTargetDisplayValue } from '@/lib/plan-resolver'

type EditorView =
  | { screen: 'hub' }
  | { screen: 'day'; dayIndex: number }
  | { screen: 'exercise'; dayIndex: number; exerciseIndex: number }
  | { screen: 'pick'; dayIndex: number }

function defaultSets(metric: ExerciseDefinition['primaryMetric']): SetPrescription[] {
  if (metric === 'duration_sec') return [{ durationSec: { kind: 'min', value: 30 } }]
  if (metric === 'reps_weight') {
    return [{ reps: { kind: 'fixed', value: 8 }, weightKg: { kind: 'fixed', value: 20 } }]
  }
  return [{ reps: { kind: 'fixed', value: 8 } }]
}

function dayExerciseNames(
  day: CustomPlan['days'][number],
  exercises: ExerciseDefinition[],
): string {
  return day.exercises
    .map((pe) => exercises.find((e) => e.id === pe.exerciseId)?.name ?? pl.planEllipsis)
    .join(' · ')
}

function renumberDays(days: CustomPlan['days']): CustomPlan['days'] {
  return days.map((d, i) => ({
    ...d,
    dayNumber: i + 1,
    exercises: d.exercises.map((ex, order) => ({ ...ex, order })),
  }))
}

export function CustomPlanEditor({
  open,
  planId,
  onClose,
  onSaved,
}: {
  open: boolean
  planId: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [view, setView] = useState<EditorView>({ screen: 'hub' })
  const [plan, setPlan] = useState<CustomPlan>(() => createEmptyDraftPlan())
  const [persisted, setPersisted] = useState(false)
  const [exercises, setExercises] = useState<ExerciseDefinition[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [deleteDayIndex, setDeleteDayIndex] = useState<number | null>(null)
  const [showProgression, setShowProgression] = useState(false)
  const [editBlocked, setEditBlocked] = useState(false)
  const saveTimer = useRef<number | null>(null)
  const planRef = useRef(plan)
  const persistedRef = useRef(persisted)
  const saveGenRef = useRef(0)
  const editorSessionRef = useRef(0)

  useEffect(() => {
    planRef.current = plan
  }, [plan])

  useEffect(() => {
    persistedRef.current = persisted
  }, [persisted])

  useEffect(() => {
    if (!open) return
    const session = ++editorSessionRef.current
    saveGenRef.current += 1
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    void (async () => {
      const exs = await listExercises()
      if (session !== editorSessionRef.current) return
      setExercises(exs)
      setValidationErrors([])
      setView({ screen: 'hub' })
      setDeleteDayIndex(null)
      setEditBlocked(false)
      if (planId) {
        const existing = await getCustomPlan(planId)
        if (session !== editorSessionRef.current) return
        if (existing) {
          const blocked = await hasActiveCustomWorkout(planId)
          if (session !== editorSessionRef.current) return
          if (blocked) {
            setEditBlocked(true)
            showToast(pl.planEditBlockedActive, 'error')
          }
          setPlan(existing)
          setPersisted(true)
          setShowProgression(Boolean(existing.progression?.enabled))
          return
        }
      }
      if (session !== editorSessionRef.current) return
      setPlan(createEmptyDraftPlan())
      setPersisted(false)
      setShowProgression(false)
    })()
  }, [open, planId])

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  async function flushSave(next: CustomPlan, force = false) {
    if (editBlocked) return
    if (!force && !shouldPersistDraft(next) && !persistedRef.current) {
      setPlan(next)
      return
    }
    const gen = ++saveGenRef.current
    const session = editorSessionRef.current
    setPlan(next)
    try {
      const saved = await saveCustomPlan(next, { skipValidation: true })
      if (gen !== saveGenRef.current || session !== editorSessionRef.current) return
      setPlan(saved)
      setPersisted(true)
    } catch {
      // ignore incomplete autosave races
    }
  }

  function updatePlan(next: CustomPlan) {
    if (editBlocked) return
    setPlan(next)
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      void flushSave(next)
    }, 400)
  }

  async function syncProgressAfterDayDelete(planIdToFix: string, days: CustomPlan['days']) {
    await adjustCustomProgressAfterDayDelete(planIdToFix, days)
  }

  async function handleClose() {
    if (saveTimer.current) {
      window.clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    // Invalidate in-flight autosaves so they cannot resurrect orphans or overwrite.
    saveGenRef.current += 1
    const current = planRef.current
    const wasPersisted = persistedRef.current
    let didWrite = false
    if (editBlocked) {
      onClose()
      return
    }
    if (wasPersisted && isEmptyOrphanDraft(current)) {
      await deleteCustomPlan(current.id)
      didWrite = true
    } else if (shouldPersistDraft(current) || wasPersisted) {
      try {
        await saveCustomPlan(current, { skipValidation: true })
        didWrite = true
      } catch {
        // ignore
      }
    }
    if (didWrite) onSaved()
    onClose()
  }

  const day =
    view.screen === 'day' || view.screen === 'exercise' || view.screen === 'pick'
      ? plan.days[view.dayIndex]
      : undefined
  const exerciseIndex = view.screen === 'exercise' ? view.exerciseIndex : 0
  const planned = day?.exercises[exerciseIndex]
  const exDef = planned ? exercises.find((e) => e.id === planned.exerciseId) : undefined

  function sheetTitle() {
    if (view.screen === 'pick') return pl.exercisePickTitle
    if (view.screen === 'day' && day) return pl.planDayLabel(day.dayNumber)
    if (view.screen === 'exercise') return exDef?.name ?? pl.planEllipsis
    return plan.name.trim() || pl.newCustomPlan
  }

  function updatePlanned(
    dayIdx: number,
    exIdx: number,
    patch: Partial<PlannedExercise>,
  ) {
    const d = plan.days[dayIdx]
    const pe = d?.exercises[exIdx]
    if (!d || !pe) return
    const exercisesInDay = [...d.exercises]
    exercisesInDay[exIdx] = { ...pe, ...patch }
    const days = [...plan.days]
    days[dayIdx] = { ...d, exercises: exercisesInDay }
    updatePlan({ ...plan, days })
  }

  function updateSet(dayIdx: number, exIdx: number, setIdx: number, prescription: SetPrescription) {
    const pe = plan.days[dayIdx]?.exercises[exIdx]
    if (!pe) return
    const sets = [...pe.sets]
    sets[setIdx] = prescription
    updatePlanned(dayIdx, exIdx, { sets })
  }

  function appendExercise(dayIdx: number, ex: ExerciseDefinition) {
    const d = plan.days[dayIdx]
    if (!d) return
    const pe: PlannedExercise = {
      exerciseId: ex.id,
      order: d.exercises.length,
      restBetweenSetsSec: ex.restDefaultSec,
      restAfterExerciseSec: 60,
      sets: defaultSets(ex.primaryMetric),
    }
    const days = [...plan.days]
    days[dayIdx] = { ...d, exercises: [...d.exercises, pe] }
    const next = { ...plan, days }
    updatePlan(next)
    setExercises((prev) => (prev.some((e) => e.id === ex.id) ? prev : [...prev, ex]))
    setView({ screen: 'exercise', dayIndex: dayIdx, exerciseIndex: d.exercises.length })
  }

  async function handleActivate() {
    if (await hasActiveCustomWorkout(plan.id)) {
      showToast(pl.planEditBlockedActive, 'error')
      return
    }
    const byId = new Map(exercises.map((e) => [e.id, e]))
    const issues = validateCustomPlan(plan, byId)
    if (issues.length) {
      setValidationErrors(issues.map((i) => i.message))
      showToast(pl.planValidationFix, 'error')
      setView({ screen: 'hub' })
      return
    }
    setValidationErrors([])
    try {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      saveGenRef.current += 1
      await saveCustomPlan(plan, { activate: true })
      setPersisted(true)
      showToast(pl.planPublish, 'success')
      onSaved()
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : pl.errorCrash, 'error')
    }
  }

  async function handleSaveDraft() {
    try {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      saveGenRef.current += 1
      await saveCustomPlan({ ...plan, status: 'draft' }, { skipValidation: true })
      setPersisted(true)
      showToast(pl.planSaveDraft, 'success')
      onSaved()
      onClose()
    } catch (e) {
      showToast(e instanceof Error ? e.message : pl.errorCrash, 'error')
    }
  }

  function confirmDeleteDay() {
    if (deleteDayIndex == null) return
    if (plan.days.length <= 1) {
      showToast(pl.planCannotDeleteLastDay, 'error')
      setDeleteDayIndex(null)
      return
    }
    const days = renumberDays(plan.days.filter((_, i) => i !== deleteDayIndex))
    const next = { ...plan, days }
    updatePlan(next)
    void syncProgressAfterDayDelete(plan.id, days)
    setDeleteDayIndex(null)
    setView({ screen: 'hub' })
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={() => void handleClose()}
        title={sheetTitle()}
        className="max-h-[92vh] overflow-y-auto"
      >
        {view.screen === 'hub' && (
          <div className="flex flex-col gap-4">
            {editBlocked && (
              <FeedbackBanner variant="warning" message={pl.planEditBlockedActive} />
            )}
            <TextField
              id="plan-name"
              label={pl.planName}
              value={plan.name}
              disabled={editBlocked}
              onChange={(e) => updatePlan({ ...plan, name: e.target.value })}
            />
            <TextField
              id="plan-desc"
              label={pl.planDescription}
              value={plan.description}
              disabled={editBlocked}
              onChange={(e) => updatePlan({ ...plan, description: e.target.value })}
            />

            {validationErrors.length > 0 && (
              <FeedbackBanner
                variant="warning"
                title={pl.planValidationFix}
                message={validationErrors.join(' · ')}
              />
            )}

            <ul className="flex flex-col gap-2">
              {plan.days.map((d, i) => (
                <li
                  key={d.dayNumber}
                  className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] p-3"
                >
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      className={cn('min-h-11 min-w-0 flex-1 text-left', FOCUS_RING)}
                      onClick={() => setView({ screen: 'day', dayIndex: i })}
                    >
                      <p className="font-semibold text-[var(--sr-text-primary)]">
                        {pl.planDayLabel(d.dayNumber)}
                        <span className="ml-2 font-normal text-[var(--sr-text-muted)]">
                          {pl.planExercisesShort(d.exercises.length)} ·{' '}
                          {pl.planDayRestShort(d.restAfterDay)}
                        </span>
                      </p>
                      {d.exercises.length > 0 && (
                        <p className="mt-1 truncate text-sm text-[var(--sr-text-secondary)]">
                          {dayExerciseNames(d, exercises)}
                        </p>
                      )}
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-11"
                      onClick={() => {
                        const nextNum = Math.max(0, ...plan.days.map((x) => x.dayNumber)) + 1
                        updatePlan({
                          ...plan,
                          days: [...plan.days, duplicatePlanDay(d, nextNum)],
                        })
                      }}
                    >
                      {pl.planDuplicateDay}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-11"
                      aria-label={pl.planDeleteDay}
                      onClick={() => {
                        if (plan.days.length <= 1) {
                          showToast(pl.planCannotDeleteLastDay, 'error')
                          return
                        }
                        if (d.exercises.length > 0) setDeleteDayIndex(i)
                        else {
                          const days = renumberDays(plan.days.filter((_, idx) => idx !== i))
                          updatePlan({ ...plan, days })
                          void syncProgressAfterDayDelete(plan.id, days)
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const nextNum = Math.max(0, ...plan.days.map((x) => x.dayNumber)) + 1
                updatePlan({
                  ...plan,
                  days: [
                    ...plan.days,
                    { dayNumber: nextNum, restAfterDay: 1, exercises: [] },
                  ],
                })
              }}
            >
              {pl.planAddDay}
            </Button>

            <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] p-3">
              <CheckboxField
                id="prog-enable"
                label={pl.progressionEnable}
                description={pl.progressionHint}
                checked={plan.progression?.enabled ?? false}
                onChange={(checked) => {
                  setShowProgression(checked)
                  updatePlan({
                    ...plan,
                    progression: {
                      enabled: checked,
                      afterCycleComplete: true,
                      repsDelta: plan.progression?.repsDelta ?? 2,
                      weightKgDelta: plan.progression?.weightKgDelta ?? 2.5,
                      durationSecDelta: plan.progression?.durationSecDelta ?? 5,
                    },
                  })
                }}
              />
              {(showProgression || plan.progression?.enabled) && plan.progression?.enabled && (
                <div className="mt-3 flex flex-col gap-2">
                  <TextField
                    id="prog-reps"
                    label={pl.progressionReps}
                    type="number"
                    value={plan.progression.repsDelta ?? 0}
                    onChange={(e) =>
                      updatePlan({
                        ...plan,
                        progression: {
                          ...plan.progression!,
                          repsDelta: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                  <TextField
                    id="prog-kg"
                    label={pl.progressionKg}
                    type="number"
                    value={plan.progression.weightKgDelta ?? 0}
                    onChange={(e) =>
                      updatePlan({
                        ...plan,
                        progression: {
                          ...plan.progression!,
                          weightKgDelta: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                  <TextField
                    id="prog-sec"
                    label={pl.progressionSec}
                    type="number"
                    value={plan.progression.durationSecDelta ?? 0}
                    onChange={(e) =>
                      updatePlan({
                        ...plan,
                        progression: {
                          ...plan.progression!,
                          durationSecDelta: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                  <p className="text-xs text-[var(--sr-text-muted)]">
                    {pl.progressionPreviewCount(
                      previewProgressionDiff(plan, plan.progression).length,
                    )}
                  </p>
                </div>
              )}
            </div>

            <Button type="button" variant="secondary" fullWidth onClick={() => void handleSaveDraft()}>
              {pl.planSaveDraft}
            </Button>
            <Button type="button" size="touch" fullWidth onClick={() => void handleActivate()}>
              {pl.planPublish}
            </Button>
          </div>
        )}

        {view.screen === 'day' && day && (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="ghost"
              className="self-start"
              onClick={() => setView({ screen: 'hub' })}
            >
              ← {pl.planBack}
            </Button>

            <div>
              <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
                {pl.planRestAfterDay}
              </p>
              <SegmentedControl
                value={String(day.restAfterDay) as '1' | '2'}
                onChange={(v) => {
                  const days = [...plan.days]
                  days[view.dayIndex] = { ...day, restAfterDay: v === '2' ? 2 : 1 }
                  updatePlan({ ...plan, days })
                }}
                options={[
                  { value: '1', label: pl.planRestDay1 },
                  { value: '2', label: pl.planRestDay2 },
                ]}
              />
            </div>

            <ul className="flex flex-col gap-2">
              {day.exercises.map((pe, i) => {
                const def = exercises.find((e) => e.id === pe.exerciseId)
                const name = def?.name ?? pl.planEllipsis
                return (
                  <li
                    key={`${pe.exerciseId}-${i}`}
                    className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] p-2"
                  >
                    <div className="flex items-start gap-1">
                      <button
                        type="button"
                        className={cn('min-h-11 min-w-0 flex-1 text-left', FOCUS_RING)}
                        onClick={() =>
                          setView({
                            screen: 'exercise',
                            dayIndex: view.dayIndex,
                            exerciseIndex: i,
                          })
                        }
                      >
                        <p className="font-medium">
                          {name}{' '}
                          <span className="text-[var(--sr-text-muted)]">
                            · {pl.planSetsShort(pe.sets.length)}
                          </span>
                        </p>
                        {def && (
                          <CustomSetChips
                            className="mt-2"
                            size="sm"
                            sets={pe.sets}
                            metric={def.primaryMetric}
                          />
                        )}
                      </button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-11 min-w-11"
                        disabled={i === 0}
                        aria-label={pl.planMoveUp}
                        onClick={() => {
                          const list = day.exercises.map((x) => ({ ...x }))
                          ;[list[i - 1], list[i]] = [list[i]!, list[i - 1]!]
                          const ordered = list.map((x, idx) => ({ ...x, order: idx }))
                          const days = [...plan.days]
                          days[view.dayIndex] = { ...day, exercises: ordered }
                          updatePlan({ ...plan, days })
                        }}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-11 min-w-11"
                        disabled={i === day.exercises.length - 1}
                        aria-label={pl.planMoveDown}
                        onClick={() => {
                          const list = day.exercises.map((x) => ({ ...x }))
                          ;[list[i], list[i + 1]] = [list[i + 1]!, list[i]!]
                          const ordered = list.map((x, idx) => ({ ...x, order: idx }))
                          const days = [...plan.days]
                          days[view.dayIndex] = { ...day, exercises: ordered }
                          updatePlan({ ...plan, days })
                        }}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-11 min-w-11"
                        aria-label={pl.planRemoveExercise}
                        onClick={() => {
                          const list = day.exercises
                            .filter((_, idx) => idx !== i)
                            .map((x, idx) => ({ ...x, order: idx }))
                          const days = [...plan.days]
                          days[view.dayIndex] = { ...day, exercises: list }
                          updatePlan({ ...plan, days })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>

            <Button
              type="button"
              variant="secondary"
              onClick={() => setView({ screen: 'pick', dayIndex: view.dayIndex })}
            >
              {pl.planAddExercise}
            </Button>
          </div>
        )}

        {view.screen === 'pick' && (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="ghost"
              className="self-start"
              onClick={() => setView({ screen: 'day', dayIndex: view.dayIndex })}
            >
              ← {pl.planBack}
            </Button>
            <ExerciseLibraryPanel
              mode="pick"
              onPick={(ex) => appendExercise(view.dayIndex, ex)}
              onExercisesChange={setExercises}
            />
          </div>
        )}

        {view.screen === 'exercise' && planned && day && (
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="ghost"
              className="self-start"
              onClick={() => setView({ screen: 'day', dayIndex: view.dayIndex })}
            >
              ← {pl.planBack}
            </Button>

            <RestSecChips
              id="rest-sets"
              label={pl.planRestBetweenSets}
              value={planned.restBetweenSetsSec}
              onChange={(sec) =>
                updatePlanned(view.dayIndex, view.exerciseIndex, { restBetweenSetsSec: sec })
              }
            />
            <RestSecChips
              id="rest-ex"
              label={pl.planRestAfterExercise}
              value={planned.restAfterExerciseSec ?? 60}
              onChange={(sec) =>
                updatePlanned(view.dayIndex, view.exerciseIndex, { restAfterExerciseSec: sec })
              }
            />

            <SetsCountStepper
              value={planned.sets.length}
              onChange={(n) => {
                const metric = exDef?.primaryMetric ?? 'reps'
                const sets: SetPrescription[] = Array.from({ length: n }, (_, i) => {
                  const prev = planned.sets[i]
                  if (prev) return prev
                  return defaultSets(metric)[0]!
                })
                updatePlanned(view.dayIndex, view.exerciseIndex, { sets })
              }}
            />

            {planned.sets.map((s, i) => (
              <div key={i} className="flex flex-col gap-2 sm:flex-row">
                <TextField
                  id={`set-${i}`}
                  className="flex-1"
                  label={`${pl.planTargetValue} · ${i + 1}`}
                  type="number"
                  value={
                    s.durationSec
                      ? metricTargetDisplayValue(s.durationSec)
                      : s.reps
                        ? metricTargetDisplayValue(s.reps)
                        : 0
                  }
                  onChange={(e) => {
                    const v = Number(e.target.value) || 0
                    if (exDef?.primaryMetric === 'duration_sec') {
                      updateSet(view.dayIndex, view.exerciseIndex, i, {
                        durationSec: { kind: 'min', value: v },
                      })
                    } else {
                      updateSet(view.dayIndex, view.exerciseIndex, i, {
                        reps: { kind: 'fixed', value: v },
                        weightKg: s.weightKg,
                      })
                    }
                  }}
                />
                {exDef?.primaryMetric === 'reps_weight' && (
                  <TextField
                    id={`set-kg-${i}`}
                    className="flex-1"
                    label={pl.customWorkoutWeightKg}
                    type="number"
                    inputMode="decimal"
                    value={
                      s.weightKg
                        ? s.weightKg.kind === 'max'
                          ? s.weightKg.minValue
                          : s.weightKg.value
                        : ''
                    }
                    onChange={(e) => {
                      const v = e.target.value === '' ? undefined : Number(e.target.value)
                      updateSet(view.dayIndex, view.exerciseIndex, i, {
                        reps: s.reps ?? { kind: 'fixed', value: 8 },
                        weightKg:
                          v == null || !Number.isFinite(v)
                            ? undefined
                            : { kind: 'fixed', value: v },
                      })
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </Sheet>

      {deleteDayIndex != null && (
        <ConfirmSheet
          title={pl.planDeleteDay}
          message={pl.planDeleteDayConfirm}
          confirmLabel={pl.planDeleteDay}
          variant="danger"
          onConfirm={confirmDeleteDay}
          onCancel={() => setDeleteDayIndex(null)}
        />
      )}
    </>
  )
}
