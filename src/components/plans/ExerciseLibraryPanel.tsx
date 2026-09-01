import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { EmptyState } from '@/components/ux/Feedback'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { ExerciseDetailSheet } from '@/components/plans/ExerciseDetailSheet'
import { ExerciseLibraryRow } from '@/components/plans/ExerciseLibraryRow'
import { RestSecChips } from '@/components/plans/RestSecChips'
import { pl } from '@/i18n/pl'
import type { ExerciseDefinition, PrimaryMetric } from '@/lib/exercise-model'
import {
  archiveExercise,
  countPlansUsingExercise,
  listExercises,
  saveExercise,
  seedStarterExercises,
} from '@/lib/custom-plan-service'
import {
  computeExerciseListSummaries,
  type ExerciseListSummary,
} from '@/lib/custom-exercise-stats'
import { showToast } from '@/stores/toast-store'

export function ExerciseLibraryPanel({
  mode,
  onPick,
  onExercisesChange,
}: {
  mode: 'manage' | 'pick'
  onPick?: (ex: ExerciseDefinition) => void
  onExercisesChange?: (list: ExerciseDefinition[]) => void
}) {
  const [exercises, setExercises] = useState<ExerciseDefinition[]>([])
  const [summaries, setSummaries] = useState<Map<string, ExerciseListSummary>>(new Map())
  const [editing, setEditing] = useState<ExerciseDefinition | null>(null)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [metric, setMetric] = useState<PrimaryMetric>('reps')
  const [rest, setRest] = useState(90)
  const [usedIn, setUsedIn] = useState(0)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [detailExercise, setDetailExercise] = useState<ExerciseDefinition | null>(null)

  async function reload() {
    const list = await listExercises()
    setExercises(list)
    setSummaries(await computeExerciseListSummaries(list))
    onExercisesChange?.(list)
  }

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on mount
  }, [])

  useEffect(() => {
    if (creating || editing) {
      window.setTimeout(() => {
        document.getElementById('ex-name')?.focus()
      }, 50)
    }
  }, [creating, editing])

  function startCreate() {
    setCreating(true)
    setEditing(null)
    setName('')
    setMetric('reps')
    setRest(90)
    setUsedIn(0)
  }

  async function startEdit(ex: ExerciseDefinition) {
    setCreating(false)
    setEditing(ex)
    setName(ex.name)
    setMetric(ex.primaryMetric)
    setRest(ex.restDefaultSec)
    setUsedIn(await countPlansUsingExercise(ex.id))
  }

  const metricLocked = editing != null && usedIn > 0

  async function handleSave() {
    if (metricLocked && editing && metric !== editing.primaryMetric) {
      showToast(pl.exerciseMetricLocked, 'error')
      return
    }
    try {
      const saved = await saveExercise({
        id: editing?.id,
        name,
        primaryMetric: metric,
        restDefaultSec: rest,
      })
      showToast(pl.saveExercise, 'success')
      setEditing(null)
      setCreating(false)
      await reload()
      if (mode === 'pick' && onPick) {
        onPick(saved)
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : pl.errorCrash, 'error')
    }
  }

  async function handleArchive() {
    if (!editing) return
    const result = await archiveExercise(editing.id)
    if (!result.ok) {
      showToast(pl.exerciseUsedInPlans(result.usedIn), 'error')
      setArchiveConfirm(false)
      return
    }
    setArchiveConfirm(false)
    setEditing(null)
    await reload()
  }

  async function handleSeed() {
    const { created, all } = await seedStarterExercises()
    setExercises(all)
    setSummaries(await computeExerciseListSummaries(all))
    onExercisesChange?.(all)
    if (created.length > 0) showToast(pl.exerciseStarterPackDone, 'success')
  }

  const formOpen = creating || editing

  return (
    <>
      {!formOpen && (
        <div className="flex flex-col gap-3">
          {mode === 'manage' && (
            <p className="text-sm text-[var(--sr-text-muted)]">{pl.exerciseLibraryHint}</p>
          )}
          {mode === 'pick' && (
            <p className="text-sm text-[var(--sr-text-muted)]">{pl.exerciseLibraryPickHint}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={startCreate}>
              {pl.addExercise}
            </Button>
            {exercises.length === 0 && (
              <Button type="button" variant="secondary" onClick={() => void handleSeed()}>
                {pl.exerciseStarterPack}
              </Button>
            )}
          </div>

          {exercises.length === 0 ? (
            <>
              <EmptyState title={pl.exerciseLibraryEmpty} />
              <p className="text-center text-xs text-[var(--sr-text-muted)]">
                {pl.exerciseTemplatesTitle}
              </p>
            </>
          ) : (
            <ul className="flex flex-col gap-2">
              {exercises.map((ex) => (
                <li key={ex.id}>
                  <ExerciseLibraryRow
                    exercise={ex}
                    summary={summaries.get(ex.id)}
                    mode={mode}
                    onOpenDetail={() => setDetailExercise(ex)}
                    onPick={mode === 'pick' && onPick ? () => onPick(ex) : undefined}
                    onEdit={mode === 'manage' ? () => void startEdit(ex) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {formOpen && (
        <div className="flex flex-col gap-4">
          <TextField
            id="ex-name"
            label={pl.exerciseName}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div>
            <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
              {pl.exerciseMetric}
            </p>
            <SegmentedControl
              value={metric}
              onChange={setMetric}
              disabled={metricLocked}
              options={[
                { value: 'reps', label: pl.exerciseMetricReps },
                { value: 'duration_sec', label: pl.exerciseMetricDuration },
                { value: 'reps_weight', label: pl.exerciseMetricRepsWeight },
              ]}
            />
          </div>
          {metricLocked && (
            <p className="text-sm text-[var(--sr-text-muted)]">{pl.exerciseMetricLockedHint}</p>
          )}
          <RestSecChips
            id="ex-rest"
            label={pl.exerciseRestDefault}
            value={rest}
            onChange={setRest}
          />
          {usedIn > 0 && (
            <p className="text-sm text-[var(--sr-text-muted)]">{pl.exerciseUsedInPlans(usedIn)}</p>
          )}
          <div className="flex flex-col gap-2">
            <Button type="button" size="touch" fullWidth onClick={() => void handleSave()}>
              {pl.saveExercise}
            </Button>
            {editing && mode === 'manage' && (
              <Button
                type="button"
                size="md"
                variant="danger"
                fullWidth
                onClick={() => setArchiveConfirm(true)}
              >
                {pl.archiveExercise}
              </Button>
            )}
            <Button
              type="button"
              size="md"
              variant="ghost"
              fullWidth
              onClick={() => {
                setCreating(false)
                setEditing(null)
              }}
            >
              {pl.planBack}
            </Button>
          </div>
        </div>
      )}

      {archiveConfirm && (
        <ConfirmSheet
          title={pl.archiveExercise}
          message={pl.exerciseArchiveConfirm}
          confirmLabel={pl.archiveExercise}
          variant="danger"
          onConfirm={() => void handleArchive()}
          onCancel={() => setArchiveConfirm(false)}
        />
      )}

      <ExerciseDetailSheet
        open={detailExercise != null}
        exercise={detailExercise}
        elevated
        onClose={() => setDetailExercise(null)}
        onEdit={
          detailExercise && mode === 'manage'
            ? () => {
                const ex = detailExercise
                setDetailExercise(null)
                void startEdit(ex)
              }
            : undefined
        }
      />
    </>
  )
}
