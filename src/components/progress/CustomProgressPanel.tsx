import { useEffect, useMemo, useState, type RefObject } from 'react'
import { ChevronRight } from 'lucide-react'
import { format, subDays } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { CustomPlanCycleRail } from '@/components/progress/CustomPlanCycleRail'
import { Button } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Sheet } from '@/components/ui/Sheet'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { NestedStat } from '@/components/ui/NestedStat'
import { LogoMark } from '@/components/brand/Logo'
import { Badge } from '@/components/ui/Card'
import { EmptyState } from '@/components/ux/Feedback'
import { ExerciseSparkline } from '@/components/plans/ExerciseSparkline'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'
import { FOCUS_RING } from '@/lib/ui-chrome'
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
import type { CustomProgressView } from '@/components/progress/ProgressChromeNav'

export type CustomView = CustomProgressView

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
  customPrs,
  onOpenExercise,
  customPlans,
  customCyclePlan,
  customCyclePlanId,
  onCyclePlanChange,
  customCycleProgress,
  customCycleSessions,
  customHistoryRef,
  customFiltersActive,
  customActiveFilterCount,
  onOpenFilters,
  customHistoryPlanFilter,
  customHistoryDayFilter,
  customHistoryResultFilter,
  customPlanNames,
  exerciseNamesById,
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
  customPrs: ExercisePr[]
  onOpenExercise: (exerciseId: string) => void
  customPlans: CustomPlan[]
  customCyclePlan: CustomPlan | null
  customCyclePlanId: string | 'all'
  onCyclePlanChange: (id: string | 'all') => void
  customCycleProgress: CustomProgramProgress | null
  customCycleSessions: LocalWorkoutSession[]
  customHistoryRef: RefObject<HTMLDivElement | null>
  customFiltersActive: boolean
  customActiveFilterCount: number
  onOpenFilters: () => void
  customHistoryPlanFilter: string | 'all'
  customHistoryDayFilter: number | 'all'
  customHistoryResultFilter: 'all' | 'passed' | 'failed'
  customPlanNames: Record<string, string>
  exerciseNamesById: Record<string, string>
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
  const [previewDay, setPreviewDay] = useState<number | null>(null)
  const [userPickedDay, setUserPickedDay] = useState(false)

  const firstPlanDay = useMemo(() => {
    if (!customCyclePlan?.days.length) return null
    return [...customCyclePlan.days].sort((a, b) => a.dayNumber - b.dayNumber)[0]?.dayNumber ?? null
  }, [customCyclePlan])

  const progressCurrentDay = customCycleProgress?.currentDay ?? null

  useEffect(() => {
    setUserPickedDay(false)
    setPreviewDay(progressCurrentDay ?? firstPlanDay)
  }, [customCyclePlan?.id]) // eslint-disable-line react-hooks/exhaustive-deps -- reset only on plan switch

  useEffect(() => {
    if (userPickedDay) return
    setPreviewDay(progressCurrentDay ?? firstPlanDay)
  }, [progressCurrentDay, firstPlanDay, userPickedDay])

  const sessions14d = useMemo(() => {
    const since = subDays(new Date(), 14).getTime()
    return customSessionsAll.filter(
      (s) => s.status === 'completed' && new Date(s.startedAt).getTime() >= since,
    ).length
  }, [customSessionsAll])

  const trainedExerciseCount = useMemo(
    () => customPrs.filter((p) => p.sessionCount > 0).length,
    [customPrs],
  )

  const planDaysTotal = customCyclePlan?.days.length ?? 0
  const planDayCurrent = progressCurrentDay ?? firstPlanDay
  const selectedMapDay = previewDay ?? planDayCurrent
  const preview =
    customCyclePlan &&
    selectedMapDay != null &&
    customCyclePlan.days.find((d) => d.dayNumber === selectedMapDay)

  return (
    <>
      {customView === 'exercises' && (
        <>
          {(customSessionsAll.length > 0 || customPlans.length > 0) && (
            <ProgressSection first title={pl.progressSummaryTitle}>
              <MetricStrip
                metrics={[
                  {
                    value: sessions14d,
                    label: pl.progressCustomSessions14d,
                    hint: pl.homeSessions14dHint,
                  },
                  {
                    value: trainedExerciseCount,
                    label: pl.progressCustomExercisesTrained,
                  },
                  {
                    value: customPlans.length,
                    label: pl.progressCustomActivePlans,
                  },
                ]}
                goal={{
                  label: pl.homeGoal3in14,
                  current: sessions14d,
                  max: 3,
                }}
              />
            </ProgressSection>
          )}

          {customCyclePlan ? (
            <ProgressSection
              first={customSessionsAll.length === 0 && customPlans.length === 0}
              title={pl.progressCustomActivePlanTitle}
            >
              {customPlans.length > 1 && (
                <label className="mb-3 block">
                  <span className="sr-only">{pl.customHistoryFilterPlan}</span>
                  <select
                    className={cn(
                      FOCUS_RING,
                      'w-full rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)]',
                      'bg-[var(--sr-bg-surface)] px-3 py-3 text-base text-[var(--sr-text-primary)]',
                    )}
                    aria-label={pl.customHistoryFilterPlan}
                    value={customCyclePlanId === 'all' ? customCyclePlan.id : customCyclePlanId}
                    onChange={(e) => onCyclePlanChange(e.target.value)}
                  >
                    {customPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <NestedStat
                size="md"
                overline={
                  planDayCurrent != null && planDaysTotal > 0
                    ? pl.progressCustomPlanDayProgress(planDayCurrent, planDaysTotal)
                    : pl.customCycleRailTitle
                }
                value={customCyclePlan.name}
                hint={
                  customCycleProgress
                    ? [
                        pl.progressCustomCycleAttempt(customCycleProgress.cycleAttempt),
                        customCycleProgress.status === 'rest' ? pl.customCycleDayRest : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : undefined
                }
              />

              <Button
                className="mt-3"
                size="touch"
                fullWidth
                onClick={() => navigate(`/workout/custom/${customCyclePlan.id}`)}
              >
                {pl.planTrain}
              </Button>

              <div className="mt-4">
                <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
                  {pl.progressCustomPlanMapTitle}
                </p>
                <CustomPlanCycleRail
                  plan={customCyclePlan}
                  progress={customCycleProgress}
                  sessions={customCycleSessions}
                  selectedDay={selectedMapDay}
                  onDayClick={(day) => {
                    setUserPickedDay(true)
                    setPreviewDay(day)
                  }}
                />
              </div>

              {preview && preview.exercises.length > 0 && (
                <div className="mt-4 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3">
                  <p className="sr-text-overline text-[var(--sr-text-muted)]">
                    {selectedMapDay === planDayCurrent && !userPickedDay
                      ? pl.progressCustomNextSession
                      : pl.dayLabel(preview.dayNumber)}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {preview.exercises.map((ex, idx) => {
                      const name =
                        exerciseNamesById[ex.exerciseId] ??
                        customPrs.find((p) => p.exerciseId === ex.exerciseId)?.name ??
                        pl.progressCustomExerciseFallback
                      return (
                        <li
                          key={`${ex.exerciseId}-${idx}`}
                          className="flex items-baseline justify-between gap-2"
                        >
                          <span className="min-w-0 truncate sr-text-body-sm text-[var(--sr-text-primary)]">
                            {name}
                          </span>
                          <span className="shrink-0 sr-text-caption text-[var(--sr-text-muted)]">
                            {pl.progressCustomDaySets(ex.sets.length)}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )}
            </ProgressSection>
          ) : (
            <ProgressSection first={customSessionsAll.length === 0 && customPlans.length === 0}>
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

          <ProgressSection
            title={pl.progressCustomRecordsTitle}
            hint={customPrs.length > 0 ? pl.progressCustomRecordsHint : undefined}
          >
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
              <ul className="flex flex-col gap-2.5">
                {customPrs.map((pr) => (
                  <li key={pr.exerciseId}>
                    <button
                      type="button"
                      className={cn(
                        FOCUS_RING,
                        'flex w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)]',
                        'bg-[var(--sr-bg-surface)] px-3.5 py-3.5 text-left transition-colors',
                        'hover:border-[var(--sr-border-strong)]',
                      )}
                      onClick={() => onOpenExercise(pr.exerciseId)}
                    >
                      <ExerciseSparkline values={pr.sparkline} active={pr.sessionCount > 0} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-semibold text-[var(--sr-text-primary)]">
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
                        <p className="mt-1 text-sm font-medium tabular-nums text-[var(--sr-text-primary)]">
                          {formatExercisePrLine(pr)}
                        </p>
                        <p className="mt-0.5 sr-text-caption text-[var(--sr-text-muted)]">
                          {[
                            pr.sessionCount > 0
                              ? pl.progressCustomSessionCount(pr.sessionCount)
                              : null,
                            pr.lastSessionAt
                              ? `${pl.exerciseDetailLastTrained} ${format(new Date(pr.lastSessionAt), 'd MMM', { locale: plLocale })}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
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
            )}
          </ProgressSection>
        </>
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
                <ul className="flex flex-col gap-2.5">
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
                            FOCUS_RING,
                            'flex w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)]',
                            'bg-[var(--sr-bg-surface)] px-3.5 py-3.5 text-left transition-colors',
                            'hover:border-[var(--sr-border-strong)]',
                          )}
                          onClick={() => {
                            if (planId) {
                              navigate(`/workout/custom/${planId}/summary?session=${s.id}`)
                            }
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="sr-text-overline text-[var(--sr-text-muted)]">
                                {format(new Date(s.startedAt), 'd MMM yyyy', { locale: plLocale })}
                              </p>
                              <Badge variant={sessionBadgeVariant(s)}>
                                {sessionStatusLabel(s)}
                              </Badge>
                            </div>
                            <p className="mt-1 font-semibold text-[var(--sr-text-primary)]">
                              {pl.progressCustomSessionMeta(planName, s.dayNumber)}
                            </p>
                            <p className="mt-1 text-sm text-[var(--sr-text-secondary)]">
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
