import { useEffect, useMemo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { ActivityHeatmap } from '@/components/progress/ActivityHeatmap'
import { ProgressSection } from '@/components/progress/ProgressSection'
import { buildActivityHeatmap, exportSessionsCsv, downloadCsv } from '@/lib/export'
import {
  hasAnyProgramRecords,
  isCustomProgressHistorySession,
  isProgressHistorySession,
  sessionTotalReps,
} from '@/lib/progress-history'
import { Button } from '@/components/ui/Button'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { NestedStat } from '@/components/ui/NestedStat'
import { CycleDayPicker } from '@/components/ui/CycleDayPicker'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Sheet } from '@/components/ui/Sheet'
import { LogoMark } from '@/components/brand/Logo'
import { Badge } from '@/components/ui/Card'
import { EmptyState, SkeletonCard, ErrorBanner } from '@/components/ux/Feedback'
import { db } from '@/lib/db'
import { getProgramProgress } from '@/lib/program-service'
import { navigateToTrain } from '@/lib/setup-flow'
import { getCycleById } from '@/data/plans'
import { getProgramStats, getMaxSetPerDay, getProgramRecords } from '@/lib/stats-engine'
import { useAppStore } from '@/stores/app-store'
import { pl } from '@/i18n/pl'
import { TAB_PAGE_SHELL } from '@/lib/ui-chrome'
import type { Program } from '@/data/plans/types'
import type { LocalWorkoutSession } from '@/lib/db'
import { getCycleDayStatus } from '@/lib/cycle-progress'
import { showToast } from '@/stores/toast-store'
import { computeCustomExercisePrs, type ExercisePr } from '@/lib/custom-stats'
import { ExerciseDetailSheet } from '@/components/plans/ExerciseDetailSheet'
import { ExerciseSparkline } from '@/components/plans/ExerciseSparkline'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import type { ExerciseTrend } from '@/lib/custom-exercise-stats'
import {
  computeCustomSessionDetail,
  formatCustomSessionSummary,
  sessionTotalSets,
} from '@/lib/custom-session-stats'
import { cn } from '@/lib/utils'

type Tab = 'overview' | 'history' | 'cycle' | 'records' | 'custom'
type HistoryDateFilter = 'all' | '30d' | '90d'

const HISTORY_PAGE_SIZE = 20

const chartTooltipStyle = {
  background: 'var(--sr-bg-elevated)',
  border: '1px solid var(--sr-border-subtle)',
  borderRadius: '8px',
  color: 'var(--sr-text-primary)',
}

const TAB_HINTS: Record<Tab, string> = {
  overview: pl.progressTabOverviewHint,
  history: pl.progressTabHistoryHint,
  cycle: pl.progressTabCycleHint,
  records: pl.progressTabRecordsHint,
  custom: pl.myPlansHint,
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
      pr.maxDurationSec != null ? `${pr.maxDurationSec}s` : null,
      pr.maxWeightKg != null ? `${pr.maxWeightKg} kg` : null,
    ]
      .filter(Boolean)
      .join(' · ') || '—'
  )
}

export default function ProgressPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { settings } = useAppStore()
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const [program, setProgram] = useState<Program>(settings.enabledPrograms[0] ?? 'pushups')
  const [tab, setTab] = useState<Tab>(() =>
    searchParams.get('tab') === 'custom' ? 'custom' : 'overview',
  )
  const [loading, setLoading] = useState(true)
  const [tests, setTests] = useState<{ date: string; dateLabel: string; reps: number }[]>([])
  const [sessions, setSessions] = useState<LocalWorkoutSession[]>([])
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof getProgramProgress>>>(undefined)
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getProgramStats>> | null>(null)
  const [records, setRecords] = useState<Awaited<ReturnType<typeof getProgramRecords>> | null>(null)
  const [maxPerDay, setMaxPerDay] = useState<{ day: number; maxActual: number }[]>([])
  const [historyFilter, setHistoryFilter] = useState<'all' | 'passed' | 'failed'>('all')
  const [historyCycleFilter, setHistoryCycleFilter] = useState<'all' | 'current'>('all')
  const [historyDateFilter, setHistoryDateFilter] = useState<HistoryDateFilter>('all')
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [heatmap, setHeatmap] = useState<Awaited<ReturnType<typeof buildActivityHeatmap>>>([])
  const [selectedSession, setSelectedSession] = useState<LocalWorkoutSession | null>(null)
  const [cyclePreviewDay, setCyclePreviewDay] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadEpoch, setReloadEpoch] = useState(0)
  const [customPrs, setCustomPrs] = useState<ExercisePr[]>([])
  const [customSessions, setCustomSessions] = useState<LocalWorkoutSession[]>([])
  const [customPlanNames, setCustomPlanNames] = useState<Record<string, string>>({})
  const [detailExercise, setDetailExercise] = useState<ExerciseDefinition | null>(null)

  async function openExerciseDetail(exerciseId: string) {
    const ex = await db.exercises.get(exerciseId)
    if (ex && !ex.archived) setDetailExercise(ex)
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await db.maxTests.where('program').equals(program).sortBy('testedAt')
        setTests(
          rows.map((r) => ({
            date: r.testedAt.slice(0, 10),
            dateLabel: format(new Date(r.testedAt), 'd MMM', { locale: plLocale }),
            reps: r.reps,
          })),
        )
        const sess = await db.workoutSessions.where('program').equals(program).toArray()
        sess.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        setSessions(sess)
        const prog = await getProgramProgress(program)
        setProgress(prog)
        if (prog) {
          setStats(await getProgramStats(program, prog))
          setMaxPerDay(await getMaxSetPerDay(program, prog.cycleId, prog.cycleAttempt))
        } else {
          setStats(null)
          setMaxPerDay([])
        }
        setRecords(await getProgramRecords(program))
        setHeatmap(await buildActivityHeatmap(program))
        setCustomPrs(await computeCustomExercisePrs())
        const customHistory = (await db.workoutSessions.toArray())
          .filter(isCustomProgressHistorySession)
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        setCustomSessions(customHistory.slice(0, HISTORY_PAGE_SIZE))
        const planRows = await db.customPlans.toArray()
        const nameMap: Record<string, string> = {}
        for (const p of planRows) nameMap[p.id] = p.name
        setCustomPlanNames(nameMap)
      } catch {
        setError(pl.errorLoadProgress)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [program, reloadEpoch, lastSyncedAt])

  useEffect(() => {
    if (searchParams.get('tab') === 'custom') setTab('custom')
  }, [searchParams])

  useEffect(() => {
    setHistoryLimit(HISTORY_PAGE_SIZE)
  }, [program, historyFilter, historyCycleFilter, historyDateFilter])

  const cycle = progress ? getCycleById(progress.cycleId) : undefined

  const historyBase = useMemo(
    () => sessions.filter(isProgressHistorySession),
    [sessions],
  )

  const filtersActive =
    historyFilter !== 'all' || historyCycleFilter !== 'all' || historyDateFilter !== 'all'

  const activeFilterCount = [
    historyFilter !== 'all',
    historyCycleFilter !== 'all',
    historyDateFilter !== 'all',
  ].filter(Boolean).length

  const filteredSessions = useMemo(() => {
    return historyBase.filter((s) => {
      if (historyFilter === 'passed') {
        if (!(s.status === 'completed' && s.passed)) return false
      } else if (historyFilter === 'failed') {
        if (!(s.status === 'completed' && s.passed === false)) return false
      }
      if (historyCycleFilter === 'current' && progress && s.cycleId !== progress.cycleId) {
        return false
      }
      if (historyDateFilter !== 'all') {
        const cutoff = subDays(new Date(), historyDateFilter === '30d' ? 30 : 90)
        if (new Date(s.startedAt) < cutoff) return false
      }
      return true
    })
  }, [historyBase, historyFilter, historyCycleFilter, historyDateFilter, progress])

  const visibleSessions = filteredSessions.slice(0, historyLimit)
  const hasMoreHistory = filteredSessions.length > historyLimit

  const clearFilters = () => {
    setHistoryFilter('all')
    setHistoryCycleFilter('all')
    setHistoryDateFilter('all')
  }

  const handleCycleDayTap = (dayNumber: number) => {
    if (!progress || !cycle) return
    const dayStatus = getCycleDayStatus(progress, dayNumber, cycle.days.length)
    if (dayStatus === 'completed') {
      const matches = sessions
        .filter(
          (s) =>
            s.cycleId === progress.cycleId &&
            s.cycleAttempt === progress.cycleAttempt &&
            s.dayNumber === dayNumber &&
            s.status === 'completed' &&
            s.passed,
        )
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      if (matches[0]) setSelectedSession(matches[0])
    } else {
      setCyclePreviewDay(dayNumber)
    }
  }

  const tabOptions: { value: Tab; label: string }[] = [
    { value: 'overview', label: pl.tabOverview },
    { value: 'history', label: pl.tabHistory },
    { value: 'cycle', label: pl.tabCycle },
    { value: 'records', label: pl.tabRecords },
    { value: 'custom', label: pl.progressMyExercises },
  ]

  const programOptions = settings.enabledPrograms.map((p) => ({
    value: p,
    label: p === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram,
  }))

  const statusSubtitle = !stats
    ? pl.progressOverviewHint
    : stats.passedSessionCount === 0
      ? pl.progressStatusEmpty
      : stats.streakWeeks > 0
        ? pl.progressStatusStreak(stats.streakWeeks)
        : pl.progressStatusSessions(stats.passedSessionCount)

  const hasAnyData = tests.length > 0 || historyBase.length > 0
  const heatmapWorkouts = heatmap.flat().filter(
    (c) => c.status === 'passed' || c.status === 'failed',
  ).length

  const activeTabLabel = tabOptions.find((t) => t.value === tab)?.label ?? pl.navProgress

  if (loading) {
    return (
      <div className={TAB_PAGE_SHELL}>
        <PageHeader title={pl.navProgress} subtitle={pl.progressOverviewHint} />
        <SkeletonCard className="mt-4 min-h-[8rem]" />
        <SkeletonCard className="mt-4 min-h-[12rem]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className={TAB_PAGE_SHELL}>
        <PageHeader title={pl.navProgress} />
        <ErrorBanner message={error} onRetry={() => setReloadEpoch((n) => n + 1)} />
      </div>
    )
  }

  return (
    <div className={TAB_PAGE_SHELL}>
      <PageHeader title={pl.navProgress} subtitle={statusSubtitle} />

      {programOptions.length > 1 && (
        <SegmentedControl
          className="mb-4 flex-nowrap overflow-x-auto pb-0.5"
          options={programOptions}
          value={program}
          onChange={setProgram}
        />
      )}

      <SegmentedControl
        className="flex-nowrap overflow-x-auto pb-0.5"
        options={tabOptions}
        value={tab}
        onChange={setTab}
      />
      <p className="mt-2 sr-text-body-sm text-[var(--sr-text-secondary)]">{TAB_HINTS[tab]}</p>

      <div role="tabpanel" aria-label={activeTabLabel}>
      {tab === 'overview' && (
        <>
          {stats && hasAnyData && (
            <ProgressSection first title={pl.progressSummaryTitle}>
              <MetricStrip
                metrics={[
                  {
                    value: stats.maxTestRecord ?? '—',
                    label: pl.recordTest,
                    hint: pl.progressRecordTestHint,
                  },
                  {
                    value: progress
                      ? `${stats.completedDaysInCycle}/${stats.cycleDaysTotal}`
                      : '—',
                    label: pl.cycleDays,
                    hint: pl.progressCycleDaysHint,
                  },
                  {
                    value: stats.streakWeeks,
                    label: pl.streakWeeks,
                    hint: pl.homeStreakWeeksHint,
                  },
                ]}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <NestedStat size="md" overline={pl.sessionsTotal} value={stats.passedSessionCount} />
                <NestedStat size="md" overline={pl.totalRepsLabel} value={stats.totalRepsAllTime} />
              </div>
            </ProgressSection>
          )}

          {!hasAnyData ? (
            <ProgressSection first title={pl.progressEmptyTitle} hint={pl.progressEmptyHint}>
              <EmptyState
                icon={<LogoMark size={48} />}
                title={pl.firstWorkout}
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
                  <div className="h-44 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] py-3">
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
                          contentStyle={chartTooltipStyle}
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
                  <p className="sr-text-body-sm text-[var(--sr-text-muted)]">{pl.progressChartEmpty}</p>
                </ProgressSection>
              )}

              {maxPerDay.length > 0 && (
                <ProgressSection title={pl.maxSetPerDay} hint={pl.progressMaxSetChartHint}>
                  <div className="h-36 rounded-[var(--sr-radius-md)] bg-[var(--sr-bg-elevated)] py-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={maxPerDay}>
                        <XAxis
                          dataKey="day"
                          tickFormatter={(d) => `D${d}`}
                          tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                          stroke="var(--sr-border-subtle)"
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                          stroke="var(--sr-border-subtle)"
                          width={28}
                        />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(value) => [value ?? 0, pl.repsUnit]}
                          labelFormatter={(label) => String(label)}
                        />
                        <Bar dataKey="maxActual" fill="var(--sr-brand-primary)" radius={4} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ProgressSection>
              )}

              <ProgressSection title={pl.activityHeatmap} hint={pl.progressHeatmapHint}>
                <ActivityHeatmap grid={heatmap} showSummary={false} />
                {heatmapWorkouts === 0 && (
                  <p className="mt-2 sr-text-body-sm text-[var(--sr-text-muted)]">
                    {pl.progressHeatmapEmpty}
                  </p>
                )}
              </ProgressSection>
            </>
          )}
        </>
      )}

      {tab === 'records' && records && (
        <ProgressSection first title={pl.tabRecords}>
          {hasAnyProgramRecords(records) ? (
            <>
              <NestedStat
                size="lg"
                overline={pl.recordBestTest}
                value={records.bestTest ?? '—'}
                highlight={records.bestTest !== null}
                hint={records.bestTest !== null ? pl.progressRecordHeroHint : undefined}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <NestedStat size="md" overline={pl.recordBestMaxSet} value={records.bestMaxSet ?? '—'} />
                <NestedStat size="md" overline={pl.recordBestSession} value={records.bestSessionTotal ?? '—'} />
                <NestedStat
                  className="col-span-2"
                  size="md"
                  overline={pl.recordHighestCycle}
                  value={records.highestCycleName ?? '—'}
                />
              </div>
            </>
          ) : (
            <EmptyState
              icon={<LogoMark size={48} />}
              title={pl.progressRecordsEmpty}
              action={{
                label: pl.startFirstWorkout,
                onClick: () => void navigateToTrain(navigate, program),
              }}
            />
          )}
        </ProgressSection>
      )}

      {tab === 'custom' && (
        <>
          <ProgressSection first title={pl.progressMyExercises}>
            {customPrs.length === 0 ? (
              <EmptyState
                icon={<LogoMark size={48} />}
                title={pl.progressCustomPrEmpty}
                action={{
                  label: pl.myPlansTitle,
                  onClick: () => navigate('/plans?tab=mine'),
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
                      onClick={() => void openExerciseDetail(pr.exerciseId)}
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

          <ProgressSection title={pl.progressCustomHistory} className="mt-8">
            {customSessions.length === 0 ? (
              <EmptyState
                icon={<LogoMark size={48} />}
                title={pl.progressCustomHistoryEmpty}
                action={{
                  label: pl.myPlansTitle,
                  onClick: () => navigate('/plans?tab=mine'),
                }}
              />
            ) : (
              <ul className="divide-y divide-[var(--sr-border-subtle)]">
                {customSessions.map((s) => {
                  const planName =
                    (s.customPlanId && customPlanNames[s.customPlanId]) || pl.planDash
                  const sets = sessionTotalSets(s)
                  const detail = computeCustomSessionDetail(s.exerciseLogs)
                  return (
                    <li key={s.id} className="py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                          {format(new Date(s.startedAt), 'd MMM yyyy', { locale: plLocale })}
                        </p>
                        <Badge variant={sessionBadgeVariant(s)}>{sessionStatusLabel(s)}</Badge>
                      </div>
                      <p className="mt-1 font-medium text-[var(--sr-text-primary)]">
                        {pl.progressCustomSessionMeta(planName, s.dayNumber)}
                      </p>
                      <p className="mt-1 text-sm text-[var(--sr-text-muted)]">
                        {formatCustomSessionSummary(s.exerciseLogs?.length ?? 0, sets, detail)}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </ProgressSection>
        </>
      )}

      {tab === 'history' && (
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
              {historyCycleFilter === 'current' && <Badge variant="default">{pl.filterCycleCurrent}</Badge>}
              {historyDateFilter !== 'all' && (
                <Badge variant="default">
                  {historyDateFilter === '30d' ? pl.filterDate30 : pl.filterDate90}
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
                  action={filtersActive ? { label: pl.clearFilters, onClick: clearFilters } : undefined}
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
                        'flex w-full min-h-11 flex-col gap-1 py-3 text-left',
                        'rounded-[var(--sr-radius-md)] transition-colors',
                        'hover:bg-[var(--sr-bg-surface)] active:bg-[var(--sr-bg-surface)]',
                      )}
                      onClick={() => setSelectedSession(s)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                          {format(new Date(s.startedAt), 'd MMM yyyy', { locale: plLocale })}
                        </p>
                        <Badge variant={sessionBadgeVariant(s)}>{sessionStatusLabel(s)}</Badge>
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
                    </button>
                  </li>
                ))}
              </ul>
              {hasMoreHistory && (
                <Button
                  className="mt-3"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE_SIZE)}
                >
                  {pl.progressLoadMore(filteredSessions.length - historyLimit)}
                </Button>
              )}
            </>
          )}
        </ProgressSection>
      )}

      {tab === 'cycle' &&
        (cycle && progress ? (
          <ProgressSection
            first
            title={pl.cycleMapTitle(cycle.nameShort)}
            hint={pl.progressCycleProgress(stats?.completedDaysInCycle ?? 0, stats?.cycleDaysTotal ?? cycle.days.length)}
          >
            <CycleDayPicker
              totalDays={cycle.days.length}
              selectedDay={cyclePreviewDay}
              onSelect={handleCycleDayTap}
              days={cycle.days.map((d) => ({
                dayNumber: d.dayNumber,
                status: getCycleDayStatus(progress, d.dayNumber, cycle.days.length),
              }))}
            />
            <p className="mt-3 sr-text-body-sm text-[var(--sr-text-secondary)]">{pl.cycleMapHint}</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4"
              fullWidth
              onClick={() => navigate(`/plans?highlight=${progress.cycleId}`)}
            >
              {pl.progressFullCyclePlan}
            </Button>
          </ProgressSection>
        ) : (
          <ProgressSection first>
            <EmptyState
              icon={<LogoMark size={48} />}
              title={pl.cycleNotConfigured}
              action={{ label: pl.configureProgram, onClick: () => navigate(`/setup/test/${program}`) }}
            />
          </ProgressSection>
        ))}

      </div>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={pl.progressFilters}>
        <div className="flex flex-col gap-4 pb-2">
          <div>
            <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">{pl.progressFilterResult}</p>
            <SegmentedControl
              options={[
                { value: 'all' as const, label: pl.filterAll },
                { value: 'passed' as const, label: pl.filterPassed },
                { value: 'failed' as const, label: pl.filterFailed },
              ]}
              value={historyFilter}
              onChange={setHistoryFilter}
            />
          </div>
          <div>
            <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">{pl.progressFilterCycle}</p>
            <SegmentedControl
              options={[
                { value: 'all' as const, label: pl.filterCycleAll },
                { value: 'current' as const, label: pl.filterCycleCurrent },
              ]}
              value={historyCycleFilter}
              onChange={setHistoryCycleFilter}
            />
          </div>
          <div>
            <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">{pl.progressFilterDate}</p>
            <SegmentedControl
              options={[
                { value: 'all' as const, label: pl.filterDateAll },
                { value: '30d' as const, label: pl.filterDate30 },
                { value: '90d' as const, label: pl.filterDate90 },
              ]}
              value={historyDateFilter}
              onChange={setHistoryDateFilter}
            />
          </div>
          {filtersActive && (
            <Button variant="ghost" fullWidth onClick={() => { clearFilters(); setFiltersOpen(false) }}>
              {pl.clearFilters}
            </Button>
          )}
          <Button variant="primary" fullWidth onClick={() => setFiltersOpen(false)}>
            {pl.progressFiltersApply}
          </Button>
        </div>
      </Sheet>

      <Sheet open={!!selectedSession} onClose={() => setSelectedSession(null)} title={pl.sessionDetails}>
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
              {pl.dayLabel(selectedSession.dayNumber)}
              <span className="ml-2 tabular-nums sr-text-body-sm font-normal text-[var(--sr-text-secondary)]">
                {sessionTotalReps(selectedSession)}{' '}
                {pl.repsUnit}
              </span>
            </p>
            <p className="mt-0.5 sr-text-body-sm text-[var(--sr-text-muted)]">
              {getCycleById(selectedSession.cycleId)?.nameShort ?? selectedSession.cycleId}
            </p>
            {selectedSession.setResults.length > 0 ? (
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
            ) : (
              <p className="mt-4 sr-text-body-sm text-[var(--sr-text-muted)]">{pl.progressSessionNoSets}</p>
            )}
          </>
        )}
      </Sheet>

      <Sheet
        open={cyclePreviewDay !== null}
        onClose={() => setCyclePreviewDay(null)}
        title={pl.cycleDayPreviewTitle(cyclePreviewDay ?? 0)}
      >
        {cyclePreviewDay !== null &&
          cycle &&
          (() => {
            const day = cycle.days.find((d) => d.dayNumber === cyclePreviewDay)
            if (!day) return null
            return (
              <div>
                <SetTargetsRow sets={day.sets} size="md" />
                <p className="mt-3 sr-text-body-sm text-[var(--sr-text-secondary)]">
                  {pl.restBetweenSets(day.restBetweenSetsSec)}
                </p>
              </div>
            )
          })()}
      </Sheet>

      <ExerciseDetailSheet
        open={detailExercise != null}
        exercise={detailExercise}
        onClose={() => setDetailExercise(null)}
      />
    </div>
  )
}
