import { useEffect, useMemo, useState } from 'react'
import { Dumbbell, ChevronDown, Check, X, ArrowDownUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { cn } from '@/lib/utils'
import { EmptyState, SkeletonCard } from '@/components/ux/Feedback'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { ExerciseDetailSheet } from '@/components/plans/ExerciseDetailSheet'
import { ExerciseLibraryRow } from '@/components/plans/ExerciseLibraryRow'
import { FOCUS_RING } from '@/lib/ui-chrome'
import { RestSecChips } from '@/components/plans/RestSecChips'
import { pl } from '@/i18n/pl'
import type { ExerciseDefinition, PrimaryMetric, MuscleGroup } from '@/lib/exercise-model'
import { MUSCLE_GROUPS } from '@/lib/exercise-model'
import { muscleGroupLabel } from '@/lib/exercise-substitution'
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
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup | ''>('')
  const [durationUnit, setDurationUnit] = useState<'sec' | 'min'>('sec')
  const [usedIn, setUsedIn] = useState(0)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [detailExercise, setDetailExercise] = useState<ExerciseDefinition | null>(null)
  const [search, setSearch] = useState('')
  const [metricFilter, setMetricFilter] = useState<PrimaryMetric | 'all'>('all')
  const [muscleFilter, setMuscleFilter] = useState<MuscleGroup | 'all'>('all')
  const [muscleSheetOpen, setMuscleSheetOpen] = useState(false)
  const [sortSheetOpen, setSortSheetOpen] = useState(false)
  const [sortBy, setSortBy] = useState<'name' | 'recent' | 'sessions'>('name')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  async function reload() {
    setLoading(true)
    setLoadError(false)
    try {
      const list = await listExercises()
      setExercises(list)
      setSummaries(await computeExerciseListSummaries(list))
      onExercisesChange?.(list)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
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
    setMuscleGroup('')
    setDurationUnit('sec')
    setUsedIn(0)
  }

  async function startEdit(ex: ExerciseDefinition) {
    setCreating(false)
    setEditing(ex)
    setName(ex.name)
    setMetric(ex.primaryMetric)
    setRest(ex.restDefaultSec)
    setMuscleGroup(ex.muscleGroup ?? '')
    setDurationUnit(ex.durationDisplayUnit ?? 'min')
    setUsedIn(await countPlansUsingExercise(ex.id))
  }

  const metricChanged = editing != null && metric !== editing.primaryMetric
  const metricWarn = metricChanged && usedIn > 0

  async function handleSave() {
    try {
      const saved = await saveExercise({
        id: editing?.id,
        name,
        primaryMetric: metric,
        restDefaultSec: rest,
        muscleGroup: muscleGroup || undefined,
        durationDisplayUnit: metric === 'duration_sec' ? durationUnit : undefined,
      })
      showToast(pl.saveExercise, 'success')
      setEditing(null)
      setCreating(false)
      await reload()
      if (mode === 'pick' && onPick) {
        onPick(saved)
      }
    } catch {
      showToast(pl.errorCrash, 'error')
    }
  }

  async function handleArchive() {
    if (!editing) return
    try {
      const result = await archiveExercise(editing.id)
      if (!result.ok) {
        showToast(pl.exerciseUsedInPlans(result.usedIn), 'error')
        setArchiveConfirm(false)
        return
      }
      setArchiveConfirm(false)
      setEditing(null)
      await reload()
    } catch {
      showToast(pl.exerciseArchiveFailed, 'error')
      setArchiveConfirm(false)
    }
  }

  async function handleSeed() {
    const { created, all } = await seedStarterExercises()
    setExercises(all)
    setSummaries(await computeExerciseListSummaries(all))
    onExercisesChange?.(all)
    if (created.length > 0) showToast(pl.exerciseStarterPackDone, 'success')
  }

  const formOpen = creating || editing

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase()
    const filtered = exercises.filter((ex) => {
      if (metricFilter !== 'all' && ex.primaryMetric !== metricFilter) return false
      if (muscleFilter !== 'all' && ex.muscleGroup !== muscleFilter) return false
      if (q && !ex.name.toLowerCase().includes(q)) return false
      return true
    })
    const sorted = [...filtered]
    if (sortBy === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name, 'pl'))
    } else if (sortBy === 'recent') {
      sorted.sort((a, b) => {
        const aDate = summaries.get(a.id)?.lastSessionAt ?? ''
        const bDate = summaries.get(b.id)?.lastSessionAt ?? ''
        return bDate.localeCompare(aDate)
      })
    } else if (sortBy === 'sessions') {
      sorted.sort((a, b) => {
        const aCount = summaries.get(a.id)?.sessionCount ?? 0
        const bCount = summaries.get(b.id)?.sessionCount ?? 0
        return bCount - aCount
      })
    }
    return sorted
  }, [exercises, search, metricFilter, muscleFilter, sortBy, summaries])

  const hasActiveFilters = metricFilter !== 'all' || muscleFilter !== 'all' || search.trim() !== ''

  function clearFilters() {
    setMetricFilter('all')
    setMuscleFilter('all')
    setSearch('')
  }

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

          {loading ? (
            <div className="flex flex-col gap-2" aria-busy aria-label={pl.loading}>
              {Array.from({ length: 4 }).map((_, i) => (
                <SkeletonCard key={i} className="min-h-[4rem]" />
              ))}
            </div>
          ) : loadError ? (
            <EmptyState
              title={pl.exerciseLibraryEmpty}
              description={pl.exerciseLibraryEmptyHint}
            />
          ) : exercises.length === 0 ? (
            <EmptyState
              icon={<Dumbbell size={40} strokeWidth={1.5} className="text-[var(--sr-text-muted)]" />}
              title={pl.exerciseLibraryEmpty}
              description={pl.exerciseLibraryEmptyHint}
              action={{
                label: pl.addExercise,
                onClick: startCreate,
              }}
              secondaryAction={{
                label: pl.exerciseStarterPack,
                onClick: () => void handleSeed(),
              }}
            />
          ) : (
            <>
              <div className="relative">
                <TextField
                  id="exercise-search"
                  placeholder={pl.exerciseSearchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  inputClassName="py-2.5"
                  aria-label={pl.exerciseSearchPlaceholder}
                />
                {search.trim() !== '' && (
                  <button
                    type="button"
                    aria-label={pl.exerciseClearSearch}
                    className={cn(
                      'absolute right-2.5 top-1/2 -translate-y-1/2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[var(--sr-text-muted)] transition-colors hover:bg-[var(--sr-bg-elevated)] hover:text-[var(--sr-text-primary)] active:scale-95',
                      FOCUS_RING,
                    )}
                    onClick={() => setSearch('')}
                  >
                    <X size={16} aria-hidden />
                  </button>
                )}
              </div>
              <SegmentedControl
                value={metricFilter}
                onChange={(v) => setMetricFilter(v as PrimaryMetric | 'all')}
                options={[
                  { value: 'all' as const, label: pl.exerciseFilterAll },
                  { value: 'reps' as const, label: pl.exerciseMetricReps },
                  { value: 'duration_sec' as const, label: pl.exerciseMetricDuration },
                  { value: 'reps_weight' as const, label: pl.exerciseMetricRepsWeight },
                ]}
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMuscleSheetOpen(true)}
                  className={cn(
                    'flex min-h-12 min-w-0 flex-1 items-center justify-between gap-2 rounded-[var(--sr-radius-md)] border px-4 py-2.5 text-sm transition-colors hover:border-[var(--sr-border-strong)]',
                    muscleFilter === 'all'
                      ? 'border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] text-[var(--sr-text-muted)]'
                      : 'border-[var(--sr-brand-primary)]/30 bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)] font-medium',
                    FOCUS_RING,
                  )}
                  aria-label={pl.exerciseMuscleGroup}
                >
                  <span className="break-words">
                    {muscleFilter === 'all'
                      ? `${pl.exerciseFilterAll} — ${pl.exerciseMuscleGroup}`
                      : muscleGroupLabel(muscleFilter)}
                  </span>
                  <ChevronDown size={16} className="shrink-0" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setSortSheetOpen(true)}
                  className={cn(
                    'flex min-h-12 shrink-0 items-center gap-1.5 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-3.5 py-2.5 text-sm text-[var(--sr-text-secondary)] transition-colors hover:border-[var(--sr-border-strong)] hover:text-[var(--sr-text-primary)]',
                    FOCUS_RING,
                  )}
                  aria-label={pl.exerciseSortLabel}
                >
                  <ArrowDownUp size={15} aria-hidden />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-[var(--sr-text-muted)]">
                  {pl.exerciseResultCount(filteredExercises.length, exercises.length)}
                </p>
                {hasActiveFilters && filteredExercises.length === 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className={cn(
                      'text-xs font-medium text-[var(--sr-brand-primary)] transition-colors hover:text-[var(--sr-brand-primary)]/80 active:scale-95',
                      FOCUS_RING,
                    )}
                  >
                    {pl.exerciseClearFilters}
                  </button>
                )}
              </div>
              {filteredExercises.length === 0 ? (
                <EmptyState
                  title={hasActiveFilters ? pl.exerciseFilterNoResults : pl.exerciseSearchNoResults}
                  action={hasActiveFilters ? {
                    label: pl.exerciseClearFilters,
                    onClick: clearFilters,
                  } : undefined}
                />
              ) : (
                <ul className="flex flex-col gap-2">
                  {filteredExercises.map((ex) => (
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
            </>
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
              onChange={(v) => {
                setMetric(v as PrimaryMetric)
                // Duration exercises default to minutes (more natural for cardio/time-based)
                if (v === 'duration_sec') {
                  setDurationUnit('min')
                }
              }}
              options={[
                { value: 'reps', label: pl.exerciseMetricReps },
                { value: 'duration_sec', label: pl.exerciseMetricDuration },
                { value: 'reps_weight', label: pl.exerciseMetricRepsWeight },
              ]}
            />
          </div>
          {metric === 'duration_sec' && (
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--sr-text-secondary)]">
                {pl.customDurationUnitLabel}
              </p>
              <SegmentedControl
                value={durationUnit}
                onChange={(v) => setDurationUnit(v as 'sec' | 'min')}
                options={[
                  { value: 'sec', label: pl.customDurationUnitSec },
                  { value: 'min', label: pl.customDurationUnitMin },
                ]}
              />
              <p className="mt-1.5 text-xs text-[var(--sr-text-muted)]">
                {pl.customDurationUnitHint}
              </p>
            </div>
          )}
          {metricWarn && (
            <p className="rounded-[var(--sr-radius-sm)] border border-[var(--sr-warning)]/30 bg-[var(--sr-warning-muted)] px-3 py-2 text-sm text-[var(--sr-text-secondary)]">
              {pl.exerciseMetricChangeWarn(usedIn)}
            </p>
          )}
          <div>
            <p className="mb-1 text-sm font-medium text-[var(--sr-text-secondary)]">
              {pl.exerciseMuscleGroup}
            </p>
            <p className="mb-2 text-xs text-[var(--sr-text-muted)]">{pl.exerciseMuscleGroupHint}</p>
            <select
              value={muscleGroup}
              onChange={(e) => {
                const g = e.target.value as MuscleGroup | ''
                setMuscleGroup(g)
                // Auto-suggest 'min' when selecting cardio for duration exercises
                if (g === 'cardio' && metric === 'duration_sec') {
                  setDurationUnit('min')
                }
              }}
              className={`w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] px-4 py-3 text-base text-[var(--sr-text-primary)] ${FOCUS_RING}`}
            >
              <option value="">{pl.planDash}</option>
              {MUSCLE_GROUPS.map((g) => (
                <option key={g} value={g}>{muscleGroupLabel(g)}</option>
              ))}
            </select>
          </div>
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

      <Sheet
        open={muscleSheetOpen}
        onClose={() => setMuscleSheetOpen(false)}
        title={pl.exerciseMuscleGroup}
        elevated
      >
        <ul className="flex flex-col gap-1 pb-2">
          <li>
            <button
              type="button"
              onClick={() => {
                setMuscleFilter('all')
                setMuscleSheetOpen(false)
              }}
              className={cn(
                'flex min-h-12 w-full items-center justify-between rounded-[var(--sr-radius-sm)] px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--sr-bg-elevated)]',
                FOCUS_RING,
              )}
            >
              <span className={cn(
                muscleFilter === 'all' ? 'font-medium text-[var(--sr-text-primary)]' : 'text-[var(--sr-text-secondary)]',
              )}>
                {pl.exerciseFilterAll}
              </span>
              {muscleFilter === 'all' && <Check size={16} className="text-[var(--sr-brand-primary)]" aria-hidden />}
            </button>
          </li>
          {MUSCLE_GROUPS.map((g) => (
            <li key={g}>
              <button
                type="button"
                onClick={() => {
                  setMuscleFilter(g)
                  setMuscleSheetOpen(false)
                }}
                className={cn(
                  'flex min-h-12 w-full items-center justify-between rounded-[var(--sr-radius-sm)] px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--sr-bg-elevated)]',
                  FOCUS_RING,
                )}
              >
                <span className={cn(
                  muscleFilter === g ? 'font-medium text-[var(--sr-text-primary)]' : 'text-[var(--sr-text-secondary)]',
                )}>
                  {muscleGroupLabel(g)}
                </span>
                {muscleFilter === g && <Check size={16} className="text-[var(--sr-brand-primary)]" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={sortSheetOpen}
        onClose={() => setSortSheetOpen(false)}
        title={pl.exerciseSortLabel}
        elevated
      >
        <ul className="flex flex-col gap-1 pb-2">
          {([
            { value: 'name', label: pl.exerciseSortName },
            { value: 'recent', label: pl.exerciseSortRecent },
            { value: 'sessions', label: pl.exerciseSortSessions },
          ] as const).map((opt) => (
            <li key={opt.value}>
              <button
                type="button"
                onClick={() => {
                  setSortBy(opt.value)
                  setSortSheetOpen(false)
                }}
                className={cn(
                  'flex min-h-12 w-full items-center justify-between rounded-[var(--sr-radius-sm)] px-3 py-2.5 text-left text-sm transition-colors hover:bg-[var(--sr-bg-elevated)]',
                  FOCUS_RING,
                )}
              >
                <span className={cn(
                  sortBy === opt.value ? 'font-medium text-[var(--sr-text-primary)]' : 'text-[var(--sr-text-secondary)]',
                )}>
                  {opt.label}
                </span>
                {sortBy === opt.value && <Check size={16} className="text-[var(--sr-brand-primary)]" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  )
}
