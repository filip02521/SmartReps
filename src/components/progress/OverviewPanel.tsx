import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { ActivityInsightsPanel } from '@/components/dashboard/ActivityInsightsPanel'
import { ActivityCalendar } from '@/components/progress/ActivityCalendar'
import { UnifiedRecordsSection } from '@/components/progress/UnifiedRecordsSection'
import { LogoMark } from '@/components/brand/Logo'
import { EmptyState } from '@/components/ux/Feedback'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { NestedStat } from '@/components/ui/NestedStat'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useMemo, useState } from 'react'
import { pl } from '@/i18n/pl'
import type { LocalProgramProgress, LocalWorkoutSession } from '@/lib/db'
import type { ProgramStats, SessionChartPoint, ProgramVolumeStats, DayCycleTrend, ProgramRecordsWithDates } from '@/lib/stats-engine'
import type { ActivityInsights } from '@/lib/weekly-recap'
import { navigateToTrain } from '@/lib/setup-flow'
import type { Program } from '@/data/plans/types'
import type { NavigateFunction } from 'react-router-dom'
import { PROGRESS_CHART_TOOLTIP_STYLE } from '@/components/progress/chart-style'
import type { ExercisePr, CustomVolumeStats, CustomSessionChartPoint, CustomOverviewStats } from '@/lib/custom-stats'

export function OverviewPanel({
  program,
  enabledPrograms,
  onProgramChange,
  stats,
  progress,
  tests,
  activity,
  hasAnyData,
  sessionChart,
  volumeStats,
  dayCycleTrend,
  allSessions,
  customSessionsAll,
  customPrs,
  customVolumeStats,
  customSessionChart,
  customOverviewStats,
  recordsWithDates,
  onOpenExercise,
  navigate,
}: {
  program: Program
  enabledPrograms: Program[]
  onProgramChange: (p: Program) => void
  stats: ProgramStats | null
  progress: LocalProgramProgress | undefined
  tests: { date: string; dateLabel: string; reps: number }[]
  activity: ActivityInsights | null
  hasAnyData: boolean
  sessionChart: SessionChartPoint[]
  volumeStats: ProgramVolumeStats | null
  dayCycleTrend: DayCycleTrend[]
  allSessions: LocalWorkoutSession[]
  customSessionsAll: LocalWorkoutSession[]
  customPrs: ExercisePr[]
  customVolumeStats: CustomVolumeStats | null
  customSessionChart: CustomSessionChartPoint[]
  customOverviewStats: CustomOverviewStats | null
  recordsWithDates: ProgramRecordsWithDates | null
  onOpenExercise: (exerciseId: string) => void
  navigate: NavigateFunction
}) {
  const trend = stats?.maxLastSetTrend
  const previousLastSet = trend?.previous
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

  const showEmptyState = !hasAnyData && allSessions.length === 0
  const showStatsSection = stats != null && hasAnyData
  const hasCustomSessions = customSessionsAll.length > 0
  const showCustomSection = hasCustomSessions && customOverviewStats != null
  // First section flag: if stats/empty don't render, calendar or records is first.
  const calendarFirst = !showStatsSection && !showEmptyState && !showCustomSection

  // Program switcher options
  const programOptions = enabledPrograms.map((p) => ({
    value: p as string,
    label: p === 'pushups' ? pl.pushupsProgram : p === 'pullups' ? pl.pullupsProgram : p,
  }))

  return (
    <>
      {/* Program switcher */}
      {enabledPrograms.length > 1 && (
        <div className="mb-4">
          <SegmentedControl
            aria-label={pl.progressProgramSwitcher}
            value={program as string}
            onChange={(v) => onProgramChange(v as Program)}
            options={programOptions}
          />
        </div>
      )}

      {/* Podsumowanie + metryki */}
      {showStatsSection && (
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

      {/* Empty state gdy brak danych */}
      {showEmptyState && (
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
      )}

      {/* Statystyki planów własnych */}
      {showCustomSection && customOverviewStats && (
        <ProgressSection
          first={!showStatsSection && !showEmptyState}
          title={pl.progressCustomStatsTitle}
        >
          <MetricStrip
            metrics={[
              {
                value: customOverviewStats.totalSessions,
                label: pl.sessionsTotal,
                hint: pl.progressCustomStatsHint,
              },
              {
                value: customOverviewStats.exercisesTrained,
                label: pl.progressCustomExercisesTrained,
                hint: pl.progressCustomStatsHint,
              },
              {
                value: customOverviewStats.totalVolume,
                label: pl.progressCustomVolumeTotal,
                hint: pl.progressCustomStatsHint,
              },
            ]}
          />
          {customVolumeStats && (customVolumeStats.volume14d > 0 || customVolumeStats.sessionsLast30d > 0) && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <NestedStat
                size="md"
                overline={pl.progressVolume14d}
                value={customVolumeStats.volume14d}
                hint={
                  customVolumeStats.volumeChangePct != null
                    ? customVolumeStats.volumeChangePct > 0
                      ? pl.progressVolumeTrendUp(customVolumeStats.volumeChangePct)
                      : customVolumeStats.volumeChangePct < 0
                        ? pl.progressVolumeTrendDown(Math.abs(customVolumeStats.volumeChangePct))
                        : pl.progressVolumeTrendFlat
                    : undefined
                }
              />
              <NestedStat
                size="md"
                overline={pl.progressSessions30d}
                value={customVolumeStats.sessionsLast30d}
              />
            </div>
          )}
          {customSessionChart.length >= 2 && (
            <div className="mt-3 h-40 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 pl-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={customSessionChart}>
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
                      const row = item.payload as CustomSessionChartPoint
                      return [
                        `${value ?? 0} · ${pl.dayLabel(row.dayNumber)}`,
                        pl.progressCustomVolumePerSession,
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
            </div>
          )}
        </ProgressSection>
      )}

      {/* Kalendarz aktywności */}
      {allSessions.length > 0 && (
        <ProgressSection first={calendarFirst} title={pl.calendarTitle} hint={pl.calendarHint}>
          <ActivityCalendar sessions={allSessions} />
        </ProgressSection>
      )}

      {/* Rekordy ujednolicone */}
      <UnifiedRecordsSection
        programRecords={recordsWithDates}
        programStats={stats}
        customPrs={customPrs}
        onOpenExercise={onOpenExercise}
        first={!showStatsSection && !showEmptyState && allSessions.length === 0}
      />

      {/* Objętość i częstotliwość */}
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

      {/* Wykres najlepszej serii */}
      {sessionChart.length >= 2 && (
        <ProgressSection
          title={pl.progressSessionChartTitle}
          hint={pl.progressSessionChartHint}
        >
          <div className="h-40 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 pl-1">
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
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--sr-brand-primary)' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ProgressSection>
      )}

      {/* Wykres testu max */}
      {tests.length > 0 && (
        <ProgressSection title={pl.chartTestOverTime} hint={pl.progressTestChartHint}>
          <div className="h-40 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 pl-1">
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
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--sr-brand-primary)' }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ProgressSection>
      )}

      {/* Trend w cyklu */}
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
  )
}
