import { Bar, BarChart, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BarChart3, Calendar, Dumbbell, Trophy, Activity } from 'lucide-react'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { ActivityInsightsPanel } from '@/components/dashboard/ActivityInsightsPanel'
import { ActivityCalendar } from '@/components/progress/ActivityCalendar'
import { MuscleBalanceHeatmap } from '@/components/progress/MuscleBalanceHeatmap'
import { UnifiedRecordsSection } from '@/components/progress/UnifiedRecordsSection'
import { Estimated1rmSection } from '@/components/progress/Estimated1rmSection'
import { AccessibleChart } from '@/components/ui/AccessibleChart'
import { LogoMark } from '@/components/brand/Logo'
import { EmptyState } from '@/components/ux/Feedback'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { NestedStat } from '@/components/ui/NestedStat'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useEffect, useMemo, useState } from 'react'
import { pl } from '@/i18n/pl'
import { buildActivityInsights } from '@/lib/weekly-recap'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import type { LocalProgramProgress, LocalWorkoutSession } from '@/lib/db'
import type {
  ProgramStats,
  ProgramVolumeStats,
  DayCycleTrend,
  ProgramRecordsWithDates,
  WeeklyVolumePoint,
  SessionChartPoint,
} from '@/lib/stats-engine'
import type { ActivityInsights } from '@/lib/weekly-recap'
import { navigateToTrain } from '@/lib/setup-flow'
import type { Program } from '@/data/plans/types'
import type { NavigateFunction } from 'react-router-dom'
import { PROGRESS_CHART_TOOLTIP_STYLE } from '@/components/progress/chart-style'
import type { ExercisePr, CustomVolumeStats, CustomSessionChartPoint, CustomOverviewStats, CustomWeeklyVolumePoint } from '@/lib/custom-stats'

type ProgramData = {
  program: Program
  progress: LocalProgramProgress | undefined
  stats: ProgramStats | null
  sessions: LocalWorkoutSession[]
  recordsWithDates: ProgramRecordsWithDates | null
  volumeStats: ProgramVolumeStats | null
  dayCycleTrend: DayCycleTrend[]
  weeklyVolumeChart: WeeklyVolumePoint[]
  maxSetChart: SessionChartPoint[]
}

function programLabel(prog: Program): string {
  return prog === 'pushups' ? pl.pushupsProgram : prog === 'pullups' ? pl.pullupsProgram : prog
}

/** Sekcja podsumowania + wykres postępu dla jednego programu (pompki lub podciąganie). */
function ProgramSection({
  data,
  allSessions,
  first,
}: {
  data: ProgramData
  allSessions: LocalWorkoutSession[]
  first: boolean
}) {
  const { program, stats, progress, volumeStats, dayCycleTrend, weeklyVolumeChart, maxSetChart } = data
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
      (s) =>
        s.status === 'completed' &&
        s.program === program &&
        new Date(s.startedAt).getTime() >= cutoff,
    )
    const sessionsCount = inRange.length
    const totalReps = inRange.reduce((sum, s) => sum + (s.totalReps ?? 0), 0)
    return { sessions: sessionsCount, totalReps }
  }, [allSessions, rangeDays, nowMs, program])

  if (!stats) return null

  return (
    <ProgressSection first={first} icon={BarChart3} title={pl.progressProgramSectionTitle(programLabel(program))}>
      <div className="mb-3">
        <SegmentedControl
          aria-label={pl.progressRangeLabel}
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
            value: rangeStats.totalReps,
            label: pl.rangeTotalReps,
            hint: pl.rangeDaysLabel(rangeDays),
          },
        ]}
      />
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

      {/* Wykres postępu ostatniej serii — zastąpił wykres testów max */}
      {maxSetChart.length >= 2 && (
        <div className="mt-4">
          <p className="mb-1 sr-text-overline text-[var(--sr-text-muted)]">
            {pl.chartTestOverTime}
          </p>
          <p className="mb-2 sr-text-caption text-[var(--sr-text-muted)]">
            {pl.progressLastSetChartHint}
          </p>
          <AccessibleChart
            label={pl.progressLastSetChartAria(maxSetChart.length)}
            data={maxSetChart.map((p) => ({ date: p.dateLabel, reps: p.value, day: pl.dayLabel(p.dayNumber) }))}
            columns={[
              { key: 'date', header: pl.dateColumn },
              { key: 'reps', header: pl.repsUnit },
              { key: 'day', header: pl.dayLabelShort },
            ]}
            className="h-40 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 pl-1"
          >
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={maxSetChart}>
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
                      `${value ?? 0} · ${pl.dayLabel(row.dayNumber)}`,
                      pl.progressLastSetChartTooltip,
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
        </div>
      )}

      {/* Statystyki objętości per program — metryki unikatowe, nie dublują MetricStrip */}
      {volumeStats && (volumeStats.volume14d > 0 || stats.passedSessionCount > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <NestedStat
            size="md"
            overline={pl.progressTotalRepsAllTime}
            value={stats.totalRepsAllTime}
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
            overline={pl.progressVolumeTrend14d}
            value={
              volumeStats.volumeChangePct != null
                ? volumeStats.volumeChangePct > 0
                  ? `+${volumeStats.volumeChangePct}%`
                  : volumeStats.volumeChangePct < 0
                    ? `−${Math.abs(volumeStats.volumeChangePct)}%`
                    : '0%'
                : pl.noValue
            }
            hint={pl.progressVolume14d + ': ' + volumeStats.volume14d}
          />
        </div>
      )}

      {/* Wykres objętości tygodniowej */}
      {weeklyVolumeChart.length >= 2 && weeklyVolumeChart.some((p) => p.volume > 0) && (
        <div className="mt-4">
          <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
            {pl.progressWeeklyVolumeTitle}
          </p>
          <AccessibleChart
            label={pl.progressWeeklyVolumeAria(weeklyVolumeChart.length)}
            data={weeklyVolumeChart.map((p) => ({ week: p.weekLabel, volume: p.volume }))}
            columns={[
              { key: 'week', header: pl.dateColumn },
              { key: 'volume', header: pl.progressWeeklyVolumeAxisLabel },
            ]}
            className="h-40 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 pl-1"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVolumeChart}>
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }}
                  stroke="var(--sr-border-subtle)"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                  stroke="var(--sr-border-subtle)"
                  width={36}
                />
                <Tooltip
                  contentStyle={PROGRESS_CHART_TOOLTIP_STYLE}
                  formatter={(value) => [value ?? 0, pl.progressWeeklyVolumeTooltip]}
                  labelFormatter={(label) => String(label)}
                />
                <Bar
                  dataKey="volume"
                  fill="var(--sr-brand-primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </AccessibleChart>
        </div>
      )}

      {/* Trend w cyklu */}
      {dayCycleTrend.length > 0 && dayCycleTrend.some((d) => d.delta != null) && (
        <div className="mt-4">
          <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
            {pl.progressCycleTrendTitle}
          </p>
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
        </div>
      )}
    </ProgressSection>
  )
}

type Scope = 'activity' | 'pushups' | 'pullups'

export function OverviewPanel({
  programDataMap,
  enabledPrograms,
  activity,
  allSessions,
  customSessionsAll,
  customPrs,
  customVolumeStats,
  customSessionChart,
  customOverviewStats,
  customPlanNames,
  customWeeklyVolumeChart,
  onOpenExercise,
  navigate,
  exerciseMap,
  weightUnit = 'kg',
}: {
  programDataMap: Map<Program, ProgramData>
  enabledPrograms: Program[]
  activity: ActivityInsights | null
  allSessions: LocalWorkoutSession[]
  customSessionsAll: LocalWorkoutSession[]
  customPrs: ExercisePr[]
  customVolumeStats: CustomVolumeStats | null
  customSessionChart: CustomSessionChartPoint[]
  customOverviewStats: CustomOverviewStats | null
  customPlanNames: Record<string, string>
  customWeeklyVolumeChart: CustomWeeklyVolumePoint[]
  onOpenExercise: (exerciseId: string) => void
  navigate: NavigateFunction
  exerciseMap?: Map<string, { name: string }>
  weightUnit?: 'kg' | 'lb'
}) {
  const [scope, setScope] = useState<Scope>('activity')

  // Dostępne zakładki — Aktywność zawsze + programy które są włączone
  const scopeOptions = useMemo(() => {
    const opts: { value: Scope; label: string }[] = [{ value: 'activity', label: pl.progressScopeActivity }]
    if (programDataMap.has('pushups')) opts.push({ value: 'pushups', label: pl.progressScopePushups })
    if (programDataMap.has('pullups')) opts.push({ value: 'pullups', label: pl.progressScopePullups })
    return opts
  }, [programDataMap])

  // Reset scope to 'activity' if the current scope is no longer available
  useEffect(() => {
    if (!scopeOptions.some((o) => o.value === scope)) {
      setScope('activity')
    }
  }, [scopeOptions, scope])

  // Sesje builtin (nie-custom) — do filtrowania
  const builtinSessions = useMemo(
    () => allSessions.filter((s) => !isCustomWorkoutSession(s)),
    [allSessions],
  )

  // Aktywność: sesje custom + ogólna aktywność (bez programów builtin)
  // Programy: tylko sesje tego programu
  const scopedSessions = useMemo(() => {
    if (scope === 'activity') return allSessions
    return builtinSessions.filter((s) => s.program === scope)
  }, [scope, allSessions, builtinSessions])

  // Aktywność globalna — dla zakładki Aktywność użyj wszystkich sesji
  // Dla programów przelicz aktywność tylko z sesji tego programu
  const scopedActivity = useMemo(() => {
    if (scope === 'activity') return activity
    const passed = scopedSessions.filter((s) => s.status === 'completed' && s.passed)
    return buildActivityInsights(passed)
  }, [scope, activity, scopedSessions])

  // ===== Zakładka AKTYWNOŚĆ =====
  // Pokazuje: custom plans, aktywność globalną, balans mięśniowy, kalendarz, rekordy custom
  // Nie pokazuje: sekcji programów builtin (pompki/podciąganie)
  const showCustomSection = customSessionsAll.length > 0 && customOverviewStats != null
  const hasActivityData = customSessionsAll.length > 0 || builtinSessions.length > 0

  // ===== Zakładki PROGRAMÓW (pompki/podciąganie) =====
  const programData = scope === 'pushups' || scope === 'pullups' ? programDataMap.get(scope) : undefined
  const hasProgramData = programData != null && programData.stats != null

  // Empty state — gdy wybrany scope nie ma żadnych danych
  const showEmptyState =
    (scope === 'activity' && !hasActivityData && !showCustomSection) ||
    ((scope === 'pushups' || scope === 'pullups') && !hasProgramData)

  // Renderuj sekcję custom (używana w zakładce Aktywność)
  const customSection = showCustomSection && customOverviewStats ? (
    <ProgressSection first icon={Dumbbell} title={pl.progressCustomStatsTitle}>
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
        <AccessibleChart
          label={pl.progressCustomVolumeChartAria(customSessionChart.length)}
          data={customSessionChart.map((p) => ({ date: p.dateLabel, volume: p.value, day: pl.dayLabel(p.dayNumber) }))}
          columns={[
            { key: 'date', header: pl.dateColumn },
            { key: 'volume', header: pl.progressCustomVolumePerSession },
            { key: 'day', header: pl.dayLabelShort },
          ]}
          className="mt-3 h-40 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 pl-1"
        >
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
        </AccessibleChart>
      )}

      {/* Wykres objętości tygodniowej — plany własne */}
      {customWeeklyVolumeChart.length >= 2 && customWeeklyVolumeChart.some((p) => p.volume > 0) && (
        <div className="mt-4">
          <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">
            {pl.progressWeeklyVolumeTitle}
          </p>
          <AccessibleChart
            label={pl.progressWeeklyVolumeAria(customWeeklyVolumeChart.length)}
            data={customWeeklyVolumeChart.map((p) => ({ week: p.weekLabel, volume: p.volume }))}
            columns={[
              { key: 'week', header: pl.dateColumn },
              { key: 'volume', header: pl.progressWeeklyVolumeAxisLabel },
            ]}
            className="h-40 rounded-[var(--sr-radius-md)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] p-3 pl-1"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={customWeeklyVolumeChart}>
                <XAxis
                  dataKey="weekLabel"
                  tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }}
                  stroke="var(--sr-border-subtle)"
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                  stroke="var(--sr-border-subtle)"
                  width={36}
                />
                <Tooltip
                  contentStyle={PROGRESS_CHART_TOOLTIP_STYLE}
                  formatter={(value) => [value ?? 0, pl.progressWeeklyVolumeTooltip]}
                  labelFormatter={(label) => String(label)}
                />
                <Bar
                  dataKey="volume"
                  fill="var(--sr-brand-primary)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </AccessibleChart>
        </div>
      )}
    </ProgressSection>
  ) : null

  return (
    <>
      {/* Filtr zakresu — pokazuj tylko gdy jest więcej niż jedna opcja */}
      {scopeOptions.length > 1 && (
        <div className="mb-4">
          <SegmentedControl
            stretch
            aria-label={pl.progressScopeLabel}
            value={scope}
            onChange={(v) => setScope(v as Scope)}
            options={scopeOptions}
          />
        </div>
      )}

      {/* ===== ZAKŁADKA: AKTYWNOŚĆ ===== */}
      {scope === 'activity' && (
        <>
          {/* Statystyki planów własnych */}
          {customSection}

          {/* Globalna sekcja aktywności */}
          {scopedActivity && hasActivityData && (
            <ProgressSection first={!showCustomSection} icon={Activity} title={pl.progressActivityTitle}>
              <ActivityInsightsPanel insights={scopedActivity} ariaLabel={pl.progressActivityAria} />
            </ProgressSection>
          )}

          {/* Empty state gdy brak danych */}
          {showEmptyState && (
            <ProgressSection first icon={BarChart3} title={pl.progressEmptyTitle}>
              <EmptyState
                icon={<LogoMark size={48} />}
                title={pl.firstWorkout}
                description={pl.progressEmptyHint}
                action={{
                  label: pl.startFirstWorkout,
                  onClick: () => void navigateToTrain(navigate, enabledPrograms[0] ?? 'pushups'),
                }}
              />
            </ProgressSection>
          )}

          {/* Balans mięśniowy — wszystkie sesje */}
          {allSessions.length > 0 && (
            <ProgressSection icon={Activity} title={pl.muscleBalanceTitle} hint={pl.muscleBalanceHint}>
              <MuscleBalanceHeatmap sessions={allSessions} />
            </ProgressSection>
          )}

          {/* Kalendarz aktywności — wszystkie sesje */}
          {allSessions.length > 0 && (
            <ProgressSection icon={Calendar} title={pl.calendarTitle} hint={pl.calendarHint}>
              <ActivityCalendar sessions={allSessions} customPlanNames={customPlanNames} navigate={navigate} />
            </ProgressSection>
          )}

          {/* Rekordy — tylko custom PRs w zakładce Aktywność;
              ukryj całkowicie gdy brak danych, aby nie dublować empty state */}
          {customPrs.length > 0 && (
            <UnifiedRecordsSection
              programRecordsList={[]}
              customPrs={customPrs}
              onOpenExercise={onOpenExercise}
              first={!showCustomSection && !showEmptyState && allSessions.length === 0}
              icon={Trophy}
            />
          )}

          {/* Szacowany 1RM — na podstawie serii z ciężarem */}
          {allSessions.length > 0 && (
            <ProgressSection icon={Dumbbell} title={pl.est1rmTitle} hint={pl.est1rmHint}>
              <Estimated1rmSection
                sessions={allSessions}
                exerciseMap={exerciseMap ?? new Map()}
                weightUnit={weightUnit}
              />
            </ProgressSection>
          )}
        </>
      )}

      {/* ===== ZAKŁADKA: POMPKI ===== */}
      {scope === 'pushups' && programData && hasProgramData && (
        <>
          <ProgramSection
            data={programData}
            allSessions={scopedSessions}
            first
          />
          {/* Rekordy — tylko pompki */}
          {programData.recordsWithDates && (
            <UnifiedRecordsSection
              programRecordsList={[{
                program: 'pushups',
                records: programData.recordsWithDates,
                stats: programData.stats!,
              }]}
              customPrs={[]}
              onOpenExercise={onOpenExercise}
              icon={Trophy}
            />
          )}
        </>
      )}

      {/* ===== ZAKŁADKA: PODCIĄGANIE ===== */}
      {scope === 'pullups' && programData && hasProgramData && (
        <>
          <ProgramSection
            data={programData}
            allSessions={scopedSessions}
            first
          />
          {/* Rekordy — tylko podciąganie */}
          {programData.recordsWithDates && (
            <UnifiedRecordsSection
              programRecordsList={[{
                program: 'pullups',
                records: programData.recordsWithDates,
                stats: programData.stats!,
              }]}
              customPrs={[]}
              onOpenExercise={onOpenExercise}
              icon={Trophy}
            />
          )}
        </>
      )}

      {/* Empty state dla programów bez danych */}
      {showEmptyState && (scope === 'pushups' || scope === 'pullups') && (
        <ProgressSection first icon={BarChart3} title={pl.progressEmptyTitle}>
          <EmptyState
            icon={<LogoMark size={48} />}
            title={pl.firstWorkout}
            description={pl.progressEmptyHint}
            action={{
              label: pl.startFirstWorkout,
              onClick: () => void navigateToTrain(navigate, scope),
            }}
          />
        </ProgressSection>
      )}
    </>
  )
}
