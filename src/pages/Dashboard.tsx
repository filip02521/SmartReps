import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import { LogoFull, LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { PageLoader, SkeletonCard, EmptyState, ErrorBanner } from '@/components/ux/Feedback'
import {
  HomeStatusHeader,
  HomeActivitySection,
} from '@/components/dashboard/HomeSummary'
import { HomeTip } from '@/components/dashboard/HomeTip'
import { ProgramHomeCard } from '@/components/dashboard/ProgramHomeCard'
import { CustomPlansHomeSection } from '@/components/dashboard/CustomPlansHomeSection'
import { CommunityHomeTeaser } from '@/components/dashboard/CommunityHomeTeaser'
import { InstallCoach } from '@/components/ux/InstallCoach'
import { WeeklyReportCard } from '@/components/dashboard/WeeklyReportCard'
import { AiCoachMark } from '@/components/brand/AiCoachMark'
import { pl } from '@/i18n/pl'
import { showToast } from '@/stores/toast-store'
import { TAB_PAGE_SHELL } from '@/lib/ui-chrome'
import { Dumbbell } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { beginLevelChange } from '@/lib/setup-flow'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { db, type LocalAiInsight, type LocalWorkoutSession } from '@/lib/db'
import { enqueueSync } from '@/lib/sync'
import { generateWeeklyReport } from '@/lib/ai/proactive-coach'
import {
  checkRateLimit,
  acquireInflight,
  releaseInflight,
  recordCall,
  formatCooldownRemaining,
} from '@/lib/ai/rate-limiter'
import { listExercises } from '@/lib/custom-plan-service'
import { getWeekKey, startOfLocalWeek } from '@/lib/stats-engine'
import {
  loadHomeDashboard,
  localDayKey,
  type HomeLoadResult,
} from '@/lib/home-summary'
import type { Program } from '@/data/plans/types'

function scrollToProgram(program: Program) {
  const el = document.getElementById(`program-${program}`)
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

export default function Dashboard() {
  const settings = useAppStore((s) => s.settings)
  const dismissedHomeTipId = useAppStore((s) => s.dismissedHomeTipId)
  const dismissedHomeTipDay = useAppStore((s) => s.dismissedHomeTipDay)
  useSeo({ title: pl.seoDashboardTitle, description: pl.seoDashboardDescription, path: '/' })
  const hasCompletedFirstWorkout = useAppStore((s) => s.hasCompletedFirstWorkout)
  const dismissedLoginBackupTip = useAppStore((s) => s.dismissedLoginBackupTip)
  const dismissedHabitMetTip = useAppStore((s) => s.dismissedHabitMetTip)
  const hasSeenLoginCloudPrompt = useAppStore((s) => s.hasSeenLoginCloudPrompt)
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt)
  const dismissHomeTip = useAppStore((s) => s.dismissHomeTip)
  const setDismissedLoginBackupTip = useAppStore((s) => s.setDismissedLoginBackupTip)
  const setDismissedHabitMetTip = useAppStore((s) => s.setDismissedHabitMetTip)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const hydrated = useStoreHydrated()
  const [reloadEpoch, setReloadEpoch] = useState(0)
  const [home, setHome] = useState<HomeLoadResult | null>(null)
  const [weeklyReport, setWeeklyReport] = useState<LocalAiInsight | null>(null)
  const [weeklyReportGenerating, setWeeklyReportGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
  const [heatmapSessions, setHeatmapSessions] = useState<LocalWorkoutSession[]>([])
  /** null = InstallCoach not yet reported — tip withheld to avoid dual attention. */
  const [installVisible, setInstallVisible] = useState<boolean | null>(null)

  const onInstallVisibility = useCallback((v: boolean) => {
    setInstallVisible(v)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    if (!isSupabaseConfigured) {
      setHasSession(false)
      return
    }
    void supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session))
  }, [hydrated, reloadEpoch])

  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    const showLoginBackup =
      installVisible === false &&
      hasCompletedFirstWorkout &&
      !dismissedLoginBackupTip &&
      !hasSeenLoginCloudPrompt &&
      hasSession === false
    void loadHomeDashboard(settings.enabledPrograms, {
      dismissedHomeTipId,
      dismissedHomeTipDay,
      showLoginBackup,
      dismissedHabitMetTip,
    })
      .then(async (result) => {
        if (!cancelled) {
          setHome(result)
          setLoading(false)
          // Load sessions for streak heatmap
          try {
            const sessions = await db.workoutSessions.toArray()
            if (!cancelled) setHeatmapSessions(sessions)
          } catch {
            /* ignore — heatmap is non-critical */
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHome(null)
          setLoadError(pl.errorLoadHome)
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [
    hydrated,
    settings.enabledPrograms,
    reloadEpoch,
    lastSyncedAt,
    dismissedHomeTipId,
    dismissedHomeTipDay,
    installVisible,
    hasCompletedFirstWorkout,
    dismissedLoginBackupTip,
    dismissedHabitMetTip,
    hasSeenLoginCloudPrompt,
    hasSession,
  ])

  useEffect(() => {
    if (!hydrated || loading || !home) return
    const programParam = searchParams.get('program')
    if (programParam !== 'pushups' && programParam !== 'pullups') return
    scrollToProgram(programParam)
    setSearchParams({}, { replace: true })
  }, [hydrated, loading, home, searchParams, setSearchParams])

  // Proactive coach: weekly report — generate on demand or on Sunday
  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    const controller = new AbortController()
    void (async () => {
      const weekKey = getWeekKey(new Date())
      const forceRegenerate = searchParams.get('weekly_report') === 'force'
      // Check for ANY existing report this week (including dismissed).
      // If any exists (even dismissed), don't regenerate — respect user's dismissal.
      // Exception: ?weekly_report=force bypasses cache (for testing/fixing stale reports).
      if (!forceRegenerate) {
        const allExisting = await db.aiInsights
          .where('weekKey')
          .equals(weekKey)
          .filter((i) => i.type === 'weekly_report')
          .toArray()
        if (allExisting.length > 0) {
          // Prefer AI source, then most recent createdAt
          const best = allExisting.sort((a, b) => {
            if (a.source === 'ai' && b.source !== 'ai') return -1
            if (a.source !== 'ai' && b.source === 'ai') return 1
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          })[0]
          // Clean up duplicate reports for the same week (keep only the best)
          if (allExisting.length > 1) {
            const duplicates = allExisting.filter((r) => r.id !== best.id)
            await Promise.all(duplicates.map((r) => db.aiInsights.delete(r.id)))
          }
          if (!cancelled && !best.dismissedAt) setWeeklyReport(best)
          return
        }
      }
      // Generate on Sundays, on explicit request, or when user has completed workouts
      const isSunday = new Date().getDay() === 0
      const hasReportParam = forceRegenerate
      // Check if user has any completed sessions this week
      const weekStart = startOfLocalWeek(new Date())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekStart.getDate() + 7)
      const weekSessions = await db.workoutSessions
        .filter((s) => s.status === 'completed' && new Date(s.startedAt) >= weekStart && new Date(s.startedAt) < weekEnd)
        .count()
      if (!isSunday && !hasReportParam && weekSessions === 0) return

      // Generation starts here — show placeholder until report is ready
      setWeeklyReportGenerating(true)

      const settings = useAppStore.getState().settings
      const aiConfig = settings.aiProactiveCoach && settings.aiApiKey
        ? { apiKey: settings.aiApiKey, model: settings.aiModel ?? 'gpt-4o-mini', baseURL: settings.aiBaseUrl || undefined, reasoningEffort: settings.aiReasoningEffort }
        : undefined

      // Rate limit check — only for AI calls (local fallback is free)
      if (aiConfig) {
        const rl = checkRateLimit('weekly_report')
        if (!rl.allowed) {
          // For auto-fire: silently use local fallback
          // For force: show error via local fallback
          if (forceRegenerate && rl.reason === 'cooldown') {
            showToast(pl.aiRateLimitCooldown(formatCooldownRemaining(rl.retryAfterMs)), 'warning')
          }
          // Generate local report instead
          try {
            const [sessions, exercises] = await Promise.all([
              db.workoutSessions.toArray(),
              listExercises(),
            ])
            const report = await generateWeeklyReport({ sessions, exercises, aiConfig: undefined, signal: controller.signal })
            if (cancelled) { setWeeklyReportGenerating(false); return }
            if (forceRegenerate) {
              const old = await db.aiInsights.where('weekKey').equals(weekKey).filter((i) => i.type === 'weekly_report').toArray()
              await Promise.all(old.map((r) => db.aiInsights.delete(r.id)))
            }
            await db.aiInsights.put(report)
            void enqueueSync('ai_insights', 'insert', report)
            setWeeklyReport(report)
            setWeeklyReportGenerating(false)
            if (forceRegenerate) {
              const next = new URLSearchParams(searchParams)
              next.delete('weekly_report')
              setSearchParams(next, { replace: true })
            }
          } catch {
            setWeeklyReportGenerating(false)
            // Non-blocking
          }
          return
        }
        acquireInflight('weekly_report')
      }

      try {
        const [sessions, exercises] = await Promise.all([
          db.workoutSessions.toArray(),
          listExercises(),
        ])
        const report = await generateWeeklyReport({ sessions, exercises, aiConfig, signal: controller.signal })
        if (cancelled) { setWeeklyReportGenerating(false); return }
        // Record successful AI call
        if (report.source === 'ai') {
          recordCall('weekly_report')
        }
        // When forcing with AI configured, don't overwrite AI report with local fallback
        if (forceRegenerate && aiConfig && report.source !== 'ai') {
          // AI failed — keep existing report if any, don't save local fallback
          const existing = await db.aiInsights
            .where('weekKey')
            .equals(weekKey)
            .filter((i) => i.type === 'weekly_report' && !i.dismissedAt)
            .first()
          if (existing) {
            setWeeklyReport(existing)
          } else {
            // No existing report — save local as last resort
            await db.aiInsights.put(report)
            void enqueueSync('ai_insights', 'insert', report)
            setWeeklyReport(report)
          }
          const next = new URLSearchParams(searchParams)
          next.delete('weekly_report')
          setSearchParams(next, { replace: true })
          return
        }
        // When forcing, delete old reports for this week first
        if (forceRegenerate) {
          const old = await db.aiInsights
            .where('weekKey')
            .equals(weekKey)
            .filter((i) => i.type === 'weekly_report')
            .toArray()
          await Promise.all(old.map((r) => db.aiInsights.delete(r.id)))
        }
        await db.aiInsights.put(report)
        void enqueueSync('ai_insights', 'insert', report)
        setWeeklyReport(report)
        // Clear force param after report is saved so re-entry doesn't regenerate
        if (forceRegenerate) {
          const next = new URLSearchParams(searchParams)
          next.delete('weekly_report')
          setSearchParams(next, { replace: true })
        }
      } catch {
        setWeeklyReportGenerating(false)
        // Non-blocking
      } finally {
        setWeeklyReportGenerating(false)
        if (aiConfig) releaseInflight('weekly_report')
      }
    })()
    return () => { cancelled = true; controller.abort() }
  }, [hydrated, hasCompletedFirstWorkout, reloadEpoch, searchParams, setSearchParams])

  if (!hydrated) {
    return (
      <div className={TAB_PAGE_SHELL}>
        <PageLoader />
      </div>
    )
  }

  const reload = () => setReloadEpoch((n) => n + 1)
  const showTip = installVisible === false && !!home?.tip
  const tipSuppression = home?.tip
    ? home.tipSuppression
    : { stale: false, test: false, level: false }

  return (
    <div className={TAB_PAGE_SHELL}>
      <header className="mb-5">
        <LogoFull height={36} />
        <h1 className="sr-only">{pl.navWorkout}</h1>
      </header>

      {loadError && (
        <ErrorBanner
          message={loadError}
          onRetry={() => {
            setLoadError(null)
            reload()
          }}
        />
      )}

      {loading && !home ? (
        <div className="space-y-4" aria-busy aria-label={pl.loading}>
          {/* Status header skeleton */}
          <SkeletonCard className="min-h-[5rem]" />
          {/* Activity metrics skeleton */}
          <SkeletonCard className="min-h-[7rem]" />
          {/* Program cards skeleton */}
          <SkeletonCard className="min-h-[14rem]" />
          <SkeletonCard className="min-h-[14rem]" />
        </div>
      ) : home ? (
        <>
          <HomeStatusHeader summary={home.summary} />

          {/* Quick activity stats + streak heatmap — visible immediately under today's status */}
          <HomeActivitySection summary={home.summary} sessions={heatmapSessions} />

          {/* Proactive coach: weekly report card */}
          {weeklyReportGenerating && !weeklyReport && (
            <section
              aria-busy
              aria-live="polite"
              className="sr-coach-msg-in mb-6 overflow-hidden rounded-[var(--sr-radius-lg)] border border-[var(--sr-border-subtle)] bg-[var(--sr-bg-elevated)] shadow-[var(--sr-shadow-card)]"
            >
              <div className="flex items-center gap-3 border-b border-[var(--sr-border-subtle)] bg-[color-mix(in_srgb,var(--sr-brand-primary-muted)_30%,transparent)] p-4">
                <AiCoachMark size="sm" pulse />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold leading-tight text-[var(--sr-text-primary)]">
                    {pl.coachWeeklyReportTitle}
                  </h3>
                  <p className="mt-0.5 animate-pulse text-xs text-[var(--sr-text-muted)]">
                    {pl.coachWeeklyReportGenerating}
                  </p>
                </div>
              </div>
              {/* Skeleton metrics grid — mirrors the real 4-tile layout */}
              <div className="grid grid-cols-4 gap-2 p-4">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="flex h-14 animate-pulse flex-col items-center justify-center gap-1 rounded-[var(--sr-radius-sm)] bg-[var(--sr-bg-surface)]"
                  >
                    <div className="h-3 w-8 rounded bg-[var(--sr-border-subtle)]" />
                    <div className="h-2 w-10 rounded bg-[var(--sr-border-subtle)]" />
                  </div>
                ))}
              </div>
            </section>
          )}
          {weeklyReport && !weeklyReport.dismissedAt && (
            <WeeklyReportCard
              key={weeklyReport.id}
              insight={weeklyReport}
              onDismissed={() => setWeeklyReport(null)}
              onConnectAi={() => navigate('/profile')}
              onRegenerate={() => setSearchParams({ weekly_report: 'force' }, { replace: true })}
              regenerating={weeklyReportGenerating}
            />
          )}

          <div className="mt-4">
            <InstallCoach demotePrimary onVisibilityChange={onInstallVisibility} />

            {showTip && home.tip && (
              <HomeTip
                tip={home.tip}
                onDismiss={(id) => {
                  dismissHomeTip(id, localDayKey())
                  if (home.tip?.kind === 'login_backup') {
                    setDismissedLoginBackupTip(true)
                  }
                  if (home.tip?.kind === 'habit_met') {
                    setDismissedHabitMetTip(true)
                  }
                }}
                onAction={(program) => {
                  if (home.tip?.kind === 'dual_program' && home.tip.actionProgram) {
                    navigate(`/setup/test/${home.tip.actionProgram}`)
                    return
                  }
                  void beginLevelChange(navigate, program)
                }}
                onNavigate={(path) => navigate(path, { state: { returnTo: '/' } })}
                onScroll={scrollToProgram}
              />
            )}
          </div>

          {settings.enabledPrograms.length === 0 ? (
            <EmptyState
              icon={<LogoMark size={48} />}
              title={pl.noProgramsTitle}
              description={pl.noProgramsDesc}
              action={{
                label: pl.noProgramsCreatePlan,
                onClick: () => navigate('/plans?tab=mine'),
              }}
              secondaryAction={{
                label: pl.noProgramsGoProfile,
                onClick: () => navigate('/profile'),
              }}
            />
          ) : (
            <section aria-label={pl.homeStartTraining} className="mt-6">
              <SectionHeader icon={Dumbbell} title={pl.homeStartTraining} />
              <div className="flex flex-col gap-3">
                <CustomPlansHomeSection embedded />
                {home.cards.map((card) => (
                  <ProgramHomeCard
                    key={`${card.program}-${reloadEpoch}`}
                    model={card}
                    allResting={home.summary.allResting}
                    tipSuppression={tipSuppression}
                    onReload={reload}
                  />
                ))}
              </div>
              {settings.enabledPrograms.length === 1 && (
                <Button
                  variant="ghost"
                  fullWidth
                  className="mt-4"
                  onClick={() => navigate('/profile')}
                >
                  {pl.homeAddSecondProgram}
                </Button>
              )}
            </section>
          )}

          {/* Cards only when custom-only — EmptyState above already owns create CTAs */}
          {settings.enabledPrograms.length === 0 && (
            <CustomPlansHomeSection hideEmptyDiscover />
          )}

          <CommunityHomeTeaser />
        </>
      ) : null}
    </div>
  )
}
