import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { BarChart2, TrendingDown, TrendingUp } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Card'
import { NestedStat } from '@/components/ui/NestedStat'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { EmptyState, SkeletonCard } from '@/components/ux/Feedback'
import { LogoMark } from '@/components/brand/Logo'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import {
  computeExerciseDetailStats,
  exercisePrDisplay,
  type ExerciseDetailStats,
} from '@/lib/custom-exercise-stats'
import { pl } from '@/i18n/pl'
import { cn } from '@/lib/utils'

const chartTooltipStyle = {
  background: 'var(--sr-bg-elevated)',
  border: '1px solid var(--sr-border-subtle)',
  borderRadius: '8px',
  color: 'var(--sr-text-primary)',
}

function metricBadgeLabel(metric: ExerciseDefinition['primaryMetric']): string {
  if (metric === 'reps') return pl.exerciseMetricReps
  if (metric === 'duration_sec') return pl.exerciseMetricDuration
  return pl.exerciseMetricRepsWeight
}

function chartValueLabel(metric: ExerciseDefinition['primaryMetric']): string {
  if (metric === 'duration_sec') return pl.exerciseDetailChartDuration
  if (metric === 'reps_weight') return pl.exerciseDetailChartReps
  return pl.repsUnit
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
              />

              <ProgressSection title={pl.exerciseDetailChartTitle} hint={pl.exerciseDetailChartHint}>
                {stats.chartPoints.length >= 2 ? (
                  <div className="h-44 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-surface)] py-3">
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
                          contentStyle={chartTooltipStyle}
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
                          strokeWidth={2}
                          dot={{ r: 3 }}
                          activeDot={{ r: 5 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
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
        'text-[var(--sr-brand-primary)] hover:bg-[var(--sr-brand-primary-muted)]',
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
