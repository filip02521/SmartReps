import { useEffect, useState } from 'react'
import { Minus, Plus, Clock } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { RestSecChips } from '@/components/plans/RestSecChips'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { useAppStore } from '@/stores/app-store'
import { formatPrescriptionTarget } from '@/lib/custom-prescription-format'
import { getGroupForExercise } from '@/lib/custom-workout-nav'
import { setPendingDayOverride } from '@/lib/pending-day-override'
import type { SetTarget } from '@/data/plans/types'
import type {
  ExerciseDefinition,
  ExerciseGroup,
  PlanDay,
  PlannedExercise,
  SetPrescription,
} from '@/lib/exercise-model'

/* ---------- Built-in preview (read-only) ---------- */

export function BuiltinWorkoutPreviewSheet({
  open,
  onClose,
  programLabel,
  dayNumber,
  cycleName,
  sets,
  restBetweenSetsSec,
  onStart,
}: {
  open: boolean
  onClose: () => void
  programLabel: string
  dayNumber: number
  cycleName: string | null
  sets: SetTarget[]
  restBetweenSetsSec: number
  onStart: () => void
}) {
  const totalReps = sets.reduce((sum, s) => sum + (s.kind === 'max' ? s.minReps : s.reps), 0)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pl.previewWorkoutTitle}
      className="max-w-md"
    >
      <div className="flex flex-col gap-4 pb-4">
        {/* Header */}
        <div className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] px-4 py-3">
          <p className="sr-text-overline text-[var(--sr-text-muted)]">
            {cycleName ? `${cycleName} · ` : ''}
            {pl.planDayLabel(dayNumber)}
          </p>
          <p className="mt-1 sr-text-h3 text-[var(--sr-text-primary)]">{programLabel}</p>
          <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">
            {pl.plansDayReps(sets.length, totalReps)}
          </p>
        </div>

        {/* Sets */}
        <div>
          <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
            {pl.previewSetsLabel}
          </p>
          <SetTargetsRow sets={sets} size="md" />
        </div>

        {/* Rest */}
        <div className="flex items-center gap-2 text-sm text-[var(--sr-text-secondary)]">
          <Clock size={16} className="text-[var(--sr-text-muted)]" aria-hidden />
          {pl.restBetweenSets(restBetweenSetsSec)}
        </div>

        <Button size="touch" fullWidth onClick={onStart}>
          {pl.previewStartWorkout}
        </Button>
      </div>
    </Sheet>
  )
}

/* ---------- Custom preview (with editing) ---------- */

function groupLabel(group: ExerciseGroup): string {
  if (group.kind === 'superset') return pl.customWorkoutGroupSuperset
  if (group.kind === 'circuit') return pl.customWorkoutGroupCircuit
  return pl.customWorkoutGroupAmrap
}

function exerciseSetChips(
  pe: PlannedExercise,
  def: ExerciseDefinition | undefined,
  weightUnit: 'kg' | 'lb',
): string[] {
  if (!def) return pe.sets.map(() => '—')
  return pe.sets.map((s) => formatPrescriptionTarget(s, def.primaryMetric, weightUnit))
}

function cloneDay(day: PlanDay): PlanDay {
  return {
    ...day,
    exercises: day.exercises.map((pe) => ({
      ...pe,
      sets: pe.sets.map((s) => ({ ...s })),
      progression: pe.progression ? { ...pe.progression } : undefined,
    })),
    groups: day.groups?.map((g) => ({ ...g })),
  }
}

function daysEqual(a: PlanDay, b: PlanDay): boolean {
  if (a.exercises.length !== b.exercises.length) return false
  for (let i = 0; i < a.exercises.length; i++) {
    const ae = a.exercises[i]!
    const be = b.exercises[i]!
    if (ae.exerciseId !== be.exerciseId) return false
    if (ae.sets.length !== be.sets.length) return false
    if (ae.restBetweenSetsSec !== be.restBetweenSetsSec) return false
  }
  return true
}

export function CustomWorkoutPreviewSheet({
  open,
  onClose,
  planId,
  planName,
  dayNumber,
  originalDay,
  exercises,
  onStart,
}: {
  open: boolean
  onClose: () => void
  planId: string
  planName: string
  dayNumber: number
  originalDay: PlanDay
  exercises: Map<string, ExerciseDefinition>
  onStart: () => void
}) {
  const weightUnit = useAppStore((s) => s.settings.weightUnit)
  const [editedDay, setEditedDay] = useState<PlanDay>(() => cloneDay(originalDay))

  // Reset edits when sheet reopens with a new original day.
  useEffect(() => {
    if (open) setEditedDay(cloneDay(originalDay))
  }, [open, originalDay])

  const dirty = !daysEqual(originalDay, editedDay)

  function handleAddSet(exerciseIndex: number) {
    const pe = editedDay.exercises[exerciseIndex]
    if (!pe) return
    if (getGroupForExercise(editedDay, exerciseIndex)) return
    if (pe.sets.length >= 30) return
    const template: SetPrescription =
      pe.sets[pe.sets.length - 1] ?? pe.sets[0] ?? { reps: { kind: 'fixed', value: 8 } }
    setEditedDay({
      ...editedDay,
      exercises: editedDay.exercises.map((e, i) =>
        i === exerciseIndex
          ? { ...e, sets: [...e.sets, structuredClone(template)] }
          : e,
      ),
    })
  }

  function handleRemoveSet(exerciseIndex: number) {
    const pe = editedDay.exercises[exerciseIndex]
    if (!pe) return
    if (getGroupForExercise(editedDay, exerciseIndex)) return
    if (pe.sets.length <= 1) return
    // Don't remove below original count.
    const originalCount = originalDay.exercises[exerciseIndex]?.sets.length ?? 0
    if (pe.sets.length <= originalCount) return
    setEditedDay({
      ...editedDay,
      exercises: editedDay.exercises.map((e, i) =>
        i === exerciseIndex ? { ...e, sets: e.sets.slice(0, -1) } : e,
      ),
    })
  }

  function handleRestChange(exerciseIndex: number, sec: number) {
    if (getGroupForExercise(editedDay, exerciseIndex)) return
    setEditedDay({
      ...editedDay,
      exercises: editedDay.exercises.map((e, i) =>
        i === exerciseIndex ? { ...e, restBetweenSetsSec: Math.max(0, Math.floor(sec)) } : e,
      ),
    })
  }

  function handleStart() {
    if (dirty) {
      setPendingDayOverride(planId, editedDay)
    }
    onStart()
  }

  const totalSets = editedDay.exercises.reduce((sum, pe) => sum + pe.sets.length, 0)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={pl.previewWorkoutTitle}
      className="max-w-md"
    >
      <div className="flex flex-col gap-4 pb-4">
        {/* Header */}
        <div className="rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] px-4 py-3">
          <p className="sr-text-overline text-[var(--sr-text-muted)]">
            {pl.planDayLabel(dayNumber)}
          </p>
          <p className="mt-1 sr-text-h3 text-[var(--sr-text-primary)]">{planName}</p>
          <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">
            {pl.previewCustomSummary(editedDay.exercises.length, totalSets)}
          </p>
        </div>

        {/* Exercises */}
        <div className="flex flex-col gap-3">
          {editedDay.exercises.map((pe, i) => {
            const def = exercises.get(pe.exerciseId)
            const group = getGroupForExercise(editedDay, i)
            const chips = exerciseSetChips(pe, def, weightUnit)
            const originalCount = originalDay.exercises[i]?.sets.length ?? 0
            const canRemove = !group && pe.sets.length > 1 && pe.sets.length > originalCount
            const canAdd = !group && pe.sets.length < 30
            return (
              <div
                key={`${pe.exerciseId}-${i}`}
                className={cn(
                  'rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3',
                  group && 'border-l-4 border-l-[var(--sr-brand-primary)]',
                )}
              >
                {/* Exercise header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-[var(--sr-text-primary)]">
                      {def?.name ?? pl.planEllipsis}
                    </p>
                    {group && (
                      <p className="mt-0.5 text-xs text-[var(--sr-text-muted)]">
                        {groupLabel(group)}
                        {group.kind === 'circuit' && group.rounds
                          ? ` · ${pl.previewRounds(group.rounds)}`
                          : ''}
                        {group.kind === 'amrap' && group.amrapDurationSec
                          ? ` · ${pl.customWorkoutAmrapRemaining(group.amrapDurationSec)}`
                          : ''}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--sr-text-muted)]">
                    {pe.sets.length} {pl.setsShort}
                  </span>
                </div>

                {/* Set chips */}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {chips.map((label, si) => (
                    <span
                      key={si}
                      className="flex min-w-[2.25rem] flex-col items-center justify-center rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-2 py-1.5"
                    >
                      <span className="sr-text-overline text-[var(--sr-text-muted)]">
                        {si + 1}
                      </span>
                      <span className="text-sm font-semibold tabular-nums text-[var(--sr-text-primary)]">
                        {label}
                      </span>
                    </span>
                  ))}
                </div>

                {/* Rest + set controls */}
                {!group && (
                  <div className="mt-3 flex flex-col gap-2">
                    <RestSecChips
                      id={`preview-rest-${i}`}
                      label={pl.restBetweenSetsLabel}
                      value={pe.restBetweenSetsSec}
                      onChange={(sec) => handleRestChange(i, sec)}
                      size="compact"
                      hideLabel
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!canRemove}
                        onClick={() => handleRemoveSet(i)}
                        className={cn(
                          'flex min-h-9 min-w-9 items-center justify-center rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] active:scale-95 disabled:opacity-30 disabled:active:scale-100',
                          FOCUS_RING,
                        )}
                        aria-label={pl.previewRemoveSet}
                      >
                        <Minus size={16} />
                      </button>
                      <button
                        type="button"
                        disabled={!canAdd}
                        onClick={() => handleAddSet(i)}
                        className={cn(
                          'flex min-h-9 min-w-9 items-center justify-center rounded-[var(--sr-radius-sm)] border border-[var(--sr-border-subtle)] text-[var(--sr-text-secondary)] transition-colors hover:bg-[var(--sr-bg-surface)] active:scale-95 disabled:opacity-30 disabled:active:scale-100',
                          FOCUS_RING,
                        )}
                        aria-label={pl.previewAddSet}
                      >
                        <Plus size={16} />
                      </button>
                      {dirty && pe.sets.length !== originalCount && (
                        <span className="text-xs text-[var(--sr-text-muted)]">
                          {pl.previewEdited}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {dirty && (
          <p className="text-xs text-[var(--sr-text-muted)]">
            {pl.previewChangesNote}
          </p>
        )}

        <Button size="touch" fullWidth onClick={handleStart}>
          {pl.previewStartWorkout}
        </Button>
      </div>
    </Sheet>
  )
}
