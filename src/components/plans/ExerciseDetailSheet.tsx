import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart2, TrendingDown, TrendingUp } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { AccessibleChart } from '@/components/ui/AccessibleChart'
import { NestedStat } from '@/components/ui/NestedStat'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { PROGRESS_CHART_TOOLTIP_STYLE } from '@/components/progress/chart-style'
import { EmptyState, SkeletonCard } from '@/components/ux/Feedback'
import { LogoMark } from '@/components/brand/Logo'
import type { ExerciseDefinition, PrimaryMetric } from '@/lib/exercise-model'
import {
  computeExerciseDetailStats,
  exercisePrDisplay,
  type ExerciseDetailStats,
} from '@/lib/custom-exercise-stats'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

function metricBadgeLabel(metric: PrimaryMetric): string {
  if (metric === 'reps') return pl.exerciseMetricReps
  if (metric === 'duration_sec') return pl.exerciseMetricDuration
  return pl.exerciseMetricRepsWeight
}

function chartValueLabel(metric: PrimaryMetric): string {
  if (metric === 'duration_sec') return pl.exerciseDetailChartDuration
  if (metric === 'reps_weight') return pl.exerciseDetailChartReps
  return pl.repsUnit
}

function loadChartUnit(metric: PrimaryMetric): string {
  if (metric === 'duration_sec') return pl.exerciseDetailLoadChartDuration
  if (metric === 'reps_weight') return pl.exerciseDetailLoadChartVolume
  return pl.exerciseDetailLoadChartReps
}

function formatDurationMinutes(totalSec: number): string {
  if (totalSec < 60) return `${totalSec}s`
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return s === 0 ? `${m} min` : `${m} min ${s}s`
}

function trendCopy(stats: ExerciseDetailStats): string | null {
  if (!stats.trend || stats.chartPoints.length < 4) return null
  const abs = stats.trendDeltaPct != null ? Math.abs(stats.trendDeltaPct) : 0
  if (stats.trend === 'up') return pl.exerciseDetailTrendUp(abs)
  if (stats.trend === 'down') return pl.exerciseDetailTrendDown(abs)
  return pl.exerciseDetailTrendFlat
}

function ExerciseDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <SkeletonCard className="h-6 w-28" />
      <div className="grid grid-cols-2 gap-2">
        <SkeletonCard className="h-[4.5rem]" />
        <SkeletonCard className="h-[4.5rem]" />
        <SkeletonCard className="h-[4.5rem]" />
        <SkeletonCard className="h-[4.5rem]" />
      </div>
      <SkeletonCard className="h-20" />
      <SkeletonCard className="h-44" />
      <SkeletonCard className="h-44" />
      <SkeletonCard className="h-28" />
    </div>
  )
}

function TrendBadge({ stats }: { stats: ExerciseDetailStats }) {
  if (!stats.trend || stats.chartPoints.length < 4) return null
  const Icon = stats.trend === 'down' ? TrendingDown : TrendingUp
  const variant =
    stats.trend === 'up' ? 'success' : stats.trend === 'down' ? 'error' : 'default'
  return (
    <Badge variant={variant} className="inline-flex items-center gap-1">
      {stats.trend !== 'flat' && <Icon size={14} aria-hidden />}
      {trendCopy(stats)}
    </Badge>
  )
}

export function ExerciseDetailSheet({
  open,
  exercise,
  onClose,
  onEdit,
  elevated = false,
  showProgressLink = true,
}: {
  open: boolean
  exercise: ExerciseDefinition | null
  onClose: () => void
  onEdit?: () => void
  elevated?: boolean
  showProgressLink?: boolean
}) {
  const navigate = useNavigate()
  const [stats, setStats] = useState<ExerciseDetailStats | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !exercise) {
      setStats(null)
      return
    }
    setLoading(true)
    void computeExerciseDetailStats(exercise)
      .then(setStats)
      .finally(() => setLoading(false))
  }, [open, exercise?.id, exercise])

  const title = exercise?.name ?? pl.exerciseDetailTitle

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      elevated={elevated}
      className="max-h-[92vh]"
    >
      {!exercise ? null : loading ? (
        <ExerciseDetailSkeleton />
      ) : !stats ? null : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{metricBadgeLabel(exercise.primaryMetric)}</Badge>
            {exercise.restDefaultSec > 0 && (
              <span className="text-sm text-[var(--sr-text-muted)]">
                {pl.exerciseDetailRestDefault(exercise.restDefaultSec)}
              </span>
            )}
            {stats.sessionCount > 0 && (
              <TrendBadge stats={stats} />
            )}
          </div>

          {stats.sessionCount === 0 ? (
            <EmptyState
              icon={<LogoMark size={48} />}
              title={pl.exerciseDetailEmpty}
              action={{
                label: pl.myPlansTitle,
                onClick: () => {
                  onClose()
                  navigate('/plans?tab=mine')
                },
              }}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                <NestedStat
                  size="md"
                  overline={pl.exerciseDetailSessions}
                  value={stats.sessionCount}
                />
                <NestedStat
                  size="md"
                  overline={pl.exerciseDetailSets}
                  value={stats.setCount}
                />
                <NestedStat
                  size="md"
                  overline={pl.exerciseDetailPassRate}
                  value={stats.passRatePct != null ? `${stats.passRatePct}%` : '—'}
                  hint={
                    stats.passRatePct != null
                      ? pl.exerciseDetailPassHint(stats.passedSetCount, stats.setCount)
                      : undefined
                  }
                />
                <NestedStat
                  size="md"
                  overline={pl.exerciseDetailLastTrained}
                  value={
                    stats.lastSessionAt
                      ? format(new Date(stats.lastSessionAt), 'd MMM yyyy', {
                          locale: plLocale,
                        })
                      : '—'
                  }
                  hint={
                    stats.firstSessionAt && stats.firstSessionAt !== stats.lastSessionAt
                      ? pl.exerciseDetailSince(
                          format(new Date(stats.firstSessionAt), 'd MMM yyyy', {
                            locale: plLocale,
                          }),
                        )
                      : undefined
                  }
                />
              </div>

              <NestedStat
                size="lg"
                highlight
                overline={pl.progressCustomPr}
                value={exercisePrDisplay(stats)}
                hint={
                  stats.prDate && stats.prSessionLabel
                    ? (exercise.primaryMetric === 'reps_weight'
                        ? pl.exerciseDetailPrHintRepsWeight
                        : exercise.primaryMetric === 'duration_sec'
                          ? pl.exerciseDetailPrHintDuration
                          : pl.exerciseDetailPrHint)(
                        format(new Date(stats.prDate), 'd MMM yyyy', { locale: plLocale }),
                        stats.prSessionLabel,
                      )
                    : undefined
                }
              />

              <ProgressSection title={pl.exerciseDetailLoadTitle}>
                <div className="grid grid-cols-2 gap-2">
                  {exercise.primaryMetric === 'duration_sec' ? (
                    <NestedStat
                      size="md"
                      overline={pl.exerciseDetailTotalDuration}
                      value={formatDurationMinutes(stats.totalDurationSecAllTime)}
                    />
                  ) : exercise.primaryMetric === 'reps_weight' ? (
                    <NestedStat
                      size="md"
                      overline={pl.exerciseDetailTotalVolume}
                      value={`${Math.round(stats.totalVolumeKgAllTime ?? 0)} ${pl.exerciseDetailTotalVolumeUnit}`}
                    />
                  ) : (
                    <NestedStat
                      size="md"
                      overline={pl.exerciseDetailTotalReps}
                      value={stats.totalRepsAllTime}
                    />
                  )}
                  <NestedStat
                    size="md"
                    overline={pl.exerciseDetailAvgBest}
                    value={
                      stats.avgBestPerSession != null
                        ? `${stats.avgBestPerSession} ${chartValueLabel(exercise.primaryMetric)}`
                        : '—'
                    }
                  />
                  <NestedStat
                    size="md"
                    overline={pl.exerciseDetailSessions30d}
                    value={stats.sessionsLast30d}
                  />
                  <NestedStat
                    size="md"
                    overline={pl.exerciseDetailAvgPerWeek}
                    value={
                      stats.avgSessionsPerWeek != null
                        ? pl.exerciseDetailAvgPerWeekUnit(stats.avgSessionsPerWeek)
                        : '—'
                    }
                  />
                </div>
              </ProgressSection>

              <ProgressSection title={pl.exerciseDetailChartTitle} hint={pl.exerciseDetailChartHint}>
                {stats.chartPoints.length >= 2 ? (
                  <AccessibleChart
                    label={pl.exerciseDetailChartAria(stats.chartPoints.length, exercise.name)}
                    data={stats.chartPoints.map((p) => ({ date: p.dateLabel, value: p.value }))}
                    columns={[
                      { key: 'date', header: pl.dateColumn },
                      { key: 'value', header: chartValueLabel(exercise.primaryMetric) },
                    ]}
                    className="h-44 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3 pl-1"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={stats.chartPoints}>
                        <XAxis
                          dataKey="dateLabel"
                          tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                          stroke="var(--sr-border-subtle)"
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                          stroke="var(--sr-border-subtle)"
                          width={32}
                        />
                        <Tooltip
                          contentStyle={PROGRESS_CHART_TOOLTIP_STYLE}
                          formatter={(value, _name, item) => {
                            const row = item.payload as ExerciseDetailStats['chartPoints'][0]
                            const secondary = row.tooltipSecondary
                            const main = `${value ?? 0} ${chartValueLabel(exercise.primaryMetric)}`
                            return [
                              secondary ? `${main} · ${secondary}` : main,
                              pl.exerciseDetailChartTooltip,
                            ]
                          }}
                          labelFormatter={(label) => String(label)}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="var(--sr-brand-primary)"
                          strokeWidth={2.5}
                          dot={{ r: 3, fill: 'var(--sr-brand-primary)' }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </AccessibleChart>
                ) : stats.chartPoints.length === 1 ? (
                  <p className="sr-text-body-sm text-[var(--sr-text-muted)]">
                    {pl.exerciseDetailChartSingle(
                      stats.chartPoints[0]!.value,
                      chartValueLabel(exercise.primaryMetric),
                    )}
                  </p>
                ) : (
                  <p className="sr-text-body-sm text-[var(--sr-text-muted)]">
                    {pl.progressChartEmpty}
                  </p>
                )}
              </ProgressSection>

              {stats.loadPerSession.length >= 2 && (
                <ProgressSection
                  title={pl.exerciseDetailLoadChartTitle}
                  hint={pl.exerciseDetailLoadChartHint}
                >
                  <AccessibleChart
                    label={pl.exerciseDetailLoadChartAria(stats.loadPerSession.length, exercise.name)}
                    data={stats.loadPerSession.map((p) => ({ date: p.dateLabel, load: p.value }))}
                    columns={[
                      { key: 'date', header: pl.dateColumn },
                      { key: 'load', header: loadChartUnit(exercise.primaryMetric) },
                    ]}
                    className="h-44 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-surface)] p-3 pl-1"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.loadPerSession}>
                        <XAxis
                          dataKey="dateLabel"
                          tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                          stroke="var(--sr-border-subtle)"
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                          stroke="var(--sr-border-subtle)"
                          width={32}
                        />
                        <Tooltip
                          contentStyle={PROGRESS_CHART_TOOLTIP_STYLE}
                          formatter={(value) => [
                            `${value ?? 0} ${loadChartUnit(exercise.primaryMetric)}`,
                            pl.exerciseDetailLoadChartTooltip,
                          ]}
                          labelFormatter={(label) => String(label)}
                          cursor={{ fill: 'var(--sr-brand-primary-muted)' }}
                        />
                        <Bar dataKey="value" fill="var(--sr-brand-primary)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </AccessibleChart>
                </ProgressSection>
              )}

              {stats.lastSessionSets.length > 0 && (
                <ProgressSection
                  title={pl.exerciseDetailLastSessionTitle}
                  hint={pl.exerciseDetailLastSessionHint}
                >
                  <ul className="divide-y divide-[var(--sr-border-subtle)]">
                    {stats.lastSessionSets.map((set) => (
                      <li
                        key={set.setNumber}
                        className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="sr-text-overline w-6 shrink-0 text-[var(--sr-text-muted)]">
                            {pl.exerciseDetailSetShort(set.setNumber)}
                          </span>
                          <div className="min-w-0">
                            <p className="font-medium tabular-nums text-[var(--sr-text-primary)]">
                              {set.actualLabel}
                            </p>
                            <p className="sr-text-caption text-[var(--sr-text-muted)]">
                              {pl.exerciseDetailTargetShort}: {set.targetLabel}
                            </p>
                          </div>
                        </div>
                        <Badge variant={set.passed ? 'success' : 'error'}>
                          {set.passed ? pl.passedShort : pl.failedShort}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </ProgressSection>
              )}

              {stats.recentSessions.length > 0 && (
                <ProgressSection
                  title={pl.exerciseDetailRecentTitle}
                  hint={pl.exerciseDetailRecentHint}
                >
                  <ul className="divide-y divide-[var(--sr-border-subtle)]">
                    {stats.recentSessions.map((row) => (
                      <li key={row.sessionId} className="py-3 first:pt-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-[var(--sr-text-muted)]">
                            {format(new Date(row.date), 'd MMM yyyy', { locale: plLocale })}
                          </p>
                          <Badge
                            variant={
                              row.setsPassed === row.setsTotal
                                ? 'success'
                                : row.setsPassed === 0
                                  ? 'error'
                                  : 'default'
                            }
                          >
                            {pl.exerciseDetailSetsPassed(row.setsPassed, row.setsTotal)}
                          </Badge>
                        </div>
                        <p className="mt-1 font-medium text-[var(--sr-text-primary)]">
                          {pl.progressCustomSessionMeta(row.planName, row.dayNumber)}
                        </p>
                        <p className="mt-0.5 text-sm text-[var(--sr-text-secondary)]">
                          {pl.exerciseDetailBestInSession}: {row.summary}
                        </p>
                      </li>
                    ))}
                  </ul>
                </ProgressSection>
              )}
            </>
          )}

          <div className="flex flex-col gap-2 border-t border-[var(--sr-border-subtle)] pt-4">
            {showProgressLink && stats.sessionCount > 0 && (
              <Button
                type="button"
                variant="secondary"
                size="touch"
                fullWidth
                onClick={() => {
                  onClose()
                  navigate('/progress?tab=custom')
                }}
              >
                {pl.exerciseDetailViewProgress}
              </Button>
            )}
            {onEdit && (
              <Button type="button" size="touch" fullWidth onClick={onEdit}>
                {pl.editExercise}
              </Button>
            )}
            <Button type="button" size="md" variant="ghost" fullWidth onClick={onClose}>
              {pl.exerciseDetailClose}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

export function ExerciseStatsIconButton({
  onClick,
  label = pl.exerciseDetailOpen,
}: {
  onClick: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sr-radius-sm)]',
        'text-[var(--sr-brand-primary)] transition-colors hover:bg-[var(--sr-brand-primary-muted)] active:scale-95',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sr-brand-primary)]',
      )}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <BarChart2 size={20} aria-hidden />
    </button>
  )
}
