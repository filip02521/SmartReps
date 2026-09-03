import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { format, subDays } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { OverviewPanel } from '@/components/progress/OverviewPanel'
import { CyclePanel } from '@/components/progress/CyclePanel'
import { HistoryPanel } from '@/components/progress/HistoryPanel'
import { CustomProgressPanel } from '@/components/progress/CustomProgressPanel'
import { buildActivityHeatmap } from '@/lib/export'
import {
  isCustomProgressHistorySession,
  isProgressHistorySession,
  sessionTotalReps,
} from '@/lib/progress-history'
import { Button } from '@/components/ui/Button'
import { SetTargetsRow } from '@/components/ui/SetTargetsRow'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { PageHeader } from '@/components/ui/PageHeader'
import { Sheet } from '@/components/ui/Sheet'
import { Badge } from '@/components/ui/Card'
import { SkeletonCard, ErrorBanner } from '@/components/ux/Feedback'
import { db } from '@/lib/db'
import { getProgramProgress } from '@/lib/program-service'
import { getCycleById } from '@/data/plans'
import {
  getProgramStats,
  getMaxSetPerDay,
  getProgramRecords,
  getMaxSetPerSession,
  getProgramRecordsWithDates,
  getProgramVolumeStats,
  getDayCycleTrend,
  type SessionChartPoint,
  type ProgramRecordsWithDates,
  type ProgramVolumeStats,
  type DayCycleTrend,
} from '@/lib/stats-engine'
import { buildActivityInsights } from '@/lib/weekly-recap'
import { useAppStore } from '@/stores/app-store'
import { pl } from '@/i18n/pl'
import { TAB_PAGE_SHELL } from '@/lib/ui-chrome'
import type { Program } from '@/data/plans/types'
import type { LocalWorkoutSession } from '@/lib/db'
import { getCycleDayStatus } from '@/lib/cycle-progress'
import { computeCustomExercisePrs, type ExercisePr } from '@/lib/custom-stats'
import { ExerciseDetailSheet } from '@/components/plans/ExerciseDetailSheet'
import type { ExerciseDefinition, CustomPlan, CustomProgramProgress } from '@/lib/exercise-model'
import { cn } from '@/lib/utils'
import { filterCustomHistorySessions } from '@/lib/custom-history-filters'
import { AchievementGallery } from '@/components/achievements/AchievementGallery'
import { getAllUnlocks } from '@/lib/achievements/store'
import { buildAchievementSnapshot, emptyImpact } from '@/lib/achievements/snapshot'
import { fetchAuthorImpact } from '@/lib/achievements/community-impact'
import { pickInProgress } from '@/lib/achievements/evaluate'
import { runAchievementCheck } from '@/lib/achievements/schedule'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'
import {
  ProgressChromeNav,
  type ProgressSection,
  type TrainingTab,
} from '@/components/progress/ProgressChromeNav'
import { ACHIEVEMENT_CATALOG } from '@/lib/achievements/catalog'

type Tab = 'overview' | 'history' | 'cycle' | 'custom' | 'achievements'
type CustomView = 'exercises' | 'history'
type HistoryDateFilter = 'all' | '30d' | '90d'

const HISTORY_PAGE_SIZE = 20

function sectionFromTab(tab: Tab): ProgressSection {
  if (tab === 'custom') return 'custom'
  if (tab === 'achievements') return 'achievements'
  return 'programs'
}

function isTrainingTab(tab: Tab): tab is TrainingTab {
  return tab === 'overview' || tab === 'history' || tab === 'cycle'
}

function parseProgressTab(raw: string | null): Tab | 'records' | null {
  if (
    raw === 'overview' ||
    raw === 'history' ||
    raw === 'cycle' ||
    raw === 'custom' ||
    raw === 'achievements' ||
    raw === 'records'
  ) {
    return raw
  }
  return null
}

function parseCustomView(raw: string | null): CustomView {
  if (raw === 'history') return 'history'
  // Legacy ?view=plan → overview (mapa planu jest w Przeglądzie)
  return 'exercises'
}

function parseProgramParam(raw: string | null, enabled: Program[]): Program {
  if ((raw === 'pushups' || raw === 'pullups') && enabled.includes(raw)) return raw
  return enabled[0] ?? 'pushups'
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

export default function ProgressPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { settings } = useAppStore()
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const [program, setProgram] = useState<Program>(() =>
    parseProgramParam(searchParams.get('program'), settings.enabledPrograms),
  )
  const [tab, setTab] = useState<Tab>(() => {
    const raw = parseProgressTab(searchParams.get('tab'))
    if (raw === 'records' || raw == null) return 'overview'
    return raw
  })
  const [scrollToRecords, setScrollToRecords] = useState(
    () => searchParams.get('tab') === 'records',
  )
  const [customView, setCustomView] = useState<CustomView>(() =>
    parseCustomView(searchParams.get('view')),
  )
  const [lastTrainingTab, setLastTrainingTab] = useState<TrainingTab>(() => {
    const raw = parseProgressTab(searchParams.get('tab'))
    if (raw === 'history' || raw === 'cycle') return raw
    return 'overview'
  })
  const [loading, setLoading] = useState(true)
  const [tests, setTests] = useState<{ date: string; dateLabel: string; reps: number }[]>([])
  const [sessions, setSessions] = useState<LocalWorkoutSession[]>([])
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof getProgramProgress>>>(undefined)
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getProgramStats>> | null>(null)
  const [records, setRecords] = useState<Awaited<ReturnType<typeof getProgramRecords>> | null>(null)
  const [maxPerDay, setMaxPerDay] = useState<{ day: number; maxActual: number }[]>([])
  const [sessionChart, setSessionChart] = useState<SessionChartPoint[]>([])
  const [recordsWithDates, setRecordsWithDates] = useState<ProgramRecordsWithDates | null>(null)
  const [volumeStats, setVolumeStats] = useState<ProgramVolumeStats | null>(null)
  const [dayCycleTrend, setDayCycleTrend] = useState<DayCycleTrend[]>([])
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
  const [customSessionsAll, setCustomSessionsAll] = useState<LocalWorkoutSession[]>([])
  const [customPlanNames, setCustomPlanNames] = useState<Record<string, string>>({})
  const [exerciseNamesById, setExerciseNamesById] = useState<Record<string, string>>({})
  const [customPlans, setCustomPlans] = useState<CustomPlan[]>([])
  const [customProgressByPlan, setCustomProgressByPlan] = useState<
    Record<string, CustomProgramProgress | null>
  >({})
  const [customCyclePlanId, setCustomCyclePlanId] = useState<string | 'all'>('all')
  const [customHistoryPlanFilter, setCustomHistoryPlanFilter] = useState<string | 'all'>('all')
  const [customHistoryResultFilter, setCustomHistoryResultFilter] = useState<
    'all' | 'passed' | 'failed'
  >('all')
  const [customHistoryDayFilter, setCustomHistoryDayFilter] = useState<number | 'all'>('all')
  const [customHistoryLimit, setCustomHistoryLimit] = useState(HISTORY_PAGE_SIZE)
  const [customFiltersOpen, setCustomFiltersOpen] = useState(false)
  const [detailExercise, setDetailExercise] = useState<ExerciseDefinition | null>(null)
  const [achievementUnlocks, setAchievementUnlocks] = useState<LocalAchievementUnlock[]>([])
  const [achievementInProgress, setAchievementInProgress] = useState<
    { id: import('@/lib/achievements/types').AchievementId; current: number; target: number }[]
  >([])
  const customHistoryRef = useRef<HTMLDivElement>(null)
  const recordsScrollDone = useRef(false)

  const customFiltersActive =
    customHistoryPlanFilter !== 'all' ||
    customHistoryResultFilter !== 'all' ||
    customHistoryDayFilter !== 'all'

  const customActiveFilterCount =
    (customHistoryPlanFilter !== 'all' ? 1 : 0) +
    (customHistoryResultFilter !== 'all' ? 1 : 0) +
    (customHistoryDayFilter !== 'all' ? 1 : 0)

  function clearCustomFilters() {
    setCustomHistoryPlanFilter('all')
    setCustomHistoryResultFilter('all')
    setCustomHistoryDayFilter('all')
  }

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
          setDayCycleTrend(await getDayCycleTrend(program, prog.cycleId, prog.cycleAttempt))
        } else {
          setStats(null)
          setMaxPerDay([])
          setDayCycleTrend([])
        }
        setRecords(await getProgramRecords(program))
        setSessionChart(await getMaxSetPerSession(program))
        setRecordsWithDates(await getProgramRecordsWithDates(program))
        setVolumeStats(await getProgramVolumeStats(program))
        setHeatmap(await buildActivityHeatmap(program))
        setCustomPrs(await computeCustomExercisePrs())
        const customHistory = (await db.workoutSessions.toArray())
          .filter(isCustomProgressHistorySession)
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        setCustomSessionsAll(customHistory)
        const planRows = await db.customPlans.toArray()
        setCustomPlans(planRows.filter((p) => p.status === 'active'))
        const nameMap: Record<string, string> = {}
        const progMap: Record<string, CustomProgramProgress | null> = {}
        for (const p of planRows) {
          nameMap[p.id] = p.name
          progMap[p.id] =
            (await db.customProgramProgress.where('customPlanId').equals(p.id).first()) ?? null
        }
        setCustomPlanNames(nameMap)
        setCustomProgressByPlan(progMap)
        const exRows = await db.exercises.toArray()
        const exMap: Record<string, string> = {}
        for (const e of exRows) {
          if (!e.archived) exMap[e.id] = e.name
        }
        setExerciseNamesById(exMap)
        const activePlans = planRows.filter((p) => p.status === 'active')
        setCustomCyclePlanId((current) => {
          if (activePlans.length === 0) return 'all'
          if (activePlans.length === 1) return activePlans[0]!.id
          if (current === 'all' || !activePlans.some((p) => p.id === current)) {
            return activePlans[0]!.id
          }
          return current
        })

        let impact = emptyImpact()
        try {
          impact = await fetchAuthorImpact()
        } catch {
          /* guest / offline */
        }
        const evalResult = await runAchievementCheck()
        const snap = await buildAchievementSnapshot({ impact })
        const unlocks = evalResult?.allUnlocked ?? (await getAllUnlocks())
        setAchievementUnlocks(unlocks)
        setAchievementInProgress(
          pickInProgress(snap, new Set(unlocks.map((u) => u.id)), 2),
        )
      } catch {
        setError(pl.errorLoadProgress)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [program, reloadEpoch, lastSyncedAt])

  useEffect(() => {
    setHistoryLimit(HISTORY_PAGE_SIZE)
  }, [program, historyFilter, historyCycleFilter, historyDateFilter])

  useEffect(() => {
    setCustomHistoryLimit(HISTORY_PAGE_SIZE)
  }, [customHistoryPlanFilter, customHistoryResultFilter, customHistoryDayFilter])

  const customHistoryFiltered = useMemo(
    () =>
      filterCustomHistorySessions(customSessionsAll, {
        planId: customHistoryPlanFilter,
        result: customHistoryResultFilter,
        dayNumber: customHistoryDayFilter,
      }),
    [customSessionsAll, customHistoryPlanFilter, customHistoryResultFilter, customHistoryDayFilter],
  )

  const customHistoryVisible = useMemo(
    () => customHistoryFiltered.slice(0, customHistoryLimit),
    [customHistoryFiltered, customHistoryLimit],
  )

  const customCyclePlan = useMemo(() => {
    if (customCyclePlanId === 'all') return customPlans[0] ?? null
    return customPlans.find((p) => p.id === customCyclePlanId) ?? null
  }, [customPlans, customCyclePlanId])

  const customCycleProgress = customCyclePlan
    ? (customProgressByPlan[customCyclePlan.id] ?? null)
    : null

  const customCycleSessions = useMemo(() => {
    if (!customCyclePlan) return []
    return customSessionsAll.filter((s) => s.customPlanId === customCyclePlan.id)
  }, [customSessionsAll, customCyclePlan])

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

  useEffect(() => {
    const raw = parseProgressTab(searchParams.get('tab'))
    if (raw === 'records') {
      setTab('overview')
      recordsScrollDone.current = false
      setScrollToRecords(true)
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      setSearchParams(next, { replace: true })
      return
    }
    if (raw === 'overview' && searchParams.has('tab')) {
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      setSearchParams(next, { replace: true })
      setTab('overview')
      setCustomView(parseCustomView(searchParams.get('view')))
      setProgram(parseProgramParam(searchParams.get('program'), settings.enabledPrograms))
      return
    }
    setTab(raw ?? 'overview')
    if (raw === 'history' || raw === 'cycle') setLastTrainingTab(raw)
    else if (raw === 'overview' || raw == null) setLastTrainingTab('overview')
    const viewRaw = searchParams.get('view')
    if (viewRaw === 'plan') {
      const next = new URLSearchParams(searchParams)
      next.delete('view')
      setSearchParams(next, { replace: true })
      setCustomView('exercises')
    } else {
      setCustomView(parseCustomView(viewRaw))
    }
    setProgram(parseProgramParam(searchParams.get('program'), settings.enabledPrograms))
  }, [searchParams, setSearchParams, settings.enabledPrograms])

  const hasCustomData = customPlans.length > 0 || customSessionsAll.length > 0

  function writeProgressParams(next: { tab?: Tab; view?: CustomView; program?: Program }) {
    const params = new URLSearchParams(searchParams)
    const tabValue = next.tab ?? tab
    const viewValue = next.view ?? customView
    const programValue = next.program ?? program
    if (tabValue === 'overview') params.delete('tab')
    else params.set('tab', tabValue)
    if (tabValue === 'custom' && viewValue !== 'exercises') params.set('view', viewValue)
    else params.delete('view')
    // Program only meaningful for Strong training views
    if (isTrainingTab(tabValue) && settings.enabledPrograms.length > 1) {
      params.set('program', programValue)
    } else {
      params.delete('program')
    }
    setSearchParams(params, { replace: true })
  }

  function selectTab(next: Tab) {
    if (isTrainingTab(next)) setLastTrainingTab(next)
    setTab(next)
    writeProgressParams({ tab: next })
  }

  function selectSection(next: ProgressSection) {
    if (next === 'programs') {
      selectTab(lastTrainingTab)
      return
    }
    if (next === 'custom') {
      selectTab('custom')
      return
    }
    selectTab('achievements')
  }

  function selectCustomView(next: CustomView) {
    setCustomView(next)
    writeProgressParams({ tab: 'custom', view: next })
  }

  function selectProgram(next: Program) {
    setProgram(next)
    writeProgressParams({ program: next })
  }

  useEffect(() => {
    if (loading) return
    if (tab === 'custom' && !hasCustomData) {
      setTab('overview')
      if (searchParams.get('tab') === 'custom') {
        const next = new URLSearchParams(searchParams)
        next.delete('tab')
        next.delete('view')
        setSearchParams(next, { replace: true })
      }
    }
  }, [loading, tab, hasCustomData, searchParams, setSearchParams])

  const hasAnyData = tests.length > 0 || historyBase.length > 0

  useEffect(() => {
    if (loading || !scrollToRecords || recordsScrollDone.current) return
    if (tab !== 'overview') {
      recordsScrollDone.current = true
      setScrollToRecords(false)
      return
    }
    const el = document.getElementById('progress-records')
    if (!el) {
      // Empty overview has no records section — clear so a later load can scroll once.
      recordsScrollDone.current = true
      setScrollToRecords(false)
      return
    }
    recordsScrollDone.current = true
    setScrollToRecords(false)
    window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [loading, scrollToRecords, tab, hasAnyData])

  const tabOptions: { value: Tab; label: string }[] = [
    { value: 'overview', label: pl.tabOverview },
    { value: 'history', label: pl.tabHistory },
    { value: 'cycle', label: pl.tabCycle },
    ...(hasCustomData ? [{ value: 'custom' as const, label: pl.progressMyExercises }] : []),
    { value: 'achievements', label: pl.tabAchievements },
  ]

  const programOptions = settings.enabledPrograms.map((p) => ({
    value: p,
    label: p === 'pushups' ? pl.pushupsProgram : pl.pullupsProgram,
  }))

  const activityInsights = useMemo(() => {
    const passed = sessions.filter((s) => s.status === 'completed' && s.passed)
    return buildActivityInsights(passed)
  }, [sessions])

  const activeTab: Tab = tabOptions.some((t) => t.value === tab) ? tab : 'overview'
  const activeSection = sectionFromTab(activeTab)
  const trainingTab: TrainingTab = isTrainingTab(activeTab) ? activeTab : lastTrainingTab
  const activeTabLabel =
    activeSection === 'programs'
      ? tabOptions.find((t) => t.value === trainingTab)?.label ?? pl.tabOverview
      : activeSection === 'custom'
        ? customView === 'history'
          ? pl.progressCustomViewHistory
          : pl.progressCustomViewExercises
        : pl.tabAchievements

  // Streak lives in MetricStrip; header keeps session count as stable status line.
  const statusSubtitle =
    activeSection === 'achievements'
      ? pl.achievementsStatusCount(achievementUnlocks.length, ACHIEVEMENT_CATALOG.length)
      : activeSection === 'custom'
        ? pl.progressCustomStatus
        : !stats
          ? undefined
          : stats.passedSessionCount === 0
            ? pl.progressStatusEmpty
            : pl.progressStatusSessions(stats.passedSessionCount)

  if (loading) {
    return (
      <div className={TAB_PAGE_SHELL}>
        <PageHeader title={pl.navProgress} />
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

      <ProgressChromeNav
        section={activeSection}
        onSectionChange={selectSection}
        hasCustom={hasCustomData}
        trainingTab={trainingTab}
        onTrainingTabChange={selectTab}
        program={program}
        programOptions={programOptions}
        onProgramChange={selectProgram}
        customView={customView}
        onCustomViewChange={selectCustomView}
      />

      <div role="tabpanel" aria-label={activeTabLabel}>
      {activeTab === 'overview' && (
        <OverviewPanel
          program={program}
          stats={stats}
          progress={progress}
          tests={tests}
          heatmap={heatmap}
          activity={activityInsights}
          hasAnyData={hasAnyData}
          records={records}
          sessionChart={sessionChart}
          recordsWithDates={recordsWithDates}
          volumeStats={volumeStats}
          dayCycleTrend={dayCycleTrend}
          navigate={navigate}
        />
      )}

      {activeTab === 'achievements' && (
        <div className="mt-4">
          <AchievementGallery
            unlocks={achievementUnlocks}
            inProgress={achievementInProgress}
            onUnlocksChange={() => {
              void getAllUnlocks().then(setAchievementUnlocks)
            }}
          />
        </div>
      )}

      {activeTab === 'custom' && (
        <CustomProgressPanel
          customView={customView}
          customPrs={customPrs}
          onOpenExercise={(id) => void openExerciseDetail(id)}
          customPlans={customPlans}
          customCyclePlan={customCyclePlan}
          customCyclePlanId={customCyclePlanId}
          onCyclePlanChange={setCustomCyclePlanId}
          customCycleProgress={customCycleProgress}
          customCycleSessions={customCycleSessions}
          customHistoryRef={customHistoryRef}
          customFiltersActive={customFiltersActive}
          customActiveFilterCount={customActiveFilterCount}
          onOpenFilters={() => setCustomFiltersOpen(true)}
          customHistoryPlanFilter={customHistoryPlanFilter}
          customHistoryDayFilter={customHistoryDayFilter}
          customHistoryResultFilter={customHistoryResultFilter}
          customPlanNames={customPlanNames}
          exerciseNamesById={exerciseNamesById}
          onClearFilters={clearCustomFilters}
          customHistoryVisible={customHistoryVisible}
          customHistoryFilteredLength={customHistoryFiltered.length}
          customHistoryLimit={customHistoryLimit}
          onLoadMore={() => setCustomHistoryLimit((n) => n + HISTORY_PAGE_SIZE)}
          historyPageSize={HISTORY_PAGE_SIZE}
          customFiltersOpen={customFiltersOpen}
          onCloseFilters={() => setCustomFiltersOpen(false)}
          onHistoryPlanFilter={(v) => {
            setCustomHistoryPlanFilter(v)
            setCustomHistoryDayFilter('all')
          }}
          onHistoryResultFilter={setCustomHistoryResultFilter}
          onHistoryDayFilter={setCustomHistoryDayFilter}
          customSessionsAll={customSessionsAll}
          navigate={navigate}
        />
      )}

      {activeTab === 'history' && (
        <HistoryPanel
          program={program}
          historyBaseCount={historyBase.length}
          filteredCount={filteredSessions.length}
          visibleSessions={visibleSessions}
          hasMoreHistory={hasMoreHistory}
          filtersActive={filtersActive}
          activeFilterCount={activeFilterCount}
          historyFilter={historyFilter}
          historyCycleFilter={historyCycleFilter}
          historyDateFilter={historyDateFilter}
          onOpenFilters={() => setFiltersOpen(true)}
          onClearFilters={clearFilters}
          onLoadMore={() => setHistoryLimit((n) => n + HISTORY_PAGE_SIZE)}
          onSelectSession={setSelectedSession}
          navigate={navigate}
        />
      )}

      {activeTab === 'cycle' && (
        <CyclePanel
          program={program}
          cycle={cycle}
          progress={progress}
          stats={stats}
          maxPerDay={maxPerDay}
          cyclePreviewDay={cyclePreviewDay}
          onSelectDay={handleCycleDayTap}
          navigate={navigate}
        />
      )}

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
            <Button
              className="mt-4"
              variant="ghost"
              fullWidth
              onClick={() => {
                const id = selectedSession.id
                setSelectedSession(null)
                navigate(`/workout/${selectedSession.program}/summary?session=${id}`)
              }}
            >
              {pl.progressOpenFullSummary}
            </Button>
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
