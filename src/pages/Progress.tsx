import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { ActivityHeatmap } from '@/components/progress/ActivityHeatmap'
import { buildActivityHeatmap, exportSessionsCsv, downloadCsv } from '@/lib/export'
import { Button } from '@/components/ui/Button'
import { StatTile } from '@/components/ui/StatTile'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Sheet } from '@/components/ui/Sheet'
import { LogoMark } from '@/components/brand/Logo'
import { Card } from '@/components/ui/Card'
import { EmptyState, SkeletonCard, ErrorBanner } from '@/components/ux/Feedback'
import { formatSetTarget } from '@/lib/progress-engine'
import { db } from '@/lib/db'
import { getProgramProgress } from '@/lib/program-service'
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
  }, [program])

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

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 safe-top">
        <SkeletonCard className="h-48" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-6 safe-top">
        <ErrorBanner message={error} onRetry={() => window.location.reload()} />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 safe-top">
      <PageHeader title={pl.navProgress} />

      {programOptions.length > 1 && (
        <SegmentedControl className="mb-4" options={programOptions} value={program} onChange={setProgram} />
      )}

      <SegmentedControl options={tabOptions} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <>
          {stats && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label={pl.recordTest} value={stats.maxTestRecord ?? '—'} highlight={stats.maxTestRecord !== null} />
              <StatTile
                label={pl.cycleDays}
                value={
                  progress && stats
                    ? `${stats.completedDaysInCycle}/${stats.cycleDaysTotal}`
                    : '—'
                }
              />
              <StatTile label={pl.sessionsTotal} value={stats.passedSessionCount} />
              <StatTile label={pl.totalRepsLabel} value={stats.totalRepsAllTime} />
              <StatTile label={pl.streakWeeks} value={stats.streakWeeks} />
            </div>
          )}

          {tests.length === 0 && sessions.length === 0 ? (
            <EmptyState
              icon={<LogoMark size={48} />}
              title={pl.firstWorkout}
              action={{ label: pl.startFirstWorkout, onClick: () => navigate(`/workout/${program}`) }}
            />
          ) : tests.length > 0 ? (
            <Card className="mt-6 h-48 sr-card">
              <p className="mb-2 text-sm font-medium">{pl.chartTestOverTime}</p>
              <ResponsiveContainer width="100%" height="85%">
                <LineChart data={tests}>
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--sr-text-muted)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--sr-text-muted)" />
                  <Tooltip />
                  <Line type="monotone" dataKey="reps" stroke="var(--sr-brand-primary)" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          ) : null}

          {maxPerDay.length > 0 && (
            <Card className="mt-6 h-40 sr-card">
              <p className="mb-2 text-sm font-medium">{pl.maxSetPerDay}</p>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={maxPerDay}>
                  <XAxis dataKey="day" tickFormatter={(d) => `D${d}`} stroke="var(--sr-text-muted)" />
                  <YAxis stroke="var(--sr-text-muted)" />
                  <Bar dataKey="maxActual" fill="var(--sr-brand-primary)" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Card className="mt-6 sr-card">
            <p className="mb-3 text-sm font-medium">{pl.activityHeatmap}</p>
            <ActivityHeatmap grid={heatmap} />
          </Card>
        </>
      )}

      {tab === 'records' && records && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <StatTile label={pl.recordBestTest} value={records.bestTest ?? '—'} highlight={records.bestTest !== null} />
          <StatTile label={pl.recordBestMaxSet} value={records.bestMaxSet ?? '—'} />
          <StatTile label={pl.recordBestSession} value={records.bestSessionTotal ?? '—'} />
          <StatTile label={pl.recordHighestCycle} value={records.highestCycleName ?? '—'} />
        </div>
      )}

      {tab === 'history' && (
        <div className="mt-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SegmentedControl
              options={[
                { value: 'all' as const, label: pl.filterAll },
                { value: 'passed' as const, label: pl.filterPassed },
                { value: 'failed' as const, label: pl.filterFailed },
              ]}
              value={historyFilter}
              onChange={setHistoryFilter}
            />
            <Button size="sm" variant="secondary" onClick={() => setFiltersOpen((v) => !v)}>
              {filtersOpen ? pl.lessFilters : pl.moreFilters}
            </Button>
          </div>
          {filtersOpen && (
            <div className="mb-3 flex flex-col gap-2">
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
            </div>
          )}
          {sessions.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              className="mb-3"
              onClick={async () => {
                const csv = await exportSessionsCsv(program)
                downloadCsv(`smartreps-${program}-${new Date().toISOString().slice(0, 10)}.csv`, csv)
                showToast(pl.toastExportDone, 'success')
              }}
            >
              {pl.exportCsv}
            </Button>
          )}
          {filteredSessions.length === 0 ? (
            sessions.length === 0 ? (
              <EmptyState
                icon={<LogoMark size={48} />}
                title={pl.firstWorkout}
                action={{ label: pl.startFirstWorkout, onClick: () => navigate(`/workout/${program}`) }}
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
                return (
                <Card key={s.id} className="cursor-pointer py-3 sr-card" onClick={() => setSelectedSession(s)}>
                  <p className="text-sm font-medium">
                    {format(new Date(s.startedAt), 'd MMM yyyy', { locale: plLocale })} · {pl.dayLabel(s.dayNumber)}
                    {` · ${statusLabel}`}
                  </p>
                  <p className="text-xs text-[var(--sr-text-muted)]">
                    {getCycleById(s.cycleId)?.nameShort ?? s.cycleId} · {s.totalReps ?? 0} {pl.repsUnit}
                  </p>
                </Card>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'cycle' && (
        cycle ? (
        <Card className="mt-4 sr-card">
          <p className="mb-3 text-sm font-medium">{pl.cycleMapTitle(cycle.nameShort)}</p>
          <div className="flex justify-between gap-1">
            {cycle.days.map((d) => {
              const dayStatus = progress
                ? getCycleDayStatus(progress, d.dayNumber, cycle.days.length)
                : 'future'
              return (
              <button
                key={d.dayNumber}
                type="button"
                className="flex min-h-11 flex-1 flex-col items-center justify-center"
                onClick={() => handleCycleDayTap(d.dayNumber)}
              >
                <div
                  className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full text-xs font-medium"
                  style={{
                    background:
                      dayStatus === 'completed'
                        ? 'var(--sr-success-muted)'
                        : dayStatus === 'current'
                          ? 'var(--sr-brand-primary-muted)'
                          : 'var(--sr-bg-surface)',
                    color:
                      dayStatus === 'completed'
                        ? 'var(--sr-success)'
                        : dayStatus === 'current'
                          ? 'var(--sr-brand-primary)'
                          : 'var(--sr-text-muted)',
                  }}
                >
                  {dayStatus === 'completed' ? pl.ok : d.dayNumber}
                </div>
                <p className="text-[10px] text-[var(--sr-text-muted)]">D{d.dayNumber}</p>
              </button>
              )
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--sr-text-muted)]">{pl.cycleMapHint}</p>
        </Card>
        ) : (
          <EmptyState
            icon={<LogoMark size={48} />}
            title={pl.cycleNotConfigured}
            action={{ label: pl.configureProgram, onClick: () => navigate(`/setup/test/${program}`) }}
          />
        )
      )}

      <Sheet open={!!selectedSession} onClose={() => setSelectedSession(null)} title={pl.sessionDetails}>
        {selectedSession && (
          <>
            <p className="text-sm text-[var(--sr-text-secondary)]">
              {pl.dayLabel(selectedSession.dayNumber)} · {selectedSession.totalReps ?? 0} {pl.repsUnit}
            </p>
            <ul className="mt-4 space-y-1 text-sm">
              {selectedSession.setResults.map((r) => (
                <li key={r.setNumber}>
                  {pl.setColumn} {r.setNumber}: {r.actual}{' '}
                  {r.passed ? '' : `(${pl.failedShort})`}
                </li>
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
        {cyclePreviewDay !== null && cycle && (() => {
          const day = cycle.days.find((d) => d.dayNumber === cyclePreviewDay)
          if (!day) return null
          return (
            <ul className="space-y-2 text-sm text-[var(--sr-text-secondary)]">
              {day.sets.map((s, i) => (
                <li key={i} className="flex justify-between border-b border-[var(--sr-border-subtle)] py-2">
                  <span>{pl.setColumn} {i + 1}</span>
                  <span>{formatSetTarget(s)}</span>
                </li>
              ))}
              <li className="pt-2 text-xs text-[var(--sr-text-muted)]">{pl.restBetweenSets(day.restBetweenSetsSec)}</li>
            </ul>
          )
        })()}
      </Sheet>
    </div>
  )
}
