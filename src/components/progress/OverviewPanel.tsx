import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { ActivityInsightsPanel } from '@/components/dashboard/ActivityInsightsPanel'
import { LogoMark } from '@/components/brand/Logo'
import { EmptyState } from '@/components/ux/Feedback'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { NestedStat } from '@/components/ui/NestedStat'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useMemo, useState } from 'react'
import { pl } from '@/i18n/pl'
import type { LocalProgramProgress, LocalWorkoutSession } from '@/lib/db'
import type { ProgramStats } from '@/lib/stats-engine'
import type {
  SessionChartPoint,
  ProgramVolumeStats,
  DayCycleTrend,
} from '@/lib/stats-engine'
import type { ActivityInsights } from '@/lib/weekly-recap'
import { navigateToTrain } from '@/lib/setup-flow'
import type { Program } from '@/data/plans/types'
import type { NavigateFunction } from 'react-router-dom'
import { PROGRESS_CHART_TOOLTIP_STYLE } from '@/components/progress/chart-style'

export function OverviewPanel({
  program,
  stats,
  progress,
  tests,
  activity,
  hasAnyData,
  sessionChart,
  volumeStats,
  dayCycleTrend,
  allSessions,
  navigate,
}: {
  program: Program
  stats: ProgramStats | null
  progress: LocalProgramProgress | undefined
  tests: { date: string; dateLabel: string; reps: number }[]
  activity: ActivityInsights | null
  hasAnyData: boolean
  sessionChart: SessionChartPoint[]
  volumeStats: ProgramVolumeStats | null
  dayCycleTrend: DayCycleTrend[]
  allSessions: LocalWorkoutSession[]
  navigate: NavigateFunction
}) {
  const trend = stats?.maxLastSetTrend
  const previousLastSet = trend?.previous
  // Require real previous actual (delta) so target-preview current never appears as a trend.
  const showTrend =
    trend != null &&
    trend.delta != null &&
    trend.current > 0 &&
    previousLastSet != null

  const [rangeDays, setRangeDays] = useState<14 | 30 | 90 | 365>(14)
  const [nowMs] = useState(() => Date.now())
  const rangeStats = useMemo(() => {
    const cutoff = nowMs - rangeDays * 86400000
    const inRange = allSessions.filter(
      (s) => s.status === 'completed' && new Date(s.startedAt).getTime() >= cutoff,
    )
    const sessions = inRange.length
    const totalReps = inRange.reduce((sum, s) => sum + (s.totalReps ?? 0), 0)
    return { sessions, totalReps }
  }, [allSessions, rangeDays, nowMs])

  return (
    <>
      {stats && hasAnyData && (
        <ProgressSection first title={pl.progressSummaryTitle}>
          <div className="mb-3">
            <SegmentedControl
              value={String(rangeDays)}
              onChange={(v) => setRangeDays(Number(v) as 14 | 30 | 90 | 365)}
              options={[
                { value: '14' as const, label: pl.range14d },
                { value: '30' as const, label: pl.range30d },
                { value: '90' as const, label: pl.range90d },
                { value: '365' as const, label: pl.rangeYear },
              ]}
            />
          </div>
          <MetricStrip
            metrics={[
              {
                value: rangeStats.sessions,
                label: pl.rangeSessions,
                hint: pl.rangeDaysLabel(rangeDays),
              },
              {
                value: stats.streakWeeks,
                label: pl.streakWeeks,
                hint: pl.streakWeeksHint,
              },
              {
                value: rangeStats.totalReps,
                label: pl.rangeTotalReps,
                hint: pl.rangeDaysLabel(rangeDays),
              },
            ]}
            goal={{
              label: pl.homeGoal3in14,
              current: activity?.sessions14d ?? 0,
              max: 3,
            }}
          />
          {activity && (
            <ActivityInsightsPanel insights={activity} ariaLabel={pl.progressActivityAria} />
          )}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <NestedStat
              size="sm"
              overline={pl.recordTest}
              value={stats.maxTestRecord ?? pl.noValue}
            />
            <NestedStat
              size="sm"
              overline={pl.cycleDays}
              value={
                progress
                  ? `${stats.completedDaysInCycle}/${stats.cycleDaysTotal}`
                  : pl.noValue
              }
            />
            <NestedStat
              size="sm"
              overline={pl.sessionsTotal}
              value={stats.passedSessionCount}
            />
          </div>
          {showTrend && (
            <p className="mt-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
              {pl.progressLastSetTrend(trend.current, previousLastSet)}
            </p>
          )}
        </ProgressSection>
      )}

      {!hasAnyData ? (
        <ProgressSection first title={pl.progressEmptyTitle}>
          <EmptyState
            icon={<LogoMark size={48} />}
            title={pl.firstWorkout}
            description={pl.progressEmptyHint}
            action={{
              label: pl.startFirstWorkout,
              onClick: () => void navigateToTrain(navigate, program),
            }}
          />
        </ProgressSection>
      ) : (
        <>
          {volumeStats && (volumeStats.volume14d > 0 || (stats?.passedSessionCount ?? 0) > 0) && (
            <ProgressSection title={pl.progressVolumeTitle}>
              <div className="grid grid-cols-2 gap-2">
                <NestedStat
                  size="md"
                  overline={pl.progressVolume14d}
                  value={volumeStats.volume14d}
                  hint={
                    volumeStats.volumeChangePct != null
                      ? volumeStats.volumeChangePct > 0
                        ? pl.progressVolumeTrendUp(volumeStats.volumeChangePct)
                        : volumeStats.volumeChangePct < 0
                          ? pl.progressVolumeTrendDown(Math.abs(volumeStats.volumeChangePct))
                          : pl.progressVolumeTrendFlat
                      : volumeStats.volumePrev14d === 0
                        ? pl.progressVolumePrev14d + ': 0'
                        : undefined
                  }
                />
                <NestedStat
                  size="md"
                  overline={pl.progressAvgPerSession}
                  value={volumeStats.avgRepsPerSession ?? pl.noValue}
                />
                <NestedStat
                  size="md"
                  overline={pl.progressAvgSessionsPerWeek}
                  value={volumeStats.avgSessionsPerWeek ?? pl.noValue}
                />
                <NestedStat
                  size="md"
                  overline={pl.progressSessions30d}
                  value={volumeStats.sessionsLast30d}
                />
              </div>
            </ProgressSection>
          )}

          {sessionChart.length >= 2 && (
            <ProgressSection
              title={pl.progressSessionChartTitle}
              hint={pl.progressSessionChartHint}
            >
              <div className="h-40 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] py-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sessionChart}>
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                      stroke="var(--sr-border-subtle)"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                      stroke="var(--sr-border-subtle)"
                      width={28}
                    />
                    <Tooltip
                      contentStyle={PROGRESS_CHART_TOOLTIP_STYLE}
                      formatter={(value, _name, item) => {
                        const row = item.payload as SessionChartPoint
                        return [
                          `${value ?? 0} ${pl.repsUnit} · ${pl.dayLabel(row.dayNumber)}`,
                          pl.progressSessionChartTooltip,
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
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ProgressSection>
          )}

          {tests.length > 0 ? (
            <ProgressSection title={pl.chartTestOverTime} hint={pl.progressTestChartHint}>
              <div className="h-40 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] py-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={tests}>
                    <XAxis
                      dataKey="dateLabel"
                      tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                      stroke="var(--sr-border-subtle)"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                      stroke="var(--sr-border-subtle)"
                      width={28}
                    />
                    <Tooltip
                      contentStyle={PROGRESS_CHART_TOOLTIP_STYLE}
                      formatter={(value) => [value ?? 0, pl.repsUnit]}
                      labelFormatter={(label) => String(label)}
                    />
                    <Line
                      type="monotone"
                      dataKey="reps"
                      stroke="var(--sr-brand-primary)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </ProgressSection>
          ) : (
            <ProgressSection title={pl.chartTestOverTime}>
              <EmptyState
                icon={<LogoMark size={40} />}
                title={pl.progressChartEmpty}
                action={{
                  label: pl.retestNow,
                  onClick: () => navigate(`/setup/test/${program}`),
                }}
              />
            </ProgressSection>
          )}

          {dayCycleTrend.length > 0 && dayCycleTrend.some((d) => d.delta != null) && (
            <ProgressSection
              title={pl.progressCycleTrendTitle}
              hint={pl.progressCycleTrendHint}
            >
              <ul className="divide-y divide-[var(--sr-border-subtle)]">
                {dayCycleTrend.map((d) => (
                  <li
                    key={d.dayNumber}
                    className="flex items-center justify-between gap-3 py-2.5 first:pt-0"
                  >
                    <span className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                      {pl.dayLabel(d.dayNumber)}
                    </span>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="sr-text-body-sm text-[var(--sr-text-muted)]">
                        {pl.progressCycleTrendPrevious}:{' '}
                        {d.previous ?? '—'}
                      </span>
                      <span className="font-semibold text-[var(--sr-text-primary)]">
                        {pl.progressCycleTrendCurrent}: {d.current ?? '—'}
                      </span>
                      {d.delta != null ? (
                        <span
                          className={
                            d.delta > 0
                              ? 'text-[var(--sr-success)]'
                              : d.delta < 0
                                ? 'text-[var(--sr-error)]'
                                : 'text-[var(--sr-text-muted)]'
                          }
                        >
                          {pl.progressCycleTrendDelta(d.delta)}
                        </span>
                      ) : (
                        <span className="sr-text-caption text-[var(--sr-text-muted)]">
                          {pl.progressCycleTrendNoPrevious}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </ProgressSection>
          )}

        </>
      )}
    </>
  )
}
