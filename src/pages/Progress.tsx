import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import { OverviewPanel } from '@/components/progress/OverviewPanel'
import { HistoryPanel } from '@/components/progress/HistoryPanel'
import { AiWorkoutAnalysis } from '@/components/progress/AiWorkoutAnalysis'
import { BodyWeightSection } from '@/components/progress/BodyWeightSection'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { PageHeader } from '@/components/ui/PageHeader'
import { SkeletonCard, ErrorBanner } from '@/components/ux/Feedback'
import { db } from '@/lib/db'
import { getProgramProgress } from '@/lib/program-service'
import {
  getProgramStats,
  getProgramRecordsWithDates,
  getProgramVolumeStats,
  getDayCycleTrend,
  getWeeklyVolumeChart,
  getMaxSetPerSession,
  type ProgramRecordsWithDates,
  type ProgramVolumeStats,
  type DayCycleTrend,
  type WeeklyVolumePoint,
  type SessionChartPoint,
  type ProgramStats,
} from '@/lib/stats-engine'
import { buildActivityInsights } from '@/lib/weekly-recap'
import { useAppStore } from '@/stores/app-store'
import { pl } from '@/i18n/pl'
import { TAB_PAGE_SHELL, FOCUS_RING } from '@/lib/ui-chrome'
import { cn } from '@/lib/utils'
import type { Program } from '@/data/plans/types'
import type { LocalProgramProgress, LocalWorkoutSession } from '@/lib/db'

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
import {
  computeCustomExercisePrs,
  getCustomVolumeStats,
  getCustomSessionChart,
  getCustomOverviewStats,
  getCustomWeeklyVolumeChart,
  type ExercisePr,
  type CustomVolumeStats,
  type CustomSessionChartPoint,
  type CustomOverviewStats,
  type CustomWeeklyVolumePoint,
} from '@/lib/custom-stats'
import { ExerciseDetailSheet } from '@/components/plans/ExerciseDetailSheet'
import type { ExerciseDefinition } from '@/lib/exercise-model'
import { isCustomProgressHistorySession, isProgressHistorySession } from '@/lib/progress-history'
import { isCustomWorkoutSession } from '@/lib/custom-session-utils'
import { AchievementGallery } from '@/components/achievements/AchievementGallery'
import { getAllUnlocks } from '@/lib/achievements/store'
import { buildAchievementSnapshot, emptyImpact } from '@/lib/achievements/snapshot'
import { fetchAuthorImpact } from '@/lib/achievements/community-impact'
import { pickInProgress } from '@/lib/achievements/evaluate'
import { runAchievementCheck } from '@/lib/achievements/schedule'
import type { LocalAchievementUnlock } from '@/lib/achievements/types'
import { ProgressChromeNav, type ProgressTab } from '@/components/progress/ProgressChromeNav'
import { ACHIEVEMENT_CATALOG } from '@/lib/achievements/catalog'

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

  // Program data (builtin) — loaded for ALL enabled programs
  const [programDataMap, setProgramDataMap] = useState<Map<Program, ProgramData>>(new Map())
  // All builtin sessions (pushups + pullups) for history — not just the selected program
  const [allBuiltinSessions, setAllBuiltinSessions] = useState<LocalWorkoutSession[]>([])

  // Custom data
  const [customPrs, setCustomPrs] = useState<ExercisePr[]>([])
  const [customSessionsAll, setCustomSessionsAll] = useState<LocalWorkoutSession[]>([])
  const [customPlanNames, setCustomPlanNames] = useState<Record<string, string>>({})
  const [customVolumeStats, setCustomVolumeStats] = useState<CustomVolumeStats | null>(null)
  const [customSessionChart, setCustomSessionChart] = useState<CustomSessionChartPoint[]>([])
  const [customOverviewStats, setCustomOverviewStats] = useState<CustomOverviewStats | null>(null)
  const [customWeeklyVolumeChart, setCustomWeeklyVolumeChart] = useState<CustomWeeklyVolumePoint[]>([])
  const [exerciseMap, setExerciseMap] = useState<Map<string, { name: string }>>(new Map())

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
        // Load data for ALL enabled programs
        const enabled = settings.enabledPrograms
        const dataMap = new Map<Program, ProgramData>()
        for (const prog of enabled) {
          const p = await getProgramProgress(prog)
          const progStats = p ? await getProgramStats(prog, p) : null
          const dayCycleTrend = p ? await getDayCycleTrend(prog, p.cycleId, p.cycleAttempt) : []
          const sess = await db.workoutSessions.where('program').equals(prog).toArray()
          sess.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
          dataMap.set(prog, {
            program: prog,
            progress: p,
            stats: progStats,
            sessions: sess,
            recordsWithDates: await getProgramRecordsWithDates(prog),
            volumeStats: await getProgramVolumeStats(prog),
            dayCycleTrend,
            weeklyVolumeChart: await getWeeklyVolumeChart(prog),
            maxSetChart: await getMaxSetPerSession(prog),
          })
        }
        setProgramDataMap(dataMap)

        // All builtin sessions (pushups + pullups) for history tab — exclude custom
        const builtinHistory = (await db.workoutSessions.toArray())
          .filter((s) => isProgressHistorySession(s) && !isCustomWorkoutSession(s))
          .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        setAllBuiltinSessions(builtinHistory)

        // Custom data
        setCustomPrs(await computeCustomExercisePrs())
        setCustomVolumeStats(await getCustomVolumeStats())
        setCustomSessionChart(await getCustomSessionChart())
        setCustomOverviewStats(await getCustomOverviewStats())
        setCustomWeeklyVolumeChart(await getCustomWeeklyVolumeChart())
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

        // Exercise map for 1RM estimation
        const allExercises = await db.exercises.toArray()
        const exMap = new Map<string, { name: string }>()
        for (const ex of allExercises) {
          if (!ex.archived) exMap.set(ex.id, { name: ex.name })
        }
        setExerciseMap(exMap)

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
    () => [...allBuiltinSessions, ...customSessionsAll],
    [allBuiltinSessions, customSessionsAll],
  )

  const hasAnyData =
    [...programDataMap.values()].some((d) => d.sessions.length > 0) ||
    customSessionsAll.length > 0

  const activityInsights = useMemo(() => {
    const passed = allSessions.filter((s) => s.status === 'completed' && s.passed)
    return buildActivityInsights(passed)
  }, [allSessions])

  const totalPassedSessions =
    [...programDataMap.values()].reduce(
      (sum, d) => sum + (d.stats?.passedSessionCount ?? 0),
      0,
    ) + customSessionsAll.filter((s) => s.status === 'completed').length
  const statusSubtitle =
    tab === 'achievements'
      ? pl.achievementsStatusCount(achievementUnlocks.length, ACHIEVEMENT_CATALOG.length)
      : tab === 'history'
        ? pl.progressHistoryCount(allSessions.filter(isProgressHistorySession).length)
        : totalPassedSessions === 0
          ? undefined
          : pl.progressStatusSessions(totalPassedSessions)

  if (loading) {
    return (
      <div className={TAB_PAGE_SHELL}>
        <PageHeader title={pl.navProgress} />
        <ProgressChromeNav tab={tab} onTabChange={selectTab} />
        <div className="space-y-6" aria-busy aria-label={pl.loading}>
          {/* Summary skeleton */}
          <SkeletonCard className="min-h-[10rem]" />
          {/* Streak heatmap skeleton */}
          <SkeletonCard className="min-h-[8rem]" />
          {/* Calendar skeleton */}
          <SkeletonCard className="min-h-[12rem]" />
          {/* Records skeleton */}
          <SkeletonCard className="min-h-[8rem]" />
        </div>
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
            programDataMap={programDataMap}
            enabledPrograms={settings.enabledPrograms}
            activity={activityInsights}
            allSessions={allSessions}
            customSessionsAll={customSessionsAll}
            customPrs={customPrs}
            customVolumeStats={customVolumeStats}
            customSessionChart={customSessionChart}
            customOverviewStats={customOverviewStats}
            customPlanNames={customPlanNames}
            customWeeklyVolumeChart={customWeeklyVolumeChart}
            onOpenExercise={(id) => void openExerciseDetail(id)}
            navigate={navigate}
            exerciseMap={exerciseMap}
            weightUnit={settings.weightUnit}
          />
          {/* AI Coach teaser — discoverability for analysis feature */}
          {hasAnyData && (
            <button
              type="button"
              onClick={() => selectTab('history')}
              aria-label={pl.aiCoachName}
              className={cn(
                FOCUS_RING,
                'sr-coach-msg-in mt-6 flex min-h-11 w-full items-center gap-3 rounded-[var(--sr-radius-lg)] border border-[var(--sr-brand-primary)]/30 p-4 text-left shadow-[var(--sr-shadow-card)] transition-colors hover:bg-[var(--sr-bg-surface)]',
              )}
              style={{
                backgroundImage: `linear-gradient(135deg, color-mix(in srgb, var(--sr-brand-primary) 8%, var(--sr-bg-elevated)) 0%, var(--sr-bg-elevated) 60%)`,
              }}
            >
              <AiCoachMark size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--sr-text-primary)]">
                  {pl.aiCoachName}
                </p>
                <p className="truncate text-xs text-[var(--sr-text-secondary)]">
                  {pl.aiAnalysisHint}
                </p>
              </div>
              <span className="shrink-0 text-xs font-medium text-[var(--sr-brand-primary)]">
                {pl.aiAnalyze}
              </span>
            </button>
          )}
          {/* Body weight tracking — also on overview for discoverability */}
          <div className="mt-6">
            <BodyWeightSection />
          </div>
          </>
        )}

        {tab === 'history' && (
          <HistoryPanel
            allSessions={allSessions}
            customPlanNames={customPlanNames}
            enabledPrograms={settings.enabledPrograms}
            currentCycleId={programDataMap.values().next().value?.progress?.cycleId}
            navigate={navigate}
            onSessionDeleted={() => setReloadEpoch((n) => n + 1)}
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
