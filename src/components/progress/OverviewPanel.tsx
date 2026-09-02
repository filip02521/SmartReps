import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ActivityHeatmap } from '@/components/progress/ActivityHeatmap'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { ActivityInsightsPanel } from '@/components/dashboard/ActivityInsightsPanel'
import { LogoMark } from '@/components/brand/Logo'
import { EmptyState } from '@/components/ux/Feedback'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { NestedStat } from '@/components/ui/NestedStat'
import { pl } from '@/i18n/pl'
import type { HeatmapCell } from '@/lib/export'
import type { LocalProgramProgress } from '@/lib/db'
import type { ProgramStats } from '@/lib/stats-engine'
import type { ActivityInsights } from '@/lib/weekly-recap'
import { hasAnyProgramRecords } from '@/lib/progress-history'
import { navigateToTrain } from '@/lib/setup-flow'
import type { Program } from '@/data/plans/types'
import type { NavigateFunction } from 'react-router-dom'
import { PROGRESS_CHART_TOOLTIP_STYLE } from '@/components/progress/chart-style'

export function OverviewPanel({
  program,
  stats,
  progress,
  tests,
  heatmap,
  activity,
  hasAnyData,
  records,
  navigate,
}: {
  program: Program
  stats: ProgramStats | null
  progress: LocalProgramProgress | undefined
  tests: { date: string; dateLabel: string; reps: number }[]
  heatmap: HeatmapCell[][]
  activity: ActivityInsights | null
  hasAnyData: boolean
  records: {
    bestTest: number | null
    bestMaxSet: number | null
    bestSessionTotal: number | null
    highestCycleName: string | null
  } | null
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

  return (
    <>
      {stats && hasAnyData && (
        <ProgressSection first title={pl.progressSummaryTitle}>
          <MetricStrip
            metrics={[
              {
                value: activity?.sessions14d ?? 0,
                label: pl.homeSessions14d,
                hint: pl.homeSessions14dHint,
              },
              {
                value: stats.streakWeeks,
                label: pl.streakWeeks,
                hint: pl.streakWeeksHint,
              },
              {
                value: activity?.reps14d ?? 0,
                label: pl.homeReps14d,
                hint: pl.homeReps14dHint,
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

          <ProgressSection title={pl.activityHeatmap} hint={pl.progressHeatmapHint}>
            <ActivityHeatmap grid={heatmap} showSummary />
          </ProgressSection>

          {records && (
            <ProgressSection title={pl.progressRecordsSectionTitle}>
              <div id="progress-records">
                {hasAnyProgramRecords(records) ? (
                  <div className="grid grid-cols-2 gap-2">
                    <NestedStat
                      size="md"
                      overline={pl.recordBestMaxSet}
                      value={records.bestMaxSet ?? pl.noValue}
                    />
                    <NestedStat
                      size="md"
                      overline={pl.recordBestSession}
                      value={records.bestSessionTotal ?? pl.noValue}
                    />
                    <NestedStat
                      size="md"
                      overline={pl.totalRepsLabel}
                      value={stats?.totalRepsAllTime ?? pl.noValue}
                    />
                    <NestedStat
                      size="md"
                      overline={pl.recordHighestCycle}
                      value={records.highestCycleName ?? pl.noValue}
                    />
                  </div>
                ) : (
                  <EmptyState
                    icon={<LogoMark size={40} />}
                    title={pl.progressRecordsEmpty}
                    action={{
                      label: pl.startFirstWorkout,
                      onClick: () => void navigateToTrain(navigate, program),
                    }}
                  />
                )}
              </div>
            </ProgressSection>
          )}
        </>
      )}
    </>
  )
}
