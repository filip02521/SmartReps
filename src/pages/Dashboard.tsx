import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSeo } from '@/hooks/useSeo'
import { LogoFull, LogoMark } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
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
import { pl } from '@/i18n/pl'
import { showToast } from '@/stores/toast-store'
import { TAB_PAGE_SHELL } from '@/lib/ui-chrome'
import { useAppStore } from '@/stores/app-store'
import { useStoreHydrated } from '@/hooks/useStoreHydrated'
import { beginLevelChange } from '@/lib/setup-flow'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { db, type LocalAiInsight } from '@/lib/db'
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
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasSession, setHasSession] = useState<boolean | null>(null)
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
      .then((result) => {
        if (!cancelled) {
          setHome(result)
          setLoading(false)
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
        const anyExisting = await db.aiInsights
          .where('weekKey')
          .equals(weekKey)
          .filter((i) => i.type === 'weekly_report')
          .first()
        if (anyExisting) {
          if (!cancelled && !anyExisting.dismissedAt) setWeeklyReport(anyExisting)
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

      const settings = useAppStore.getState().settings
      const aiConfig = settings.aiProactiveCoach && settings.aiApiKey
        ? { apiKey: settings.aiApiKey, model: settings.aiModel ?? 'gpt-4o-mini', baseURL: settings.aiBaseUrl || undefined }
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
            if (cancelled) return
            if (forceRegenerate) {
              const old = await db.aiInsights.where('weekKey').equals(weekKey).filter((i) => i.type === 'weekly_report').toArray()
              await Promise.all(old.map((r) => db.aiInsights.delete(r.id)))
            }
            await db.aiInsights.put(report)
            void enqueueSync('ai_insights', 'insert', report)
            setWeeklyReport(report)
            if (forceRegenerate) {
              const next = new URLSearchParams(searchParams)
              next.delete('weekly_report')
              setSearchParams(next, { replace: true })
            }
          } catch {
            // Non-blocking
          }
          return
        }
        acquireInflight()
      }

      try {
        const [sessions, exercises] = await Promise.all([
          db.workoutSessions.toArray(),
          listExercises(),
        ])
        const report = await generateWeeklyReport({ sessions, exercises, aiConfig, signal: controller.signal })
        if (cancelled) return
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
        // Non-blocking
      } finally {
        if (aiConfig) releaseInflight()
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
          <SkeletonCard className="min-h-[5rem]" />
          <SkeletonCard className="min-h-[7rem]" />
          <SkeletonCard className="min-h-[18rem]" />
        </div>
      ) : home ? (
        <>
          <HomeStatusHeader summary={home.summary} />

          {/* Quick activity stats — visible immediately under today's status */}
          <HomeActivitySection summary={home.summary} />

          {/* Proactive coach: weekly report card */}
          {weeklyReport && !weeklyReport.dismissedAt && (
            <WeeklyReportCard
              insight={weeklyReport}
              onDismissed={() => setWeeklyReport(null)}
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
              <p className="sr-text-overline text-[var(--sr-text-muted)]">
                {pl.homeStartTraining}
              </p>
              <div className="mt-3 flex flex-col gap-3">
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
