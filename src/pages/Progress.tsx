import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import { format } from 'date-fns'
import { pl as plLocale } from 'date-fns/locale'
import { OverviewPanel } from '@/components/progress/OverviewPanel'
import { HistoryPanel } from '@/components/progress/HistoryPanel'
import { AiWorkoutAnalysis } from '@/components/progress/AiWorkoutAnalysis'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonCard, ErrorBanner } from '@/components/ux/Feedback'
import { db } from '@/lib/db'
import { getProgramProgress } from '@/lib/program-service'
import {
  getProgramStats,
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
import type { LocalProgramProgress, LocalWorkoutSession } from '@/lib/db'
import {
  computeCustomExercisePrs,
  getCustomVolumeStats,
  getCustomSessionChart,
  getCustomOverviewStats,
  type ExercisePr,
  type CustomVolumeStats,
  type CustomSessionChartPoint,
  type CustomOverviewStats,
} from '@/lib/custom-stats'
import { ExerciseDetailSheet } from '@/components/plans/ExerciseDetailSheet'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import { isCustomProgressHistorySession, isProgressHistorySession } from '@/lib/progress-history'
import { AchievementGallery } from '@/components/achievements/AchievementGallery'
import { getAllUnlocks } from '@/lib/achievements/store'
import { buildAchievementSnapshot, emptyImpact } from '@/lib/achievements/snapshot'
import { fetchAuthorImpact } from '@/lib/achievements/community-impact'
import { pickInProgress } from '@/lib/achievements/evaluate'
import { runAchievementCheck } from '@/lib/achievements/schedule'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'
import { ProgressChromeNav, type ProgressTab } from '@/components/progress/ProgressChromeNav'
import { ACHIEVEMENT_CATALOG } from '@/lib/achievements/catalog'
import type { ProgramStats } from '@/lib/stats-engine'

function parseTab(raw: string | null): ProgressTab | 'records' | null {
  // New tabs
  if (raw === 'overview' || raw === 'history' || raw === 'achievements') return raw
  // Legacy tabs → redirect to overview
  if (raw === 'cycle' || raw === 'custom') return 'overview'
  // Legacy records → overview + scroll
  if (raw === 'records') return 'records'
  return null
}

export default function ProgressPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { settings } = useAppStore()
  useSeo({ title: pl.seoProgressTitle, description: pl.seoProgressDescription, path: '/progress' })
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const [tab, setTab] = useState<ProgressTab>(() => {
    const raw = parseTab(searchParams.get('tab'))
    if (raw === 'records') return 'overview'
    return raw ?? 'overview'
  })
  const [scrollToRecords, setScrollToRecords] = useState(
    () => searchParams.get('tab') === 'records',
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadEpoch, setReloadEpoch] = useState(0)

  // Program data (builtin)
  const [program, setProgram] = useState<Program>(() =>
    settings.enabledPrograms[0] ?? 'pushups',
  )
  const [tests, setTests] = useState<{ date: string; dateLabel: string; reps: number }[]>([])
  const [sessions, setSessions] = useState<LocalWorkoutSession[]>([])
  const [progress, setProgress] = useState<LocalProgramProgress | undefined>(undefined)
  const [stats, setStats] = useState<ProgramStats | null>(null)
  const [sessionChart, setSessionChart] = useState<SessionChartPoint[]>([])
  const [recordsWithDates, setRecordsWithDates] = useState<ProgramRecordsWithDates | null>(null)
  const [volumeStats, setVolumeStats] = useState<ProgramVolumeStats | null>(null)
  const [dayCycleTrend, setDayCycleTrend] = useState<DayCycleTrend[]>([])

  // Custom data
  const [customPrs, setCustomPrs] = useState<ExercisePr[]>([])
  const [customSessionsAll, setCustomSessionsAll] = useState<LocalWorkoutSession[]>([])
  const [customPlanNames, setCustomPlanNames] = useState<Record<string, string>>({})
  const [customVolumeStats, setCustomVolumeStats] = useState<CustomVolumeStats | null>(null)
  const [customSessionChart, setCustomSessionChart] = useState<CustomSessionChartPoint[]>([])
  const [customOverviewStats, setCustomOverviewStats] = useState<CustomOverviewStats | null>(null)

  // Achievements
  const [achievementUnlocks, setAchievementUnlocks] = useState<LocalAchievementUnlock[]>([])
  const [achievementInProgress, setAchievementInProgress] = useState<
    { id: import('@/lib/achievements/types').AchievementId; current: number; target: number }[]
  >([])

  // Detail sheet
  const [detailExercise, setDetailExercise] = useState<ExerciseDefinition | null>(null)
  const recordsScrollDone = useRef(false)

  async function openExerciseDetail(exerciseId: string) {
    const ex = await db.exercises.get(exerciseId)
    if (ex && !ex.archived) setDetailExercise(ex)
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const initialProgram = settings.enabledPrograms[0] ?? 'pushups'
        await loadProgramData(initialProgram)

        // Custom data
        setCustomPrs(await computeCustomExercisePrs())
        setCustomVolumeStats(await getCustomVolumeStats())
        setCustomSessionChart(await getCustomSessionChart())
        setCustomOverviewStats(await getCustomOverviewStats())
        const customHistory = (await db.workoutSessions.toArray())
          .filter(isCustomProgressHistorySession)
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        setCustomSessionsAll(customHistory)
        const planRows = await db.customPlans.toArray()
        const nameMap: Record<string, string> = {}
        for (const p of planRows) {
          nameMap[p.id] = p.name
        }
        setCustomPlanNames(nameMap)

        // Achievements
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
  }, [reloadEpoch, lastSyncedAt, settings.enabledPrograms])

  async function loadProgramData(prog: Program) {
    setProgram(prog)
    const p = await getProgramProgress(prog)
    setProgress(p)
    if (p) {
      setStats(await getProgramStats(prog, p))
      setDayCycleTrend(await getDayCycleTrend(prog, p.cycleId, p.cycleAttempt))
    } else {
      setStats(null)
      setDayCycleTrend([])
    }

    const rows = await db.maxTests.where('program').equals(prog).sortBy('testedAt')
    setTests(
      rows.map((r) => ({
        date: r.testedAt.slice(0, 10),
        dateLabel: format(new Date(r.testedAt), 'd MMM', { locale: plLocale }),
        reps: r.reps,
      })),
    )
    const sess = await db.workoutSessions.where('program').equals(prog).toArray()
    sess.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    setSessions(sess)
    setSessionChart(await getMaxSetPerSession(prog))
    setRecordsWithDates(await getProgramRecordsWithDates(prog))
    setVolumeStats(await getProgramVolumeStats(prog))
  }

  // URL sync + legacy redirect
  useEffect(() => {
    const raw = parseTab(searchParams.get('tab'))
    if (raw === 'records') {
      setTab('overview')
      recordsScrollDone.current = false
      setScrollToRecords(true)
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      setSearchParams(next, { replace: true })
      return
    }
    // Legacy ?tab=cycle or ?tab=custom → redirect to overview
    const legacyRaw = searchParams.get('tab')
    if (legacyRaw === 'cycle' || legacyRaw === 'custom') {
      const next = new URLSearchParams(searchParams)
      next.set('tab', 'overview')
      next.delete('view')
      setSearchParams(next, { replace: true })
      setTab('overview')
      return
    }
    // Legacy ?view=plan → overview
    if (searchParams.get('view') === 'plan') {
      const next = new URLSearchParams(searchParams)
      next.delete('view')
      setSearchParams(next, { replace: true })
    }
    if (raw === 'overview' || raw === 'history' || raw === 'achievements') setTab(raw)
    else if (!raw) setTab('overview')
  }, [searchParams, setSearchParams])

  // Scroll to records after load
  useEffect(() => {
    if (loading || !scrollToRecords || recordsScrollDone.current) return
    if (tab !== 'overview') {
      recordsScrollDone.current = true
      setScrollToRecords(false)
      return
    }
    const el = document.getElementById('progress-records')
    if (!el) {
      recordsScrollDone.current = true
      setScrollToRecords(false)
      return
    }
    recordsScrollDone.current = true
    setScrollToRecords(false)
    window.setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }, [loading, scrollToRecords, tab])

  function selectTab(next: ProgressTab) {
    setTab(next)
    const params = new URLSearchParams(searchParams)
    if (next === 'overview') params.delete('tab')
    else params.set('tab', next)
    params.delete('view')
    params.delete('program')
    setSearchParams(params, { replace: true })
  }

  const allSessions = useMemo(
    () => [...sessions, ...customSessionsAll],
    [sessions, customSessionsAll],
  )

  const hasAnyData = tests.length > 0 || sessions.length > 0 || customSessionsAll.length > 0

  const activityInsights = useMemo(() => {
    const passed = allSessions.filter((s) => s.status === 'completed' && s.passed)
    return buildActivityInsights(passed)
  }, [allSessions])

  const statusSubtitle =
    tab === 'achievements'
      ? pl.achievementsStatusCount(achievementUnlocks.length, ACHIEVEMENT_CATALOG.length)
      : tab === 'history'
        ? pl.progressHistoryCount(allSessions.filter(isProgressHistorySession).length)
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

      <ProgressChromeNav tab={tab} onTabChange={selectTab} />

      <div role="tabpanel" aria-label={pl.navProgress}>
        {tab === 'overview' && (
          <>
          <OverviewPanel
            program={program}
            enabledPrograms={settings.enabledPrograms}
            onProgramChange={(p) => void loadProgramData(p)}
            stats={stats}
            progress={progress}
            tests={tests}
            activity={activityInsights}
            hasAnyData={hasAnyData}
            sessionChart={sessionChart}
            volumeStats={volumeStats}
            dayCycleTrend={dayCycleTrend}
            allSessions={allSessions}
            customSessionsAll={customSessionsAll}
            customPrs={customPrs}
            customVolumeStats={customVolumeStats}
            customSessionChart={customSessionChart}
            customOverviewStats={customOverviewStats}
            customPlanNames={customPlanNames}
            recordsWithDates={recordsWithDates}
            onOpenExercise={(id) => void openExerciseDetail(id)}
            navigate={navigate}
          />
          {/* AI Coach teaser — discoverability for analysis feature */}
          {hasAnyData && (
            <button
              type="button"
              onClick={() => selectTab('history')}
              className="mt-4 flex w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-brand-primary)]/30 p-3 text-left transition-colors hover:bg-[var(--sr-bg-surface)]"
              style={{
                backgroundImage: `linear-gradient(135deg, color-mix(in srgb, var(--sr-brand-primary) 8%, var(--sr-bg-elevated)) 0%, var(--sr-bg-elevated) 60%)`,
              }}
            >
              <AiCoachMark size="md" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--sr-text-primary)]">
                  {pl.aiCoachName}
                </p>
                <p className="text-xs text-[var(--sr-text-secondary)]">
                  {pl.aiAnalysisHint}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-[var(--sr-brand-primary)]">
                {pl.aiAnalyze}
              </span>
            </button>
          )}
          </>
        )}

        {tab === 'history' && (
          <HistoryPanel
            allSessions={allSessions}
            customPlanNames={customPlanNames}
            enabledPrograms={settings.enabledPrograms}
            currentCycleId={progress?.cycleId}
            navigate={navigate}
          />
        )}

        {tab === 'achievements' && (
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

        {tab === 'history' && (
          <div className="mt-4">
            <AiWorkoutAnalysis />
          </div>
        )}
      </div>

      <ExerciseDetailSheet
        open={detailExercise != null}
        exercise={detailExercise}
        onClose={() => setDetailExercise(null)}
      />
    </div>
  )
}
