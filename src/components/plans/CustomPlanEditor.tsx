import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronUp, Trash2, ArrowLeft, Copy, Dumbbell, Repeat, Plus, MoreHorizontal } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SwitchRow } from '@/components/ui/Switch'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { ExerciseLibraryPanel } from '@/components/plans/ExerciseLibraryPanel'
import { CustomSetChips } from '@/components/plans/CustomSetChips'
import { CustomSetPrescriptionEditor } from '@/components/plans/CustomSetPrescriptionEditor'
import { RestSecChips, SetsCountStepper } from '@/components/plans/RestSecChips'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { FeedbackBanner, EmptyState } from '@/components/ux/Feedback'
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
  saveExercise,
  shouldPersistDraft,
} from '@/lib/custom-plan-service'
import { canEditCustomPlanDay } from '@/lib/custom-plan-edit-lock'
import { previewProgressionDiff } from '@/lib/custom-progression'
import {
  countExercisesInGroup,
  dissolveExerciseGroup,
  linkExercisesWithNext,
  unlinkExerciseFromGroup,
  updateExerciseGroup,
} from '@/lib/custom-plan-groups'
import type { ExerciseGroupKind } from '@/lib/exercise-model'
import { showToast } from '@/stores/toast-store'
import { useAppStore } from '@/stores/app-store'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'

type EditorView =
  | { screen: 'hub' }
  | { screen: 'day'; dayIndex: number }
  | { screen: 'exercise'; dayIndex: number; exerciseIndex: number }
  | { screen: 'pick'; dayIndex: number }
  | { screen: 'pickReplace'; dayIndex: number; exerciseIndex: number }

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

function SaveBar({
  plan,
  onActivate,
  onSaveDraft,
}: {
  plan: CustomPlan
  onActivate: () => void
  onSaveDraft: () => void
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-4 flex flex-col gap-2 border-t border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
      <Button type="button" size="touch" fullWidth onClick={onActivate}>
        {plan.status === 'active'
          ? pl.planSaveActive
          : plan.source === 'community'
            ? pl.communityActivateHint
            : pl.planPublish}
      </Button>
      <Button type="button" variant="ghost" fullWidth onClick={onSaveDraft}>
        {pl.planSaveDraft}
      </Button>
    </div>
  )
}

export function CustomPlanEditor({
  open,
  planId,
  initialDayNumber,
  activeWorkoutDayNumber,
  onClose,
  onSaved,
}: {
  open: boolean
  planId: string | null
  initialDayNumber?: number | null
  activeWorkoutDayNumber?: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const navigate = useNavigate()
  const [view, setView] = useState<EditorView>({ screen: 'hub' })
  const [plan, setPlan] = useState<CustomPlan>(() => createEmptyDraftPlan())
  const [persisted, setPersisted] = useState(false)
  const [exercises, setExercises] = useState<ExerciseDefinition[]>([])
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [deleteDayIndex, setDeleteDayIndex] = useState<number | null>(null)
  const [showProgression, setShowProgression] = useState(false)
  const [showDeload, setShowDeload] = useState(false)
  const [expandedExercise, setExpandedExercise] = useState<number | null>(null)
  const [expandedDay, setExpandedDay] = useState<number | null>(null)
  const exerciseNameTimer = useRef<number | null>(null)
  const activeDay = activeWorkoutDayNumber ?? null

  function isDayLocked(dayNumber: number): boolean {
    return !canEditCustomPlanDay(activeDay, dayNumber)
  }

  function guardDayEdit(dayIndex: number): boolean {
    const dayNumber = plan.days[dayIndex]?.dayNumber
    if (dayNumber == null) return true
    if (isDayLocked(dayNumber)) {
      showToast(pl.customEditBlockedActiveDay, 'error')
      return false
    }
    return true
  }
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
      if (planId) {
        const existing = await getCustomPlan(planId)
        if (session !== editorSessionRef.current) return
        if (existing) {
          setPlan(existing)
          setPersisted(true)
          setShowProgression(Boolean(existing.progression?.enabled))
          setShowDeload(Boolean(existing.deload?.enabled))
          if (initialDayNumber != null) {
            const dayIndex = existing.days.findIndex((d) => d.dayNumber === initialDayNumber)
            if (dayIndex >= 0) {
              setView({ screen: 'day', dayIndex })
            }
          }
          return
        }
      }
      if (session !== editorSessionRef.current) return
      setPlan(createEmptyDraftPlan())
      setPersisted(false)
      setShowProgression(false)
      setShowDeload(false)
    })()
  }, [open, planId, initialDayNumber])

  useEffect(() => {
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current)
    }
  }, [])

  async function flushSave(next: CustomPlan, force = false) {
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
    view.screen === 'day' || view.screen === 'exercise' || view.screen === 'pick' || view.screen === 'pickReplace'
      ? plan.days[view.dayIndex]
      : undefined
  const exerciseIndex = view.screen === 'exercise' ? view.exerciseIndex : 0
  const planned = day?.exercises[exerciseIndex]
  const exDef = planned ? exercises.find((e) => e.id === planned.exerciseId) : undefined
  const exerciseDayLocked =
    view.screen === 'exercise' && day != null ? isDayLocked(day.dayNumber) : false

  function sheetTitle() {
    if (view.screen === 'pick') return pl.exercisePickTitle
    if (view.screen === 'pickReplace') return pl.exerciseReplaceTitle
    if (view.screen === 'day' && day) return pl.planDayLabel(day.dayNumber)
    if (view.screen === 'exercise') return exDef?.name ?? pl.planEllipsis
    return plan.name.trim() || pl.newCustomPlan
  }

  function updatePlanned(
    dayIdx: number,
    exIdx: number,
    patch: Partial<PlannedExercise>,
  ) {
    if (!guardDayEdit(dayIdx)) return
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
    if (!guardDayEdit(dayIdx)) return
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

  /** Replace the exercise definition at (dayIdx, exIdx) while keeping sets, rests, notes, progression. */
  function replaceExercise(dayIdx: number, exIdx: number, ex: ExerciseDefinition) {
    if (!guardDayEdit(dayIdx)) return
    const d = plan.days[dayIdx]
    if (!d) return
    const current = d.exercises[exIdx]
    if (!current) return
    const updated: PlannedExercise = {
      ...current,
      exerciseId: ex.id,
    }
    const exercises = [...d.exercises]
    exercises[exIdx] = updated
    const days = [...plan.days]
    days[dayIdx] = { ...d, exercises }
    updatePlan({ ...plan, days })
    setExercises((prev) => (prev.some((e) => e.id === ex.id) ? prev : [...prev, ex]))
    setView({ screen: 'exercise', dayIndex: dayIdx, exerciseIndex: exIdx })
  }

  const filterExplicit = useAppStore((s) => s.settings.customPlansFilterExplicit)

  async function handleActivate() {
    const hasActive = await hasActiveCustomWorkout(plan.id)
    if (hasActive && plan.status === 'draft') {
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
    const activating = plan.status !== 'active'
    try {
      if (saveTimer.current) {
        window.clearTimeout(saveTimer.current)
        saveTimer.current = null
      }
      saveGenRef.current += 1
      await saveCustomPlan(plan, activating ? { activate: true } : undefined)
      setPersisted(true)
      showToast(activating ? pl.planPublish : pl.planSaveActive, 'success')
      if (activating && !filterExplicit) {
        showToast(pl.customHomePinPrompt, 'info', {
          durationMs: 10000,
          action: {
            label: pl.navProfile,
            onClick: () => navigate('/profile'),
          },
        })
      }
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
    if (!guardDayEdit(deleteDayIndex)) {
      setDeleteDayIndex(null)
      return
    }
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
          <div className="flex flex-col gap-5">
            {activeDay != null && (
              <FeedbackBanner variant="warning" message={pl.customEditBlockedActiveDay} />
            )}

            {/* Plan summary card */}
            <div className="flex items-center gap-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] px-4 py-3">
              <div className="flex flex-1 flex-col items-center gap-0.5">
                <span className="text-xl font-bold text-[var(--sr-text-primary)]">
                  {plan.days.length}
                </span>
                <span className="text-xs text-[var(--sr-text-muted)]">
                  {pl.planSummaryDays(plan.days.length)}
                </span>
              </div>
              <div className="h-8 w-px bg-[var(--sr-border-subtle)]" />
              <div className="flex flex-1 flex-col items-center gap-0.5">
                <span className="text-xl font-bold text-[var(--sr-text-primary)]">
                  {plan.days.reduce((acc, d) => acc + d.exercises.length, 0)}
                </span>
                <span className="text-xs text-[var(--sr-text-muted)]">
                  {pl.planSummaryExercises(plan.days.reduce((acc, d) => acc + d.exercises.length, 0))}
                </span>
              </div>
              <div className="h-8 w-px bg-[var(--sr-border-subtle)]" />
              <div className="flex flex-1 flex-col items-center gap-0.5">
                <span className="text-xl font-bold text-[var(--sr-text-primary)]">
                  {plan.days.reduce(
                    (acc, d) => acc + d.exercises.reduce((s, e) => s + e.sets.length, 0),
                    0,
                  )}
                </span>
                <span className="text-xs text-[var(--sr-text-muted)]">
                  {pl.planSummarySets(
                    plan.days.reduce(
                      (acc, d) => acc + d.exercises.reduce((s, e) => s + e.sets.length, 0),
                      0,
                    ),
                  )}
                </span>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="sr-text-overline text-[var(--sr-text-muted)]">
                  {pl.planSectionInfo}
                </p>
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                    plan.status === 'active'
                      ? 'bg-[var(--sr-success)]/15 text-[var(--sr-success)]'
                      : 'bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]',
                  )}
                >
                  {plan.status === 'active' ? pl.planStatusActive : pl.planStatusDraft}
                </span>
              </div>
              <div className="flex flex-col gap-3">
                <TextField
                  id="plan-name"
                  label={pl.planName}
                  value={plan.name}
                  onChange={(e) => updatePlan({ ...plan, name: e.target.value })}
                />
                <TextField
                  id="plan-desc"
                  label={pl.planDescription}
                  value={plan.description}
                  onChange={(e) => updatePlan({ ...plan, description: e.target.value })}
                />
              </div>
            </div>

            {validationErrors.length > 0 && (
              <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-warning)]/40 bg-[var(--sr-warning)]/10 p-3">
                <p className="text-sm font-medium text-[var(--sr-warning)]">{pl.planValidationFix}</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--sr-text-secondary)]">
                  {validationErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
                {pl.planSectionDays}
              </p>
            <ul className="flex flex-col gap-2">
              {plan.days.map((d, i) => (
                <li
                  key={d.dayNumber}
                  className={cn(
                    'rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 transition-colors hover:border-[var(--sr-border-strong)]',
                    isDayLocked(d.dayNumber) && 'border-l-4 border-l-[var(--sr-warning)]',
                  )}
                >
                  <div className="flex items-start gap-1">
                    <button
                      type="button"
                      className={cn('min-h-11 min-w-0 flex-1 rounded-[var(--sr-radius-sm)] text-left transition-colors hover:bg-[var(--sr-bg-surface)] active:scale-[0.99]', FOCUS_RING)}
                      onClick={() => {
                        if (isDayLocked(d.dayNumber)) {
                          showToast(pl.customEditBlockedActiveDay, 'error')
                          return
                        }
                        setView({ screen: 'day', dayIndex: i })
                      }}
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
                      {d.exercises.length === 0 && (
                        <p className="mt-1 text-sm text-[var(--sr-text-muted)] italic">
                          {pl.planDayEmpty}
                        </p>
                      )}
                    </button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-11 min-w-11 shrink-0"
                      aria-label={pl.planExerciseActions}
                      aria-expanded={expandedDay === i}
                      onClick={() => setExpandedDay(expandedDay === i ? null : i)}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                  {expandedDay === i && (
                    <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-[var(--sr-border-subtle)] pt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-9 flex-1 gap-1.5"
                        disabled={i === 0 || isDayLocked(d.dayNumber)}
                        aria-label={pl.planMoveDayUp}
                        onClick={() => {
                          if (!guardDayEdit(i)) return
                          const list = plan.days.map((x) => ({ ...x }))
                          ;[list[i - 1], list[i]] = [list[i]!, list[i - 1]!]
                          updatePlan({ ...plan, days: renumberDays(list) })
                          setExpandedDay(null)
                        }}
                      >
                        <ChevronUp className="h-4 w-4" />
                        {pl.planMoveDayUp}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-9 flex-1 gap-1.5"
                        disabled={i === plan.days.length - 1 || isDayLocked(d.dayNumber)}
                        aria-label={pl.planMoveDayDown}
                        onClick={() => {
                          if (!guardDayEdit(i)) return
                          const list = plan.days.map((x) => ({ ...x }))
                          ;[list[i], list[i + 1]] = [list[i + 1]!, list[i]!]
                          updatePlan({ ...plan, days: renumberDays(list) })
                          setExpandedDay(null)
                        }}
                      >
                        <ChevronDown className="h-4 w-4" />
                        {pl.planMoveDayDown}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-9 flex-1 gap-1.5"
                        aria-label={pl.planDuplicateDay}
                        disabled={isDayLocked(d.dayNumber)}
                        onClick={() => {
                          const nextNum = Math.max(0, ...plan.days.map((x) => x.dayNumber)) + 1
                          updatePlan({
                            ...plan,
                            days: [...plan.days, duplicatePlanDay(d, nextNum)],
                          })
                          setExpandedDay(null)
                        }}
                      >
                        <Copy className="h-4 w-4" />
                        {pl.planDuplicateDay}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="min-h-9 flex-1 gap-1.5 text-[var(--sr-error)]"
                        aria-label={pl.planDeleteDay}
                        onClick={() => {
                          if (!guardDayEdit(i)) return
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
                          setExpandedDay(null)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        {pl.planDeleteDay}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <Button
              type="button"
              variant="secondary"
              className="mt-2 gap-1.5"
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
              <Plus size={16} aria-hidden />
              {pl.planAddDay}
            </Button>
            </div>

            <div>
              <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
                {pl.planSectionProgression}
              </p>
              <div className="flex flex-col gap-3">
              <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] p-3">
              <SwitchRow
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
                      afterCycleComplete: plan.progression?.afterCycleComplete ?? true,
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
                  <SwitchRow
                    id="prog-after-cycle"
                    label={pl.progressionAfterCycle}
                    checked={plan.progression.afterCycleComplete ?? true}
                    onChange={(checked) =>
                      updatePlan({
                        ...plan,
                        progression: {
                          ...plan.progression!,
                          afterCycleComplete: checked,
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

            <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] p-3">
              <SwitchRow
                id="deload-enable"
                label={pl.deloadEnable}
                description={pl.deloadHint}
                checked={plan.deload?.enabled ?? false}
                onChange={(checked) => {
                  setShowDeload(checked)
                  updatePlan({
                    ...plan,
                    deload: {
                      enabled: checked,
                      everyNCycles: plan.deload?.everyNCycles ?? 4,
                      repsDelta: plan.deload?.repsDelta ?? -2,
                      weightKgDelta: plan.deload?.weightKgDelta ?? -2.5,
                      durationSecDelta: plan.deload?.durationSecDelta ?? -5,
                    },
                  })
                }}
              />
              {(showDeload || plan.deload?.enabled) && plan.deload?.enabled && (
                <div className="mt-3 flex flex-col gap-2">
                  <TextField
                    id="deload-cycles"
                    label={pl.deloadEveryNCycles}
                    type="number"
                    value={plan.deload.everyNCycles}
                    onChange={(e) =>
                      updatePlan({
                        ...plan,
                        deload: {
                          ...plan.deload!,
                          everyNCycles: Number(e.target.value) || 4,
                        },
                      })
                    }
                  />
                  <TextField
                    id="deload-reps"
                    label={pl.deloadReps}
                    type="number"
                    value={plan.deload.repsDelta ?? 0}
                    onChange={(e) =>
                      updatePlan({
                        ...plan,
                        deload: { ...plan.deload!, repsDelta: Number(e.target.value) || 0 },
                      })
                    }
                  />
                  <TextField
                    id="deload-kg"
                    label={pl.deloadKg}
                    type="number"
                    value={plan.deload.weightKgDelta ?? 0}
                    onChange={(e) =>
                      updatePlan({
                        ...plan,
                        deload: { ...plan.deload!, weightKgDelta: Number(e.target.value) || 0 },
                      })
                    }
                  />
                  <TextField
                    id="deload-sec"
                    label={pl.deloadSec}
                    type="number"
                    value={plan.deload.durationSecDelta ?? 0}
                    onChange={(e) =>
                      updatePlan({
                        ...plan,
                        deload: {
                          ...plan.deload!,
                          durationSecDelta: Number(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>
              )}
            </div>
              </div>
            </div>

            <SaveBar
              plan={plan}
              onActivate={() => void handleActivate()}
              onSaveDraft={() => void handleSaveDraft()}
            />
          </div>
        )}

        {view.screen === 'day' && day && (
          <div className="flex flex-col gap-4">
            <Button
              type="button"
              variant="ghost"
              className="self-start gap-1.5"
              onClick={() => setView({ screen: 'hub' })}
              aria-label={pl.planBack}
            >
              <ArrowLeft size={18} aria-hidden />
              {pl.planBack}
            </Button>

            {isDayLocked(day.dayNumber) && (
              <FeedbackBanner variant="warning" message={pl.customEditBlockedActiveDay} />
            )}

            {day.exercises.length > 0 && (
              <p className="text-sm text-[var(--sr-text-muted)]">
                {pl.planDayExercisesCount(day.exercises.length)}
              </p>
            )}

            <div>
              <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
                {pl.planSectionRestDay}
              </p>
              <SegmentedControl
                value={String(day.restAfterDay) as '1' | '2'}
                disabled={isDayLocked(day.dayNumber)}
                onChange={(v) => {
                  if (!guardDayEdit(view.dayIndex)) return
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

            {day.exercises.length === 0 ? (
              <EmptyState
                icon={<Dumbbell size={40} strokeWidth={1.5} className="text-[var(--sr-text-muted)]" />}
                title={pl.planDayEmptyTitle}
                description={pl.planDayEmptyHint}
                action={
                  !isDayLocked(day.dayNumber)
                    ? {
                        label: pl.planAddExercise,
                        onClick: () => {
                          if (!guardDayEdit(view.dayIndex)) return
                          setView({ screen: 'pick', dayIndex: view.dayIndex })
                        },
                      }
                    : undefined
                }
              />
            ) : (
            <ul className="flex flex-col gap-2">
              {day.exercises.map((pe, i) => {
                const def = exercises.find((e) => e.id === pe.exerciseId)
                const name = def?.name ?? pl.planEllipsis
                const group = pe.groupId
                  ? day.groups?.find((g) => g.id === pe.groupId)
                  : undefined
                const groupLabel =
                  group?.kind === 'circuit'
                    ? pl.groupCircuit
                    : group?.kind === 'amrap'
                      ? pl.groupAmrap
                      : group?.kind === 'superset'
                        ? pl.groupSuperset
                        : null
                const isFirstInGroup =
                  group && day.exercises.findIndex((x) => x.groupId === group.id) === i
                return (
                  <li
                    key={`${pe.exerciseId}-${i}`}
                    className={cn(
                      'rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-2 transition-colors hover:border-[var(--sr-border-strong)]',
                      groupLabel && 'border-l-4 border-l-[var(--sr-brand-primary)]',
                    )}
                  >
                    <div className="flex items-start gap-1">
                      <button
                        type="button"
                        className={cn('min-h-11 min-w-0 flex-1 rounded-[var(--sr-radius-sm)] text-left transition-colors hover:bg-[var(--sr-bg-surface)] active:scale-[0.99]', FOCUS_RING)}
                        onClick={() => {
                          if (!guardDayEdit(view.dayIndex)) return
                          setView({
                            screen: 'exercise',
                            dayIndex: view.dayIndex,
                            exerciseIndex: i,
                          })
                        }}
                      >
                        <p className="font-medium">
                          <span className="mr-1.5 text-[var(--sr-text-muted)]">{i + 1}.</span>
                          {name}{' '}
                          <span className="text-[var(--sr-text-muted)]">
                            · {pl.planSetsShort(pe.sets.length)}
                          </span>
                          {groupLabel ? (
                            <span className="ml-1 rounded-[var(--sr-radius-sm)] bg-[var(--sr-brand-primary-muted)] px-1.5 py-0.5 text-xs font-medium text-[var(--sr-brand-primary)]">
                              {groupLabel}
                            </span>
                          ) : null}
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
                        className="min-h-11 min-w-11 shrink-0"
                        aria-label={pl.planExerciseActions}
                        aria-expanded={expandedExercise === i}
                        disabled={isDayLocked(day.dayNumber)}
                        onClick={() => setExpandedExercise(expandedExercise === i ? null : i)}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </div>
                    {expandedExercise === i && !isDayLocked(day.dayNumber) && (
                      <div className="mt-2 flex items-center gap-1 border-t border-[var(--sr-border-subtle)] pt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-9 flex-1 gap-1.5"
                          disabled={i === 0}
                          aria-label={pl.planMoveUp}
                          onClick={() => {
                            if (!guardDayEdit(view.dayIndex)) return
                            const list = day.exercises.map((x) => ({ ...x }))
                            ;[list[i - 1], list[i]] = [list[i]!, list[i - 1]!]
                            const ordered = list.map((x, idx) => ({ ...x, order: idx }))
                            const days = [...plan.days]
                            days[view.dayIndex] = { ...day, exercises: ordered }
                            updatePlan({ ...plan, days })
                            setExpandedExercise(null)
                          }}
                        >
                          <ChevronUp className="h-4 w-4" />
                          {pl.planMoveUp}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-9 flex-1 gap-1.5"
                          disabled={i === day.exercises.length - 1}
                          aria-label={pl.planMoveDown}
                          onClick={() => {
                            if (!guardDayEdit(view.dayIndex)) return
                            const list = day.exercises.map((x) => ({ ...x }))
                            ;[list[i], list[i + 1]] = [list[i + 1]!, list[i]!]
                            const ordered = list.map((x, idx) => ({ ...x, order: idx }))
                            const days = [...plan.days]
                            days[view.dayIndex] = { ...day, exercises: ordered }
                            updatePlan({ ...plan, days })
                            setExpandedExercise(null)
                          }}
                        >
                          <ChevronDown className="h-4 w-4" />
                          {pl.planMoveDown}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-9 flex-1 gap-1.5"
                          aria-label={pl.planDuplicateExercise}
                          onClick={() => {
                            if (!guardDayEdit(view.dayIndex)) return
                            const copy = { ...pe, sets: pe.sets.map((s) => ({ ...s })), order: i + 1 }
                            const list = [...day.exercises]
                            list.splice(i + 1, 0, copy)
                            const ordered = list.map((x, idx) => ({ ...x, order: idx }))
                            const days = [...plan.days]
                            days[view.dayIndex] = { ...day, exercises: ordered }
                            updatePlan({ ...plan, days })
                            setExpandedExercise(null)
                          }}
                        >
                          <Copy className="h-4 w-4" />
                          {pl.planDuplicateExercise}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-9 flex-1 gap-1.5 text-[var(--sr-error)]"
                          aria-label={pl.planRemoveExercise}
                          onClick={() => {
                            if (!guardDayEdit(view.dayIndex)) return
                            const list = day.exercises
                              .filter((_, idx) => idx !== i)
                              .map((x, idx) => ({ ...x, order: idx }))
                            const days = [...plan.days]
                            days[view.dayIndex] = { ...day, exercises: list }
                            updatePlan({ ...plan, days })
                            setExpandedExercise(null)
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          {pl.planRemoveExercise}
                        </Button>
                      </div>
                    )}
                    {!isDayLocked(day.dayNumber) && i < day.exercises.length - 1 && !pe.groupId && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="mt-1 min-h-9"
                        onClick={() => {
                          if (!guardDayEdit(view.dayIndex)) return
                          const days = [...plan.days]
                          days[view.dayIndex] = linkExercisesWithNext(day, i, 'superset')
                          updatePlan({ ...plan, days })
                        }}
                      >
                        {pl.groupLinkNext}
                      </Button>
                    )}
                    {group && isFirstInGroup && (
                      <div className="mt-2 space-y-2 rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-elevated)] p-2">
                        <p className="text-xs font-medium text-[var(--sr-text-secondary)]">
                          {pl.groupEdit} · {pl.groupMemberCount(countExercisesInGroup(day, group.id))}
                        </p>
                        <SegmentedControl
                          value={group.kind}
                          disabled={isDayLocked(day.dayNumber)}
                          onChange={(v) => {
                            if (!guardDayEdit(view.dayIndex)) return
                            const days = [...plan.days]
                            days[view.dayIndex] = updateExerciseGroup(day, group.id, {
                              kind: v as ExerciseGroupKind,
                            })
                            updatePlan({ ...plan, days })
                          }}
                          options={[
                            { value: 'superset', label: pl.groupSuperset },
                            { value: 'circuit', label: pl.groupCircuit },
                            { value: 'amrap', label: pl.groupAmrap },
                          ]}
                        />
                        {group.kind === 'circuit' && (
                          <TextField
                            id={`group-rounds-${group.id}`}
                            label={pl.groupRounds}
                            type="number"
                            value={group.rounds ?? 3}
                            disabled={isDayLocked(day.dayNumber)}
                            onChange={(e) => {
                              if (!guardDayEdit(view.dayIndex)) return
                              const days = [...plan.days]
                              days[view.dayIndex] = updateExerciseGroup(day, group.id, {
                                rounds: Number(e.target.value) || 3,
                              })
                              updatePlan({ ...plan, days })
                            }}
                          />
                        )}
                        {group.kind === 'amrap' && (
                          <TextField
                            id={`group-amrap-${group.id}`}
                            label={pl.groupAmrapDuration}
                            type="number"
                            value={group.amrapDurationSec ?? 600}
                            disabled={isDayLocked(day.dayNumber)}
                            onChange={(e) => {
                              if (!guardDayEdit(view.dayIndex)) return
                              const days = [...plan.days]
                              days[view.dayIndex] = updateExerciseGroup(day, group.id, {
                                amrapDurationSec: Number(e.target.value) || 600,
                              })
                              updatePlan({ ...plan, days })
                            }}
                          />
                        )}
                        <TextField
                          id={`group-rest-${group.id}`}
                          label={pl.groupRestAfterRound}
                          type="number"
                          value={group.restAfterRoundSec ?? 60}
                          disabled={isDayLocked(day.dayNumber)}
                          onChange={(e) => {
                            if (!guardDayEdit(view.dayIndex)) return
                            const days = [...plan.days]
                            days[view.dayIndex] = updateExerciseGroup(day, group.id, {
                              restAfterRoundSec: Number(e.target.value) || 0,
                            })
                            updatePlan({ ...plan, days })
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isDayLocked(day.dayNumber)}
                          onClick={() => {
                            if (!guardDayEdit(view.dayIndex)) return
                            const days = [...plan.days]
                            days[view.dayIndex] = dissolveExerciseGroup(day, group.id)
                            updatePlan({ ...plan, days })
                          }}
                        >
                          {pl.groupUnlink}
                        </Button>
                      </div>
                    )}
                    {pe.groupId && !isFirstInGroup && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="mt-1 min-h-9"
                        disabled={isDayLocked(day.dayNumber)}
                        onClick={() => {
                          if (!guardDayEdit(view.dayIndex)) return
                          const days = [...plan.days]
                          days[view.dayIndex] = unlinkExerciseFromGroup(day, i)
                          updatePlan({ ...plan, days })
                        }}
                      >
                        {pl.groupUnlink}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
            )}

            {day.exercises.length > 0 && (
            <button
              type="button"
              disabled={isDayLocked(day.dayNumber)}
              onClick={() => {
                if (!guardDayEdit(view.dayIndex)) return
                setView({ screen: 'pick', dayIndex: view.dayIndex })
              }}
              className={cn(
                'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[var(--sr-radius-md)] border border-dashed border-[var(--sr-border-subtle)] text-sm font-medium text-[var(--sr-text-secondary)] transition-colors hover:border-[var(--sr-brand-primary)] hover:text-[var(--sr-brand-primary)] active:scale-[0.99]',
                FOCUS_RING,
                isDayLocked(day.dayNumber) && 'opacity-40 pointer-events-none',
              )}
            >
              <Plus size={16} aria-hidden />
              {pl.planAddExercise}
            </button>
            )}

            <SaveBar
              plan={plan}
              onActivate={() => void handleActivate()}
              onSaveDraft={() => void handleSaveDraft()}
            />
          </div>
        )}

        {view.screen === 'pick' && (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="ghost"
              className="self-start gap-1.5"
              onClick={() => setView({ screen: 'day', dayIndex: view.dayIndex })}
              aria-label={pl.planBack}
            >
              <ArrowLeft size={18} aria-hidden />
              {pl.planBack}
            </Button>
            <p className="text-sm text-[var(--sr-text-muted)]">
              {pl.exercisePickHint}
            </p>
            <ExerciseLibraryPanel
              mode="pick"
              onPick={(ex) => appendExercise(view.dayIndex, ex)}
              onExercisesChange={setExercises}
            />
            <SaveBar
              plan={plan}
              onActivate={() => void handleActivate()}
              onSaveDraft={() => void handleSaveDraft()}
            />
          </div>
        )}

        {view.screen === 'pickReplace' && (
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              variant="ghost"
              className="self-start gap-1.5"
              onClick={() => setView({ screen: 'exercise', dayIndex: view.dayIndex, exerciseIndex: view.exerciseIndex })}
              aria-label={pl.planBack}
            >
              <ArrowLeft size={18} aria-hidden />
              {pl.planBack}
            </Button>
            <p className="text-sm text-[var(--sr-text-muted)]">
              {pl.exerciseReplaceHint(exDef?.name ?? '')}
            </p>
            <ExerciseLibraryPanel
              mode="pick"
              onPick={(ex) => replaceExercise(view.dayIndex, view.exerciseIndex, ex)}
              onExercisesChange={setExercises}
            />
            <SaveBar
              plan={plan}
              onActivate={() => void handleActivate()}
              onSaveDraft={() => void handleSaveDraft()}
            />
          </div>
        )}

        {view.screen === 'exercise' && planned && day && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                className="gap-1.5"
                onClick={() => setView({ screen: 'day', dayIndex: view.dayIndex })}
                aria-label={pl.planBack}
              >
                <ArrowLeft size={18} aria-hidden />
                {pl.planBack}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                disabled={exerciseDayLocked}
                onClick={() => setView({ screen: 'pickReplace', dayIndex: view.dayIndex, exerciseIndex: view.exerciseIndex })}
              >
                <Repeat size={16} aria-hidden />
                {pl.exerciseReplace}
              </Button>
            </div>

            {isDayLocked(day.dayNumber) && (
              <FeedbackBanner variant="warning" message={pl.customEditBlockedActiveDay} />
            )}

            {exDef && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-[var(--sr-radius-sm)] bg-[var(--sr-brand-primary-muted)] px-2 py-0.5 text-xs font-medium text-[var(--sr-brand-primary)]">
                    {exDef.primaryMetric === 'reps_weight'
                      ? pl.planExerciseMetricRepsWeight
                      : exDef.primaryMetric === 'duration_sec'
                        ? pl.planExerciseMetricDuration
                        : pl.planExerciseMetricReps}
                  </span>
                </div>
                <div>
                  <TextField
                    id="exercise-name-edit"
                    label={pl.exerciseNameLabel}
                    value={exDef.name}
                    disabled={exerciseDayLocked}
                    onChange={(e) => {
                      if (!exDef) return
                      const newName = e.target.value
                      // Optimistic local update
                      setExercises((prev) =>
                        prev.map((x) => (x.id === exDef.id ? { ...x, name: newName } : x)),
                      )
                      // Debounced save to library
                      if (exerciseNameTimer.current) window.clearTimeout(exerciseNameTimer.current)
                      exerciseNameTimer.current = window.setTimeout(async () => {
                        try {
                          const updated = await saveExercise({
                            id: exDef.id,
                            name: newName,
                            primaryMetric: exDef.primaryMetric,
                            restDefaultSec: exDef.restDefaultSec,
                            archived: exDef.archived,
                            muscleGroup: exDef.muscleGroup,
                          })
                          setExercises((prev) =>
                            prev.map((x) => (x.id === updated.id ? updated : x)),
                          )
                        } catch {
                          showToast(pl.errorCrash, 'error')
                        }
                      }, 600)
                    }}
                  />
                  <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                    {pl.exerciseNameHint}
                  </p>
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
                {pl.planSectionSets}
              </p>
              <SetsCountStepper
                value={planned.sets.length}
                disabled={exerciseDayLocked}
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
              {planned.sets.length > 0 && (
                <ul className="mt-3 flex flex-col gap-3">
                  {planned.sets.map((s, i) => (
                    <li key={i}>
                      <CustomSetPrescriptionEditor
                        setNumber={i + 1}
                        metric={exDef?.primaryMetric ?? 'reps'}
                        prescription={s}
                        disabled={exerciseDayLocked}
                        onChange={(next) => updateSet(view.dayIndex, view.exerciseIndex, i, next)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
                {pl.planSectionRest}
              </p>
              <div className="flex flex-col gap-3">
                <RestSecChips
                  id="rest-sets"
                  label={pl.planRestBetweenSets}
                  value={planned.restBetweenSetsSec}
                  disabled={exerciseDayLocked}
                  onChange={(sec) =>
                    updatePlanned(view.dayIndex, view.exerciseIndex, { restBetweenSetsSec: sec })
                  }
                />
                <RestSecChips
                  id="rest-ex"
                  label={pl.planRestAfterExercise}
                  value={planned.restAfterExerciseSec ?? 60}
                  disabled={exerciseDayLocked}
                  onChange={(sec) =>
                    updatePlanned(view.dayIndex, view.exerciseIndex, { restAfterExerciseSec: sec })
                  }
                />
              </div>
            </div>

            <div>
              <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
                {pl.planSectionNote}
              </p>
              <TextField
                id="exercise-note"
                label={pl.customExerciseNoteLabel}
                placeholder={pl.customExerciseNotePlaceholder}
                value={planned.note ?? ''}
                maxLength={200}
                disabled={exerciseDayLocked}
                onChange={(e) =>
                  updatePlanned(view.dayIndex, view.exerciseIndex, { note: e.target.value })
                }
              />
            </div>

            <div>
              <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
                {pl.planSectionProgressPerExercise}
              </p>
              <div className="rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] p-3">
                <SwitchRow
                  id="ex-prog-enable"
                  label={pl.progressionPerExercise}
                  description={pl.progressionPerExerciseHint}
                  checked={planned.progression?.enabled ?? false}
                  disabled={exerciseDayLocked}
                  onChange={(checked) =>
                    updatePlanned(view.dayIndex, view.exerciseIndex, {
                      progression: checked
                        ? {
                            enabled: true,
                            afterCycleComplete: true,
                            repsDelta: planned.progression?.repsDelta ?? plan.progression?.repsDelta ?? 2,
                            weightKgDelta:
                              planned.progression?.weightKgDelta ?? plan.progression?.weightKgDelta ?? 2.5,
                            durationSecDelta:
                              planned.progression?.durationSecDelta ??
                              plan.progression?.durationSecDelta ??
                              5,
                          }
                        : { enabled: false, afterCycleComplete: true },
                    })
                  }
                />
                {planned.progression?.enabled && (
                  <div className="mt-2 flex flex-col gap-2">
                    <TextField
                      id="ex-prog-reps"
                      label={pl.progressionReps}
                      type="number"
                      disabled={exerciseDayLocked}
                      value={planned.progression.repsDelta ?? 0}
                      onChange={(e) =>
                        updatePlanned(view.dayIndex, view.exerciseIndex, {
                          progression: {
                            ...planned.progression!,
                            repsDelta: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                    <TextField
                      id="ex-prog-kg"
                      label={pl.progressionKg}
                      type="number"
                      disabled={exerciseDayLocked}
                      value={planned.progression.weightKgDelta ?? 0}
                      onChange={(e) =>
                        updatePlanned(view.dayIndex, view.exerciseIndex, {
                          progression: {
                            ...planned.progression!,
                            weightKgDelta: Number(e.target.value) || 0,
                          },
                        })
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <SaveBar
              plan={plan}
              onActivate={() => void handleActivate()}
              onSaveDraft={() => void handleSaveDraft()}
            />
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
