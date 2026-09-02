import type { RefObject } from 'react'
import { ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { CustomPlanCycleRail } from '@/components/progress/CustomPlanCycleRail'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { LogoMark } from '@/components/brand/Logo'
import { Badge } from '@/components/ui/Card'
import { EmptyState } from '@/components/ux/Feedback'
import { ExerciseSparkline } from '@/components/plans/ExerciseSparkline'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import type { ExercisePr } from '@/lib/custom-stats'
import type { ExerciseTrend } from '@/lib/custom-exercise-stats'
import type { CustomPlan, CustomProgramProgress } from '@/lib/exercise-model'
import type { LocalWorkoutSession } from '@/lib/db'
import {
  computeCustomSessionDetail,
  formatCustomSessionSummary,
  sessionTotalSets,
} from '@/lib/custom-session-stats'
import type { NavigateFunction } from 'react-router-dom'

export type CustomView = 'exercises' | 'plan' | 'history'

function trendDotClass(trend: ExerciseTrend): string | null {
  if (trend === 'up') return 'bg-[var(--sr-success)]'
  if (trend === 'down') return 'bg-[var(--sr-error)]'
  if (trend === 'flat') return 'bg-[var(--sr-text-muted)]'
  return null
}

function formatExercisePrLine(pr: ExercisePr): string {
  return (
    [
      pr.maxReps != null ? `${pr.maxReps} ${pl.repsUnit}` : null,
      pr.maxDurationSec != null ? `${pr.maxDurationSec}${pl.durationUnitShort}` : null,
      pr.maxWeightKg != null ? `${pr.maxWeightKg} ${pl.weightUnit}` : null,
    ]
      .filter(Boolean)
      .join(' · ') || pl.noValue
  )
}

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

export function CustomProgressPanel({
  customView,
  onSelectView,
  customPrs,
  onOpenExercise,
  customPlans,
  customCyclePlan,
  customCyclePlanId,
  onCyclePlanChange,
  customCycleProgress,
  customCycleSessions,
  onPlanDayClick,
  customHistoryRef,
  customFiltersActive,
  customActiveFilterCount,
  onOpenFilters,
  customHistoryPlanFilter,
  customHistoryDayFilter,
  customHistoryResultFilter,
  customPlanNames,
  onClearFilters,
  customHistoryVisible,
  customHistoryFilteredLength,
  customHistoryLimit,
  onLoadMore,
  historyPageSize,
  customFiltersOpen,
  onCloseFilters,
  onHistoryPlanFilter,
  onHistoryResultFilter,
  onHistoryDayFilter,
  customSessionsAll,
  navigate,
}: {
  customView: CustomView
  onSelectView: (v: CustomView) => void
  customPrs: ExercisePr[]
  onOpenExercise: (exerciseId: string) => void
  customPlans: CustomPlan[]
  customCyclePlan: CustomPlan | null
  customCyclePlanId: string | 'all'
  onCyclePlanChange: (id: string | 'all') => void
  customCycleProgress: CustomProgramProgress | null
  customCycleSessions: LocalWorkoutSession[]
  onPlanDayClick: (day: number, planId: string) => void
  customHistoryRef: RefObject<HTMLDivElement | null>
  customFiltersActive: boolean
  customActiveFilterCount: number
  onOpenFilters: () => void
  customHistoryPlanFilter: string | 'all'
  customHistoryDayFilter: number | 'all'
  customHistoryResultFilter: 'all' | 'passed' | 'failed'
  customPlanNames: Record<string, string>
  onClearFilters: () => void
  customHistoryVisible: LocalWorkoutSession[]
  customHistoryFilteredLength: number
  customHistoryLimit: number
  onLoadMore: () => void
  historyPageSize: number
  customFiltersOpen: boolean
  onCloseFilters: () => void
  onHistoryPlanFilter: (v: string | 'all') => void
  onHistoryResultFilter: (v: 'all' | 'passed' | 'failed') => void
  onHistoryDayFilter: (v: number | 'all') => void
  customSessionsAll: LocalWorkoutSession[]
  navigate: NavigateFunction
}) {
  const viewOptions: { value: CustomView; label: string }[] = [
    { value: 'exercises', label: pl.progressCustomViewExercises },
    { value: 'plan', label: pl.progressCustomViewPlan },
    { value: 'history', label: pl.progressCustomViewHistory },
  ]

  return (
    <>
      <div className="mt-3 mb-1">
        <SegmentedControl
          className="flex-nowrap overflow-x-auto pb-0.5"
          size="compact"
          options={viewOptions}
          value={customView}
          onChange={onSelectView}
        />
      </div>

      {customView === 'exercises' && (
        <ProgressSection first title={pl.progressMyExercises}>
          {customPrs.length === 0 ? (
            <EmptyState
              icon={<LogoMark size={48} />}
              title={pl.progressCustomPrEmpty}
              description={pl.progressTabCustomHint}
              action={{
                label: pl.myPlansEmptyCta,
                onClick: () => navigate('/plans?tab=mine'),
              }}
              secondaryAction={{
                label: pl.exerciseLibrary,
                onClick: () => navigate('/plans?tab=library'),
              }}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {customPrs.map((pr) => (
                <li key={pr.exerciseId}>
                  <button
                    type="button"
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)]',
                      'bg-[var(--sr-bg-surface)] p-3 text-left transition-colors',
                      'hover:border-[var(--sr-border-strong)]',
                      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]',
                    )}
                    onClick={() => onOpenExercise(pr.exerciseId)}
                  >
                    <ExerciseSparkline values={pr.sparkline} active={pr.sessionCount > 0} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-medium text-[var(--sr-text-primary)]">
                          {pr.name}
                        </p>
                        {trendDotClass(pr.trend) && (
                          <span
                            className={cn(
                              'h-1.5 w-1.5 shrink-0 rounded-full',
                              trendDotClass(pr.trend),
                            )}
                            aria-hidden
                          />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">
                        {pl.progressCustomPr}: {formatExercisePrLine(pr)}
                      </p>
                      {pr.sessionCount > 0 && (
                        <p className="mt-0.5 text-xs text-[var(--sr-text-muted)]">
                          {pl.progressCustomSessionCount(pr.sessionCount)}
                        </p>
                      )}
                      {pr.lastSessionAt && (
                        <p className="mt-1 text-xs text-[var(--sr-text-muted)]">
                          {pl.exerciseDetailLastTrained}:{' '}
                          {format(new Date(pr.lastSessionAt), 'd MMM yyyy', { locale: plLocale })}
                        </p>
                      )}
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
          )}
        </ProgressSection>
      )}

      {customView === 'plan' && customCyclePlan && (
        <ProgressSection first title={pl.customCycleRailTitle}>
          {customPlans.length > 1 && (
            <div className="mb-3">
              <SegmentedControl
                size="compact"
                value={customCyclePlanId}
                onChange={onCyclePlanChange}
                options={customPlans.map((p) => ({ value: p.id, label: p.name }))}
              />
            </div>
          )}
          <CustomPlanCycleRail
            plan={customCyclePlan}
            progress={customCycleProgress}
            sessions={customCycleSessions}
            onDayClick={(day) => onPlanDayClick(day, customCyclePlan.id)}
          />
        </ProgressSection>
      )}

      {customView === 'plan' && !customCyclePlan && (
        <ProgressSection first>
          <EmptyState
            icon={<LogoMark size={48} />}
            title={pl.progressCustomPlanEmpty}
            description={pl.progressCustomPlanEmptyHint}
            action={{
              label: pl.myPlansEmptyCta,
              onClick: () => navigate('/plans?tab=mine'),
            }}
          />
        </ProgressSection>
      )}

      {customView === 'history' && (
        <div ref={customHistoryRef}>
          <ProgressSection first title={pl.progressCustomHistory}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={customFiltersActive ? 'primary' : 'secondary'}
                onClick={onOpenFilters}
              >
                {pl.progressFilters}
                {customFiltersActive ? ` (${customActiveFilterCount})` : ''}
              </Button>
            </div>

            {customFiltersActive && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {customHistoryPlanFilter !== 'all' && (
                  <Badge variant="default">
                    {customPlanNames[customHistoryPlanFilter] ?? pl.planDash}
                  </Badge>
                )}
                {customHistoryDayFilter !== 'all' && (
                  <Badge variant="default">{pl.planDayLabel(customHistoryDayFilter)}</Badge>
                )}
                {customHistoryResultFilter !== 'all' && (
                  <Badge variant="default">
                    {customHistoryResultFilter === 'passed' ? pl.passedShort : pl.failedShort}
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

            {customHistoryVisible.length === 0 ? (
              <EmptyState
                icon={<LogoMark size={48} />}
                title={
                  customFiltersActive
                    ? pl.customHistoryEmptyFiltered
                    : pl.progressCustomHistoryEmpty
                }
                description={
                  customFiltersActive
                    ? pl.filterEmptyHistoryHint
                    : pl.progressCustomHistoryEmptyHint
                }
                action={
                  customFiltersActive
                    ? { label: pl.clearFilters, onClick: onClearFilters }
                    : {
                        label: pl.myPlansTitle,
                        onClick: () => navigate('/plans?tab=mine'),
                      }
                }
              />
            ) : (
              <>
                <ul className="divide-y divide-[var(--sr-border-subtle)]">
                  {customHistoryVisible.map((s) => {
                    const planName =
                      (s.customPlanId && customPlanNames[s.customPlanId]) || pl.planDash
                    const sets = sessionTotalSets(s)
                    const detail = computeCustomSessionDetail(s.exerciseLogs)
                    const planId = s.customPlanId
                    return (
                      <li key={s.id}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full items-center gap-3 py-3 text-left transition-colors',
                            'rounded-[var(--sr-radius-md)] hover:bg-[var(--sr-bg-surface)]/60',
                            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]',
                          )}
                          onClick={() => {
                            if (planId) {
                              navigate(`/workout/custom/${planId}/summary?session=${s.id}`)
                            }
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                                {format(new Date(s.startedAt), 'd MMM yyyy', { locale: plLocale })}
                              </p>
                              <Badge variant={sessionBadgeVariant(s)}>
                                {sessionStatusLabel(s)}
                              </Badge>
                            </div>
                            <p className="mt-1 font-medium text-[var(--sr-text-primary)]">
                              {pl.progressCustomSessionMeta(planName, s.dayNumber)}
                            </p>
                            <p className="mt-1 text-sm text-[var(--sr-text-muted)]">
                              {formatCustomSessionSummary(
                                s.exerciseLogs?.length ?? 0,
                                sets,
                                detail,
                              )}
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
                {customHistoryFilteredLength > customHistoryLimit && (
                  <Button className="mt-4" variant="secondary" fullWidth onClick={onLoadMore}>
                    {pl.progressLoadMore(
                      Math.min(
                        historyPageSize,
                        customHistoryFilteredLength - customHistoryLimit,
                      ),
                    )}
                  </Button>
                )}
              </>
            )}
          </ProgressSection>

          <Sheet open={customFiltersOpen} onClose={onCloseFilters} title={pl.progressFilters}>
            <div className="flex flex-col gap-4">
              <p className="sr-text-overline text-[var(--sr-text-muted)]">
                {pl.customHistoryFilterPlan}
              </p>
              <SegmentedControl
                value={customHistoryPlanFilter}
                onChange={(v) => onHistoryPlanFilter(v)}
                options={[
                  { value: 'all', label: pl.filterAll },
                  ...customPlans.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <p className="sr-text-overline text-[var(--sr-text-muted)]">
                {pl.customHistoryFilterResult}
              </p>
              <SegmentedControl
                value={customHistoryResultFilter}
                onChange={(v) => onHistoryResultFilter(v as 'all' | 'passed' | 'failed')}
                options={[
                  { value: 'all', label: pl.filterAll },
                  { value: 'passed', label: pl.passedShort },
                  { value: 'failed', label: pl.failedShort },
                ]}
              />
              <p className="sr-text-overline text-[var(--sr-text-muted)]">
                {pl.customHistoryFilterDay}
              </p>
              <SegmentedControl
                value={customHistoryDayFilter === 'all' ? 'all' : String(customHistoryDayFilter)}
                onChange={(v) => onHistoryDayFilter(v === 'all' ? 'all' : Number(v))}
                options={[
                  { value: 'all', label: pl.filterAll },
                  ...(customHistoryPlanFilter !== 'all'
                    ? (customPlans.find((p) => p.id === customHistoryPlanFilter)?.days ?? [])
                        .map((d) => d.dayNumber)
                        .sort((a, b) => a - b)
                        .map((n) => ({ value: String(n), label: pl.planDayLabel(n) }))
                    : Array.from(
                        new Set(
                          customSessionsAll
                            .filter(
                              (s) =>
                                customHistoryPlanFilter === 'all' ||
                                s.customPlanId === customHistoryPlanFilter,
                            )
                            .map((s) => s.dayNumber),
                        ),
                      )
                        .sort((a, b) => a - b)
                        .map((n) => ({ value: String(n), label: pl.planDayLabel(n) }))),
                ]}
              />
              <Button fullWidth onClick={onCloseFilters}>
                {pl.progressFiltersApply}
              </Button>
            </div>
          </Sheet>
        </div>
      )}
    </>
  )
}
