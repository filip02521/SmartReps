import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { ActivityHeatmap } from '@/components/progress/ActivityHeatmap'
import { buildActivityHeatmap, exportSessionsCsv, downloadCsv } from '@/lib/export'
import { Button } from '@/components/ui/Button'
import { MetricStrip } from '@/components/ui/MetricStrip'
import { NestedStat } from '@/components/ui/NestedStat'
import { CycleDayPicker } from '@/components/ui/CycleDayPicker'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Sheet } from '@/components/ui/Sheet'
import { LogoMark } from '@/components/brand/Logo'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Card'
import { EmptyState, SkeletonCard, ErrorBanner } from '@/components/ux/Feedback'
import { db } from '@/lib/db'
import { getProgramProgress } from '@/lib/program-service'
import { navigateToTrain } from '@/lib/setup-flow'
import { getCycleById } from '@/data/plans'
import { getProgramStats, getMaxSetPerDay, getProgramRecords } from '@/lib/stats-engine'
import { useAppStore } from '@/stores/app-store'
import { pl } from '@/i18n/pl'
import type { Program } from '@/data/plans/types'
import type { LocalWorkoutSession } from '@/lib/db'
import { getCycleDayStatus } from '@/lib/cycle-progress'
import { showToast } from '@/stores/toast-store'

type Tab = 'overview' | 'history' | 'cycle' | 'records'
type HistoryDateFilter = 'all' | '30d' | '90d'

const chartTooltipStyle = {
  background: 'var(--sr-bg-elevated)',
  border: '1px solid var(--sr-border-subtle)',
  borderRadius: '8px',
  color: 'var(--sr-text-primary)',
}

export default function ProgressPage() {
  const navigate = useNavigate()
  const { settings } = useAppStore()
  const [program, setProgram] = useState<Program>(settings.enabledPrograms[0] ?? 'pushups')
  const [tab, setTab] = useState<Tab>('overview')
  const [loading, setLoading] = useState(true)
  const [tests, setTests] = useState<{ date: string; reps: number }[]>([])
  const [sessions, setSessions] = useState<LocalWorkoutSession[]>([])
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof getProgramProgress>>>(undefined)
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getProgramStats>> | null>(null)
  const [records, setRecords] = useState<Awaited<ReturnType<typeof getProgramRecords>> | null>(null)
  const [maxPerDay, setMaxPerDay] = useState<{ day: number; maxActual: number }[]>([])
  const [historyFilter, setHistoryFilter] = useState<'all' | 'passed' | 'failed'>('all')
  const [historyCycleFilter, setHistoryCycleFilter] = useState<'all' | 'current'>('all')
  const [historyDateFilter, setHistoryDateFilter] = useState<HistoryDateFilter>('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [heatmap, setHeatmap] = useState<Awaited<ReturnType<typeof buildActivityHeatmap>>>([])
  const [selectedSession, setSelectedSession] = useState<LocalWorkoutSession | null>(null)
  const [cyclePreviewDay, setCyclePreviewDay] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadEpoch, setReloadEpoch] = useState(0)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const rows = await db.maxTests.where('program').equals(program).sortBy('testedAt')
        setTests(rows.map((r) => ({ date: r.testedAt.slice(0, 10), reps: r.reps })))
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
      } catch {
        setError(pl.errorLoadProgress)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [program, reloadEpoch])

  const cycle = progress ? getCycleById(progress.cycleId) : undefined
  const filtersActive =
    historyFilter !== 'all' || historyCycleFilter !== 'all' || historyDateFilter !== 'all'
  const filteredSessions = sessions.filter((s) => {
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

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 safe-top">
        <PageHeader title={pl.navProgress} subtitle={pl.progressOverviewHint} />
        <SkeletonCard className="mt-4 min-h-[8rem]" />
        <SkeletonCard className="mt-4 min-h-[12rem]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 safe-top">
        <PageHeader title={pl.navProgress} />
        <ErrorBanner message={error} onRetry={() => setReloadEpoch((n) => n + 1)} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 safe-top">
      <PageHeader title={pl.navProgress} subtitle={statusSubtitle} />

      {programOptions.length > 1 && (
        <SegmentedControl className="mb-4" options={programOptions} value={program} onChange={setProgram} />
      )}

      <SegmentedControl options={tabOptions} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <>
          {stats && (
            <>
              <MetricStrip
                className="mt-4"
                metrics={[
                  { value: stats.maxTestRecord ?? '—', label: pl.recordTest },
                  {
                    value: progress
                      ? `${stats.completedDaysInCycle}/${stats.cycleDaysTotal}`
                      : '—',
                    label: pl.cycleDays,
                  },
                  { value: stats.streakWeeks, label: pl.streakWeeks },
                ]}
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                <NestedStat size="md" overline={pl.sessionsTotal} value={stats.passedSessionCount} />
                <NestedStat size="md" overline={pl.totalRepsLabel} value={stats.totalRepsAllTime} />
              </div>
            </>
          )}

          {tests.length === 0 && sessions.length === 0 ? (
            <EmptyState
              icon={<LogoMark size={48} />}
              title={pl.firstWorkout}
              action={{ label: pl.startFirstWorkout, onClick: () => void navigateToTrain(navigate, program) }}
            />
          ) : tests.length > 0 ? (
            <Card className="mt-6 h-48">
              <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">{pl.chartTestOverTime}</p>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={tests}>
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'var(--sr-text-muted)' }} stroke="var(--sr-border-subtle)" />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--sr-text-muted)' }} stroke="var(--sr-border-subtle)" />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Line type="monotone" dataKey="reps" stroke="var(--sr-brand-primary)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          ) : (
            <p className="mt-6 sr-text-body-sm text-[var(--sr-text-muted)]">{pl.progressChartEmpty}</p>
          )}

          {maxPerDay.length > 0 && (
            <Card className="mt-6 h-40">
              <p className="mb-2 sr-text-overline text-[var(--sr-text-muted)]">{pl.maxSetPerDay}</p>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={maxPerDay}>
                  <XAxis dataKey="day" tickFormatter={(d) => `D${d}`} stroke="var(--sr-text-muted)" />
                  <YAxis stroke="var(--sr-text-muted)" />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Bar dataKey="maxActual" fill="var(--sr-brand-primary)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card className="mt-6">
            <p className="mb-3 sr-text-overline text-[var(--sr-text-muted)]">{pl.activityHeatmap}</p>
            <ActivityHeatmap grid={heatmap} />
          </Card>
        </>
      )}

      {tab === 'records' && records && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <NestedStat
            size="lg"
            overline={pl.recordBestTest}
            value={records.bestTest ?? '—'}
            highlight={records.bestTest !== null}
          />
          <NestedStat size="md" overline={pl.recordBestMaxSet} value={records.bestMaxSet ?? '—'} />
          <NestedStat size="md" overline={pl.recordBestSession} value={records.bestSessionTotal ?? '—'} />
          <NestedStat size="md" overline={pl.recordHighestCycle} value={records.highestCycleName ?? '—'} />
        </div>
      )}

      {tab === 'history' && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setFiltersOpen(true)}>
              {pl.progressFilters}
              {filtersActive ? ' ·' : ''}
            </Button>
            {sessions.length > 0 && (
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
          {filteredSessions.length === 0 ? (
            sessions.length === 0 ? (
              <EmptyState
                icon={<LogoMark size={48} />}
                title={pl.firstWorkout}
                action={{ label: pl.startFirstWorkout, onClick: () => void navigateToTrain(navigate, program) }}
              />
            ) : (
              <EmptyState
                icon={<LogoMark size={48} />}
                title={pl.filterEmptyHistory}
                action={
                  filtersActive
                    ? { label: pl.clearFilters, onClick: clearFilters }
                    : undefined
                }
              />
            )
          ) : (
            <div className="flex flex-col gap-2">
              {filteredSessions.slice(0, 20).map((s) => {
                const statusLabel =
                  s.status === 'in_progress'
                    ? pl.sessionInProgress
                    : s.status === 'abandoned'
                      ? pl.abandonedShort
                      : s.passed === false
                        ? pl.failedShort
                        : s.passed === true
                          ? pl.passedShort
                          : pl.incompleteShort
                const badgeVariant =
                  s.passed === true
                    ? 'success'
                    : s.passed === false
                      ? 'error'
                      : s.status === 'in_progress'
                        ? 'info'
                        : 'default'
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full rounded-[var(--sr-radius-lg)] bg-[var(--sr-bg-elevated)] p-4 text-left shadow-[var(--sr-shadow-card)] transition-opacity hover:opacity-90"
                    onClick={() => setSelectedSession(s)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="sr-text-body-sm text-[var(--sr-text-secondary)]">
                          {format(new Date(s.startedAt), 'd MMM yyyy', { locale: plLocale })}
                        </p>
                        <p className="mt-1 sr-text-h3 text-[var(--sr-text-primary)]">
                          {pl.dayLabel(s.dayNumber)}
                          <span className="ml-2 tabular-nums text-[var(--sr-text-secondary)]">
                            {s.totalReps ?? 0} {pl.repsUnit}
                          </span>
                        </p>
                        <p className="mt-1 sr-text-body-sm text-[var(--sr-text-muted)]">
                          {getCycleById(s.cycleId)?.nameShort ?? s.cycleId}
                        </p>
                      </div>
                      <Badge variant={badgeVariant}>{statusLabel}</Badge>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'cycle' &&
        (cycle && progress ? (
          <Card className="mt-4">
            <p className="mb-3 sr-text-overline text-[var(--sr-text-muted)]">
              {pl.cycleMapTitle(cycle.nameShort)}
            </p>
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
          </Card>
        ) : (
          <EmptyState
            icon={<LogoMark size={48} />}
            title={pl.cycleNotConfigured}
            action={{ label: pl.configureProgram, onClick: () => navigate(`/setup/test/${program}`) }}
          />
        ))}

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={pl.progressFilters}>
        <div className="flex flex-col gap-4 pb-2">
          <SegmentedControl
            options={[
              { value: 'all' as const, label: pl.filterAll },
              { value: 'passed' as const, label: pl.filterPassed },
              { value: 'failed' as const, label: pl.filterFailed },
            ]}
            value={historyFilter}
            onChange={setHistoryFilter}
          />
          <SegmentedControl
            options={[
              { value: 'all' as const, label: pl.filterCycleAll },
              { value: 'current' as const, label: pl.filterCycleCurrent },
            ]}
            value={historyCycleFilter}
            onChange={setHistoryCycleFilter}
          />
          <SegmentedControl
            options={[
              { value: 'all' as const, label: pl.filterDateAll },
              { value: '30d' as const, label: pl.filterDate30 },
              { value: '90d' as const, label: pl.filterDate90 },
            ]}
            value={historyDateFilter}
            onChange={setHistoryDateFilter}
          />
          {filtersActive && (
            <Button variant="ghost" fullWidth onClick={clearFilters}>
              {pl.clearFilters}
            </Button>
          )}
        </div>
      </Sheet>

      <Sheet open={!!selectedSession} onClose={() => setSelectedSession(null)} title={pl.sessionDetails}>
        {selectedSession && (
          <>
            <p className="text-sm text-[var(--sr-text-secondary)]">
              {pl.dayLabel(selectedSession.dayNumber)} · {selectedSession.totalReps ?? 0} {pl.repsUnit}
            </p>
            <ul className="mt-4 space-y-2">
              {selectedSession.setResults.map((r) => (
                <NestedStat
                  key={r.setNumber}
                  overline={`${pl.setColumn} ${r.setNumber}`}
                  value={`${r.actual}${r.passed ? '' : ` (${pl.failedShort})`}`}
                />
              ))}
            </ul>
          </>
        )}
      </Sheet>

      <Sheet
        open={cyclePreviewDay !== null}
        onClose={() => setCyclePreviewDay(null)}
        title={`${pl.cycleDayPreview} ${cyclePreviewDay ?? ''}`}
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
    </div>
  )
}
