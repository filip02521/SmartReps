import { ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { ActivityCalendar } from '@/components/progress/ActivityCalendar'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { LogoMark } from '@/components/brand/Logo'
import { EmptyState } from '@/components/ux/Feedback'
import { pl } from '@/i18n/pl'
import { sessionTotalReps } from '@/lib/progress-history'
import { navigateToTrain } from '@/lib/setup-flow'
import { getCycleById } from '@/data/plans'
import { exportSessionsCsv, downloadCsv } from '@/lib/export'
import { showToast } from '@/stores/toast-store'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
import type { Program } from '@/data/plans/types'
import type { LocalWorkoutSession } from '@/lib/db'
import type { NavigateFunction } from 'react-router-dom'

export function HistoryPanel({
  program,
  historyBaseCount,
  filteredCount,
  visibleSessions,
  hasMoreHistory,
  filtersActive,
  activeFilterCount,
  historyFilter,
  historyCycleFilter,
  historyDateFilter,
  onOpenFilters,
  onClearFilters,
  onLoadMore,
  onSelectSession,
  allSessions,
  navigate,
}: {
  program: Program
  historyBaseCount: number
  filteredCount: number
  visibleSessions: LocalWorkoutSession[]
  hasMoreHistory: boolean
  filtersActive: boolean
  activeFilterCount: number
  historyFilter: 'all' | 'passed' | 'failed'
  historyCycleFilter: 'all' | 'current'
  historyDateFilter: 'all' | '30d' | '90d'
  onOpenFilters: () => void
  onClearFilters: () => void
  onLoadMore: () => void
  onSelectSession: (s: LocalWorkoutSession) => void
  allSessions: LocalWorkoutSession[]
  navigate: NavigateFunction
}) {
  return (
    <>
    {allSessions.length > 0 && (
      <ProgressSection first title={pl.calendarTitle} hint={pl.calendarHint}>
        <ActivityCalendar sessions={allSessions} />
      </ProgressSection>
    )}

    <ProgressSection first={allSessions.length === 0}>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={filtersActive ? 'primary' : 'secondary'}
          onClick={onOpenFilters}
        >
          {pl.progressFilters}
          {filtersActive ? ` (${activeFilterCount})` : ''}
        </Button>
        {historyBaseCount > 0 && (
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              const csv = await exportSessionsCsv(program)
              downloadCsv(`smartreps-${program}-${new Date().toISOString().slice(0, 10)}.csv`, csv)
              showToast(pl.toastExportDone, 'success')
            }}
          >
            {pl.exportThisProgram}
          </Button>
        )}
      </div>

      {filtersActive && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {historyFilter !== 'all' && (
            <Badge variant="default">
              {historyFilter === 'passed' ? pl.filterPassed : pl.filterFailed}
            </Badge>
          )}
          {historyCycleFilter === 'current' && (
            <Badge variant="default">{pl.filterCycleCurrent}</Badge>
          )}
          {historyDateFilter !== 'all' && (
            <Badge variant="default">
              {historyDateFilter === '30d' ? pl.filterDate30 : pl.filterDate90}
            </Badge>
          )}
          <button
            type="button"
            className="sr-text-body-sm text-[var(--sr-brand-primary)] underline-offset-2 hover:underline"
            onClick={onClearFilters}
          >
            {pl.clearFilters}
          </button>
        </div>
      )}

      {historyBaseCount > 0 && (
        <p className="mt-3 sr-text-body-sm text-[var(--sr-text-muted)]">
          {pl.progressHistoryCount(filteredCount)}
        </p>
      )}

      {filteredCount === 0 ? (
        historyBaseCount === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={<LogoMark size={48} />}
              title={pl.firstWorkout}
              description={pl.progressTabHistoryHint}
              action={{
                label: pl.startFirstWorkout,
                onClick: () => void navigateToTrain(navigate, program),
              }}
            />
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              icon={<LogoMark size={48} />}
              title={pl.filterEmptyHistory}
              description={pl.filterEmptyHistoryHint}
              action={filtersActive ? { label: pl.clearFilters, onClick: onClearFilters } : undefined}
            />
          </div>
        )
      ) : (
        <>
          <ul className="mt-3 divide-y divide-[var(--sr-border-subtle)]">
            {visibleSessions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full min-h-11 items-center gap-3 py-3 text-left',
                    'rounded-[var(--sr-radius-md)] transition-colors active:scale-[0.99]',
                    'hover:bg-[var(--sr-bg-surface)] active:bg-[var(--sr-bg-surface)]',
                    FOCUS_RING,
                  )}
                  onClick={() => onSelectSession(s)}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                        {format(new Date(s.startedAt), 'd MMM yyyy', { locale: plLocale })}
                      </p>
                      <Badge
                        variant={
                          s.passed === true ? 'success' : s.passed === false ? 'error' : 'default'
                        }
                      >
                        {s.passed === false
                          ? pl.failedShort
                          : s.passed === true
                            ? pl.passedShort
                            : pl.incompleteShort}
                      </Badge>
                    </div>
                    <p className="sr-text-h3 leading-snug text-[var(--sr-text-primary)]">
                      {pl.dayLabel(s.dayNumber)}
                      <span className="ml-2 tabular-nums sr-text-body-sm font-normal text-[var(--sr-text-secondary)]">
                        {sessionTotalReps(s)} {pl.repsUnit}
                        {s.setResults.length > 0 && (
                          <> · {pl.progressSetCount(s.setResults.length)}</>
                        )}
                      </span>
                    </p>
                    <p className="sr-text-body-sm text-[var(--sr-text-muted)]">
                      {getCycleById(s.cycleId)?.nameShort ?? s.cycleId}
                    </p>
                  </div>
                  <ChevronRight
                    size={20}
                    className="shrink-0 text-[var(--sr-text-muted)]"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
          {hasMoreHistory && (
            <Button className="mt-3" variant="secondary" size="sm" fullWidth onClick={onLoadMore}>
              {pl.progressLoadMore(filteredCount - visibleSessions.length)}
            </Button>
          )}
        </>
      )}
    </ProgressSection>
    </>
  )
}
