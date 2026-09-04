import { ChevronRight, Dumbbell, Trash2, User } from 'lucide-react'
import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { useMemo, useState } from 'react'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { LogoMark } from '@/components/brand/Logo'
import { ConfirmSheet } from '@/components/workout/WorkoutComponents'
import { EmptyState } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import {
  isProgressHistorySession,
  isCustomProgressHistorySession,
  sessionTotalReps,
} from '@/lib/progress-history'
import { navigateToTrain } from '@/lib/setup-flow'
import { getCycleById } from '@/data/plans'
import { exportSessionsCsv, exportCustomSessionsCsv, downloadCsv, mergeSessionCsvExports } from '@/lib/export'
import { showToast } from '@/stores/toast-store'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import {
  computeCustomSessionDetail,
  formatCustomSessionSummary,
  sessionTotalSets,
} from '@/lib/custom-session-stats'
import { formatExerciseSetSummary } from '@/lib/custom-exercise-stats'
import { useAppStore } from '@/stores/app-store'
import { deleteWorkoutSession } from '@/lib/session-service'
import { db } from '@/lib/db'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import type { Program } from '@/data/plans/types'
import type { LocalWorkoutSession } from '@/lib/db'
import type { NavigateFunction } from 'react-router-dom'

type SourceFilter = 'all' | 'builtin' | 'custom'
type ResultFilter = 'all' | 'passed' | 'failed'
type DateFilter = 'all' | '30d' | '90d'

const PAGE_SIZE = 20

function sessionStatusLabel(session: LocalWorkoutSession): string {
  if (session.passed === false) return pl.failedShort
  if (session.passed === true) return pl.passedShort
  return pl.incompleteShort
}

function sessionBadgeVariant(session: LocalWorkoutSession): 'success' | 'error' | 'default' {
  if (session.passed === true) return 'success'
  if (session.passed === false) return 'error'
  return 'default'
}

function isCustomSession(s: LocalWorkoutSession): boolean {
  return s.program === 'custom' || !!s.customPlanId
}

function sessionSourceLabel(s: LocalWorkoutSession, customPlanNames: Record<string, string>): string {
  if (isCustomSession(s)) {
    return (s.customPlanId && customPlanNames[s.customPlanId]) || pl.progressSourceCustom
  }
  if (s.program === 'pushups') return pl.pushupsProgram
  if (s.program === 'pullups') return pl.pullupsProgram
  return pl.progressSourceAll
}

export function HistoryPanel({
  allSessions,
  customPlanNames,
  enabledPrograms,
  currentCycleId,
  navigate,
}: {
  allSessions: LocalWorkoutSession[]
  customPlanNames: Record<string, string>
  enabledPrograms: Program[]
  currentCycleId?: string
  navigate: NavigateFunction
}) {
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [cycleFilter, setCycleFilter] = useState<'all' | 'current'>('all')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedSession, setSelectedSession] = useState<LocalWorkoutSession | null>(null)
  const [detailExercises, setDetailExercises] = useState<Map<string, ExerciseDefinition>>(new Map())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const weightUnit = useAppStore((s) => s.settings.weightUnit)

  async function openSessionDetail(s: LocalWorkoutSession) {
    setSelectedSession(s)
    if (isCustomSession(s) && s.exerciseLogs?.length) {
      const ids = [...new Set(s.exerciseLogs.map((l) => l.exerciseId))]
      const rows = await db.exercises.bulkGet(ids)
      const map = new Map<string, ExerciseDefinition>()
      for (const r of rows) {
        if (r && !r.archived) map.set(r.id, r)
      }
      setDetailExercises(map)
    } else {
      setDetailExercises(new Map())
    }
  }

  // All completed sessions (builtin + custom).
  const historyBase = useMemo(
    () =>
      allSessions
        .filter((s) => isProgressHistorySession(s) || isCustomProgressHistorySession(s))
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [allSessions],
  )

  const filtersActive =
    sourceFilter !== 'all' || resultFilter !== 'all' || dateFilter !== 'all' || cycleFilter !== 'all'
  const activeFilterCount =
    (sourceFilter !== 'all' ? 1 : 0) +
    (resultFilter !== 'all' ? 1 : 0) +
    (dateFilter !== 'all' ? 1 : 0) +
    (cycleFilter !== 'all' ? 1 : 0)

  const filteredSessions = useMemo(() => {
    return historyBase.filter((s) => {
      if (sourceFilter === 'builtin' && isCustomSession(s)) return false
      if (sourceFilter === 'custom' && !isCustomSession(s)) return false
      if (resultFilter === 'passed' && !(s.status === 'completed' && s.passed)) return false
      if (resultFilter === 'failed' && !(s.status === 'completed' && s.passed === false)) return false
      if (cycleFilter === 'current' && currentCycleId && !isCustomSession(s)) {
        if (s.cycleId !== currentCycleId) return false
      }
      if (dateFilter !== 'all') {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - (dateFilter === '30d' ? 30 : 90))
        if (new Date(s.startedAt) < cutoff) return false
      }
      return true
    })
  }, [historyBase, sourceFilter, resultFilter, dateFilter, cycleFilter, currentCycleId])

  const visibleSessions = filteredSessions.slice(0, limit)
  const hasMore = filteredSessions.length > limit

  const clearFilters = () => {
    setSourceFilter('all')
    setResultFilter('all')
    setDateFilter('all')
    setCycleFilter('all')
  }

  function customSessionSummary(s: LocalWorkoutSession): string {
    return formatCustomSessionSummary(
      s.exerciseLogs?.length ?? 0,
      sessionTotalSets(s),
      computeCustomSessionDetail(s.exerciseLogs),
    )
  }

  return (
    <>
      <ProgressSection first>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filtersActive ? 'primary' : 'secondary'}
            onClick={() => setFiltersOpen(true)}
          >
            {pl.progressFilters}
            {filtersActive ? ` (${activeFilterCount})` : ''}
          </Button>
          {historyBase.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const chunks: string[] = []
                for (const prog of ['pushups', 'pullups'] as const) {
                  chunks.push(await exportSessionsCsv(prog))
                }
                chunks.push(await exportCustomSessionsCsv())
                const merged = mergeSessionCsvExports(chunks)
                downloadCsv(`smartreps-all-${new Date().toISOString().slice(0, 10)}.csv`, merged)
                showToast(pl.toastExportDone, 'success')
              }}
            >
              {pl.exportAll}
            </Button>
          )}
        </div>

        {/* Source filter — inline, always visible */}
        <div className="mt-3">
          <SegmentedControl
            size="compact"
            stretch
            aria-label={pl.progressSourceAll}
            options={[
              { value: 'all' as const, label: pl.progressSourceAll },
              { value: 'builtin' as const, label: pl.progressSourceBuiltin },
              { value: 'custom' as const, label: pl.progressSourceCustom },
            ]}
            value={sourceFilter}
            onChange={setSourceFilter}
          />
        </div>

        {filtersActive && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {resultFilter !== 'all' && (
              <Badge variant="default">
                {resultFilter === 'passed' ? pl.filterPassed : pl.filterFailed}
              </Badge>
            )}
            {cycleFilter === 'current' && (
              <Badge variant="default">{pl.filterCycleCurrent}</Badge>
            )}
            {dateFilter !== 'all' && (
              <Badge variant="default">
                {dateFilter === '30d' ? pl.filterDate30 : pl.filterDate90}
              </Badge>
            )}
            <button
              type="button"
              className="sr-text-body-sm text-[var(--sr-brand-primary)] underline-offset-2 hover:underline"
              onClick={clearFilters}
            >
              {pl.clearFilters}
            </button>
          </div>
        )}

        {historyBase.length > 0 && (
          <p className="mt-3 sr-text-body-sm text-[var(--sr-text-muted)]">
            {pl.progressHistoryCount(filteredSessions.length)}
          </p>
        )}

        {filteredSessions.length === 0 ? (
          historyBase.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={<LogoMark size={48} />}
                title={pl.firstWorkout}
                description={pl.progressTabHistoryHint}
                action={{
                  label: pl.startFirstWorkout,
                  onClick: () => void navigateToTrain(navigate, enabledPrograms[0] ?? 'pushups'),
                }}
              />
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                icon={<LogoMark size={48} />}
                title={pl.filterEmptyHistory}
                description={pl.filterEmptyHistoryHint}
                action={filtersActive ? { label: pl.clearFilters, onClick: clearFilters } : undefined}
              />
            </div>
          )
        ) : (
          <>
            <ul className="mt-3 divide-y divide-[var(--sr-border-subtle)]">
              {visibleSessions.map((s) => {
                const isCustom = isCustomSession(s)
                const sourceLabel = sessionSourceLabel(s, customPlanNames)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full min-h-11 items-center gap-3 py-3 text-left',
                        'rounded-[var(--sr-radius-md)] transition-colors active:scale-[0.99]',
                        'hover:bg-[var(--sr-bg-surface)] active:bg-[var(--sr-bg-surface)]',
                        FOCUS_RING,
                      )}
                      onClick={() => void openSessionDetail(s)}
                    >
                      <span
                        className={cn(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--sr-radius-md)]',
                          isCustom
                            ? 'bg-[var(--sr-brand-primary-muted)] text-[var(--sr-brand-primary)]'
                            : 'bg-[var(--sr-bg-elevated)] text-[var(--sr-text-muted)]',
                        )}
                        aria-hidden
                      >
                        {isCustom ? <User size={18} /> : <Dumbbell size={18} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                            {format(new Date(s.startedAt), 'd MMM yyyy', { locale: plLocale })}
                          </p>
                          <Badge variant={sessionBadgeVariant(s)}>
                            {sessionStatusLabel(s)}
                          </Badge>
                        </div>
                        <p className="sr-text-h3 leading-snug text-[var(--sr-text-primary)]">
                          {isCustom
                            ? sourceLabel
                            : pl.dayLabel(s.dayNumber)}
                          <span className="ml-2 tabular-nums sr-text-body-sm font-normal text-[var(--sr-text-secondary)]">
                            {isCustom
                              ? `· ${pl.dayLabel(s.dayNumber)}`
                              : `· ${sessionTotalReps(s)} ${pl.repsUnit}`}
                          </span>
                        </p>
                        <p className="sr-text-body-sm text-[var(--sr-text-muted)]">
                          {isCustom
                            ? customSessionSummary(s)
                            : getCycleById(s.cycleId)?.nameShort ?? s.cycleId}
                        </p>
                      </div>
                      <ChevronRight
                        size={20}
                        className="shrink-0 text-[var(--sr-text-muted)]"
                        aria-hidden
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
            {hasMore && (
              <Button
                className="mt-3"
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => setLimit((n) => n + PAGE_SIZE)}
              >
                {pl.progressLoadMore(Math.min(PAGE_SIZE, filteredSessions.length - limit))}
              </Button>
            )}
          </>
        )}
      </ProgressSection>

      {/* Filter sheet */}
      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={pl.progressFilters}>
        <div className="flex flex-col gap-4 pb-2">
          <div>
            <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
              {pl.progressFilterResult}
            </p>
            <SegmentedControl
              aria-label={pl.progressFilterResult}
              options={[
                { value: 'all' as const, label: pl.filterAll },
                { value: 'passed' as const, label: pl.filterPassed },
                { value: 'failed' as const, label: pl.filterFailed },
              ]}
              value={resultFilter}
              onChange={setResultFilter}
            />
          </div>
          <div>
            <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
              {pl.progressFilterDate}
            </p>
            <SegmentedControl
              aria-label={pl.progressFilterDate}
              options={[
                { value: 'all' as const, label: pl.filterDateAll },
                { value: '30d' as const, label: pl.filterDate30 },
                { value: '90d' as const, label: pl.filterDate90 },
              ]}
              value={dateFilter}
              onChange={setDateFilter}
            />
          </div>
          {sourceFilter !== 'custom' && currentCycleId && (
            <div>
              <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
                {pl.progressFilterCycle}
              </p>
              <SegmentedControl
                aria-label={pl.progressFilterCycle}
                options={[
                  { value: 'all' as const, label: pl.filterCycleAll },
                  { value: 'current' as const, label: pl.filterCycleCurrent },
                ]}
                value={cycleFilter}
                onChange={setCycleFilter}
              />
            </div>
          )}
          {filtersActive && (
            <Button
              variant="ghost"
              fullWidth
              onClick={() => { clearFilters(); setFiltersOpen(false) }}
            >
              {pl.clearFilters}
            </Button>
          )}
          <Button variant="primary" fullWidth onClick={() => setFiltersOpen(false)}>
            {pl.progressFiltersApply}
          </Button>
        </div>
      </Sheet>

      {/* Session detail sheet */}
      <Sheet
        open={!!selectedSession}
        onClose={() => {
          setSelectedSession(null)
          setDetailExercises(new Map())
        }}
        title={pl.sessionDetails}
      >
        {selectedSession && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={sessionBadgeVariant(selectedSession)}>
                {sessionStatusLabel(selectedSession)}
              </Badge>
              <span className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                {format(new Date(selectedSession.startedAt), 'd MMM yyyy', { locale: plLocale })}
              </span>
            </div>
            <p className="mt-2 sr-text-h3 text-[var(--sr-text-primary)]">
              {isCustomSession(selectedSession)
                ? sessionSourceLabel(selectedSession, customPlanNames)
                : pl.dayLabel(selectedSession.dayNumber)}
              <span className="ml-2 tabular-nums sr-text-body-sm font-normal text-[var(--sr-text-secondary)]">
                {sessionTotalReps(selectedSession)} {pl.repsUnit}
              </span>
            </p>
            <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-muted)]">
              {isCustomSession(selectedSession)
                ? pl.dayLabel(selectedSession.dayNumber)
                : getCycleById(selectedSession.cycleId)?.nameShort ?? selectedSession.cycleId}
            </p>

            {/* Builtin sessions — set results list */}
            {!isCustomSession(selectedSession) && selectedSession.setResults.length > 0 && (
              <ul className="mt-4 divide-y divide-[var(--sr-border-subtle)]">
                {selectedSession.setResults.map((r) => (
                  <li
                    key={r.setNumber}
                    className="flex items-center justify-between gap-3 py-2.5 sr-text-body-sm"
                  >
                    <span className="text-[var(--sr-text-secondary)]">
                      {pl.setColumn} {r.setNumber}
                    </span>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        r.passed ? 'text-[var(--sr-text-primary)]' : 'text-[var(--sr-error)]',
                      )}
                    >
                      {r.actual} {pl.repsUnit}
                      {!r.passed && ` · ${pl.failedShort}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {/* Custom sessions — exercise logs */}
            {isCustomSession(selectedSession) && selectedSession.exerciseLogs?.length ? (
              <div className="mt-4 space-y-4">
                {selectedSession.exerciseLogs.map((log, idx) => {
                  const def = detailExercises.get(log.exerciseId)
                  const name = def?.name ?? pl.progressCustomExerciseFallback
                  const metric = def?.primaryMetric ?? 'reps'
                  return (
                    <div key={`${log.exerciseId}-${idx}`}>
                      <p className="mb-1.5 font-medium text-[var(--sr-text-primary)]">
                        {name}
                      </p>
                      <ul className="divide-y divide-[var(--sr-border-subtle)]">
                        {log.sets.map((set) => (
                          <li
                            key={set.setNumber}
                            className="flex items-center justify-between gap-3 py-2 sr-text-body-sm"
                          >
                            <span className="text-[var(--sr-text-secondary)]">
                              {pl.setColumn} {set.setNumber}
                            </span>
                            <span
                              className={cn(
                                'font-semibold tabular-nums',
                                set.passed
                                  ? 'text-[var(--sr-text-primary)]'
                                  : 'text-[var(--sr-error)]',
                              )}
                            >
                              {formatExerciseSetSummary(metric, set, weightUnit)}
                              {!set.passed && ` · ${pl.failedShort}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            ) : null}

            {/* No data fallback */}
            {!isCustomSession(selectedSession) && selectedSession.setResults.length === 0 && (
              <p className="mt-4 sr-text-body-sm text-[var(--sr-text-muted)]">
                {pl.progressSessionNoSets}
              </p>
            )}
            {isCustomSession(selectedSession) && !selectedSession.exerciseLogs?.length && (
              <p className="mt-4 sr-text-body-sm text-[var(--sr-text-muted)]">
                {pl.progressSessionNoSets}
              </p>
            )}

            <Button
              className="mt-4"
              variant="ghost"
              fullWidth
              onClick={() => {
                const id = selectedSession.id
                setSelectedSession(null)
                setDetailExercises(new Map())
                if (isCustomSession(selectedSession) && selectedSession.customPlanId) {
                  navigate(`/workout/custom/${selectedSession.customPlanId}/summary?session=${id}`)
                } else {
                  navigate(`/workout/${selectedSession.program}/summary?session=${id}`)
                }
              }}
            >
              {pl.progressOpenFullSummary}
            </Button>

            <Button
              className="mt-2"
              variant="danger"
              fullWidth
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} aria-hidden />
              {pl.sessionDelete}
            </Button>
          </>
        )}
      </Sheet>

      {/* Delete confirmation */}
      {confirmDelete && (
        <ConfirmSheet
          title={pl.sessionDeleteConfirmTitle}
          message={pl.sessionDeleteConfirm}
          confirmLabel={pl.sessionDelete}
          variant="danger"
          onConfirm={async () => {
            if (!selectedSession || deleting) return
            setDeleting(true)
            try {
              await deleteWorkoutSession(selectedSession.id)
              showToast(pl.sessionDeletedToast, 'success')
              setConfirmDelete(false)
              setSelectedSession(null)
              setDetailExercises(new Map())
            } catch {
              showToast(pl.sessionDeleteError, 'error')
            } finally {
              setDeleting(false)
            }
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  )
}
